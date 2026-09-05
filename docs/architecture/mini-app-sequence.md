# Progressive mini-app execution — v4

No early milestone depends on later work. Task-specific stage and exact dependency DAG govern, not a spec-level grouping or numeric ID. The early renderer and app sessions are reused in full Studio. Protected app delivery, generated execution and provider channels stay independently gated.

| Stage | Outcome | Anchor tickets |
|---|---|---|
| S0 | One executor and no-bypass graph | [ZN-0291](../tickets/zn-0291.md), [ZN-0292](../tickets/zn-0292.md) |
| S1 | Private Focus links, browser binding and shared-device safety | [ZN-0296](../tickets/zn-0296.md), [ZN-0297](../tickets/zn-0297.md), [ZN-0298](../tickets/zn-0298.md), [ZN-0068](../tickets/zn-0068.md) |
| S2 | Private app definitions, publication, scoped sessions and first renderer | [ZN-0293](../tickets/zn-0293.md), [ZN-0299](../tickets/zn-0299.md), [ZN-0302](../tickets/zn-0302.md), [ZN-0303](../tickets/zn-0303.md), [ZN-0304](../tickets/zn-0304.md), [ZN-0203](../tickets/zn-0203.md), [ZN-0305](../tickets/zn-0305.md) |
| S3 | Sharing, fine-grained rights and early parity | [ZN-0300](../tickets/zn-0300.md), [ZN-0301](../tickets/zn-0301.md), [ZN-0320](../tickets/zn-0320.md) |
| S4 | Host-owned consequential forms and retry parity | [ZN-0306](../tickets/zn-0306.md), [ZN-0321](../tickets/zn-0321.md) |
| S5 | Batch/export and full generated clients | [ZN-0294](../tickets/zn-0294.md), [ZN-0158](../tickets/zn-0158.md) |
| S6 | Isolated host, MCP and qualified specialized runtime | [ZN-0308](../tickets/zn-0308.md), [ZN-0309](../tickets/zn-0309.md), [ZN-0310](../tickets/zn-0310.md), [ZN-0311](../tickets/zn-0311.md), [ZN-0312](../tickets/zn-0312.md), [ZN-0204](../tickets/zn-0204.md), [ZN-0205](../tickets/zn-0205.md), [ZN-0313](../tickets/zn-0313.md), [ZN-0314](../tickets/zn-0314.md), [ZN-0315](../tickets/zn-0315.md), [ZN-0316](../tickets/zn-0316.md), [ZN-0317](../tickets/zn-0317.md), [ZN-0318](../tickets/zn-0318.md), [ZN-0319](../tickets/zn-0319.md), [ZN-0322](../tickets/zn-0322.md) |
| S7 | Dense/stream path and measured app load | [ZN-0295](../tickets/zn-0295.md), [ZN-0323](../tickets/zn-0323.md) |
| S8 | Complete Studio, lifecycle and three-audience apps | [ZN-0202](../tickets/zn-0202.md), [ZN-0206](../tickets/zn-0206.md), [ZN-0307](../tickets/zn-0307.md), [ZN-0324](../tickets/zn-0324.md) |
| S9–S11 | Institutional profiles through final full-scope review | [ZN-0325](../tickets/zn-0325.md), [ZN-0285](../tickets/zn-0285.md), [ZN-0286](../tickets/zn-0286.md) |

Original ID preservation: ZN-0203 remains declarative runtime, now S2; ZN-0204 remains isolated host integration, now S6; ZN-0205 remains MCP Apps, now S6. ZN-0202 and ZN-0206 are full S8 composition. Do not create duplicate early and advanced implementations. [Change report](../lineage/source-ledger.md) records exact differences.

S2 real hosted private data uses the existing qualified pilot/identity profile; G-APP-LINKS expands and qualifies the S3 sharing surface. Executable-host/runtime gates are not prerequisites for declarative apps. Any future provider replacement requires an ADR and the same behavior proofs.
