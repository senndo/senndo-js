# Journal des versions — `senndo`

Ce paquet suit le [versionnage sémantique](https://semver.org/lang/fr/). Tant que la version
majeure est `0`, la surface publique peut évoluer d'une mineure à l'autre : le produit bouge
encore, et prétendre à une API stable serait une promesse qu'on ne peut pas tenir.

## 0.1.0 — non publiée

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
