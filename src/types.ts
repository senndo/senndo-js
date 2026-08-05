/**
 * Les types d'EXÉCUTION du SDK — tout ce que le contrat ne décrit pas.
 *
 * POURQUOI DES TYPES STRUCTURELS PLUTÔT QUE `lib.dom` OU `@types/node`
 * Ce paquet tourne dans Node, dans un navigateur, dans Bun, dans Deno et dans un worker de bord.
 * Tirer `lib.dom` obligerait un projet Node à l'accepter, tirer `@types/node` casserait un projet
 * navigateur, et les deux à la fois se contredisent sur `setTimeout`. Les quelques formes dont le
 * transport a besoin sont donc décrites ici, structurellement : la `fetch` native de chaque
 * plateforme les satisfait sans conversion, et un client peut injecter la sienne.
 */

/** Un en-tête HTTP tel que le transport le lit — la forme minimale de `Headers`. */
export interface HeadersLike {
  get(name: string): string | null
}

/** La réponse HTTP, réduite à ce que le SDK consomme. */
export interface ResponseLike {
  readonly status: number
  readonly headers: HeadersLike
  text(): Promise<string>
}

/** Un signal d'annulation — `AbortSignal` le satisfait. */
export interface AbortSignalLike {
  readonly aborted: boolean
  addEventListener(type: 'abort', listener: () => void): void
  removeEventListener(type: 'abort', listener: () => void): void
}

/** La requête telle que le transport la remet à `fetch`. */
export interface RequestInitLike {
  method: string
  headers: Record<string, string>
  body?: string | Uint8Array
  signal?: AbortSignalLike
  /**
   * Politique de redirection. Le SDK passe TOUJOURS `'error'` (audit batch 2026-08-05) : `fetch`
   * suit par défaut et dégrade un POST en GET sur 301/302, ce qui transformait un envoi FACTURÉ
   * en lecture du journal rendue comme un succès (`POST` et `GET /v1/messages` partagent le
   * chemin). Ce type narrow OMETTAIT le champ — c'est en partie pourquoi le défaut par défaut
   * n'avait jamais été considéré : on ne choisit pas ce qu'on ne peut pas exprimer.
   */
  redirect?: 'error' | 'follow' | 'manual'
}

/** Toute implémentation compatible `fetch`. La native de la plateforme convient. */
export type FetchLike = (url: string, init: RequestInitLike) => Promise<ResponseLike>

/**
 * Un fichier à téléverser sur `POST /v1/wa-media`.
 *
 * LE CORPS MULTIPART EST CONSTRUIT PAR LE SDK, pas par `FormData`. `FormData` et `Blob` ne sont pas
 * typés de la même façon d'une plateforme à l'autre, et exiger l'un des deux aurait imposé
 * `lib.dom` au consommateur. Des octets bruts plus un nom de fichier suffisent, et se produisent
 * de la même manière partout : `readFile()` en Node, `new Uint8Array(await blob.arrayBuffer())`
 * dans un navigateur.
 */
export interface MultipartUpload {
  /** Le contenu du fichier. */
  file: Uint8Array | ArrayBuffer
  /** Le nom de fichier transmis au serveur — il détermine l'extension vérifiée contre le MIME. */
  fileName: string
  /** Le type MIME. À défaut, `application/octet-stream` — que le serveur refusera en 415. */
  contentType?: string
}

/** Les options de construction du client. */
export interface SenndoClientOptions {
  /**
   * La clé API du compte. `sk_test_…` simule la livraison et ne déplace aucun argent ;
   * `sk_live_…` débite le solde à l'envoi.
   */
  apiKey: string
  /** Base de l'API. Par défaut la production ; surchargeable pour un environnement dédié. */
  baseUrl?: string
  /** Délai maximal d'un appel, en millisecondes. 30 000 par défaut. */
  timeoutMs?: number
  /**
   * Nombre maximal de RETENTATIVES (au-delà de la première tentative). 2 par défaut, 0 pour
   * désactiver. Une retentative n'a jamais lieu sur un appel qui ne peut pas être rejoué sans
   * risque — voir la politique détaillée dans `http.ts`.
   */
  maxRetries?: number
  /** Implémentation `fetch` à utiliser. Par défaut celle de la plateforme. */
  fetch?: FetchLike
  /** Suffixe ajouté à l'en-tête `User-Agent`, pour identifier votre intégration. */
  userAgent?: string
}

/** Les options d'un appel. Elles priment sur celles du client. */
export interface RequestOptions {
  /** Délai maximal de CET appel, en millisecondes. */
  timeoutMs?: number
  /** Nombre maximal de retentatives pour CET appel. */
  maxRetries?: number
  /** Signal d'annulation. Une annulation lève `SenndoAbortError`. */
  signal?: AbortSignalLike
  /** En-têtes supplémentaires. `Authorization` ne peut pas être écrasé. */
  headers?: Record<string, string>
}
