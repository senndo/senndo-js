/* eslint-disable */
/**
 * FICHIER GÉNÉRÉ — NE PAS ÉDITER À LA MAIN.
 *
 * Source : `OPENAPI_OPERATIONS` du monorepo senndo, document version 1.0.0.
 * Régénérer : `pnpm --filter @senndo/sdk generate`.
 *
 * Toute édition manuelle est effacée à la prochaine génération, et `generated-fresh.test.ts`
 * la signale en ROUGE avant même qu'elle atteigne une revue.
 *
 * LES MONTANTS SONT DES CHAÎNES DÉCIMALES, jamais des `number`. Un `NUMERIC(18,6)` passé par un
 * double IEEE-754 perd des unités sur les longues traînes, et un prix unitaire sub-centime arrondi
 * à deux décimales devient zéro. Les additionner exige une bibliothèque décimale — ou des entiers
 * de micro-unités — jamais l'opérateur `+` de JavaScript.
 */

import type { MultipartUpload } from '../types.js'

/** Base publique de production. Surchargeable à la construction du client. */
export const SENNDO_API_BASE_URL = 'https://api.senndo.com'

/** Version du document OpenAPI dont ce fichier est dérivé. */
export const SENNDO_CONTRACT_VERSION = '1.0.0'

export type Channel = 'sms' | 'whatsapp_cloud' | 'whatsapp_baileys' | 'email' | 'voice'

export type MessageStatus =
  'pending' | 'dispatching' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'unknown'

/**
 * Code pays ISO 3166-1 alpha-3, en majuscules (« CIV », « FRA », « SEN ») — le format du
 * moteur de routage. Un code que le catalogue ne connaît pas est REFUSÉ, jamais ignoré : il ne
 * pourrait matcher aucune règle, et l’appel retomberait en silence sur la route par défaut, à
 * un prix que vous n’avez pas demandé.
 */
export type CountryIso3 = string

/**
 * Code pays ISO 3166-1 alpha-2, en majuscules (« CI », « FR », « SN ») — le format des
 * approbations d’émetteur. À ne pas confondre avec l’alpha-3 attendu par les champs de
 * routage.
 */
export type CountryAlpha2 = string

/**
 * Raison NORMALISÉE d'un échec, propre à senndo et indépendante de l'opérateur.
 *
 * L'UNION EST OUVERTE (`| (string & {})`), ET C'EST DÉLIBÉRÉ. senndo s'engage à AJOUTER des
 * valeurs, jamais à en retirer : une union fermée ferait échouer la compilation de tout client au
 * prochain ajout, et une validation fermée à l'exécution ferait LEVER le SDK sur une réponse
 * parfaitement valide. L'ouverture garde l'autocomplétion des valeurs connues sans transformer un
 * ajout amont en panne. Testez l'appartenance avec `KNOWN_FAILURE_CODES` quand vous devez
 * distinguer « code connu » de « code plus récent que votre version du SDK ».
 */
export type FailureCode =
  | 'RECIPIENT_NOT_REACHABLE'
  | 'RECIPIENT_OPTED_OUT'
  | 'WHATSAPP_WINDOW_CLOSED'
  | 'TEMPLATE_INVALID'
  | 'SENDER_NOT_AUTHORIZED'
  | 'MESSAGE_BLOCKED'
  | 'UNSUPPORTED_CONTENT'
  | 'MEDIA_ERROR'
  | 'RATE_LIMITED'
  | 'NO_ANSWER'
  | 'BUSY'
  | 'CALL_CANCELED'
  | 'PROVIDER_REFUSED'
  | (string & {})

/** Les valeurs de `FailureCode` connues de CETTE version du SDK. */
export const KNOWN_FAILURE_CODES = [
  'RECIPIENT_NOT_REACHABLE',
  'RECIPIENT_OPTED_OUT',
  'WHATSAPP_WINDOW_CLOSED',
  'TEMPLATE_INVALID',
  'SENDER_NOT_AUTHORIZED',
  'MESSAGE_BLOCKED',
  'UNSUPPORTED_CONTENT',
  'MEDIA_ERROR',
  'RATE_LIMITED',
  'NO_ANSWER',
  'BUSY',
  'CALL_CANCELED',
  'PROVIDER_REFUSED',
] as const

