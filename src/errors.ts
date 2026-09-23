/**
 * Les erreurs typées — ce qui sépare un SDK d'un enrobage de `fetch`.
 *
 * LA RÈGLE : ON BRANCHE SUR UNE CLASSE OU SUR UN CODE, JAMAIS SUR UN MESSAGE. Le contrat le dit
 * explicitement (`error.code` est stable, `error.message` est un libellé humain qui évolue). Un
 * SDK qui lèverait `new Error(body)` forcerait chaque intégrateur à lire une chaîne pour savoir
 * s'il doit recharger le compte ou corriger son appel — et à la relire le jour où le libellé
 * change.
 *
 * LA FAMILLE VIENT DU STATUT HTTP, PAS DU CODE. Les statuts sont peu nombreux et stables ; les
 * codes, eux, s'ajoutent (senndo s'y engage). Une classe par code aurait rendu toute nouvelle
 * valeur amont invisible du `catch` d'un client déjà déployé. Le code reste donc lisible sur
 * `error.code`, en union OUVERTE, et c'est le statut qui choisit la classe.
 */

/** Les codes d'erreur connus de cette version — l'union reste ouverte, senndo en ajoute. */
export type SenndoErrorCode =
  | 'VALIDATION'
  | 'INVALID_INPUT'
  | 'COUNTRY_INVALID'
  | 'INVALID_CURRENCY'
  | 'CURRENCY_NOT_ARMED'
  | 'INVALID_THREAD'
  | 'UNAUTHORIZED'
  | 'INSUFFICIENT_FUNDS'
  | 'IP_NOT_ALLOWED'
  | 'ACCOUNT_SUSPENDED'
  | 'BLOCKED_CONTENT'
  | 'BLOCKED_SENDER'
  | 'BLOCKED_DESTINATION'
  | 'TEST_KEY_FORBIDDEN'
  | 'SENDER_SESSION_FORBIDDEN'
  | 'NOT_FOUND'
  | 'MEDIA_NOT_FOUND'
  | 'MEDIA_IN_USE'
  | 'IDEMPOTENCY_MODE_MISMATCH'
  | 'IDEMPOTENCY_PAYLOAD_MISMATCH'
  | 'STORAGE_QUOTA_EXCEEDED'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_TYPE'
  | 'NO_ROUTE'
  | 'DESTINATION_NOT_SERVED'
  | 'TIER_NOT_SERVED'
  | 'PRICE_NOT_FOUND'
  | 'PRICE_CHAIN_INCOMPLETE'
  | 'SENDER_HAS_NO_PARENT'
  | 'VELOCITY_EXCEEDED'
  | 'RATE_LIMITED'
  | 'TOO_MANY_UPLOADS'
  | 'WEBHOOK_ENDPOINT_LIMIT'
  | 'PROVIDER_UNAVAILABLE'
  | 'WEBHOOKS_DISABLED'
  | (string & {})

/** La racine de toute erreur levée par ce SDK. `catch (e) { if (e instanceof SenndoError) … }` */
export class SenndoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
    // Sans cette ligne, `instanceof` échoue quand le paquet est transpilé vers ES5 par l'outil
    // du consommateur — une classe étendant `Error` y perd sa chaîne de prototype.
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * Une erreur levée AVANT tout appel réseau : le SDK a détecté que la requête serait refusée.
 *
 * Elle n'a pas de statut parce qu'aucune requête n'est partie — et c'est l'intérêt : un champ
 * obligatoire absent ne coûte ni un aller-retour ni, sur un canal facturé, le risque d'un débit.
 */
export class SenndoRequestError extends SenndoError {}

/** L'appel a dépassé le délai imparti. Ce que le serveur en a fait reste INCONNU. */
export class SenndoTimeoutError extends SenndoError {
  constructor(
    /** Le délai dépassé, en millisecondes. */
    readonly timeoutMs: number,
    operationId: string,
  ) {
    super(
      `senndo: « ${operationId} » a dépassé le délai de ${timeoutMs} ms. L'état côté serveur est ` +
        `INDÉTERMINÉ : sur un envoi, relisez GET /v1/messages avec votre clé d'idempotence avant ` +
        `de renvoyer — un délai dépassé ne prouve pas que rien n'est parti.`,
    )
  }
}

