/**
 * senndo — SDK officiel TypeScript / JavaScript.
 *
 * ```ts
 * import { SenndoClient, newIdempotencyKey } from 'senndo'
 *
 * const senndo = new SenndoClient({ apiKey: process.env.SENNDO_API_KEY! })
 *
 * const message = await senndo.sendMessage({
 *   channel: 'sms',
 *   to: '+15550001111',
 *   text: 'Votre code de connexion est 424242.',
 *   idempotencyKey: `login-otp-${userId}-${attempt}`,
 * })
 * ```
 */
export { SenndoClient, SDK_VERSION } from './client.js'
/** Utile pour journaliser une clé sans la publier. Le client masque déjà la sienne. */
export { maskApiKey } from './http.js'

export {
  SenndoError,
  SenndoRequestError,
  SenndoTimeoutError,
  SenndoAbortError,
  SenndoConnectionError,
  SenndoProtocolError,
  SenndoApiError,
  SenndoValidationError,
  SenndoAuthError,
  SenndoInsufficientFundsError,
  SenndoForbiddenError,
  SenndoNotFoundError,
  SenndoConflictError,
  SenndoPayloadTooLargeError,
  SenndoUnsupportedMediaTypeError,
  SenndoRateLimitError,
  SenndoServiceUnavailableError,
} from './errors.js'
export type { SenndoErrorCode } from './errors.js'

export {
  SENNDO_API_BASE_URL,
  SENNDO_CONTRACT_VERSION,
  KNOWN_FAILURE_CODES,
  OPERATIONS,
  OPERATION_IDS,
} from './generated/contract.js'

export type {
  Channel,
  MessageStatus,
  FailureCode,
  OperationDescriptor,
  OperationId,
  CreateWebhookBody,
  CreateWebhookResponse,
  DeleteMediaResponse,
  EstimateMessageBody,
  EstimateMessageResponse,
  GetBalanceQuery,
  GetBalanceResponse,
  GetMessageResponse,
  ListCurrenciesResponse,
  ListInboxMessagesQuery,
  ListInboxMessagesResponse,
  ListInboxThreadsQuery,
  ListInboxThreadsResponse,
  ListLedgerQuery,
  ListLedgerResponse,
  ListMediaQuery,
  ListMediaResponse,
  ListMessagesQuery,
  ListMessagesResponse,
  ListPricesResponse,
  ListSenderIdsResponse,
  ListWaCloudNumbersResponse,
  ListWaTemplatesResponse,
  ListWebhookDeliveriesQuery,
  ListWebhookDeliveriesResponse,
  ListWebhooksResponse,
  RevokeWebhookResponse,
  SendMessageBody,
  SendMessageResponse,
  UploadMediaBody,
  UploadMediaResponse,
} from './generated/contract.js'

export type {
  AbortSignalLike,
  FetchLike,
  HeadersLike,
  MultipartUpload,
  RequestInitLike,
  RequestOptions,
  ResponseLike,
  SenndoClientOptions,
} from './types.js'

import { randomId } from './http.js'

/**
 * Fabrique une clé d'idempotence aléatoire.
 *
 * LE SDK N'EN GÉNÈRE PAS À VOTRE PLACE, et c'est un refus délibéré du confort. La valeur d'une
 * clé d'idempotence tient dans sa STABILITÉ à travers VOS retentatives : si votre application
 * rappelle `sendMessage` après un délai dépassé, une clé fabriquée à chaque appel serait
 * différente — et le compte serait débité deux fois, exactement le sinistre que la clé existe
 * pour empêcher. Le SDK, lui, réutilise déjà la vôtre à travers ses propres retentatives de
 * transport ; en inventer une n'ajouterait donc aucune protection, mais supprimerait le seul
 * moment où vous êtes forcé d'y penser.
 *
 * Dérivez de préférence la clé de VOTRE domaine — `commande-8412`, `otp-${userId}-${tentative}` —
 * de sorte que deux exécutions du même geste métier portent la même clé. Cette fonction est là
 * pour les cas où aucun identifiant stable n'existe (un envoi vraiment ponctuel), et pour vos
 * tests.
 */
export const newIdempotencyKey = (prefix?: string): string =>
  prefix === undefined || prefix === '' ? randomId() : `${prefix}-${randomId()}`