/** Corps de `POST /v1/messages`. */
export interface SendMessageBody {
  /**
   * Canal d’envoi.
   */
  channel: Channel
  /**
   * Destinataire — numéro E.164 pour sms, voice et whatsapp ; adresse pour email.
   */
  to: string
  /**
   * Contenu du message — ou légende lorsqu’une pièce jointe est fournie. Requis, SAUF si media
   * OU template est présent : une image sans légende est un envoi valide, et le corps d’un
   * modèle EST son contenu (le texte d’un envoi de modèle est de toute façon remplacé par les
   * composants approuvés). Dans les deux cas le message est facturé une unité, comme tout
   * porteur de contenu.
   */
  text?: string
  /**
   * Pièce jointe, sur les canaux whatsapp_cloud et whatsapp_baileys uniquement. Sans modèle,
   * elle constitue le message ; avec un modèle à en-tête média, elle remplit cet en-tête. La
   * référence provient de POST /v1/wa-media et doit appartenir au compte appelant, sinon 404.
   */
  media?: {
    /**
     * Référence opaque rendue par POST /v1/wa-media.
     */
    ref?: string
  }
  /**
   * Modèle WhatsApp managé, REQUIS sur le canal whatsapp_cloud hors fenêtre de 24 h : WhatsApp
   * n’accepte un texte libre que si le destinataire vous a écrit dans les 24 heures. Désignez-le
   * par name (+ language si le nom existe en plusieurs langues) ou par id. L’appartenance du
   * modèle au compte et son statut « approuvé » sont vérifiés avant tout débit. Les variables
   * sont positionnelles ; un modèle à en-tête média prend sa pièce jointe via le champ media.
   */
  template?: {
    /**
     * Nom du modèle approuvé, tel qu’il s’affiche dans la console (par exemple
     * official_otp_code_template). Exclusif avec id. Un nom introuvable, ou ambigu après
     * application de la précédence, est refusé avant tout débit.
     */
    name?: string
    /**
     * Langue du modèle (fr, en, en_US…), à préciser seulement quand le nom existe en plusieurs
     * langues — le refus TEMPLATE_LANGUAGE_REQUIRED énumère alors celles qui existent. Ne se
     * combine qu’avec name.
     */
    language?: string
    /**
     * Identifiant du modèle approuvé (UUID). Exclusif avec name.
     */
    id?: string
    /**
     * Valeurs des variables positionnelles du corps, dans l’ordre. Défaut : [].
     */
    variables?: Array<string>
    /**
     * Valeur de la variable d’en-tête texte, si le modèle en déclare une.
     */
    headerVariable?: string
    /**
     * Valeur du bouton URL dynamique ({{1}} dans l’URL approuvée), si le modèle en porte un.
     * Requise dans ce cas, refusée sinon.
     */
    urlButtonVariable?: string
  }
  /**
   * Clé d’idempotence fournie par le client. Les préfixes in: et cmp: sont réservés à la
   * plateforme et refusés en 400.
   */
  idempotencyKey: string
  /**
   * Expéditeur affiché. Pour email, doit être un Sender ID e-mail vérifié.
   */
  senderId?: string
  /**
   * Override du pays de routage, en ISO 3166-1 alpha-3 (« CIV », « FRA »). Absent, le pays est
   * DÉRIVÉ du destinataire. Un code inconnu du catalogue est refusé en 400 (COUNTRY_INVALID)
   * avant tout débit : il ne pourrait matcher aucune règle de routage, et l’envoi partirait —
   * facturé — sur la route par défaut.
   */
  country?: CountryIso3
  /**
   * Catégorie du message.
   */
  category?: 'marketing' | 'utility' | 'authentication' | 'service'
  /**
   * Type de SMS (canal "sms" uniquement). "premium" route par le réseau international à haute
   * délivrabilité et se facture au tarif premium ; absent = "standard".
   */
  tier?: 'standard' | 'premium'
  /**
   * Convertit le texte en GSM-7 avant segmentation, envoi et facturation (canal "sms"
   * uniquement). Un SEUL caractère hors de l’alphabet GSM 03.38 fait passer le message entier en
   * UCS-2 et divise la capacité par plus de deux (160 → 70 caractères) : l’apostrophe
   * typographique ’ (U+2019), que la plupart des éditeurs substituent automatiquement, suffit à
   * tripler la facture. Avec ce drapeau, les apostrophes et tirets typographiques sont remplacés
   * par leur équivalent ASCII, les lettres accentuées hors alphabet (ê â î ô û ç œ) perdent leur
   * accent, et les emoji sont RETIRÉS — le destinataire ne verra donc pas exactement ce que vous
   * avez soumis. Absent = le texte est envoyé tel quel. Vérifiez le résultat avec POST
   * /v1/messages/estimate avant d’envoyer.
   */
  convertGsm7?: boolean
  /**
   * Résout les champs {{clé}} du texte contre le catalogue de champs du compte (GET
   * /v1/merge-fields) et le contact correspondant à la destination, AVANT toute facturation. Le
   * message envoyé, segmenté et facturé est le texte SUBSTITUÉ — pas le gabarit. Un champ absent
   * du catalogue rend 400 UNKNOWN_MERGE_FIELD ; un champ sans valeur pour ce destinataire rend
   * 422 MISSING_MERGE_FIELD et RIEN n’est facturé (mieux vaut ne pas envoyer qu’envoyer «
   * Bonjour , »). Absent = le texte part tel quel, accolades comprises : un corps qui contient
   * légitimement {{ }} n’est jamais modifié sans ce drapeau. Incompatible avec template (les
   * variables de modèle {{1}}, {{2}}… sont un espace de noms distinct). Devisez sous le même
   * drapeau avec POST /v1/messages/estimate.
   */
  personalize?: boolean
  /**
   * Objet — requis pour channel: "email".
   */
  subject?: string
}

/** Réponse 200 de `POST /v1/messages`. */
export type SendMessageResponse = {
  /**
   * Identifiant du message créé.
   */
  id: string
  /**
   * Statut à l’acceptation. Ce n’est PAS un verdict de livraison : celui-ci arrive par webhook
   * ou par relecture de GET /v1/messages/{id}.
   */
  status: MessageStatus
  /**
   * Canal retenu.
   */
  channel: Channel
  /**
   * Destinataire tel qu’accepté.
   */
  to: string
  /**
   * Expéditeur affiché, résolu.
   */
  senderId: string | null
  /**
   * Règle de routage retenue. Identifiant opaque, utile au support ; il ne nomme aucun
   * fournisseur.
   */
  routeRuleId: string | null
  /**
   * Montant débité en USD, chaîne décimale. null avec une clé sk_test_ (aucun mouvement
   * d’argent).
   */
  billedAmountUsd: string | null
  /**
   * Devise de facturation.
   */
  billedCurrency: string | null
  /**
   * Crédit RENDU par un contre-passage déclenché pendant cet appel, en USD, chaîne décimale.
   * null si le message n’a pas été contre-passé. billedAmountUsd garde le montant BRUT débité :
   * la dépense NETTE est billedAmountUsd − reversedAmountUsd.
   */
  reversedAmountUsd: string | null
  /**
   * true quand la clé d’idempotence avait DÉJÀ produit ce message : aucun nouveau débit n’a eu
   * lieu, et le corps décrit l’envoi d’origine.
   */
  replay: boolean
}

/** Réponse 200 de `GET /v1/messages/{id}`. */
export type GetMessageResponse = {
  /**
   * Identifiant du message.
   */
  id: string
  /**
   * Horodatage de création.
   */
  createdAt: string
  /**
   * Canal utilisé.
   */
  channel: Channel
  /**
   * Destinataire.
   */
  toAddr: string | null
  /**
   * Expéditeur affiché.
   */
  senderId: string | null
  /**
   * Statut courant.
   */
  status: MessageStatus
  /**
   * Montant facturé en USD, chaîne décimale. null si non facturé (clé de test).
   */
  billedAmountUsd: string | null
  /**
   * Crédit RENDU par un contre-passage, en USD, chaîne décimale. null si le message n’a pas été
   * contre-passé. billedAmountUsd garde le montant BRUT débité (un fait qui s’est produit,
   * inscrit au grand livre) : la dépense NETTE d’un message est billedAmountUsd −
   * reversedAmountUsd. Sommer billedAmountUsd seul SURESTIME la dépense de tout ce qui a été
   * remboursé.
   */
  reversedAmountUsd: string | null
  /**
   * Raison de l’échec. Renseignée sur TOUT message status: "failed", et null sur tout autre
   * statut. Code stable propre à senndo, indépendant de l’opérateur : branchez votre logique
   * dessus. PROVIDER_REFUSED est le fourre-tout explicite — le canal a refusé sans raison
   * normalisable.
   */
  failureCode: FailureCode | null
  /**
   * Devise de facturation.
   */
  billedCurrency: string | null
  /**
   * Catégorie déclarée à l’envoi.
   */
  category: string | null
  /**
   * Corps du message tel qu’envoyé (après translittération éventuelle).
   */
  body: string
  /**
   * Origine de l’envoi : console, appel par clé API, ou test du parcours de démarrage.
   */
  source: 'console' | 'api' | 'api_test'
}

