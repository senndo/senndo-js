# senndo

SDK officiel TypeScript / JavaScript de l'API [senndo](https://senndo.com) — SMS, WhatsApp, e-mail,
voix, et les lectures de compte qui vont avec (solde, tarifs, Sender IDs, grand livre, webhooks).

Zéro dépendance. ESM et CommonJS. Types dérivés du contrat, pas recopiés.

## Installation

Le paquet est unique : les quatre gestionnaires installent le même artefact.

```bash
npm install @senndo/sdk
pnpm add @senndo/sdk
bun add @senndo/sdk
yarn add @senndo/sdk
```

Node ≥ 18 (pour `fetch` natif), ou n'importe quel runtime qui en fournit un — navigateur, Bun,
Deno, worker de bord. Sur une plateforme sans `fetch`, passez le vôtre à la construction.

## Démarrer

```ts
import { SenndoClient } from '@senndo/sdk'

// La clé se crée dans la console, écran « REST API ». Ne la committez jamais.
const senndo = new SenndoClient({ apiKey: cleApi })

const message = await senndo.sendMessage({
  channel: 'sms',
  to: '+15550001111',
  text: 'Votre code de connexion est 424242.',
  idempotencyKey: `otp-${utilisateurId}-${tentative}`,
})

console.log(message.id, message.status, message.billedAmountUsd)
```

Une clé `sk_test_…` simule la livraison et ne déplace aucun argent. Une clé `sk_live_…` débite le
solde à l'envoi.

## La clé d'idempotence, et pourquoi le SDK n'en invente pas

`idempotencyKey` est obligatoire, et **le SDK ne la génère pas à votre place**. C'est délibéré.

Sa valeur tient dans sa **stabilité à travers vos retentatives** : si votre application rappelle
`sendMessage` après un délai dépassé, une clé fabriquée à chaque appel serait différente — et le
compte serait débité deux fois, précisément le sinistre que la clé existe pour empêcher. Le SDK
réutilise déjà la vôtre à travers ses propres retentatives de transport ; en inventer une
n'ajouterait aucune protection, mais supprimerait le seul moment où vous êtes forcé d'y penser.

Dérivez-la de **votre** domaine, de sorte que deux exécutions du même geste métier portent la même
valeur :

```ts
await senndo.sendMessage({
  channel: 'sms',
  to: commande.telephone,
  text: `Votre commande ${commande.reference} est expédiée.`,
  idempotencyKey: `expedition-${commande.reference}`,
})
```

Quand aucun identifiant stable n'existe, `newIdempotencyKey()` en fabrique une :

```ts
await senndo.sendMessage({
  channel: 'sms',
  to: '+15550001111',
  text: 'Message ponctuel.',
  idempotencyKey: newIdempotencyKey('ponctuel'),
})
```

Rejouer une clé déjà connue renvoie le message d'origine avec `replay: true`, sans nouveau débit.

## Les erreurs sont typées — ne lisez jamais un message

`error.code` est stable, `error.message` est un libellé humain qui évolue. Branchez sur la classe
ou sur le code, jamais sur la chaîne.

```ts
try {
  await senndo.sendMessage({
    channel: 'sms',
    to: '+15550001111',
    text: 'bonjour',
    idempotencyKey: 'demo-1',
  })
} catch (erreur) {
  if (erreur instanceof SenndoInsufficientFundsError) {
    await rechargerLeCompte()
  } else if (erreur instanceof SenndoRateLimitError) {
    await attendre((erreur.retryAfterSeconds ?? 5) * 1000)
  } else if (erreur instanceof SenndoValidationError) {
    journaliser(erreur.code, erreur.apiMessage)
  } else if (erreur instanceof SenndoError) {
    throw erreur
  }
}
```