/** L'appel a été annulé par le signal fourni. */
export class SenndoAbortError extends SenndoError {}

/** Le transport a échoué : DNS, TLS, coupure. Aucune réponse HTTP n'a été reçue. */
export class SenndoConnectionError extends SenndoError {
  constructor(
    operationId: string,
    /** L'erreur d'origine remontée par `fetch`. */
    readonly cause: unknown,
  ) {
    super(`senndo: « ${operationId} » n'a pas abouti (échec de transport).`)
  }
}

/** Le serveur a répondu, mais avec une enveloppe que le contrat ne décrit pas. */
export class SenndoProtocolError extends SenndoError {
  constructor(
    readonly status: number,
    /** Le corps brut, tronqué — utile au support, jamais à une logique. */
    readonly body: string,
  ) {
    super(`senndo: réponse ${status} illisible (ni JSON valide, ni enveloppe d'erreur connue).`)
  }
}

/** Toute réponse d'erreur RENVOYÉE PAR L'API — l'enveloppe `{ error: { code, message } }`. */
export class SenndoApiError extends SenndoError {
  constructor(
    /** Le statut HTTP. */
    readonly status: number,
    /** Le code STABLE. Branchez votre logique dessus. */
    readonly code: SenndoErrorCode,
    /** Le libellé humain renvoyé par l'API. Ne branchez RIEN dessus. */
    readonly apiMessage: string,
    /** L'opération concernée. */
    readonly operationId: string,
  ) {
    super(`senndo: ${operationId} → ${status} ${code} — ${apiMessage}`)
  }
}

/**
 * 400 / 422 — la requête est mal formée, ou irrecevable en l'état. Corrigez l'appel.
 *
 * Le corps peut n'avoir jamais été LU : `EMPTY_BODY` (corps annoncé en JSON mais vide) et
 * `MALFORMED_JSON` (corps illisible) sont rendus par le serveur avant d'atteindre la route, donc
 * avant toute validation métier. Les autres codes de ce statut concernent un corps bien formé
 * mais refusé sur le fond. Dans tous les cas la reprise est inutile tant que l'appel n'a pas
 * changé — c'est ce qui sépare ce statut d'un 5xx.
 */
export class SenndoValidationError extends SenndoApiError {}

/** 401 — clé absente, malformée, inconnue ou révoquée. */
export class SenndoAuthError extends SenndoApiError {}

/**
 * 402 — solde insuffisant. Rechargez le compte : rejouer à l'identique échouera pareil.
 * C'est le cas que le prompt cite en exemple — il s'attrape par sa classe, sans lire de chaîne.
 */
export class SenndoInsufficientFundsError extends SenndoApiError {}

/** 403 — la clé était valide, l'appel est refusé (allowlist, suspension, contenu bloqué). */
export class SenndoForbiddenError extends SenndoApiError {}

/**
 * 404 — la ressource n'existe pas, ou n'appartient pas au compte appelant.
 *
 * `ROUTE_NOT_FOUND` est le cas à part : aucune route ne sert ce couple méthode + chemin. C'est
 * une URL fautive, pas une ressource absente.
 */
export class SenndoNotFoundError extends SenndoApiError {}

/** 409 — conflit d'état : média encore référencé, quota dépassé, mode d'idempotence divergent. */
export class SenndoConflictError extends SenndoApiError {}

/**
 * 413 — le corps de la requête dépasse le plafond accepté.
 *
 * Deux causes distinctes : un FICHIER trop volumineux sur un envoi multipart
 * (`FILE_TOO_LARGE`), ou un CORPS JSON au-delà du plafond de la route (`BODY_TOO_LARGE`,
 * 1 Mio par défaut). Le code du corps d'erreur les sépare — la taille du fichier et celle
 * de la requête ne se corrigent pas de la même façon.
 */
export class SenndoPayloadTooLargeError extends SenndoApiError {}

