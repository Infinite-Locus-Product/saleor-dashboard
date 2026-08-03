# Cache Management — Diagram Reference

Visual companion to [cache-management-hld.md](./cache-management-hld.md). Every diagram
below reflects the implemented module in `src/cacheManagement/`.

---

## 1. System context

Where the dashboard sits relative to the two backends it talks to.

```mermaid
flowchart LR
    OP(["Ops / Developer"])

    subgraph SD["Saleor Dashboard (browser)"]
        CM["Cache Management<br/>/cache-management"]
        REST["Other views"]
    end

    subgraph TX["TenxYou backend"]
        EP["/saleor/* cache routes"]
        REDIS[("Redis cache")]
        STRAPI[("Strapi / EDD config")]
    end

    SALEOR[("Saleor Core<br/>GraphQL")]

    OP --> CM
    CM -->|"REST, fetch"| EP
    REST -->|"GraphQL, Apollo"| SALEOR
    EP --> REDIS
    EP --> STRAPI
    EP -->|"reads catalogue"| SALEOR

    style CM stroke-width:3px
```

The cache module is the only part of the dashboard that speaks REST to TenxYou.
It deliberately bypasses Apollo — there is no GraphQL surface for these routes.

---

## 2. Module architecture

Three layers, one direction of dependency. Nothing below points upward.

```mermaid
flowchart TD
    subgraph CONFIG["Config layer — pure data, no React"]
        EPTS["endpoints.ts<br/>22 config objects"]
        CATS["categories.ts<br/>section order"]
        TYPES["types.ts<br/>CacheEndpointConfig"]
    end

    subgraph LOGIC["Logic layer — pure functions + one fetch wrapper"]
        BUILD["buildRequest.ts"]
        VALID["validation.ts"]
        API["cacheApi.ts"]
    end

    subgraph UI["UI layer — React"]
        PAGE["CacheManagementPage"]
        CARD["CacheActionCard"]
        HOOK["useCacheAction"]
        FORM["CachePayloadForm"]
        DIALOG["CacheConfirmDialog"]
        JSON["JsonViewer"]
        BADGE["ExecutionStatusBadge"]
    end

    EPTS --> PAGE
    CATS --> PAGE
    TYPES -.-> BUILD
    TYPES -.-> VALID

    PAGE --> CARD
    CARD --> HOOK
    CARD --> FORM
    CARD --> DIALOG
    CARD --> JSON
    CARD --> BADGE

    HOOK --> VALID
    HOOK --> BUILD
    BUILD --> API

    style EPTS stroke-width:3px
```

`endpoints.ts` is the single source of truth. The page derives its sections from it,
the card derives its badges and button from it, the form derives its inputs from it,
and validation derives its rules from it.

---

## 3. Component hierarchy

```mermaid
flowchart TD
    ROUTE["index.tsx<br/><i>SectionRoute, lazy</i>"]
    VIEW["CacheManagementView<br/><i>WindowTitle</i>"]
    PAGE["CacheManagementPage<br/><i>TopNav + DetailPageLayout</i>"]
    SEC["Section × 9<br/><i>label + description</i>"]
    CARD["CacheActionCard × 22"]

    FORM["CachePayloadForm<br/><i>6 endpoints</i>"]
    DIALOG["CacheConfirmDialog<br/><i>9 destructive</i>"]
    BADGE["ExecutionStatusBadge<br/><i>after run</i>"]
    JSON["JsonViewer<br/><i>after run</i>"]

    INPUT["Input"]
    TEXTAREA["Textarea"]
    SELECT["Select"]

    ROUTE --> VIEW --> PAGE --> SEC --> CARD
    CARD --> FORM
    CARD --> DIALOG
    CARD --> BADGE
    CARD --> JSON
    FORM --> INPUT
    FORM --> TEXTAREA
    FORM --> SELECT
```

