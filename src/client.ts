/**
 * `SenndoClient` — une méthode par opération du contrat, nommée EXACTEMENT comme son
 * `operationId`.
 *
 * POURQUOI UNE SURFACE PLATE, ET PAS `client.messages.send()`. Le regroupement se lit mieux dans
 * une brochure ; la surface plate se VÉRIFIE. Le test de conformité affirme
 * `typeof client[operationId] === 'function'` pour chaque opération du contrat : aucune table de
 * correspondance à maintenir, donc aucune table de correspondance à oublier de mettre à jour le
 * jour où une opération est ajoutée. Et le nom qu'un développeur lit dans la documentation est
 * celui qu'il tape.
 *
 * CE QUE CE FICHIER AJOUTE AU CONTRAT, et qu'aucun générateur ne donne :
 *   - une validation LOCALE avant l'appel — un champ obligatoire absent coûte zéro aller-retour,
 *     et sur un canal facturé, zéro risque de débit ;
 *   - la règle que `required` ne sait pas exprimer (D-122) : un envoi porte du contenu par au
 *     moins un de `text`, `media`, `template` ;
 *   - le rejet local des préfixes d'idempotence réservés, que le serveur refuse en 400 ;
 *   - la clé API MASQUÉE dans toute représentation de l'objet.
 */
import { performRequest, maskApiKey } from './http.js'
import { SenndoRequestError } from './errors.js'
import { OPERATIONS, SENNDO_API_BASE_URL } from './generated/contract.js'
import type {
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
  OperationDescriptor,
  RevokeWebhookResponse,
  SendMessageBody,
  SendMessageResponse,
  UploadMediaResponse,
} from './generated/contract.js'
import type { FetchLike, MultipartUpload, RequestOptions, SenndoClientOptions } from './types.js'
import type { CallSpec, TransportConfig } from './http.js'

/** Les préfixes d'idempotence que la plateforme se réserve (entrants, campagnes). */
const RESERVED_IDEMPOTENCY_PREFIXES = ['in:', 'cmp:'] as const

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_RETRIES = 2

/** La version du paquet, injectée ici et vérifiée contre `package.json` par un test. */
export const SDK_VERSION = '1.0.0'

export class SenndoClient {
  readonly #config: TransportConfig