/** Paramètres de requête de `GET /v1/messages`. */
export interface ListMessagesQuery {
  /**
   * Numéro de page, à partir de 1.
   */
  page?: number
  /**
   * Taille de page, 50 par défaut, 100 au maximum.
   */
  pageSize?: number
  /**
   * Colonne de tri.
   */
  sort?: 'date' | 'channel' | 'status' | 'amount'
  /**
   * Sens du tri.
   */
  dir?: 'asc' | 'desc'
  /**
   * Filtre par canal.
   */
  channel?: Channel
  /**
   * Filtre par statut.
   */
  status?: MessageStatus
  /**
   * Début de plage, YYYY-MM-DD inclus.
   */
  from?: string
  /**
   * Fin de plage, YYYY-MM-DD inclus (la journée entière).
   */
  to?: string
  /**
   * via=api : ne garder que les envois partis par la surface API (clé sk_… ou tests du parcours
   * de démarrage).
   */
  via?: 'api'
}

/** Réponse 200 de `GET /v1/messages`. */
export type ListMessagesResponse = {
  /**
   * Page courante.
   */
  page: number
  /**
   * Taille de page.
   */
  pageSize: number
  /**
   * Total de lignes filtrées.
   */
  total: number
  /**
   * Périmètre RÉELLEMENT lu. Vaut toujours account pour un appelant à clé API — network est
   * réservé aux sessions console d’opérateur.
   */
  scope: 'account' | 'network'
  /**
   * Les messages.
   */
  rows: Array<{
    /**
     * Identifiant du message.
     */
    id: string
    /**
     * Horodatage de création.
     */
    createdAt: string
    /**
     * Canal utilisé.
     */
    channel: Channel
    /**
     * Destinataire.
     */
    toAddr: string | null
    /**
     * Expéditeur affiché.
     */
    senderId: string | null
    /**
     * Statut courant.
     */
    status: MessageStatus
    /**
     * Montant facturé en USD, chaîne décimale. null si non facturé (clé de test).
     */
    billedAmountUsd: string | null
    /**
     * Crédit RENDU par un contre-passage, en USD, chaîne décimale. null si le message n’a pas été
     * contre-passé. billedAmountUsd garde le montant BRUT débité (un fait qui s’est produit,
     * inscrit au grand livre) : la dépense NETTE d’un message est billedAmountUsd −
     * reversedAmountUsd. Sommer billedAmountUsd seul SURESTIME la dépense de tout ce qui a été
     * remboursé.
     */
    reversedAmountUsd: string | null
    /**
     * Raison de l’échec. Renseignée sur TOUT message status: "failed", et null sur tout autre
     * statut. Code stable propre à senndo, indépendant de l’opérateur : branchez votre logique
     * dessus. PROVIDER_REFUSED est le fourre-tout explicite — le canal a refusé sans raison
     * normalisable.
     */
    failureCode: FailureCode | null
    /**
     * Devise de facturation.
     */
    billedCurrency: string | null
    /**
     * Catégorie déclarée à l’envoi.
     */
    category: string | null
    /**
     * Corps du message tel qu’envoyé (après translittération éventuelle).
     */
    body: string
    /**
     * Origine de l’envoi : console, appel par clé API, ou test du parcours de démarrage.
     */
    source: 'console' | 'api' | 'api_test'
  }>
}

/** Corps de `POST /v1/wa-media` — téléversement multipart. */
export type UploadMediaBody = MultipartUpload

/** Réponse 201 de `POST /v1/wa-media`. */
export type UploadMediaResponse = {
  /**
   * Référence OPAQUE à reposer dans media.ref d’un envoi.
   */
  ref: string
  /**
   * Nature du fichier, déduite du type MIME.
   */
  kind: 'image' | 'video' | 'audio' | 'document'
  /**
   * Nom de fichier reçu.
   */
  fileName: string
  /**
   * Type MIME validé.
   */
  mime: string
  /**
   * Taille en octets.
   */
  sizeBytes: number
}

/** Paramètres de requête de `GET /v1/wa-media`. */
export interface ListMediaQuery {
  /**
   * Page, à partir de 1.
   */
  page?: number
  /**
   * Taille de page, 500 par défaut, 500 au maximum.
   */
  pageSize?: number
}

/** Réponse 200 de `GET /v1/wa-media`. */
export type ListMediaResponse = {
  /**
   * Les fichiers du compte.
   */
  media: Array<{
    /**
     * Référence opaque.
     */
    ref: string
    /**
     * Nature du fichier.
     */
    kind: 'image' | 'video' | 'audio' | 'document'
    /**
     * Type MIME.
     */
    mime: string
    /**
     * Nom de fichier.
     */
    fileName: string
    /**
     * Taille en octets.
     */
    sizeBytes: number
    /**
     * Téléversé le.
     */
    createdAt: string
    /**
     * true si un message ou une campagne référence encore ce fichier — sa suppression répond alors
     * 409.
     */
    inUse: boolean
    /**
     * URL d’aperçu signée et TEMPORAIRE, sur les images uniquement. null quand l’aperçu n’a pas pu
     * être signé — une liste ne tombe jamais pour un aperçu.
     */
    previewUrl: string | null
  }>
  /**
   * Page courante.
   */
  page: number
  /**
   * Taille de page.
   */
  pageSize: number
  /**
   * Total de fichiers.
   */
  total: number
  /**
   * Usage du compte ENTIER, jamais de la page.
   */
  usage: {
    /**
     * Octets stockés.
     */
    usedBytes: number
    /**
     * Quota en octets.
     */
    quotaBytes: number
  }
  /**
   * Facturation du stockage, scopée à la relation parent → compte : jamais un coût plateforme,
   * jamais le prix d’un autre compte.
   */
  billing: {
    /**
     * Prix par Gio en USD, chaîne décimale. null quand aucun barème n’est publié — l’afficher
     * deviné serait un prix inventé.
     */
    pricePerGibUsd: string | null
    /**
     * Début de la période suivante (UTC).
     */
    nextPeriodStart: string
    /**
     * Cycle de facturation en cours. null tant qu’aucun cycle n’a été mesuré.
     */
    cycle: {
      /**
       * Période, AAAA-MM.
       */
      period: string
      /**
       * État du cycle.
       */
      status: string
      /**
       * Octets mesurés.
       */
      measuredBytes: number
      /**
       * Tranches facturées.
       */
      tranches: number
      /**
       * Montant du cycle en USD, chaîne décimale.
       */
      amountUsd: string
      /**
       * Dernière mesure.
       */
      updatedAt: string | null
    } | null
  }
}

/** Réponse 204 de `DELETE /v1/wa-media/{id}`. */
export type DeleteMediaResponse = void

