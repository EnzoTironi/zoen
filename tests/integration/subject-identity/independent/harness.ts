/**
 * Independent reviews reuse the real legacy→current component harness from the
 * EX25 authorship suite. Oracles below must not merely restate that suite.
 */
export {
  http,
  jsonBody,
  responseCookie,
  withLegacyBasisHarness,
} from "../basis/fixture.ts";
export type { BasisHarness, CurrentComponent } from "../basis/fixture.ts";