  constructor(options: SenndoClientOptions) {
    const apiKey = options.apiKey
    if (typeof apiKey !== 'string' || apiKey.trim() === '') {
      throw new SenndoRequestError(
        'senndo: apiKey est requise. Créez une clé dans la console (« API » → « Clés »). ' +
          'Une clé sk_test_ simule la livraison sans déplacer d’argent.',
      )
    }
    const fetchImpl = options.fetch ?? (globalThis as { fetch?: FetchLike }).fetch
    if (fetchImpl === undefined) {
      throw new SenndoRequestError(
        'senndo: aucune implémentation fetch trouvée sur cette plateforme. ' +
          'Passez-en une via l’option « fetch » (Node < 18, environnement restreint).',
      )
    }
    this.#config = {
      apiKey,
      baseUrl: options.baseUrl ?? SENNDO_API_BASE_URL,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
      fetchImpl,
      userAgent:
        options.userAgent === undefined
          ? `senndo-node/${SDK_VERSION}`
          : `senndo-node/${SDK_VERSION} ${options.userAgent}`,
    }
  }

  /**
   * La clé API, MASQUÉE. Il n'existe aucun accesseur qui la rende en clair : un SDK qui expose
   * sa clé la voit finir dans un log d'erreur, puis dans un agrégateur, puis hors du périmètre.
   */
  get apiKeyMasked(): string {
    return maskApiKey(this.#config.apiKey)
  }

  /** La base réellement utilisée par ce client. */
  get baseUrl(): string {
    return this.#config.baseUrl
  }

  /**
   * TOUTES les représentations passent par ici : `String(client)`, `JSON.stringify(client)`, et
   * `console.log(client)` sous Node. Aucune d'elles ne doit pouvoir imprimer la clé — c'est le
   * chemin par lequel un secret fuit vraiment, bien plus souvent qu'un `console.log(apiKey)`
   * délibéré.
   */
  toString(): string {
    return `SenndoClient { baseUrl: ${this.#config.baseUrl}, apiKey: ${this.apiKeyMasked} }`
  }

  toJSON(): Record<string, string> {
    return { baseUrl: this.#config.baseUrl, apiKey: this.apiKeyMasked }
  }

  [Symbol.for('nodejs.util.inspect.custom') as unknown as symbol](): string {
    return this.toString()
  }

  // ── Envoi ────────────────────────────────────────────────────────────────────────────────

  /**
   * Envoie un message unitaire.
   *
   * `idempotencyKey` EST OBLIGATOIRE, et le SDK n'en fabrique pas à votre place — voir
   * `newIdempotencyKey()` et la note du README. Rejouer la même clé renvoie le message déjà créé
   * avec `replay: true`, sans jamais redébiter.
   */
  async sendMessage(body: SendMessageBody, options?: RequestOptions): Promise<SendMessageResponse> {
    this.#assertRequiredBody(OPERATIONS.sendMessage, body as unknown as Record<string, unknown>)

    // La règle que `required` ne peut pas porter (D-122) : le serveur exempte `text` quand le
    // contenu vit dans `media` ou `template`, mais un envoi sans AUCUN des trois n'a pas de
    // contenu et part en 400. L'attraper ici épargne l'aller-retour.
    if (body.text === undefined && body.media === undefined && body.template === undefined) {
      throw new SenndoRequestError(
        'senndo: un envoi doit porter du contenu — renseignez « text », ou « media », ou ' +
          '« template ». Le texte n’est facultatif que lorsque l’un des deux autres le remplace.',
      )
    }
    for (const prefix of RESERVED_IDEMPOTENCY_PREFIXES) {
      if (body.idempotencyKey.startsWith(prefix)) {
        throw new SenndoRequestError(
          `senndo: le préfixe « ${prefix} » est réservé à la plateforme (entrants, campagnes). ` +
            'Choisissez une clé d’idempotence dérivée de VOTRE domaine.',
        )
      }
    }
    return this.#call<SendMessageResponse>(
      { descriptor: OPERATIONS.sendMessage, body: body as unknown as Record<string, unknown> },
      options,
    )
  }

  /** Estime le coût et le découpage d'un envoi, sans rien envoyer ni débiter. */
  async estimateMessage(
    body: EstimateMessageBody,
    options?: RequestOptions,
  ): Promise<EstimateMessageResponse> {
    this.#assertRequiredBody(OPERATIONS.estimateMessage, body as unknown as Record<string, unknown>)
    return this.#call<EstimateMessageResponse>(
      { descriptor: OPERATIONS.estimateMessage, body: body as unknown as Record<string, unknown> },
      options,
    )
  }

  /** Relit un message par son identifiant — c'est ici que se lit le VERDICT de livraison. */
  async getMessage(id: string, options?: RequestOptions): Promise<GetMessageResponse> {
    return this.#call<GetMessageResponse>(
      { descriptor: OPERATIONS.getMessage, pathValues: { id } },
      options,
    )
  }

  /** Parcourt le journal des messages du compte. */
  async listMessages(
    query?: ListMessagesQuery,
    options?: RequestOptions,
  ): Promise<ListMessagesResponse> {
    return this.#call<ListMessagesResponse>(
      { descriptor: OPERATIONS.listMessages, query: query as Record<string, unknown> | undefined },
      options,
    )
  }

  // ── Média ────────────────────────────────────────────────────────────────────────────────

  /** Téléverse une pièce jointe et renvoie la référence à reposer dans `media.ref` d'un envoi. */
  async uploadMedia(
    upload: MultipartUpload,
    options?: RequestOptions,
  ): Promise<UploadMediaResponse> {
    if (upload.fileName === undefined || upload.fileName === '') {
      throw new SenndoRequestError(
        'senndo: fileName est requis — le serveur vérifie que le contenu correspond à l’extension.',
      )
    }
    return this.#call<UploadMediaResponse>({ descriptor: OPERATIONS.uploadMedia, upload }, options)
  }

  /** Liste les fichiers du compte, l'espace occupé et la facturation du stockage. */
  async listMedia(query?: ListMediaQuery, options?: RequestOptions): Promise<ListMediaResponse> {
    return this.#call<ListMediaResponse>(
      { descriptor: OPERATIONS.listMedia, query: query as Record<string, unknown> | undefined },
      options,
    )
  }

  /** Supprime un fichier. Répond 409 tant qu'un message ou une campagne le référence. */
  async deleteMedia(id: string, options?: RequestOptions): Promise<DeleteMediaResponse> {
    return this.#call<DeleteMediaResponse>(
      { descriptor: OPERATIONS.deleteMedia, pathValues: { id } },
      options,
    )
  }

  // ── Compte : solde, tarifs, devises, émetteurs ───────────────────────────────────────────

  /**
   * Le solde du compte, converti dans une devise ARMÉE.
   *
   * Aucun repli sur l'USD n'est effectué par le SDK quand la conversion échoue : la route refuse
   * précisément de commettre cette faute (`INVALID_CURRENCY`, `CURRENCY_NOT_ARMED`), et un SDK qui
   * rattraperait le refus en rendant des dollars afficherait un montant faux dans une devise que
   * l'utilisateur croit être la sienne.
   */
  async getBalance(query?: GetBalanceQuery, options?: RequestOptions): Promise<GetBalanceResponse> {
    return this.#call<GetBalanceResponse>(
      { descriptor: OPERATIONS.getBalance, query: query as Record<string, unknown> | undefined },
      options,
    )
  }

  /** Le catalogue des devises. `billable` distingue « convertible » de « encaissable ». */
  async listCurrencies(options?: RequestOptions): Promise<ListCurrenciesResponse> {
    return this.#call<ListCurrenciesResponse>({ descriptor: OPERATIONS.listCurrencies }, options)
  }

  /**
   * Les tarifs du compte : `costs` = ce que VOUS payez à votre fournisseur direct,
   * `prices` = ce que VOUS facturez à vos comptes enfants. Aucun coût plateforme, aucun tarif
   * d'un compte voisin n'entre dans cette réponse.
   */
  async listPrices(options?: RequestOptions): Promise<ListPricesResponse> {
    return this.#call<ListPricesResponse>({ descriptor: OPERATIONS.listPrices }, options)
  }

  /**
   * Les Sender IDs du compte, avec leur statut de cycle de vie ET leur approbation PAR PAYS.
   * Proposer un émetteur sans lire `countries` conduit à un envoi refusé sur une destination
   * où il n'est pas approuvé.
   */
  async listSenderIds(options?: RequestOptions): Promise<ListSenderIdsResponse> {
    return this.#call<ListSenderIdsResponse>({ descriptor: OPERATIONS.listSenderIds }, options)
  }

  /**
   * Le grand livre du compte.
   *
   * La dépense NETTE d'un message est `billedAmountUsd − reversedAmountUsd` : sommer le brut
   * SURESTIME de tout ce qui a été contre-passé. Les montants sont des chaînes décimales —
   * additionnez-les avec une bibliothèque décimale, jamais avec `+`.
   */
  async listLedger(query?: ListLedgerQuery, options?: RequestOptions): Promise<ListLedgerResponse> {
    return this.#call<ListLedgerResponse>(
      { descriptor: OPERATIONS.listLedger, query: query as Record<string, unknown> | undefined },
      options,
    )
  }

  // ── Réception ────────────────────────────────────────────────────────────────────────────

  /** Les conversations entrantes, la plus récente d'abord. */
  async listInboxThreads(
    query?: ListInboxThreadsQuery,
    options?: RequestOptions,
  ): Promise<ListInboxThreadsResponse> {
    return this.#call<ListInboxThreadsResponse>(
      {
        descriptor: OPERATIONS.listInboxThreads,
        query: query as Record<string, unknown> | undefined,
      },
      options,
    )
  }

  /** Les messages d'une conversation. `channel` et `contact` sont obligatoires. */
  async listInboxMessages(
    query: ListInboxMessagesQuery,
    options?: RequestOptions,
  ): Promise<ListInboxMessagesResponse> {
    this.#assertRequiredQuery(
      OPERATIONS.listInboxMessages,
      query as unknown as Record<string, unknown>,
    )
    return this.#call<ListInboxMessagesResponse>(
      {
        descriptor: OPERATIONS.listInboxMessages,
        query: query as unknown as Record<string, unknown>,
      },
      options,
    )
  }

  // ── WhatsApp ─────────────────────────────────────────────────────────────────────────────

  /** Les modèles WhatsApp du compte, dont ceux partagés par la plateforme. */
  async listWaTemplates(options?: RequestOptions): Promise<ListWaTemplatesResponse> {
    return this.#call<ListWaTemplatesResponse>({ descriptor: OPERATIONS.listWaTemplates }, options)
  }

  /** Les numéros WhatsApp Cloud rattachés au compte, et les émetteurs partagés disponibles. */
  async listWaCloudNumbers(options?: RequestOptions): Promise<ListWaCloudNumbersResponse> {
    return this.#call<ListWaCloudNumbersResponse>(
      { descriptor: OPERATIONS.listWaCloudNumbers },
      options,
    )
  }

  // ── Webhooks ─────────────────────────────────────────────────────────────────────────────

  /** Les endpoints de webhook du compte, révoqués compris. */
  async listWebhooks(options?: RequestOptions): Promise<ListWebhooksResponse> {
    return this.#call<ListWebhooksResponse>({ descriptor: OPERATIONS.listWebhooks }, options)
  }

  /**
   * Crée un endpoint de webhook et renvoie son SECRET — la seule fois où il est lisible.
   *
   * CET APPEL N'EST JAMAIS RETENTÉ AUTOMATIQUEMENT. Il crée une ressource à chaque exécution :
   * une retentative aveugle produirait deux endpoints, donc DEUX livraisons pour chaque
   * événement. En cas d'échec de transport, listez avant de recréer.
   */
  async createWebhook(
    body: CreateWebhookBody,
    options?: RequestOptions,
  ): Promise<CreateWebhookResponse> {
    this.#assertRequiredBody(OPERATIONS.createWebhook, body as unknown as Record<string, unknown>)
    return this.#call<CreateWebhookResponse>(
      { descriptor: OPERATIONS.createWebhook, body: body as unknown as Record<string, unknown> },
      options,
    )
  }

  /** Révoque un endpoint. Les livraisons cessent ; l'historique reste lisible. */
  async revokeWebhook(id: string, options?: RequestOptions): Promise<RevokeWebhookResponse> {
    return this.#call<RevokeWebhookResponse>(
      { descriptor: OPERATIONS.revokeWebhook, pathValues: { id } },
      options,
    )
  }

  /** L'historique des livraisons de webhook, avec les compteurs d'état. */
  async listWebhookDeliveries(
    query?: ListWebhookDeliveriesQuery,
    options?: RequestOptions,
  ): Promise<ListWebhookDeliveriesResponse> {
    return this.#call<ListWebhookDeliveriesResponse>(
      {
        descriptor: OPERATIONS.listWebhookDeliveries,
        query: query as Record<string, unknown> | undefined,
      },
      options,
    )
  }

  // ── Interne ──────────────────────────────────────────────────────────────────────────────

  #call<T>(spec: CallSpec, options: RequestOptions | undefined): Promise<T> {
    return performRequest<T>(this.#config, spec, options)
  }

  /**
   * Vérifie les champs obligatoires DEPUIS LE DESCRIPTEUR, jamais depuis une liste recopiée.
   * Un champ ajouté au contrat devient obligatoire ici à la régénération, sans édition.
   */
  #assertRequiredBody(descriptor: OperationDescriptor, body: Record<string, unknown>): void {
    if (typeof body !== 'object' || body === null) {
      throw new SenndoRequestError(`senndo: ${descriptor.operationId} attend un objet en corps.`)
    }
    for (const field of descriptor.requiredBodyFields) {
      const value = body[field]
      if (value === undefined || value === null || value === '') {
        throw new SenndoRequestError(
          `senndo: ${descriptor.operationId} — le champ obligatoire « ${field} » est absent.`,
        )
      }
    }
  }

  #assertRequiredQuery(descriptor: OperationDescriptor, query: Record<string, unknown>): void {
    for (const name of descriptor.requiredQueryParams) {
      const value = query?.[name]
      if (value === undefined || value === null || value === '') {
        throw new SenndoRequestError(
          `senndo: ${descriptor.operationId} — le paramètre obligatoire « ${name} » est absent.`,
        )
      }
    }
  }
}
