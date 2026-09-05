# Mini-app architecture diagrams — v4

Editable Mermaid views of the normative contracts. They do not claim a deployed product or independently authorize any path. The ticket dependency graph, not the phase illustration, determines executable work.

## One operational world, multiple clients

[Editable source](diagrams/one-semantic-path.mmd)

```mermaid
flowchart TB
    Human[Human web and CLI] --> Client[Shared SemanticClient]
    Eve[Eve and permitted agents] --> Client
    App[Declarative mini app] --> Client
    Guest[Isolated executable mini app] --> Bridge[Transport-only host bridge]
    Bridge --> Client
    Job[Bounded background app workload] --> Client
    Client --> Entry[Verified identity, actor and delegation context]
    Entry --> Executor[One SemanticExecutor: SPEC-007]
    Executor --> Guard[Current policy, app ceiling, purpose and source rights]
    Guard --> Meaning[Released meaning, authorized Frames and Actions]
    Meaning --> Stores[Internal stores and governed projections]
    Meaning --> Effects[EffectIntent and qualified executor]
    Effects --> Provider[External provider]
    Provider --> Evidence[Observed Settlement, not inferred success]
    Evidence --> Meaning
```

## Protected opening and current authorization

[Editable source](diagrams/protected-app-opening.mmd)

```mermaid
sequenceDiagram
    participant User as Recipient browser
    participant Host as Trusted Zoen host
    participant Door as Door identity
    participant Ont as Ontology executor
    participant App as Isolated guest if admitted
    User->>Host: GET opaque continuation reference
    Host-->>User: Generic non-consuming shell; no private metadata
    User->>Host: Explicit browser-bound POST
    Host->>Door: Existing session or identity challenge
    Door-->>Host: Verified identity and assurance
    Host->>Ont: Open context using current rights and approved binding
    Ont-->>Host: Authorized scope or neutral denial
    Host-->>User: Trusted renderer or admitted guest bootstrap
    opt Explicitly qualified executable disclosure profile
        Host->>App: Verified artifact bytes through bound MessageChannel
        App->>Host: Schema-valid semantic call; no caller-supplied authority
        Host->>Ont: Same executor with verified current context
        Ont-->>Host: Authorized result or typed denial
        Host-->>App: Allowed result within approved disclosure profile
    end
    Note over Host,Ont: Recheck every call, export chunk and subscription delivery
```

## Runtime readiness is not publication

[Editable source](diagrams/runtime-publication.mmd)

```mermaid
flowchart TB
    Author[Human or agent draft] --> Compile[Closed definition compiler or signed artifact build]
    Compile --> Eval[Isolated EvaluationWorld]
    Compile --> Prep[Private immutable runtime preparation]
    Prep --> Probe[Qualified adapter probes; Rivet candidate]
    Probe --> Proof[Profile-bound evidence]
    Eval --> Proof
    Proof --> Release[Existing release preparation]
    Release --> Approval[Approval under current policy and current rights]
    Approval --> Activate[Atomic Ontology release activation]
    Activate --> Binding[Approved AppPublicationBinding]
    Binding --> Link[Authority-free stable continuation]
    Link --> Session[Fresh identity and limited AppSession]
    Recall[Emergency recall or revocation] --> Deny[Shared deny barrier and controlled cache cleanup]
    Deny --> Session
    Note[Successful vendor deploy may activate its private slot; never the public Zoen binding] -.-> Prep
```

## Progressive delivery without alternate implementations

[Editable source](diagrams/mini-app-phases.mmd)

```mermaid
flowchart LR
    S0[S0: shared executor and no-bypass graph] --> S1[S1: protected Focus continuation]
    S1 --> S2[S2: private declarative apps]
    S2 --> S3[S3: sharing and scoped read parity]
    S3 --> S4[S4: governed forms and action parity]
    S4 --> S5[S5: rich views and generated clients]
    S5 --> S6[S6: isolated host, MCP and Rivet qualification]
    S6 --> S7[S7: dense, live and measured app workloads]
    S7 --> S8[S8: full Studio and three-audience capstone]
    S8 --> End[S9-S11: enterprise, federation and finance]
```

See [shared semantic path](semantic-path.md), [protected links](protected-links.md), [host security](app-host-security.md) and [Rivet adapter](rivet-adapter.md) for the authoritative details.
