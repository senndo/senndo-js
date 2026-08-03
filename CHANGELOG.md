# Journal des versions — `senndo`

Ce paquet suit le [versionnage sémantique](https://semver.org/lang/fr/). Tant que la version
majeure est `0`, la surface publique peut évoluer d'une mineure à l'autre : le produit bouge
encore, et prétendre à une API stable serait une promesse qu'on ne peut pas tenir.

## 0.1.2 — 2026-08-02

Quatre champs de plus, trouvés non par une sonde mais par un **gate statique** : la campagne live
de `0.1.1` n'observait que ce que l'état courant du serveur produisait, et l'observé n'est qu'une
borne inférieure de l'écart. Le gate, lui, compare les types de TOUTES les réponses aux schémas du
contrat, sans réseau et sans compte.

### Corrigé

- `createWebhook.revokedAt` — toujours `null` à la création, mais présent : la réponse de création
  a donc la MÊME forme qu'une ligne de `listWebhooks`, et se range dans une liste sans cas
  particulier. L'exemple du contrat le portait déjà ; le schéma, non.
- `listWebhookDeliveries.deliveries[]` — `durationMs` (ce qui distingue « votre serveur a refusé »
  de « votre serveur n'a pas répondu à temps »), `testMode` (un endpoint reçoit les événements de
  test ET de production : c'est ce drapeau qui les sépare) et `deliveredAt` (horodatage de l'issue
  terminale).

### Note

`0.1.1` n'a atteint que npm et PyPI ; Packagist ne l'a jamais vue. `0.1.2` atterrit sur les trois
registres ensemble — un paquet PHP qui passe de `0.1.0` à `0.1.2` ne saute donc rien.

## 0.1.1 — 2026-08-02

Première confrontation des trois SDK à l'API **réelle** (`scripts/sdk-live/`). Les gates
prouvaient la fidélité de l'émetteur au contrat et le comportement du transport face à un serveur
simulé ; aucun ne prouvait que le SERVEUR répond ce que le contrat annonce. Il ne le faisait pas
partout.

### Corrigé

- **21 champs que l'API renvoie et que le contrat ne décrivait pas** sont désormais typés — donc
  visibles à l'autocomplétion au lieu d'être invisibles au client. `listSenderIds` (`canReview`,
  `ownerAccountId`, `ownerName`, `verification`, `createdAt`, `suspensionReason`, `suspendedAt`,
  `archivedAt`), `listWaTemplates` (`requestedCategory`, `effectiveCategory`, `rejectionReason`,
  `quality`, `source`, `header`, `bodyExamples`, `buttons`, `createdAt`, `updatedAt`),
  `listWaCloudNumbers.sharedSenders` (`kind`, `oneWay`, `sessionId`), `listLedger.rows`
  (`receiptRef`).

  Deux d'entre eux valaient à eux seuls la version : `buttons` est ce qui dit qu'un modèle attend
  un CODE à l'envoi — l'omettre fait échouer l'envoi APRÈS le débit ; `effectiveCategory` est la
  catégorie que Meta a réellement retenue, et un modèle demandé en UTILITY puis reclassé en
  MARKETING ne coûte pas le même prix.

### Note

Aucun écart n'était propre à un SDK : les trois recevaient exactement les mêmes champs non
documentés. La génération faisait son travail ; c'est la source qui était incomplète.

## 0.1.0 — 2026-08-02

Première version. Couvre les **20 opérations** de l'API publique senndo, dérivées du contrat.

### Ajouté

- `SenndoClient` — une méthode par opération, nommée exactement comme son `operationId` :
  envoi et estimation, relecture et journal des messages, média (téléverser, lister, supprimer),
  solde, devises, tarifs, Sender IDs, grand livre, réception, modèles WhatsApp, numéros WhatsApp
  Cloud, webhooks (lister, créer, révoquer, livraisons).
- Erreurs typées par famille, choisies sur le **statut HTTP** : `SenndoInsufficientFundsError`,
  `SenndoRateLimitError`, `SenndoValidationError`, `SenndoAuthError`, `SenndoForbiddenError`,
  `SenndoNotFoundError`, `SenndoConflictError`, `SenndoPayloadTooLargeError`,
  `SenndoUnsupportedMediaTypeError`, `SenndoServiceUnavailableError`. Le code reste lisible sur
  `error.code`, en union **ouverte**.
- Erreurs de transport distinctes : `SenndoTimeoutError`, `SenndoAbortError`,
  `SenndoConnectionError`, `SenndoProtocolError`, et `SenndoRequestError` pour les refus **locaux**
  (avant tout appel réseau).
- Politique de retentative explicite : `GET` et `DELETE` toujours rejouables ; un `POST` seulement
  s'il porte une clé d'idempotence ; jamais un 4xx hors 429. `createWebhook` n'est donc jamais
  rejoué automatiquement.
- Validation **locale** avant appel : champs et paramètres obligatoires, préfixes d'idempotence
  réservés, et la règle qu'`required` ne sait pas exprimer — un envoi porte du contenu par au moins
  un de `text`, `media`, `template`.
- Téléversement multipart construit par le SDK, sans `FormData` ni `Blob`.
- Clé API masquée dans `toString()`, `toJSON()` et l'inspection Node.
- Sorties ESM **et** CommonJS. Zéro dépendance d'exécution.
- `newIdempotencyKey()`, `KNOWN_FAILURE_CODES`, `OPERATIONS`, `SENNDO_API_BASE_URL`.

### Notes

- Le SDK **ne génère pas** de clé d'idempotence à votre place. Voir le README : une clé fabriquée
  par appel ne protège de rien de plus que ce que le SDK fait déjà, et supprime le seul moment où
  vous êtes forcé d'y penser.
- Tous les montants sont des **chaînes décimales**. Ne les additionnez pas avec `+`.