Only `CacheActionCard` knows an endpoint exists. Everything beneath it is generic over
the field schema — no component contains endpoint-specific branching.

---

## 4. Request lifecycle

```mermaid
sequenceDiagram
    actor U as Operator
    participant C as CacheActionCard
    participant K as useCacheAction
    participant V as validateCacheFields
    participant B as buildCacheRequest
    participant S as executeCacheRequest
    participant API as TenxYou API
    participant N as useNotifier

    U->>C: click action button

    alt endpoint is destructive
        C->>U: open confirmation dialog
        U->>C: confirm
    end

    C->>K: execute()

    K->>K: inFlightRef guard
    Note over K: second click in the same<br/>React batch is dropped

    K->>V: endpoint + values
    alt validation fails
        V-->>K: error codes
        K-->>C: inline field errors
        Note over C: no request is sent
    else validation passes
        V-->>K: no errors
        K->>B: endpoint + values + baseUrl
        B-->>K: url, method, body?

        K->>K: setLoading(true)
        K->>S: request + AbortSignal

        S->>API: fetch with auth headers

        alt HTTP 2xx
            API-->>S: JSON body
            S-->>K: status success, httpStatus, durationMs
        else HTTP 4xx / 5xx
            API-->>S: error body
            S-->>K: status error, extracted message
        else network failure
            API--x S: connection refused / CORS
            S-->>K: status error, httpStatus 0
        end

        K->>K: setLoading(false)
        Note over K: skipped if unmounted
        K-->>C: CacheExecutionResult
        C->>N: toast
        C->>U: status badge + JSON response
    end
```

`executeCacheRequest` always resolves — a network failure is a result, not a rejection.
That gives timing, toasts and rendering exactly one code path.

---

## 5. Card state machine

```mermaid
stateDiagram-v2
    [*] --> Idle

    Idle --> Confirming: click, destructive
    Idle --> Validating: click, safe
    Confirming --> Validating: confirm
    Confirming --> Idle: cancel

    Validating --> Invalid: missing required fields
    Validating --> InFlight: schema satisfied

    Invalid --> Validating: edit field, then retry
    note right of Invalid
        Editing a field clears
        only that field's error
    end note

    InFlight --> Succeeded: HTTP 2xx
    InFlight --> Failed: HTTP 4xx/5xx or network
    InFlight --> [*]: unmount, request aborted

    Succeeded --> Validating: run again
    Failed --> Validating: run again

    note right of InFlight
        Button disabled
        inFlightRef set
        AbortController armed
    end note
```

`Disabled` is a fourth resting state, entered when `VITE_TENEXU_API_URL` is unset —
the card renders with an explanation rather than a button that silently fails.

---

## 6. Payload routing

How `buildCacheRequest` decides where a field's value goes. This is the branch that
made the abstraction worth building — three shapes exist across the 22 endpoints.

```mermaid
flowchart TD
    START["endpoint + form values"]
    STATIC{"has staticBody?"}
    SEED["seed body with pinned keys<br/>e.g. scope: all"]
    EMPTY["start with empty body"]

    FIELDS{"has fields?"}
    TARGET{"fieldTarget"}

    QUERY["url.searchParams.set<br/>idList joined by comma"]
    BODY["body[name] = value<br/>idList as string array"]

    METHOD{"method"}
    NOBODY["body omitted"]
    CHECK{"body has keys?"}
    SEND["JSON body<br/>+ Content-Type header"]

    OUT(["url, method, body?"])

    START --> STATIC
    STATIC -->|yes| SEED
    STATIC -->|no| EMPTY
    SEED --> FIELDS
    EMPTY --> FIELDS

    FIELDS -->|no| METHOD
    FIELDS -->|yes| TARGET
    TARGET -->|query| QUERY
    TARGET -->|body| BODY
    QUERY --> METHOD
    BODY --> METHOD

    METHOD -->|GET or DELETE| NOBODY
    METHOD -->|POST| CHECK
    CHECK -->|no| NOBODY
    CHECK -->|yes| SEND

    NOBODY --> OUT
    SEND --> OUT
```

