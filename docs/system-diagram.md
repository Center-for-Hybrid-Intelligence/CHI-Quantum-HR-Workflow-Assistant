# CHI Quantum HR Workflow Assistant — System Diagram

## 1. Architecture Overview (Simplified)

```mermaid
graph TD
    USER["👤 User <br> Browser"]
    FE["React Frontend <br> Tabs · Steps · Chat · Roadmap"]
    BE["Express Server <br> Routes · Middleware · Limits"]
    DB[("PostgreSQL <br> workflows · messages")]
    AI["Anthropic Claude <br> Sonnet 4.6 / Haiku 4.5"]
    EXT["External Data <br> Company URL · Quantum Job Excel"]

    USER -->|"interacts"| FE
    FE -->|"REST + SSE <br> X-Session-ID"| BE
    BE -->|"read / write"| DB
    BE -->|"stream chat"| AI
    BE -->|"fetch context"| EXT
    AI -->|"streamed response"| BE
    BE -->|"SSE chunks"| FE
```

---

## 2. Architecture Overview (Detailed)

```mermaid
graph TD
    subgraph Browser["Browser (Client)"]
        LS["localStorage <br> chi_session_id (UUID) <br> chi-hr-tutorial-seen"]
        RQ["React Query <br> Cache & State"]
        UI["React UI <br> Home / Tabs / Steps / Chat"]
        SSE_C["SSE Reader <br> ReadableStream"]
    end

    subgraph Express["Express Server (Node.js + TypeScript)"]
        MW_RL["Rate Limiter <br> 30 msg/min per session <br> 150 msg/day per session"]
        MW_WC["Workflow Cap <br> 10 workflows per session"]
        MW_ML["Message Length Check <br> 2 000 char max"]
        MW_S["requireSession <br> X-Session-ID validation (8–128 chars)"]
        MW_403["403 Block <br> /database/* · /secrets/*"]

        subgraph Routes["routes.ts"]
            R_WF["GET /api/workflows <br> GET /api/workflows/:id <br> POST /api/workflows <br> PATCH /api/workflows/:id/step <br> PATCH /api/workflows/:id/model <br> PATCH /api/workflows/:id/company-url <br> DELETE /api/workflows/:id"]
            R_MSG["POST /api/workflows/:id/messages <br> (SSE streaming)"]
            R_INTRO["POST /api/workflows/:id/step-intro <br> (SSE streaming)"]
            R_PU["POST /api/workflows/:id/pretend-user <br> (playtester helper)"]
            R_META["GET /api/models <br> GET /api/available-providers <br> GET /api/steps"]
        end

        subgraph Helpers["Server Helpers"]
            BCH["buildChatHistory() <br> Assembles full context <br> for every AI call"]
            ECD["extractCanvasData() <br> Parses BMC markers <br> from AI response"]
            FWC["fetchWebsiteContext() <br> Fetches + summarizes <br> company URL (cached)"]
            OWG["getOwnedWorkflow() <br> Session ownership check"]
        end

        STORAGE["storage.ts <br> DatabaseStorage <br> (IStorage interface)"]
        LLM["llm.ts <br> streamChat() / generateMessage() <br> Anthropicmodel router"]
        JDB["jobDatabase.ts <br> Quantum job market data <br> 3 600+ listings loaded from Excel at startup"]
    end

    subgraph DB["PostgreSQL (Drizzle ORM)"]
        T_WF[("workflows <br> id, sessionId, title, <br> workflowName, companyUrl, <br> selectedModel, currentStep, <br> canvasData (JSONB), <br> createdAt, updatedAt")]
        T_MSG[("messages <br> id, workflowId (FK), <br> role, content, <br> step, createdAt")]
    end

    subgraph AI["Anthropic API"]
        CLAUDE["Claude Sonnet 4.6 <br> Claude Haiku 4.5"]
    end

    subgraph External["External Sources"]
        XLSX["database/ <br> processed_offers_230125.xlsx <br> (startup load, memory cache)"]
        WEB["Company Website <br> (fetched on demand, memory cache)"]
    end

    %% Browser internals
    LS -->|"UUID injected as <br> X-Session-ID header"| UI
    UI -->|"API calls via fetch()"| MW_403
    UI <-->|"state sync"| RQ
    SSE_C -->|"streams chunks <br> into UI state"| UI

    %% Request pipeline
    MW_403 --> MW_RL
    MW_RL --> MW_S
    MW_S --> Routes

    %% Per-message guards (applied on R_MSG)
    MW_WC -.->|"checked in POST /api/workflows"| R_WF
    MW_ML -.->|"checked in message handler"| R_MSG

    %% Route → helpers
    R_MSG --> BCH
    R_MSG --> ECD
    R_INTRO --> BCH
    R_INTRO --> ECD
    BCH --> FWC
    R_WF --> OWG
    R_MSG --> OWG
    R_INTRO --> OWG
    R_PU --> OWG

    %% Route → storage
    R_WF <--> STORAGE
    R_MSG <--> STORAGE
    R_INTRO <--> STORAGE

    %% Storage → DB
    STORAGE <-->|"Drizzle ORM <br> SQL queries"| T_WF
    STORAGE <-->|"Drizzle ORM <br> SQL queries"| T_MSG
    T_WF -->|"cascade delete"| T_MSG

    %% AI calls
    BCH --> LLM
    R_PU --> LLM
    LLM -->|"Anthropic SDK <br> messages.stream()"| CLAUDE

    %% Startup data
    XLSX -->|"parsed at startup <br> cached in memory"| JDB
    JDB -->|"injected as system prompt <br> into every chat"| BCH

    %% Website context
    FWC -->|"HTTP fetch <br> cached in memory"| WEB

    %% SSE responses
    R_MSG -->|"SSE chunks"| SSE_C
    R_INTRO -->|"SSE chunks"| SSE_C
```