/** Réponse 200 de `GET /v1/prices`. */
export type ListPricesResponse = {
  /**
   * Le compte appelant.
   */
  accountId: string
  /**
   * CE QUE VOUS PAYEZ : le prix que votre compte parent vous facture, par canal et groupe de
   * destination. Ce n’est PAS un coût fournisseur — la surface publique n’en expose aucun.
   */
  costs: Array<{
    /**
     * Canal.
     */
    channel: string
    /**
     * Groupe de destination.
     */
    destGroup: string
    /**
     * Prix unitaire en USD, chaîne décimale.
     */
    priceUsd: string
  }>
  /**
   * CE QUE VOUS FACTUREZ : votre propre price book, celui que vous appliquez à vos comptes
   * enfants. Vide si vous n’en avez aucun.
   */
  prices: Array<{
    /**
     * Canal.
     */
    channel: string
    /**
     * Groupe de destination.
     */
    destGroup: string
    /**
     * Prix unitaire en USD, chaîne décimale.
     */
    priceUsd: string
    /**
     * Compte enfant visé par une dérogation. null = le tarif par défaut appliqué à tous vos
     * enfants.
     */
    buyerAccountId: string | null
  }>
}

/** Paramètres de requête de `GET /v1/balance`. */
export interface GetBalanceQuery {
  /**
   * Devise de restitution (ISO 4217). Défaut USD. Les valeurs acceptées sont celles de GET
   * /v1/currencies.
   */
  currency?: string
}

/** Réponse 200 de `GET /v1/balance`. */
export type GetBalanceResponse = {
  /**
   * Compte.
   */
  accountId: string
  /**
   * Solde canonique en USD, chaîne décimale.
   */
  balanceUsd: string
  /**
   * Devise de restitution.
   */
  currency: string
  /**
   * Taux administré : 1 USD = unitsPerUsd unités de currency.
   */
  unitsPerUsd: string
  /**
   * Solde converti, arrondi à 6 décimales — la précision de la plateforme. Arrondir à 2 pour
   * l’affichage vous appartient ; ne le faites JAMAIS sur un coût unitaire, qui est sub-centime.
   */
  balance: string
  /**
   * true = devise encaissée par une passerelle de recharge. false = affichage uniquement : ne
   * proposez pas de paiement dans cette devise.
   */
  billable: boolean
}

/** Réponse 200 de `GET /v1/currencies`. */
export type ListCurrenciesResponse = {
  currencies: Array<{
    /**
     * Code ISO 4217.
     */
    currency: string
    /**
     * Taux administré.
     */
    unitsPerUsd: string
    /**
     * Devise encaissée par une passerelle de recharge.
     */
    billable: boolean
  }>
}

/** Réponse 200 de `GET /v1/sender-ids`. */
export type ListSenderIdsResponse = {
  /**
   * Réservé à la console : true pour une session d’opérateur plateforme, qui voit alors la file
   * de revue. TOUJOURS false pour une clé API — le périmètre élargi est attaché à la SESSION,
   * jamais au compte.
   */
  canReview: boolean
  senderIds: Array<{
    /**
     * Identifiant.
     */
    id: string
    /**
     * Compte propriétaire, ou null pour un expéditeur partagé de la plateforme. Une clé API ne
     * voit jamais que ses propres dédiés et les partagés : cette valeur ne désigne donc jamais un
     * tiers.
     */
    ownerAccountId: string | null
    /**
     * Nom du compte propriétaire ; null pour un partagé.
     */
    ownerName: string | null
    /**
     * L’expéditeur tel qu’il s’envoie (à passer en senderId sur POST /v1/messages).
     */
    value: string
    /**
     * Canal concerné.
     */
    channel: string
    /**
     * true = expéditeur partagé de la plateforme, utilisable sans dossier.
     */
    shared: boolean
    /**
     * Cycle de vie. Seul active permet d’envoyer.
     */
    lifecycleStatus: 'active' | 'suspended' | 'archived'
    /**
     * Motif de la suspension en cours ; null hors suspension. À afficher à vos utilisateurs : sans
     * lui, leurs envois échouent sans explication.
     */
    suspensionReason: string | null
    /**
     * Horodatage ISO 8601 de la suspension en cours, sinon null.
     */
    suspendedAt: string | null
    /**
     * Horodatage ISO 8601 de l’archivage, sinon null.
     */
    archivedAt: string | null
    /**
     * Horodatage ISO 8601 de création.
     */
    createdAt: string
    /**
     * Vérification de l’adresse, canal e-mail UNIQUEMENT ; null sur tout autre canal. Un
     * expéditeur e-mail dont le statut n’est pas verified ne délivre pas.
     */
    verification: {
      /**
       * État de la vérification de l’adresse.
       */
      status: 'pending' | 'verified' | 'failed'
      /**
       * Horodatage ISO 8601 du passage à verified, sinon null.
       */
      confirmedAt: string | null
    } | null
    /**
     * Approbation par pays. Une destination absente de cette liste n’est pas approuvée.
     */
    countries: Array<{
      /**
       * Pays, en ISO 3166-1 alpha-2 (« CI », « FR »). Ce champ N’EST PAS dans le même système que le
       * `country` des envois et des devis, qui est en alpha-3.
       */
      country: CountryAlpha2
      /**
       * Statut dans ce pays.
       */
      status: 'approved' | 'pending' | 'rejected'
    }>
  }>
}

/** Corps de `POST /v1/messages/estimate`. */
export interface EstimateMessageBody {
  /**
   * Canal.
   */
  channel: Channel
  /**
   * Contenu à estimer.
   */
  text: string
  /**
   * Nombre de destinataires.
   */
  recipients: number
  /**
   * Expéditeur envisagé — il participe à la résolution de la route.
   */
  senderId?: string | null
  /**
   * Destination en ISO 3166-1 alpha-3 (« CIV », « FRA ») — le MÊME système que le `country` de
   * l’envoi, parce que c’est la même cascade de routage qui résout les deux. Le devis résout au
   * niveau PAYS. Un code inconnu du catalogue est refusé en 400 (COUNTRY_INVALID) : il ne
   * pourrait matcher aucune règle, et le devis annoncerait le prix de la route par défaut — pas
   * celui qui sera débité.
   */
  country?: CountryIso3 | null
  /**
   * Le message portera une pièce jointe (même règle d’unité qu’au débit).
   */
  hasAttachment?: boolean
  /**
   * Type de SMS (canal "sms" uniquement) — DOIT valoir celui de l’envoi réel, sinon le devis
   * annonce un prix que le débit ne respectera pas. Absent = "standard".
   */
  tier?: 'standard' | 'premium'
  /**
   * Conversion GSM-7 (canal "sms" uniquement) — DOIT valoir celle de l’envoi réel, sinon le
   * devis annonce un nombre de segments que le débit ne respectera pas. Le champ transliterated
   * de la réponse dit si le texte A ÉTÉ modifié.
   */
  convertGsm7?: boolean
  /**
   * Devise les corps SUBSTITUÉS plutôt que le gabarit — DOIT valoir celui de l’envoi réel. Exige
   * destinations : sans destinataires concrets il n’y a aucune valeur à substituer, donc aucun
   * devis exact possible (400). La substitution fait varier la longueur, donc les segments, donc
   * le prix : deviser le gabarit SOUS-facture dès qu’une valeur est plus longue que sa clé.
   */
  personalize?: boolean
  /**
   * Les destinataires concrets (numéros E.164, ou adresses sur le canal "email"), 1 000 au plus.
   * Requis quand personalize vaut true. Un destinataire à qui il manque une valeur est EXCLU du
   * devis — c’est celui que l’envoi refusera, donc celui qui ne sera pas facturé : comparez
   * personalized.recipients au nombre soumis pour savoir combien seront écartés.
   */
  destinations?: Array<string>
}