Blank and whitespace-only values are skipped rather than sent as empty strings, so a
half-filled optional field never reaches the backend.

---

## 7. Endpoint taxonomy

Grouped by payload shape rather than by section — this is the axis that drives the code.

```mermaid
flowchart LR
    ALL["22 endpoints"]

    NONE["No payload — 14"]
    JSON["JSON body — 6"]
    QUERY["Query params — 2"]

    ALL --> NONE
    ALL --> JSON
    ALL --> QUERY

    NONE --> N1["3 slug GETs"]
    NONE --> N2["inventory full seed"]
    NONE --> N3["4 pinned-prefix clears"]
    NONE --> N4["navbar, exchange reasons"]
    NONE --> N5["testimonial all, thankyou all"]
    NONE --> N6["2 pinned thankyou prefixes"]

    JSON --> J1["inventory targeted seed<br/>variantIds"]
    JSON --> J2["clear-cache by prefix<br/>enum select"]
    JSON --> J3["rating user_rating<br/>order_ids"]
    JSON --> J4["rating order_status<br/>order_ids"]
    JSON --> J5["rating reference_data"]
    JSON --> J6["rating all — emergency"]

    QUERY --> Q1["clear-testimonial-cache<br/>productId"]
    QUERY --> Q2["tagbox-data DELETE<br/>galleryId, feedId, postId"]

    style QUERY stroke-width:3px
```

The two query-param endpoints are the reason the form layer was built target-aware from
the start. Had it assumed JSON bodies, both would have needed a retrofit — and
`tagbox-data` is the only `DELETE` in the collection.

---

## 8. Authorisation

```mermaid
flowchart TD
    USER(["Staff user"])
    PERM{"has MANAGE_SETTINGS?"}
    HIDDEN["Sidebar entry hidden"]
    DEEP{"deep-link to<br/>/cache-management?"}
    NOTFOUND["Route rejects"]
    PAGE["Dashboard renders"]

    RUN["Operator runs an endpoint"]
    ADMIN{"requiresAdmin?"}
    KEYSET{"VITE_TENEXU_ADMIN_API_KEY<br/>configured?"}

    AK["Authorization: Bearer ADMIN_KEY"]
    ST["Authorization: Bearer staff token<br/>+ X-Refresh-Token"]
    BACKEND["Backend enforces<br/>the real permission"]

    USER --> PERM
    PERM -->|no| HIDDEN --> DEEP -->|yes| NOTFOUND
    PERM -->|yes| PAGE --> RUN --> ADMIN
    ADMIN -->|yes| KEYSET
    ADMIN -->|no| ST
    KEYSET -->|yes| AK
    KEYSET -->|no| ST
    AK --> BACKEND
    ST --> BACKEND

    style BACKEND stroke-width:3px
```

The permission is checked twice — sidebar and route — so a deep link fails the same way
as a hidden menu item. Client-side gating is convenience; the backend stays the
authority on every route.

---

## 9. Error handling

Every failure mode collapses into one result shape before it reaches the UI.

```mermaid
flowchart TD
    EXEC["execute()"]

    V{"fields valid?"}
    VE["inline helper text<br/>no request sent"]

    CFG{"baseUrl configured?"}
    CE["card disabled<br/>explanatory line"]

    FETCH["fetch"]
    OK{"response.ok?"}

    PARSE["parse JSON<br/>fall back to raw text"]
    EXTRACT["extract error / message / detail<br/>else 'Request failed with status N'"]
    NET["catch — httpStatus 0<br/>exception message"]

    RESULT["CacheExecutionResult<br/>status · httpStatus · response · durationMs"]
    TOAST["toast"]
    BADGE["status badge + duration"]
    VIEW["JSON viewer — always shown"]

    EXEC --> CFG
    CFG -->|no| CE
    CFG -->|yes| V
    V -->|no| VE
    V -->|yes| FETCH
    FETCH --> OK
    FETCH -.->|throws| NET
    OK -->|yes| PARSE
    OK -->|no| EXTRACT
    PARSE --> RESULT
    EXTRACT --> RESULT
    NET --> RESULT
    RESULT --> TOAST
    RESULT --> BADGE
    RESULT --> VIEW
```

