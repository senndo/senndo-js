/**
 * Le transport : URL, en-têtes, délais, retentatives, multipart.
 *
 * LA POLITIQUE DE RETENTATIVE EST LA PARTIE DANGEREUSE DE CE FICHIER, et elle tient en une phrase :
 * **on ne rejoue que ce qui est rejouable**. Rejouer un `POST /v1/messages` sans clé d'idempotence,
 * c'est facturer deux messages ; rejouer un `POST /v1/webhooks`, c'est créer deux endpoints, donc
 * DOUBLER toutes les livraisons futures. Un enrobage de `fetch` avec `retry: 3` fait exactement
 * cela, en silence, et la facture arrive plus tard.
 *
 * La règle appliquée, sans exception :
 *   - `GET` et `DELETE` sont rejouables — la sémantique HTTP le garantit.
 *   - un `POST` n'est rejouable QUE s'il porte une clé d'idempotence non vide dans son corps.
 *     C'est le cas de `sendMessage`, et d'aucune autre opération de la surface.
 *   - un `POST` sans clé n'est JAMAIS rejoué, même sur 503, même sur coupure réseau. L'appelant
 *     reçoit l'échec et décide — avec le contexte que le SDK n'a pas.
 * Et, quelle que soit la rejouabilité, on ne retente que sur un échec de TRANSPORT, un 429 ou un
 * 5xx. Un 4xx rejoué à l'identique échoue à l'identique : le retenter ne fait que retarder le
 * moment où l'appelant lit son erreur.
 */
import {
  SenndoAbortError,
  SenndoConnectionError,
  SenndoRateLimitError,
  SenndoTimeoutError,
  errorFromResponse,
} from './errors.js'
import type { OperationDescriptor } from './generated/contract.js'
import type {
  AbortSignalLike,
  FetchLike,
  MultipartUpload,
  RequestOptions,
  ResponseLike,
} from './types.js'

/** Les globales dont le transport a besoin, décrites plutôt qu'importées (cf. `types.ts`). */
interface RuntimeGlobals {
  fetch?: FetchLike
  setTimeout?: (handler: () => void, timeout: number) => unknown
  clearTimeout?: (handle: unknown) => void
  TextEncoder?: new () => { encode(input: string): Uint8Array }
  AbortController?: new () => { signal: AbortSignalLike; abort(): void }
  crypto?: { randomUUID?: () => string; getRandomValues?: (a: Uint8Array) => Uint8Array }
}

const runtime = globalThis as unknown as RuntimeGlobals

const encodeText = (input: string): Uint8Array => {
  const Encoder = runtime.TextEncoder
  if (Encoder === undefined) {
    throw new Error('senndo: TextEncoder est absent de cette plateforme.')
  }
  return new Encoder().encode(input)
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    const timer = runtime.setTimeout
    if (timer === undefined) {
      resolve()
      return
    }
    timer(() => resolve(), ms)
  })

/**
 * Masque une clé API : les huit premiers caractères (le préfixe `sk_live_` / `sk_test_` reste
 * lisible, il dit l'environnement) puis des points. Utilisé par TOUTE représentation du client.
 */
export const maskApiKey = (apiKey: string): string =>
  apiKey.length <= 8 ? '…' : `${apiKey.slice(0, 8)}…${apiKey.length - 8} caractères masqués`