| Statut | Classe | Ce que ça veut dire |
| --- | --- | --- |
| 400 / 422 | `SenndoValidationError` | La requête est irrecevable. Corrigez l'appel. |
| 401 | `SenndoAuthError` | Clé absente, inconnue ou révoquée. |
| 402 | `SenndoInsufficientFundsError` | Solde insuffisant. Rechargez. |
| 403 | `SenndoForbiddenError` | Allowlist d'IP, compte suspendu, contenu bloqué. |
| 404 | `SenndoNotFoundError` | Introuvable, ou hors de votre compte. |
| 409 | `SenndoConflictError` | Conflit d'état (média référencé, quota). |
| 413 / 415 | `SenndoPayloadTooLargeError` / `SenndoUnsupportedMediaTypeError` | Corps trop volumineux (`FILE_TOO_LARGE` sur un fichier, `BODY_TOO_LARGE` sur un corps JSON), type refusé. |
| 429 | `SenndoRateLimitError` | Cadence dépassée ; `retryAfterSeconds`. |
| 503 | `SenndoServiceUnavailableError` | Le canal ne peut pas livrer **maintenant**. Rien n'a été débité. |

Avant tout appel réseau, le SDK peut lever `SenndoRequestError` : champ obligatoire absent, envoi
sans contenu, préfixe d'idempotence réservé. Ces refus ne coûtent ni aller-retour ni risque de
débit.

## Retentatives : ce qui est rejoué, et ce qui ne l'est jamais

- `GET` et `DELETE` sont rejoués sur échec de transport, 429 et 5xx.
- Un `POST` n'est rejoué **que** s'il porte une clé d'idempotence — donc `sendMessage`, et rien
  d'autre.
- `createWebhook` n'est **jamais** rejoué automatiquement : un doublon créerait deux endpoints,
  donc deux livraisons pour chaque événement futur.
- Aucun 4xx hors 429 n'est rejoué : rejoué à l'identique, il échoue à l'identique.

`maxRetries` vaut 2 par défaut, à la construction ou par appel. `0` désactive.

## Les montants sont des chaînes décimales

Tout montant renvoyé par l'API est une **chaîne**, jamais un `number`. Un `NUMERIC(18,6)` passé par
un double IEEE-754 perd des unités sur les longues traînes, et un prix unitaire sub-centime arrondi
à deux décimales devient zéro. Additionnez-les avec une bibliothèque décimale ou en micro-unités
entières — jamais avec `+`.

Et la dépense **nette** d'un message est `billedAmountUsd − reversedAmountUsd` : sommer le brut
surestime de tout ce qui a été contre-passé.

```ts
const journal = await senndo.listLedger({ page: 1, pageSize: 100 })
const bruteEnMicros = journal.rows.reduce(
  (total, ligne) => total + Math.round(Number(ligne.amountUsd) * 1_000_000),
  0,
)
```

## WhatsApp : modèle et média

Hors fenêtre de 24 heures, WhatsApp Cloud n'accepte pas de texte libre : il faut un modèle
approuvé. Le corps du modèle **est** le contenu — `text` devient inutile.

```ts
await senndo.sendMessage({
  channel: 'whatsapp_cloud',
  to: '+15550001111',
  template: { name: 'official_otp_code_template', language: 'fr', variables: ['424242'] },
  idempotencyKey: `otp-${utilisateurId}-${tentative}`,
})
```

Une pièce jointe se téléverse une fois, puis se réutilise par sa référence :

```ts
const fichier = await senndo.uploadMedia({
  file: octets,
  fileName: 'visuel.png',
  contentType: 'image/png',
})

await senndo.sendMessage({
  channel: 'whatsapp_cloud',
  to: '+15550001111',
  media: { ref: fichier.ref },
  idempotencyKey: `visuel-${fichier.ref}`,
})
```

## Tous les canaux

Le même appel sert les six canaux ; seul le contenu change.

```ts
// E-mail : `senderId` est une adresse vérifiée de votre compte, `subject` est obligatoire.
await senndo.sendMessage({
  channel: 'email',
  to: 'client@example.com',
  senderId: 'contact@example.com',
  subject: 'Votre commande est expédiée',
  text: 'Bonjour, votre colis est en route.',
  idempotencyKey: `expedition-${commande.reference}`,
})

// WhatsApp Twilio : un modèle Twilio approuvé (`HX…`) et ses variables numérotées.
await senndo.sendMessage({
  channel: 'whatsapp_twilio',
  to: '+15550001111',
  content: { sid: 'HX00000000000000000000000000000000', variables: { '1': '424242' } },
  idempotencyKey: `otp-twilio-${utilisateurId}-${tentative}`,
})
```