/** Réponse 200 de `POST /v1/messages/estimate`. */
export type EstimateMessageResponse = {
  /**
   * Canal estimé.
   */
  channel: string
  /**
   * Groupe tarifaire résolu.
   */
  destGroup: string
  /**
   * Encodage retenu. unicode divise la taille du segment SMS.
   */
  encoding: 'gsm7' | 'unicode'
  /**
   * Caractères comptés.
   */
  chars: number
  /**
   * Segments SMS (0 si texte vide).
   */
  segments: number
  /**
   * Unités facturables d’UN message (segments en SMS, 1 sinon).
   */
  units: number
  /**
   * Destinataires.
   */
  recipients: number
  /**
   * La translittération GSM-7 est active pour cette route — indépendant du texte soumis.
   */
  transliterateGsm7: boolean
  /**
   * Le texte A ÉTÉ modifié avant segmentation : le destinataire ne verra pas exactement ce que
   * vous avez soumis. Signalez-le à vos utilisateurs.
   */
  transliterated: boolean
  /**
   * Prix unitaire du compte, chaîne décimale USD — SUB-CENTIME : l’arrondir à deux décimales le
   * rend nul.
   */
  unitPriceUsd: string
  /**
   * Total exact. Sans personalize : units × recipients × unitPriceUsd. Avec personalize : la
   * SOMME des unités de chaque corps substitué × unitPriceUsd — jamais une moyenne.
   */
  totalUsd: string
  /**
   * Présent UNIQUEMENT quand personalize vaut true. Les scalaires de tête (encoding, chars,
   * segments, units) décrivent alors le PIRE destinataire, jamais la moyenne : ils bornent par
   * le haut ce qu’un destinataire coûtera.
   */
  personalized?: {
    /**
     * Destinataires dont TOUS les champs se sont résolus — les seuls comptés dans totalUsd.
     * L’écart avec le nombre de destinations soumises est le nombre d’envois que
     * MISSING_MERGE_FIELD refusera.
     */
    recipients: number
    /**
     * Unités du destinataire le MOINS cher.
     */
    minUnits: number
    /**
     * Unités du destinataire le PLUS cher.
     */
    maxUnits: number
  }
}

/** Paramètres de requête de `GET /v1/ledger`. */
export interface ListLedgerQuery {
  /**
   * Page, à partir de 1.
   */
  page?: number
  /**
   * Taille de page — plafonnée à 100.
   */
  pageSize?: number
  /**
   * Filtre par type d’écriture (topup, debit_send, reversal…).
   */
  kind?:
    | 'topup'
    | 'topup_bonus'
    | 'debit_send'
    | 'debit_storage'
    | 'debit_ai'
    | 'margin'
    | 'provider_cost'
    | 'withdrawal'
    | 'adjustment'
    | 'reversal'
    | 'transfer'
  /**
   * Date de début (YYYY-MM-DD), incluse.
   */
  from?: string
  /**
   * Date de fin (YYYY-MM-DD), incluse.
   */
  to?: string
  /**
   * Colonne de tri.
   */
  sort?: 'date' | 'amount' | 'kind' | 'channel' | 'balance'
  /**
   * Sens du tri.
   */
  dir?: 'asc' | 'desc'
  /**
   * Filtre par canal du message rattaché.
   */
  channel?: Channel
  /**
   * Recherche libre : clé d’idempotence ou destination (correspondance partielle), ou référence
   * exacte si le terme est un UUID.
   */
  q?: string
}

/** Réponse 200 de `GET /v1/ledger`. */
export type ListLedgerResponse = {
  /**
   * Page servie.
   */
  page: number
  /**
   * Taille de page.
   */
  pageSize: number
  /**
   * Total de la vue filtrée.
   */
  total: number
  rows: Array<{
    /**
     * Écriture.
     */
    id: string
    /**
     * Horodatage.
     */
    createdAt: string
    /**
     * Type d’écriture.
     */
    kind: string
    /**
     * Montant SIGNÉ en USD (négatif = débit).
     */
    amountUsd: string
    /**
     * Solde après écriture.
     */
    balanceAfter: string | null
    /**
     * Canal du message lié, null sans message.
     */
    channel: string | null
    /**
     * Destinataire du message lié.
     */
    toAddr: string | null
    /**
     * Statut du message lié.
     */
    status: string | null
    /**
     * Référence de paiement (SENNDO-AAMMJJ-N) quand l’écriture EST une recharge — c’est la clé du
     * reçu. Null partout ailleurs, y compris sur la ligne de bonus, qui partage la référence du
     * crédit principal.
     */
    receiptRef?: string | null
  }>
  /**
   * Totaux de la vue FILTRÉE, calculés par le serveur.
   */
  aggregates: {
    /**
     * Somme des débits, en valeur absolue.
     */
    debitUsd: string
    /**
     * Somme des crédits — les contre-passations en font partie.
     */
    creditUsd: string
    /**
     * Solde à l’écriture la plus récente de la vue.
     */
    closingBalanceUsd: string | null
  }
}

/** Paramètres de requête de `GET /v1/inbox/threads`. */
export interface ListInboxThreadsQuery {
  /**
   * Page, à partir de 1.
   */
  page?: number
  /**
   * Taille de page — plafonnée à 100.
   */
  pageSize?: number
}

/** Réponse 200 de `GET /v1/inbox/threads`. */
export type ListInboxThreadsResponse = {
  /**
   * Page servie.
   */
  page: number
  /**
   * Taille de page.
   */
  pageSize: number
  threads: Array<{
    /**
     * Canal du fil.
     */
    channel: string
    /**
     * Correspondant.
     */
    contact: string
    /**
     * Dernier message REÇU.
     */
    lastBody: string
    /**
     * Horodatage de ce message.
     */
    lastAt: string
  }>
}

