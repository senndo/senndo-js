/**
 * Vérification de la signature d'un webhook senndo.
 *
 * Chaque livraison porte `X-Senndo-Signature: t=<unix>,v1=<hex>`, où `v1` est le HMAC-SHA256 de
 * `${t}.${corps}` sous le secret `whsec_…` rendu à la création de l'endpoint. La signature est
 * recalculée à CHAQUE tentative : une tolérance de quelques minutes sur `t` ne rejette donc
 * jamais une retentative légitime, et refuse un rejeu ancien.
 *
 * Web Crypto d'abord (Node ≥ 19, navigateurs, runtimes edge) ; `node:crypto` en repli pour Node 18,
 * chargé seulement si nécessaire pour ne pas casser un bundle non Node.
 */

/** Options de {@link verifyWebhookSignature}. */
export interface VerifyWebhookOptions {
  /** Écart maximal accepté entre `t` et l'horloge locale, en secondes. Défaut : 300. */
  toleranceSeconds?: number
  /** Horloge injectable (secondes Unix), pour les tests. */
  now?: () => number
}

const SIGNATURE_RE = /^t=(\d+),v1=([0-9a-f]{64})$/

// Le sous-ensemble de Web Crypto utilisé ici, déclaré localement : la bibliothèque publiée se
// compile sans les types DOM ni Node (`types: []`), et n'en a besoin que de ces deux appels.
interface HmacSubtle {
  importKey(
    format: 'raw',
    key: Uint8Array,
    algorithm: { name: 'HMAC'; hash: 'SHA-256' },
    extractable: false,
    usages: ['sign'],
  ): Promise<unknown>
  sign(algorithm: 'HMAC', key: unknown, data: Uint8Array): Promise<ArrayBuffer>
}
interface WebCryptoLike {
  subtle?: HmacSubtle
}
type Utf8Encoder = new () => { encode(input: string): Uint8Array }

async function subtle(): Promise<HmacSubtle> {
  const global = (globalThis as { crypto?: WebCryptoLike }).crypto
  if (global?.subtle !== undefined) return global.subtle
  // Spécificateur NON littéral : ni le compilateur (`types: []`, aucun global Node) ni un bundler
  // non Node ne le résolvent à la construction. Il n'est évalué que sur Node 18.
  const specifier = 'node:crypto'
  const node = (await import(/* @vite-ignore */ specifier)) as {
    webcrypto: Required<WebCryptoLike>
  }
  return node.webcrypto.subtle
}

function utf8(input: string): Uint8Array {
  const Encoder = (globalThis as { TextEncoder?: Utf8Encoder }).TextEncoder
  if (Encoder === undefined) throw new Error('senndo : TextEncoder indisponible dans ce runtime')
  return new Encoder().encode(input)
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Comparaison à durée constante pour deux chaînes de même longueur. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * `true` si l'en-tête `X-Senndo-Signature` authentifie `rawBody` sous `secret` et que son
 * horodatage est dans la tolérance. `rawBody` doit être le corps BRUT reçu, octet pour octet :
 * un JSON re-sérialisé ne vérifie pas.
 */
export async function verifyWebhookSignature(
  secret: string,
  header: string | null | undefined,
  rawBody: string,
  options: VerifyWebhookOptions = {},
): Promise<boolean> {
  if (typeof header !== 'string' || secret === '') return false
  const match = SIGNATURE_RE.exec(header.trim())
  if (match === null) return false
  const timestamp = Number(match[1])
  const now = options.now?.() ?? Math.floor(Date.now() / 1000)
  if (Math.abs(now - timestamp) > (options.toleranceSeconds ?? 300)) return false
  const crypto = await subtle()
  const key = await crypto.importKey(
    'raw',
    utf8(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const expected = toHex(await crypto.sign('HMAC', key, utf8(`${timestamp}.${rawBody}`)))
  return constantTimeEqual(expected, match[2] as string)
}