Un nom de modèle WhatsApp Cloud qui existe en plusieurs langues exige `template.language`, sans
quoi l'envoi est refusé en `422 TEMPLATE_LANGUAGE_REQUIRED`. Ce que votre compte peut réellement
utiliser se lit avant d'envoyer :

```ts
const { senderIds } = await senndo.listSenderIds()
const actifs = senderIds.filter((s) => s.lifecycleStatus === 'active').map((s) => s.value)

const { templates } = await senndo.listWaTemplates()
const otp = templates.find((t) => t.category === 'AUTHENTICATION')
journaliser(actifs, otp?.name, otp?.language)
```

## Quand un statut est-il définitif ?

`delivered`, `read` et `failed` sont définitifs. `sent` dit que l'opérateur a pris le message en
charge ; tant que `verdictPending` vaut `true`, aucune preuve de remise n'est encore arrivée.
Certaines routes n'émettent jamais d'accusé de remise : `sent` peut alors rester le dernier mot.
Un `failed` rendu par le fournisseur avant toute remise est contre-passé :
`reversedAmountUsd` porte le montant rendu.

## Lectures de compte

```ts
const solde = await senndo.getBalance({ currency: 'EUR' })
const devises = await senndo.listCurrencies()
const emetteurs = await senndo.listSenderIds()
const tarifs = await senndo.listPrices()
```

`getBalance` refuse une devise non armée (`CURRENCY_NOT_ARMED`) plutôt que de rendre des dollars
sous une autre étiquette — le SDK ne rattrape pas ce refus.

Un Sender ID porte un statut de cycle de vie **et** une approbation par pays : proposer un émetteur
sans lire `countries` conduit à un envoi refusé sur une destination où il n'est pas approuvé.

```ts
const emetteursDuCompte = await senndo.listSenderIds()

const utilisables = emetteursDuCompte.senderIds.filter(
  (emetteur) =>
    emetteur.lifecycleStatus === 'active' &&
    emetteur.countries.some((pays) => pays.country === 'FR' && pays.status === 'approved'),
)
```

Dans `listPrices`, `costs` est ce que **vous** payez à votre fournisseur direct et `prices` ce que
**vous** facturez à vos comptes enfants. Aucun coût de plateforme, aucun tarif d'un compte voisin
n'entre dans cette réponse.

## Codes d'échec

`failureCode` est renseigné sur tout message `failed`, et `null` partout ailleurs. senndo **ajoute**
des valeurs et n'en retire jamais : le type est une union **ouverte**, et le SDK ne lève pas sur une
valeur qu'il ne connaît pas encore.

```ts
const message = await senndo.getMessage(identifiantDuMessage)

if (message.status === 'failed') {
  const connu = KNOWN_FAILURE_CODES.some((code) => code === message.failureCode)
  journaliser(connu ? `échec: ${message.failureCode}` : `échec inconnu: ${message.failureCode}`)
}
```

## Webhooks

Le secret n'est lisible **qu'à la création**.

```ts
const endpoint = await senndo.createWebhook({
  name: 'production',
  url: 'https://exemple.test/senndo',
  events: ['message.sent', 'message.failed', 'message.inbound'],
})

conserverLeSecret(endpoint.secret)
```

## Configuration

```ts
const client = new SenndoClient({
  apiKey: cleApi,
  baseUrl: 'https://api.senndo.com',
  timeoutMs: 30_000,
  maxRetries: 2,
  userAgent: 'boutique/2.1',
})
```

La clé n'est lisible par aucune représentation de l'objet — `String(client)`,
`JSON.stringify(client)` et `console.log(client)` la rendent masquée.

## Licence

MIT.