/** Paramètres de requête de `GET /v1/inbox/messages`. */
export interface ListInboxMessagesQuery {
  /**
   * Canal du fil (whatsapp_cloud | whatsapp_baileys | sms).
   */
  channel: 'whatsapp_baileys' | 'whatsapp_cloud' | 'sms'
  /**
   * Correspondant du fil.
   */
  contact: string
  /**
   * Page, à partir de 1.
   */
  page?: number
  /**
   * Taille de page — plafonnée à 500.
   */
  pageSize?: number
}

/** Réponse 200 de `GET /v1/inbox/messages`. */
export type ListInboxMessagesResponse = {
  /**
   * Page servie.
   */
  page: number
  /**
   * Taille de page.
   */
  pageSize: number
  messages: Array<{
    /**
     * Identifiant du message.
     */
    id: string
    /**
     * Canal.
     */
    channel: string
    /**
     * Sens du message.
     */
    direction: 'in' | 'out'
    /**
     * Émetteur.
     */
    fromAddr: string | null
    /**
     * Destinataire.
     */
    toAddr: string
    /**
     * Contenu.
     */
    body: string
    /**
     * Horodatage.
     */
    createdAt: string
  }>
}

/** Réponse 200 de `GET /v1/wa-templates`. */
export type ListWaTemplatesResponse = {
  templates: Array<{
    /**
     * Modèle.
     */
    id: string
    /**
     * Nom à passer en template.name à l’envoi.
     */
    name: string
    /**
     * Langue du modèle (fr, en, en_US…).
     */
    language: string
    /**
     * Catégorie à utiliser : l’effective si Meta l’a tranchée, sinon la demandée. C’est celle-ci
     * qu’il faut lire — les deux autres n’existent que pour comprendre un reclassement.
     */
    category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
    /**
     * Catégorie DEMANDÉE à la soumission.
     */
    requestedCategory: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
    /**
     * Catégorie RETENUE par Meta ; null tant qu’il n’a pas tranché. Meta reclasse — un modèle
     * demandé en UTILITY et retenu en MARKETING ne coûte pas le même prix.
     */
    effectiveCategory: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION' | null
    /**
     * Seul approved est envoyable.
     */
    status: 'draft' | 'pending' | 'approved' | 'rejected' | 'paused'
    /**
     * Modèle partagé de la plateforme : envoyable, non éditable.
     */
    platformShared: boolean
    /**
     * Corps approuvé, variables positionnelles comprises.
     */
    body: string
    /**
     * Pied de page.
     */
    footer: string
    /**
     * Valeurs d’exemple des variables du corps, dans l’ordre — celles soumises à la revue Meta.
     * Elles ne sont PAS envoyées : à l’envoi, vous fournissez les vôtres.
     */
    bodyExamples: Array<string>
    /**
     * Motif du refus Meta ; chaîne vide quand le modèle n’a pas été refusé.
     */
    rejectionReason: string
    /**
     * Note de qualité Meta, INDÉPENDANTE du statut ; null tant que le modèle n’a jamais été noté.
     * Un modèle approuvé passé en RED est en voie d’être mis en pause par Meta.
     */
    quality: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN' | null
    /**
     * Provenance du modèle. Métadonnée d’exploitation, sans effet sur l’envoi.
     */
    source: 'builder' | 'library' | 'synced' | 'manual'
    /**
     * Horodatage ISO 8601 de création.
     */
    createdAt: string
    /**
     * Horodatage ISO 8601 de la dernière modification.
     */
    updatedAt: string
    /**
     * En-tête du modèle. type vaut none (aucun en-tête), text (texte figé), ou image / video /
     * document — un en-tête MÉDIA ne fige que le FORMAT : le média réel se fournit à CHAQUE envoi,
     * dans le paramètre header. Les champs présents dépendent du type ; seul type est garanti.
     */
    header: {
      /**
       * Nature de l’en-tête.
       */
      type: 'none' | 'text' | 'image' | 'video' | 'document'
      /**
       * Texte figé de l’en-tête (type text uniquement), au plus une variable.
       */
      text?: string
      /**
       * Valeur d’exemple de la variable d’en-tête, quand il y en a une.
       */
      example?: string
      /**
       * Handle d’échantillon Meta exigé à la soumission d’un en-tête média. Sans usage à l’envoi.
       */
      exampleHandle?: string
    }
    /**
     * Boutons du modèle, DANS L’ORDRE — leur index est ce que Meta attend à l’envoi. Un bouton
     * copy_code ou otp signale un modèle qui attend un CODE ; un bouton url dont l’URL porte une
     * variable en attend un paramètre à chaque envoi. En omettre un fait échouer l’envoi APRÈS le
     * débit.
     */
    buttons: Array<{
      /**
       * Nature du bouton.
       */
      type: 'quick_reply' | 'url' | 'phone_number' | 'copy_code' | 'otp'
      /**
       * Libellé affiché ; absent d’un bouton copy_code.
       */
      text?: string
      /**
       * Destination d’un bouton url. Une variable {{n}} y impose un paramètre à l’envoi.
       */
      url?: string
      /**
       * Numéro appelé par un bouton phone_number.
       */
      phoneNumber?: string
      /**
       * Valeur d’exemple d’un bouton copy_code.
       */
      example?: string
      /**
       * Forme d’OTP exigée par Meta (bouton otp uniquement).
       */
      otpType?: 'copy_code' | 'one_tap' | 'zero_tap'
      /**
       * Position 1-based de la variable de CORPS qui porte le code. Meta exige que le code figure
       * dans le corps ET dans le bouton : la valeur du bouton est la recopie de cette variable,
       * jamais une saisie de plus. Absent = 1.
       */
      codeVariable?: number
    }>
  }>
}

/** Réponse 200 de `GET /v1/wa-cloud/numbers`. */
export type ListWaCloudNumbersResponse = {
  /**
   * Numéros enregistrés par le compte lui-même.
   */
  numbers: Array<{
    /**
     * Numéro.
     */
    id: string
    /**
     * Identifiant Meta du numéro.
     */
    phoneNumberId: string
    /**
     * Numéro affiché.
     */
    displayNumber: string
    /**
     * Un token est enregistré (sa valeur ne sort jamais).
     */
    hasToken: boolean
    /**
     * Enregistrement.
     */
    createdAt: string
  }>
  /**
   * La plateforme peut émettre pour vous si vous n’avez pas de numéro à vous.
   */
  platformFallbackAvailable: boolean
  /**
   * Émetteurs partagés explicites — identité vue par le destinataire seulement.
   */
  sharedSenders: Array<{
    /**
     * Nature de l’émetteur partagé. C’est elle qui dit COMMENT il s’identifie : le Cloud par son
     * nom vérifié, le Baileys par son numéro appairé.
     */
    kind: 'whatsapp_cloud' | 'whatsapp_baileys'
    /**
     * Canal servi.
     */
    channel: string
    /**
     * Nom vérifié affiché au destinataire (WhatsApp Cloud). TOUJOURS null pour un émetteur Baileys
     * : le nom vérifié est un concept Cloud, et un message Baileys arrive avec le NUMÉRO.
     */
    verifiedName: string | null
    /**
     * Numéro appairé, tel que le destinataire le verra. TOUJOURS null côté Cloud — le numéro
     * plateforme reste un secret. Côté Baileys, null seulement dans la fenêtre où la session est
     * connectée mais où le numéro n’a pas encore été remonté.
     */
    pairedNumber: string | null
    /**
     * Toujours true : un émetteur partagé sert les envois À SENS UNIQUE (codes, alertes,
     * notifications). Les réponses des destinataires ne vous reviennent pas.
     */
    oneWay: boolean
    /**
     * Poignée de désignation de l’émetteur Baileys partagé, absente de l’entrée Cloud. Ce n’est
     * pas un credential : le partagé est ouvert à tout compte.
     */
    sessionId?: string
  }>
}