/** Un identifiant d'idempotence aléatoire — voir `newIdempotencyKey` dans `index.ts`. */
export const randomId = (): string => {
  const uuid = runtime.crypto?.randomUUID
  if (uuid !== undefined) return uuid.call(runtime.crypto)
  const bytes = new Uint8Array(16)
  const fill = runtime.crypto?.getRandomValues
  if (fill !== undefined) {
    fill.call(runtime.crypto, bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Construit le chemin en substituant les paramètres de chemin et en sérialisant la requête. */
export const buildUrl = (
  baseUrl: string,
  descriptor: OperationDescriptor,
  pathValues: Record<string, string>,
  query: Record<string, unknown> | undefined,
): string => {
  let path = descriptor.path
  for (const name of descriptor.pathParams) {
    const value = pathValues[name]
    if (value === undefined || value === '') {
      throw new Error(`senndo: paramètre de chemin « ${name} » manquant`)
    }
    path = path.replace(`{${name}}`, encodeURIComponent(value))
  }
  const pairs: string[] = []
  for (const name of descriptor.queryParams) {
    const value = query?.[name]
    // `null` vaut « non fourni » au même titre que `undefined` : un client qui passe le résultat
    // d'un champ de formulaire vide ne doit pas envoyer `?status=null`.
    if (value === undefined || value === null || value === '') continue
    pairs.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`)
  }
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  return `${base}${path}${pairs.length > 0 ? `?${pairs.join('&')}` : ''}`
}

/** Encode un téléversement en corps `multipart/form-data`, sans `FormData` ni `Blob`. */
export const encodeMultipart = (
  upload: MultipartUpload,
): { body: Uint8Array; contentType: string } => {
  const boundary = `----senndo${randomId().replace(/-/g, '')}`
  const bytes = upload.file instanceof Uint8Array ? upload.file : new Uint8Array(upload.file)
  const head = encodeText(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${upload.fileName.replace(/"/g, '')}"\r\n` +
      `Content-Type: ${upload.contentType ?? 'application/octet-stream'}\r\n\r\n`,
  )
  const tail = encodeText(`\r\n--${boundary}--\r\n`)
  const body = new Uint8Array(head.length + bytes.length + tail.length)
  body.set(head, 0)
  body.set(bytes, head.length)
  body.set(tail, head.length + bytes.length)
  return { body, contentType: `multipart/form-data; boundary=${boundary}` }
}

/**
 * Cet appel peut-il être REJOUÉ sans changer l'état du compte ?
 *
 * Exporté parce que c'est la décision la plus coûteuse du SDK : elle mérite d'être testée seule,
 * et lue sans dérouler la boucle de retentative.
 */
export const isReplayable = (
  descriptor: OperationDescriptor,
  body: Record<string, unknown> | undefined,
): boolean => {
  if (descriptor.method === 'GET' || descriptor.method === 'DELETE') return true
  const key = body?.['idempotencyKey']
  return typeof key === 'string' && key.length > 0
}

/** Cet échec vaut-il une retentative, indépendamment de la rejouabilité ? */
export const isTransient = (outcome: { kind: 'transport' } | { kind: 'status'; status: number }) =>
  outcome.kind === 'transport' || outcome.status === 429 || outcome.status >= 500

const backoffMs = (attempt: number, retryAfterSeconds: number | null): number => {
  if (retryAfterSeconds !== null) return Math.min(retryAfterSeconds * 1000, 60_000)
  // Exponentiel plafonné, plein jitter : sans jitter, N clients qui échouent ensemble retentent
  // ensemble et reproduisent la surcharge qu'ils devaient laisser retomber.
  const ceiling = Math.min(250 * 2 ** attempt, 8_000)
  return Math.random() * ceiling
}

export interface TransportConfig {
  apiKey: string
  baseUrl: string
  timeoutMs: number
  maxRetries: number
  fetchImpl: FetchLike
  userAgent: string
}

export interface CallSpec {
  descriptor: OperationDescriptor
  pathValues?: Record<string, string>
  query?: Record<string, unknown>
  body?: Record<string, unknown>
  upload?: MultipartUpload
}

/** Exécute un appel : en-têtes, délai, retentatives, désérialisation, erreurs typées. */
export const performRequest = async <T>(
  config: TransportConfig,
  spec: CallSpec,
  options: RequestOptions | undefined,
): Promise<T> => {
  const { descriptor } = spec
  const timeoutMs = options?.timeoutMs ?? config.timeoutMs
  const maxRetries = options?.maxRetries ?? config.maxRetries
  const url = buildUrl(config.baseUrl, descriptor, spec.pathValues ?? {}, spec.query)
  const replayable = isReplayable(descriptor, spec.body)

  const headers: Record<string, string> = {
    ...options?.headers,
    // Après l'étalement des en-têtes du client : `Authorization` n'est PAS surchargeable.
    // Le laisser l'être offrirait un moyen silencieux d'envoyer la requête d'un compte avec la
    // configuration d'un autre.
    Authorization: `Bearer ${config.apiKey}`,
    Accept: 'application/json',
    'User-Agent': config.userAgent,
  }

  let payload: string | Uint8Array | undefined
  if (spec.upload !== undefined) {
    const encoded = encodeMultipart(spec.upload)
    payload = encoded.body
    headers['Content-Type'] = encoded.contentType
  } else if (spec.body !== undefined) {
    payload = JSON.stringify(spec.body)
    headers['Content-Type'] = 'application/json'
  }

  // Lu à TRAVERS UNE FONCTION, jamais par accès direct : `aborted` est déclaré `readonly`, donc
  // TypeScript le fige à `false` après le premier test et supprimerait la branche d'annulation du
  // `catch` plus bas. Un signal change pourtant de valeur pendant l'`await` — c'est sa raison
  // d'être.
  const aborted = () => options?.signal?.aborted === true

  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    if (aborted()) {
      throw new SenndoAbortError(`senndo: « ${descriptor.operationId} » annulé.`)
    }

    let response: ResponseLike
    let timedOut = false
    const controller = runtime.AbortController === undefined ? null : new runtime.AbortController()
    const timer =
      controller === null
        ? null
        : (runtime.setTimeout?.(() => {
            timedOut = true
            controller.abort()
          }, timeoutMs) ?? null)
    const forwardAbort = () => controller?.abort()
    options?.signal?.addEventListener('abort', forwardAbort)

    try {
      response = await config.fetchImpl(url, {
        method: descriptor.method,
        headers,
        ...(payload === undefined ? {} : { body: payload }),
        ...(controller === null ? {} : { signal: controller.signal }),
      })
    } catch (cause) {
      lastError = timedOut
        ? new SenndoTimeoutError(timeoutMs, descriptor.operationId)
        : aborted()
          ? new SenndoAbortError(`senndo: « ${descriptor.operationId} » annulé.`)
          : new SenndoConnectionError(descriptor.operationId, cause)
      if (lastError instanceof SenndoAbortError) throw lastError
      if (!replayable || !isTransient({ kind: 'transport' }) || attempt === maxRetries) {
        throw lastError
      }
      await sleep(backoffMs(attempt, null))
      continue
    } finally {
      if (timer !== null) runtime.clearTimeout?.(timer)
      options?.signal?.removeEventListener('abort', forwardAbort)
    }

    if (response.status >= 200 && response.status < 300) {
      if (response.status === 204) return undefined as T
      const text = await response.text()
      if (text === '') return undefined as T
      return JSON.parse(text) as T
    }

    const text = await response.text()
    const error = errorFromResponse(
      response.status,
      text,
      descriptor.operationId,
      response.headers.get('retry-after'),
    )
    lastError = error
    if (!replayable || !isTransient({ kind: 'status', status: response.status })) throw error
    if (attempt === maxRetries) throw error
    const retryAfter = error instanceof SenndoRateLimitError ? error.retryAfterSeconds : null
    await sleep(backoffMs(attempt, retryAfter))
  }

  throw lastError
}
