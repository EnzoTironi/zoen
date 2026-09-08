import type { Redacted } from "effect";

import { durableEveJournalLayerFromUrl as durableFromUrl } from "../adapters/postgres/eve/journal.ts";

export type { EveJournalPostgresConfig } from "../adapters/postgres/eve/journal.ts";
export {
  durableEveJournalLayerFromUrl,
  makeDurableEveJournalLayer,
} from "../adapters/postgres/eve/journal.ts";

/** Build durable journal layer from a restricted journal-role URL. */
export const eveJournalLayerForUrl = (url: Redacted.Redacted) =>
  durableFromUrl(url);
