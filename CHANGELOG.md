# Journal des versions — `senndo`

Ce paquet suit le [versionnage sémantique](https://semver.org/lang/fr/). Depuis `1.0.0`, la
surface publique est STABLE : elle ne casse qu'à une majeure.

## 1.0.2 — 2026-08-10

**Si vous filtrez des Sender IDs par pays, mettez à jour votre code.** Le README publié avec
`1.0.1` donnait cet exemple :

```ts
emetteur.countries.some((pays) => pays.country === 'FRA' && pays.status === 'approved')
```

`countries[].country` est en ISO 3166-1 **alpha-2**, pas alpha-3 : ce filtre rendait
systématiquement une liste vide, sans erreur. Le bon code est `'FR'`. L'extrait est corrigé, et un
gate vérifie désormais chaque littéral pays des extraits contre le système de codes du champ
auquel il s'applique — il aurait refusé `'FRA'`.

### Ajouté — deux alias qui NOMMENT le système de codes

`CountryIso3` et `CountryAlpha2` sont exportés et portés par les trois champs `country` du
contrat. Ce sont des `string` : rien ne cesse de compiler. Ils existent parce que le contrat
portait deux systèmes de codes sous un seul type, et que l'autocomplétion ne disait pas lequel.

| Champ | Système |
|---|---|
| `sendMessage` → `country` | `CountryIso3` — « CIV », « FRA » |
| `estimateMessage` → `country` | `CountryIso3` — « CIV », « FRA » |
| `listSenderIds` → `senderIds[].countries[].country` | `CountryAlpha2` — « CI », « FR » |

### Corrigé — le contrat annonçait le mauvais système sur le devis

`estimateMessage` documentait `country` en alpha-2 quand le moteur de routage le matche en
alpha-3. Un devis publié avec « FR » ne matchait aucune règle pays : la cascade retombait en
silence sur la route par défaut et le devis annonçait **un prix qui n'était pas celui du débit**.
La description dit désormais alpha-3.

### Changé — un `country` inconnu est REFUSÉ, plus ignoré

`sendMessage` et `estimateMessage` répondent `400 COUNTRY_INVALID` quand `country` ne désigne
aucun pays du catalogue ISO 3166-1 — y compris un code de la bonne longueur mais inexistant. Sur
l'envoi, le refus arrive **avant tout débit**. Auparavant, une valeur de ce genre était acceptée
et l'envoi partait, facturé, sur une route que vous n'aviez pas demandée.

Ce n'est pas cassant pour un appel correct : `country` absent, vide, ou en alpha-3 valide (casse
et espaces indifférents) se comporte exactement comme avant.

### Aussi dans ce tarball — un correctif du 8 août jamais publié

`SenndoErrorCode` a gagné `IDEMPOTENCY_PAYLOAD_MISMATCH` dans le dépôt le 2026-08-08 (une clé
d'idempotence rejouée avec un corps DIFFÉRENT est refusée en `409` plutôt que de rendre la réponse
de l'envoi d'origine). Le tarball `1.0.1` ne le porte pas — il est parti avant. `COUNTRY_INVALID`
s'y ajoute avec cette version. L'union reste **ouverte** : ces ajouts ne cassent personne.

## 1.0.1 — 2026-08-05

**Si vous avez installé `1.0.0`, mettez à jour.** Le tarball npm de `1.0.0` embarquait un `dist/`
périmé de deux jours : son manifeste annonçait `1.0.0`, son code disait `0.1.3` et ne portait PAS
le refus de redirection — la version publiée POUR corriger ce défaut le contenait donc toujours.
Aucun `prepublishOnly` n'existait, donc `npm publish` a expédié le build qui traînait sur le
disque. `1.0.0` est déprécié sur npm.

Un `prepublishOnly` reconstruit désormais le `dist/` et `scripts/assert-dist-fresh.mjs` refuse la
publication si le build ne correspond pas aux sources — par la version compilée, et par
l'horodatage pour le cas d'un correctif sans changement de version.

Aucun changement de code par rapport à `1.0.0` : seuls le build et la garde de publication.