/**
 * 415 — le type de contenu n'est pas pris en charge.
 *
 * Deux causes distinctes, séparées par le code : le `Content-Type` de la REQUÊTE n'est servi par
 * aucun parseur — y compris quand il est absent (`UNSUPPORTED_MEDIA_TYPE`) — ou le type du
 * FICHIER envoyé en multipart est refusé, ou son contenu ne correspond pas à son extension
 * (`UNSUPPORTED_TYPE`). Ce ne sont pas les mêmes corrections : la première tient à l'en-tête, la
 * seconde au fichier.
 */
export class SenndoUnsupportedMediaTypeError extends SenndoApiError {}

/**
 * 429 — cadence dépassée. `retryAfterSeconds` porte l'attente demandée quand elle est connue.
 *
 * DEUX CODES, DEUX REMÈDES, et c'est sur `error.code` qu'on les sépare — jamais sur le statut :
 *
 *  * `VELOCITY_EXCEEDED` — trop d'ENVOIS pour ce compte sur 60 secondes. Étalez la campagne ;
 *    le message refusé n'a jamais été débité.
 *  * `RATE_LIMITED` — trop d'APPELS (ou trop d'octets) pour cette clé sur 60 secondes, lectures
 *    comprises. Espacez les requêtes, ou parallélisez moins.
 */
export class SenndoRateLimitError extends SenndoApiError {
  retryAfterSeconds: number | null = null
}

/**
 * 503 — le canal ou le service ne peut pas livrer MAINTENANT.
 *
 * Ce refus arrive AVANT tout débit (non-négociable : un canal qui ne peut pas livrer refuse avant
 * de facturer). Rien n'a été prélevé.
 */
export class SenndoServiceUnavailableError extends SenndoApiError {}

/** Le corps d'erreur tel que l'API le rend, uniformément. */
interface ErrorEnvelope {
  error: { code: string; message: string }
}

const isEnvelope = (value: unknown): value is ErrorEnvelope => {
  if (typeof value !== 'object' || value === null) return false
  const error = (value as { error?: unknown }).error
  if (typeof error !== 'object' || error === null) return false
  const { code, message } = error as { code?: unknown; message?: unknown }
  return typeof code === 'string' && typeof message === 'string'
}

const CLASS_BY_STATUS: Record<number, new (...args: never[]) => SenndoApiError> = {
  400: SenndoValidationError,
  401: SenndoAuthError,
  402: SenndoInsufficientFundsError,
  403: SenndoForbiddenError,
  404: SenndoNotFoundError,
  409: SenndoConflictError,
  413: SenndoPayloadTooLargeError,
  415: SenndoUnsupportedMediaTypeError,
  422: SenndoValidationError,
  429: SenndoRateLimitError,
  503: SenndoServiceUnavailableError,
}

/**
 * Construit l'erreur typée d'une réponse d'échec.
 *
 * UN STATUT INCONNU NE FAIT PAS LEVER LE SDK sur autre chose que l'erreur du serveur : il retombe
 * sur `SenndoApiError`. Une table exhaustive qui lèverait « statut non répertorié » transformerait
 * l'ajout d'un statut amont en panne chez tous les clients déjà déployés.
 */
export const errorFromResponse = (
  status: number,
  rawBody: string,
  operationId: string,
  retryAfterHeader: string | null,
): SenndoError => {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    return new SenndoProtocolError(status, rawBody.slice(0, 500))
  }
  if (!isEnvelope(parsed)) {
    return new SenndoProtocolError(status, rawBody.slice(0, 500))
  }
  const Ctor = CLASS_BY_STATUS[status] ?? SenndoApiError
  const error = new (
    Ctor as new (
      status: number,
      code: string,
      apiMessage: string,
      operationId: string,
    ) => SenndoApiError
  )(status, parsed.error.code, parsed.error.message, operationId)

  if (error instanceof SenndoRateLimitError && retryAfterHeader !== null) {
    const seconds = Number.parseInt(retryAfterHeader, 10)
    error.retryAfterSeconds = Number.isFinite(seconds) && seconds >= 0 ? seconds : null
  }
  return error
}