---

## 3. Message Send Flow (Sequence)

```mermaid
sequenceDiagram
    actor User
    participant UI as React UI
    participant SRV as Express Server
    participant DB as PostgreSQL
    participant AI as Claude API
    participant WEB as Company Website

    User->>UI: Types message, hits Send

    UI->>SRV: POST /api/workflows/:id/messages <br> Header: X-Session-ID <br> Body: { content }

    SRV->>SRV: requireSession — validate session ID (8–128 chars)
    SRV->>SRV: messageLimiter — 30 msg/min check
    SRV->>SRV: dailyMessageLimiter — 150 msg/day check
    SRV->>SRV: message length check — max 2 000 chars
    SRV->>DB: getWorkflow(id) — session ownership check
    DB-->>SRV: workflow row

    SRV->>DB: getMessageCountByWorkflow(id) — 500 msg cap check
    DB-->>SRV: count

    SRV->>DB: INSERT message (role=user, content, step)
    DB-->>SRV: saved message

    Note over SRV: buildChatHistory()
    SRV->>DB: getMessagesByWorkflow(id)
    DB-->>SRV: all prior messages (ordered)

    alt companyUrl is set
        SRV->>WEB: HTTP GET companyUrl (6 s timeout)
        WEB-->>SRV: HTML page
        SRV->>SRV: extractPageSummary() → title, meta description, H1
        Note over SRV: result cached in memory per URL
    end

    Note over SRV: Assemble full context:<br/>1. MASTER_SYSTEM_PROMPT<br/>2. STEP_SYSTEM_PROMPTS[currentStep]<br/>3. Quantum job market context (3 600+ listings)<br/>4. Company website context (if any)<br/>5. All prior messages

    SRV->>AI: messages.stream(model, context, maxTokens=8192)

    loop Streaming chunks
        AI-->>SRV: text delta
        SRV-->>UI: SSE: data: { "content": "chunk" }
        UI->>UI: append to streamingContent state
    end

    AI-->>SRV: stream complete (full response)

    alt Response contains <!--NEXT_STEP_READY-->
        Note over SRV,UI: Marker kept in DB content (not stripped server-side)
        UI->>UI: isNextStepReady = true → Next Step button activates
    end

    SRV->>DB: INSERT message (role=assistant, content, step)
    DB-->>SRV: saved

    SRV-->>UI: SSE: data: { "done": true }

    UI->>UI: invalidate React Query cache
    UI->>SRV: GET /api/workflows/:id (refetch)
    SRV->>DB: getWorkflow + getMessages
    DB-->>SRV: fresh data
    SRV-->>UI: JSON response
```