/** Réponse 200 de `GET /v1/webhooks`. */
export type ListWebhooksResponse = {
  endpoints: Array<{
    /**
     * Identifiant de l’endpoint.
     */
    id: string
    /**
     * Libellé.
     */
    name: string
    /**
     * URL appelée.
     */
    url: string
    /**
     * Événements souscrits.
     */
    events: Array<string>
    /**
     * Révocation — null tant que l’endpoint est actif.
     */
    revokedAt: string | null
    /**
     * Création.
     */
    createdAt: string
  }>
}

/** Corps de `POST /v1/webhooks`. */
export interface CreateWebhookBody {
  /**
   * Libellé libre.
   */
  name: string
  /**
   * URL http(s) que nous appellerons.
   */
  url: string
  /**
   * Événements souscrits. message.failed porte failureCode, la même énumération que GET
   * /v1/messages.
   */
  events: Array<'message.sent' | 'message.failed' | 'message.inbound'>
}

/** Réponse 201 de `POST /v1/webhooks`. */
export type CreateWebhookResponse = {
  /**
   * Identifiant de l’endpoint.
   */
  id: string
  /**
   * Libellé.
   */
  name: string
  /**
   * URL appelée.
   */
  url: string
  /**
   * Événements souscrits.
   */
  events: Array<string>
  /**
   * Toujours null ici : l’endpoint vient d’être créé. Le champ est présent pour que la réponse
   * de création ait la MÊME forme qu’une ligne de GET /v1/webhooks, et qu’un client puisse la
   * ranger dans sa liste sans cas particulier.
   */
  revokedAt: string | null
  /**
   * Création.
   */
  createdAt: string
  /**
   * Secret de signature — rendu une seule fois, jamais relisible.
   */
  secret: string
}

/** Réponse 200 de `POST /v1/webhooks/{id}/revoke`. */
export type RevokeWebhookResponse = {
  /**
   * Identifiant de l’endpoint.
   */
  id: string
  /**
   * Toujours true.
   */
  revoked: boolean
}

/** Paramètres de requête de `GET /v1/webhooks/deliveries`. */
export interface ListWebhookDeliveriesQuery {
  /**
   * Page, à partir de 1.
   */
  page?: number
  /**
   * Taille de page — plafonnée à 200.
   */
  pageSize?: number
  /**
   * Filtre d’issue : pending | failed_retrying | succeeded | failed_permanent.
   */
  status?: 'pending' | 'failed_retrying' | 'succeeded' | 'failed_permanent'
}

/** Réponse 200 de `GET /v1/webhooks/deliveries`. */
export type ListWebhookDeliveriesResponse = {
  /**
   * Page servie.
   */
  page: number
  /**
   * Taille de page.
   */
  pageSize: number
  /**
   * Total de la vue filtrée.
   */
  total: number
  aggregates: {
    /**
     * Livrées.
     */
    succeeded: number
    /**
     * Abandonnées.
     */
    failedPermanent: number
    /**
     * Pas encore tranchées.
     */
    inFlight: number
  }
  deliveries: Array<{
    /**
     * Livraison.
     */
    id: string
    /**
     * Endpoint visé.
     */
    endpointId: string
    /**
     * Événement livré.
     */
    eventType: string
    /**
     * Issue.
     */
    status: string
    /**
     * Numéro de tentative.
     */
    attempt: number
    /**
     * Statut HTTP renvoyé par VOTRE serveur.
     */
    httpStatus: number | null
    /**
     * Erreur de transport.
     */
    error: string | null
    /**
     * Durée de l’appel, en millisecondes ; null si la tentative n’a jamais abouti à une réponse.
     * C’est ce qui distingue « votre serveur a refusé » de « votre serveur n’a pas répondu à temps
     * ».
     */
    durationMs: number | null
    /**
     * La livraison porte un événement émis par une clé de test. Un endpoint reçoit les DEUX : ce
     * drapeau est ce qui permet de les distinguer côté client.
     */
    testMode: boolean
    /**
     * Tentative.
     */
    createdAt: string
    /**
     * Horodatage de l’issue TERMINALE (succès ou échec définitif) ; null tant que la livraison est
     * en attente ou en retentative.
     */
    deliveredAt: string | null
  }>
}

/** Le descripteur d'une opération du contrat, tel que le transport le consomme. */
export interface OperationDescriptor {
  readonly operationId: string
  readonly method: 'GET' | 'POST' | 'DELETE'
  readonly path: string
  readonly pathParams: readonly string[]
  readonly queryParams: readonly string[]
  readonly requiredQueryParams: readonly string[]
  readonly requiredBodyFields: readonly string[]
  readonly contentType: 'application/json' | 'multipart/form-data' | null
  readonly successStatus: string
  /**
   * true = l'appel produit un effet RÉEL et FACTURÉ avec une clé `sk_live_`. Le transport s'en
   * sert pour refuser tout retry qui ne serait pas protégé par une clé d'idempotence.
   */
  readonly billableSideEffect: boolean
}