## 1.0.0 — 2026-08-05

Première version **stable**. senndo passe en v1 et le SDK suit : les 20 opérations de la surface
publique sont figées et gardées par les gates de conformité.

### Corrigé — sécurité et argent (audit batch)

- **Les redirections HTTP ne sont plus suivies.** `fetch` et `urllib` les suivaient par défaut et
  **dégradent un POST en GET** sur 301/302. Or `POST /v1/messages` (envoyer) et
  `GET /v1/messages` (lire le journal) partagent le chemin : un 301 sur l'hôte d'API — une
  redirection http→https de bord suffit — transformait un **envoi facturé en lecture, rendue comme
  un succès**. Le SDK échoue désormais bruyamment : une base d'URL se corrige dans la
  configuration, jamais en silence à l'exécution.
- **(Python) La clé d'API ne fuit plus vers l'hôte de redirection.** `urllib` rejouait les en-têtes
  d'origine, `Authorization` compris : une clé `sk_live_` partait chez un tiers. Si vous avez
  utilisé une version 0.1.x derrière une URL susceptible de rediriger, **faites tourner vos clés**.
- **`estimateMessage` accepte `tier`.** Le serveur le lisait déjà ; le contrat ne le déclarait pas,
  donc aucun SDK ne pouvait le transmettre — un devis annonçait le tarif *standard* pour un envoi
  qui partirait en *premium*. Le devis et le débit s'accordent enfin.
- **`listLedger(kind)` et `listWebhookDeliveries(status)` sont des énumérations.** Elles étaient
  typées `string` ; une valeur hors liste ne provoquait aucune erreur — le filtre tombait
  silencieusement et la requête rendait **tout**. Une réconciliation comptable pouvait surcompter
  sans le moindre signal.

## 0.1.3 — 2026-08-03

Le gate serveur↔contrat descend désormais jusqu'à la **feuille** et compare trois axes : le type
de base, l'obligation, la nullité. Il a trouvé **43 écarts, tous dans le même sens** — le contrat
annonçait facultatif ce que la route rend toujours. Aucun n'était dangereux (aucun champ promis
n'était absent de la réponse) et tous coûtaient la même chose : une branche morte à écrire, pour
un cas qui ne se produit jamais.

### Corrigé

- `MessageStatus` gagne **`unknown`**. Le serveur le rend depuis toujours — c'est le statut d'un
  envoi dont l'issue est indéterminée : réconciliation d'un opérateur qui n'a jamais accusé, ou
  verdict qui n'est pas arrivé. L'union publiée n'en décrivait que sept.
- **42 champs cessent d'être facultatifs** dans les réponses. Les plus visibles : `senderId`,
  `routeRuleId`, `billedAmountUsd`, `billedCurrency`, `reversedAmountUsd`, `failureCode`,
  `category`, `body`, `source`, `toAddr`, `fromAddr`, `status` du journal, `previewUrl`,
  `balanceAfter`, `closingBalanceUsd`, `revokedAt`, `httpStatus`, `durationMs`, `deliveredAt`,
  `testMode`, `transliterateGsm7`, `transliterated`. Ils sont **présents dans chaque réponse** ;
  `null` reste possible là où il l'était déjà, mais la clé, elle, ne manque jamais.
- `listWaCloudNumbers[].displayNumber` cesse d'être **nullable** : la colonne est `NOT NULL
  DEFAULT ''`, donc le champ est une chaîne — éventuellement vide, jamais `null`.

### Note — ce qui peut ne plus compiler chez vous

Ces deux corrections ne retirent rien à la réponse, mais elles **resserrent des types**, et un
type plus étroit peut faire échouer une compilation qui passait :

- un `switch` exhaustif sur `MessageStatus` avec garde `never` doit maintenant traiter `unknown` ;
- un test `=== undefined` sur l'un des 42 champs devient une comparaison sans recouvrement, que
  TypeScript signale. La branche était morte : le champ était déjà toujours là.

`0.1.2` restera disponible sur npm ; nous ne dépublions rien.

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