The raw response body is rendered whatever happens, so an unrecognised error shape is
still diagnosable without opening dev tools.

---

## 10. Type model

```mermaid
classDiagram
    class CacheEndpointConfig {
        +string id
        +CacheCategoryId category
        +MessageDescriptor title
        +MessageDescriptor description
        +CacheHttpMethod method
        +string path
        +boolean requiresAdmin
        +boolean destructive
        +CacheConfirmationConfig confirmation
        +CacheFieldTarget fieldTarget
        +object staticBody
    }

    class CacheField {
        <<union>>
        +string name
        +MessageDescriptor label
        +boolean required
    }

    class CacheTextField {
        +type text
        +string placeholder
    }
    class CacheIdListField {
        +type idList
        +string placeholder
    }
    class CacheSelectField {
        +type select
        +List~Option~ options
    }

    class CacheRequestDescriptor {
        +string url
        +CacheHttpMethod method
        +object body
    }

    class CacheExecutionResult {
        +CacheExecutionStatus status
        +number httpStatus
        +unknown response
        +number durationMs
        +string errorMessage
    }

    class CacheCategoryConfig {
        +CacheCategoryId id
        +MessageDescriptor label
        +MessageDescriptor description
    }

    CacheEndpointConfig "1" o-- "0..*" CacheField
    CacheField <|-- CacheTextField
    CacheField <|-- CacheIdListField
    CacheField <|-- CacheSelectField
    CacheEndpointConfig ..> CacheRequestDescriptor : buildCacheRequest
    CacheRequestDescriptor ..> CacheExecutionResult : executeCacheRequest
    CacheCategoryConfig "1" --> "0..*" CacheEndpointConfig : groups
```

`CacheField` is a discriminated union on `type` — the form and the request builder both
switch on it exhaustively, so adding a variant surfaces as a type error at every site
that must handle it.

---

## 11. Adding an endpoint

```mermaid
flowchart LR
    A["append one object<br/>to endpoints.ts"]
    B["add title + description<br/>to messages.ts"]
    C["pnpm run lint<br/><i>generates i18n ids</i>"]
    D["pnpm run extract-messages<br/><i>updates locale/</i>"]
    E(["card, section, form,<br/>validation and registry<br/>assertions all follow"])

    A --> B --> C --> D --> E

    style E stroke-width:3px
```

No component is edited and no test is written. The registry test automatically asserts
the new entry has a unique id, a known category, confirmation copy if it is destructive,
and no body on a `GET`/`DELETE`.

The one change that does touch components is a **new field type**: extend the
`CacheField` union, add a branch in `CachePayloadForm`, handle it in
`buildCacheRequest`. Three files, each flagged by the compiler.

---

## 12. Navigation

```mermaid
flowchart LR
    SB["Sidebar"]
    SB --> H["Home"]
    SB --> S["Search"]
    SB --> CAT["Catalog"]
    SB --> FUL["Fulfillment"]
    SB --> CUS["Customers"]
    SB --> DIS["Discounts"]
    SB --> MOD["Modeling"]
    SB --> TR["Translations"]
    SB --> EX["Extensions"]
    SB --> CACHE["Cache Management"]
    SB --> CONF["Configuration"]

    CACHE --> URL["/cache-management"]
    URL --> CHUNK["lazy chunk, ~36 KB"]

    style CACHE stroke-width:3px
```

Lazy-loaded, so the module costs nothing to users who never open it.