/** LA surface publique, dérivée du contrat. Une opération absente d'ici n'existe pas. */
export const OPERATIONS = {
  sendMessage: {
    operationId: 'sendMessage',
    method: 'POST',
    path: '/v1/messages',
    pathParams: [],
    queryParams: [],
    requiredQueryParams: [],
    requiredBodyFields: ['channel', 'to', 'idempotencyKey'],
    contentType: 'application/json',
    successStatus: '200',
    billableSideEffect: true,
  },
  getMessage: {
    operationId: 'getMessage',
    method: 'GET',
    path: '/v1/messages/{id}',
    pathParams: ['id'],
    queryParams: [],
    requiredQueryParams: [],
    requiredBodyFields: [],
    contentType: null,
    successStatus: '200',
    billableSideEffect: false,
  },
  listMessages: {
    operationId: 'listMessages',
    method: 'GET',
    path: '/v1/messages',
    pathParams: [],
    queryParams: ['page', 'pageSize', 'sort', 'dir', 'channel', 'status', 'from', 'to', 'via'],
    requiredQueryParams: [],
    requiredBodyFields: [],
    contentType: null,
    successStatus: '200',
    billableSideEffect: false,
  },
  uploadMedia: {
    operationId: 'uploadMedia',
    method: 'POST',
    path: '/v1/wa-media',
    pathParams: [],
    queryParams: [],
    requiredQueryParams: [],
    requiredBodyFields: ['file'],
    contentType: 'multipart/form-data',
    successStatus: '201',
    billableSideEffect: false,
  },
  listMedia: {
    operationId: 'listMedia',
    method: 'GET',
    path: '/v1/wa-media',
    pathParams: [],
    queryParams: ['page', 'pageSize'],
    requiredQueryParams: [],
    requiredBodyFields: [],
    contentType: null,
    successStatus: '200',
    billableSideEffect: false,
  },
  deleteMedia: {
    operationId: 'deleteMedia',
    method: 'DELETE',
    path: '/v1/wa-media/{id}',
    pathParams: ['id'],
    queryParams: [],
    requiredQueryParams: [],
    requiredBodyFields: [],
    contentType: null,
    successStatus: '204',
    billableSideEffect: false,
  },
  listPrices: {
    operationId: 'listPrices',
    method: 'GET',
    path: '/v1/prices',
    pathParams: [],
    queryParams: [],
    requiredQueryParams: [],
    requiredBodyFields: [],
    contentType: null,
    successStatus: '200',
    billableSideEffect: false,
  },
  getBalance: {
    operationId: 'getBalance',
    method: 'GET',
    path: '/v1/balance',
    pathParams: [],
    queryParams: ['currency'],
    requiredQueryParams: [],
    requiredBodyFields: [],
    contentType: null,
    successStatus: '200',
    billableSideEffect: false,
  },
  listCurrencies: {
    operationId: 'listCurrencies',
    method: 'GET',
    path: '/v1/currencies',
    pathParams: [],
    queryParams: [],
    requiredQueryParams: [],
    requiredBodyFields: [],
    contentType: null,
    successStatus: '200',
    billableSideEffect: false,
  },
  listSenderIds: {
    operationId: 'listSenderIds',
    method: 'GET',
    path: '/v1/sender-ids',
    pathParams: [],
    queryParams: [],
    requiredQueryParams: [],
    requiredBodyFields: [],
    contentType: null,
    successStatus: '200',
    billableSideEffect: false,
  },
  estimateMessage: {
    operationId: 'estimateMessage',
    method: 'POST',
    path: '/v1/messages/estimate',
    pathParams: [],
    queryParams: [],
    requiredQueryParams: [],
    requiredBodyFields: ['channel', 'text', 'recipients'],
    contentType: 'application/json',
    successStatus: '200',
    billableSideEffect: false,
  },
  listLedger: {
    operationId: 'listLedger',
    method: 'GET',
    path: '/v1/ledger',
    pathParams: [],
    queryParams: ['page', 'pageSize', 'kind', 'from', 'to', 'sort', 'dir', 'channel', 'q'],
    requiredQueryParams: [],
    requiredBodyFields: [],
    contentType: null,
    successStatus: '200',
    billableSideEffect: false,
  },
  listInboxThreads: {
    operationId: 'listInboxThreads',
    method: 'GET',
    path: '/v1/inbox/threads',
    pathParams: [],
    queryParams: ['page', 'pageSize'],
    requiredQueryParams: [],
    requiredBodyFields: [],
    contentType: null,
    successStatus: '200',
    billableSideEffect: false,
  },
  listInboxMessages: {
    operationId: 'listInboxMessages',
    method: 'GET',
    path: '/v1/inbox/messages',
    pathParams: [],
    queryParams: ['channel', 'contact', 'page', 'pageSize'],
    requiredQueryParams: ['channel', 'contact'],
    requiredBodyFields: [],
    contentType: null,
    successStatus: '200',
    billableSideEffect: false,
  },
  listWaTemplates: {
    operationId: 'listWaTemplates',
    method: 'GET',
    path: '/v1/wa-templates',
    pathParams: [],
    queryParams: [],
    requiredQueryParams: [],
    requiredBodyFields: [],
    contentType: null,
    successStatus: '200',
    billableSideEffect: false,
  },
  listWaCloudNumbers: {
    operationId: 'listWaCloudNumbers',
    method: 'GET',
    path: '/v1/wa-cloud/numbers',
    pathParams: [],
    queryParams: [],
    requiredQueryParams: [],
    requiredBodyFields: [],
    contentType: null,
    successStatus: '200',
    billableSideEffect: false,
  },
  listWebhooks: {
    operationId: 'listWebhooks',
    method: 'GET',
    path: '/v1/webhooks',
    pathParams: [],
    queryParams: [],
    requiredQueryParams: [],
    requiredBodyFields: [],
    contentType: null,
    successStatus: '200',
    billableSideEffect: false,
  },
  createWebhook: {
    operationId: 'createWebhook',
    method: 'POST',
    path: '/v1/webhooks',
    pathParams: [],
    queryParams: [],
    requiredQueryParams: [],
    requiredBodyFields: ['name', 'url', 'events'],
    contentType: 'application/json',
    successStatus: '201',
    billableSideEffect: false,
  },
  revokeWebhook: {
    operationId: 'revokeWebhook',
    method: 'POST',
    path: '/v1/webhooks/{id}/revoke',
    pathParams: ['id'],
    queryParams: [],
    requiredQueryParams: [],
    requiredBodyFields: [],
    contentType: null,
    successStatus: '200',
    billableSideEffect: false,
  },
  listWebhookDeliveries: {
    operationId: 'listWebhookDeliveries',
    method: 'GET',
    path: '/v1/webhooks/deliveries',
    pathParams: [],
    queryParams: ['page', 'pageSize', 'status'],
    requiredQueryParams: [],
    requiredBodyFields: [],
    contentType: null,
    successStatus: '200',
    billableSideEffect: false,
  },
} as const satisfies Record<string, OperationDescriptor>

/** L'identifiant de chaque opération du contrat. */
export type OperationId = keyof typeof OPERATIONS

/** Les identifiants, à l'exécution — c'est sur eux que porte le test de conformité. */
export const OPERATION_IDS = [
  'sendMessage',
  'getMessage',
  'listMessages',
  'uploadMedia',
  'listMedia',
  'deleteMedia',
  'listPrices',
  'getBalance',
  'listCurrencies',
  'listSenderIds',
  'estimateMessage',
  'listLedger',
  'listInboxThreads',
  'listInboxMessages',
  'listWaTemplates',
  'listWaCloudNumbers',
  'listWebhooks',
  'createWebhook',
  'revokeWebhook',
  'listWebhookDeliveries',
] as const