---

## 4. Session & Multi-Tab Model

```mermaid
graph LR
    subgraph Browser
        LS["localStorage <br> chi_session_id = 'uuid-xxxx'"]

        subgraph Tab1["Workflow Tab 1 <br> workflowId = 3"]
            S1["Step 1 ✓"]
            S2["Step 2 ✓"]
            S3["Step 3 (active)"]
        end

        subgraph Tab2["Workflow Tab 2 <br> workflowId = 7"]
            S4["Step 1 (active)"]
        end
    end

    subgraph DB["PostgreSQL"]
        W3["workflows row <br> id=3, sessionId='uuid-xxxx' <br> currentStep=3"]
        W7["workflows row <br> id=7, sessionId='uuid-xxxx' <br> currentStep=1"]
        M3["messages WHERE <br> workflowId=3"]
        M7["messages WHERE <br> workflowId=7"]
    end

    LS -->|"X-Session-ID header <br> on every request"| W3
    LS -->|"X-Session-ID header <br> on every request"| W7
    W3 --> M3
    W7 --> M7

    Tab1 -->|"GET /api/workflows/3"| W3
    Tab2 -->|"GET /api/workflows/7"| W7
```

---

## 5. Rate Limiting & Abuse Prevention

```mermaid
flowchart TD
    REQ["Incoming request <br> POST /api/workflows/:id/messages"]

    REQ --> A{"Path blocked? <br> /database/* or /secrets/*"}
    A -- Yes --> R403["403 Forbidden"]
    A -- No --> B{"Valid session ID? <br> 8–128 chars"}
    B -- No --> R401["401 Unauthorized"]
    B -- Yes --> C{"30 msg/min <br> per session?"}
    C -- Exceeded --> R429A["429 Rate limited <br> (per-minute)"]
    C -- OK --> D{"150 msg/day <br> per session?"}
    D -- Exceeded --> R429B["429 Rate limited <br> (daily)"]
    D -- OK --> E{"Message ≤ 2 000 chars?"}
    E -- No --> R400["400 Bad Request"]
    E -- Yes --> F{"Workflow owned <br> by this session?"}
    F -- No --> R404["404 Not Found"]
    F -- Yes --> G{"Workflow < 500 messages?"}
    G -- No --> R429C["429 Workflow message cap"]
    G -- Yes --> H["Process message <br> → stream AI response"]
```

---

## 6. Step Readiness Signal

```mermaid
flowchart TD
    A["AI generates response for step N"] --> B{"Response contains <br> <!--NEXT_STEP_READY-->?"}
    B -- No --> C["Save response to DB <br> Next Step button stays hidden"]
    B -- Yes --> D["Save response to DB <br> (marker kept in content)"]
    D --> E["Frontend detects marker <br> in visibleMessages"]
    E --> F["Next Step button <br> becomes active (animated)"]
    F --> G{"User clicks <br> Next Step"}
    G -- Confirmed --> H["PATCH /api/workflows/:id/step <br> currentStep = N+1"]
    H --> I["POST /api/workflows/:id/step-intro <br> AI introduces step N+1"]
    G -- Cancelled --> J["Stay on step N"]
```
