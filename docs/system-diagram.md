# CHI Quantum HR Workflow Assistant — System Diagram

## 1. Architecture Overview (Simplified)

```mermaid
graph TD
    USER["👤 User\nBrowser"]
    FE["React Frontend\nTabs · Steps · Canvas"]
    BE["Express Server\nRoutes · Middleware"]
    DB[("PostgreSQL\nworkflows · messages")]
    AI["AI Model\nClaude / GPT / Gemini"]
    EXT["External Data\nCompany URL · Job Excel"]

    USER -->|"interacts"| FE
    FE -->|"REST + SSE\nX-Session-ID"| BE
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
        LS["localStorage\nchi_session_id (UUID)"]
        RQ["React Query\nCache & State"]
        UI["React UI\nHome / Tabs / Steps / Canvas"]
        SSE_C["SSE Reader\nReadableStream"]
    end

    subgraph Express["Express Server (Node.js + TypeScript)"]
        MW_RL["Rate Limiter\n120 req/min per IP\n30 msg/min per session"]
        MW_S["requireSession\nX-Session-ID validation"]

        subgraph Routes["routes.ts"]
            R_WF["GET /api/workflows\nGET /api/workflows/:id\nPOST /api/workflows\nPATCH /api/workflows/:id/step\nPATCH /api/workflows/:id/model\nPATCH /api/workflows/:id/company-url\nDELETE /api/workflows/:id"]
            R_MSG["POST /api/workflows/:id/messages\n(SSE streaming)"]
            R_INTRO["POST /api/workflows/:id/step-intro\n(SSE streaming)"]
            R_CANVAS["GET /api/workflows/:id/canvas"]
            R_META["GET /api/models\nGET /api/available-providers\nGET /api/steps"]
        end

        subgraph Helpers["Server Helpers"]
            BCH["buildChatHistory()\nAssembles full context\nfor every AI call"]
            ECD["extractCanvasData()\nParses BMC markers\nfrom AI response"]
            FWC["fetchWebsiteContext()\nFetches + summarizes\ncompany URL"]
            OWG["getOwnedWorkflow()\nSession ownership check"]
        end

        STORAGE["storage.ts\nDatabaseStorage\n(IStorage interface)"]
        LLM["llm.ts\nstreamChat()\nModel router"]
        JDB["jobDatabase.ts\nQuantum job market data\n(loaded from Excel at startup)"]
    end

    subgraph DB["PostgreSQL (Drizzle ORM)"]
        T_WF[("workflows\nid, sessionId, title,\nworkflowName, companyUrl,\nselectedModel, currentStep,\ncanvasData (JSONB),\ncreatedAt, updatedAt")]
        T_MSG[("messages\nid, workflowId (FK),\nrole, content,\nstep, createdAt")]
    end

    subgraph AI["External AI APIs"]
        CLAUDE["Anthropic Claude\nSonnet 4.6 / Haiku 4.5"]
        GPT["OpenAI GPT-4o"]
        GEMINI["Google Gemini"]
    end

    subgraph External["External Sources"]
        XLSX["database/\nprocessed_offers_230125.xlsx\n(startup load)"]
        WEB["Company Website\n(fetched on demand)"]
    end

    %% Browser internals
    LS -->|"UUID injected as\nX-Session-ID header"| UI
    UI -->|"API calls via\nfetch()"| MW_RL
    UI <-->|"state sync"| RQ
    SSE_C -->|"streams chunks\ninto UI state"| UI

    %% Request pipeline
    MW_RL --> MW_S
    MW_S --> Routes

    %% Route → helpers
    R_MSG --> BCH
    R_MSG --> ECD
    R_INTRO --> BCH
    R_INTRO --> ECD
    BCH --> FWC
    R_WF --> OWG
    R_MSG --> OWG
    R_INTRO --> OWG

    %% Route → storage
    R_WF <--> STORAGE
    R_MSG <--> STORAGE
    R_INTRO <--> STORAGE
    R_CANVAS <--> STORAGE

    %% Storage → DB
    STORAGE <-->|"Drizzle ORM\nSQL queries"| T_WF
    STORAGE <-->|"Drizzle ORM\nSQL queries"| T_MSG
    T_WF -->|"cascade delete"| T_MSG

    %% AI calls
    BCH --> LLM
    LLM -->|"Anthropic SDK\nmessages.stream()"| CLAUDE
    LLM -->|"OpenAI SDK"| GPT
    LLM -->|"Google SDK"| GEMINI

    %% Startup data
    XLSX -->|"parsed at startup\ncached in memory"| JDB
    JDB -->|"injected into\nsystem prompt"| BCH

    %% Website context
    FWC -->|"HTTP fetch\ncached in memory"| WEB

    %% SSE responses
    R_MSG -->|"SSE chunks"| SSE_C
    R_INTRO -->|"SSE chunks"| SSE_C
```

---

## 2. Message Send Flow (Sequence)

```mermaid
sequenceDiagram
    actor User
    participant UI as React UI
    participant SRV as Express Server
    participant DB as PostgreSQL
    participant AI as Claude API
    participant WEB as Company Website

    User->>UI: Types message, hits Send

    UI->>SRV: POST /api/workflows/:id/messages\nHeader: X-Session-ID\nBody: { content }

    SRV->>SRV: requireSession — validate session ID
    SRV->>SRV: messageLimiter — 30 msg/min check
    SRV->>DB: getWorkflow(id) — ownership check
    DB-->>SRV: workflow row

    SRV->>DB: INSERT message (role=user, content, step)
    DB-->>SRV: saved message

    Note over SRV: buildChatHistory()
    SRV->>DB: getMessagesByWorkflow(id)
    DB-->>SRV: all prior messages (ordered)

    alt companyUrl is set
        SRV->>WEB: HTTP GET companyUrl
        WEB-->>SRV: HTML page
        SRV->>SRV: extractPageSummary() → title, description, H1
        Note over SRV: result cached in memory
    end

    Note over SRV: Assemble full context:<br/>1. MASTER_SYSTEM_PROMPT<br/>2. STEP_SYSTEM_PROMPTS[currentStep]<br/>3. Quantum job market context<br/>4. Company context (if any)<br/>5. Canvas state (if any)<br/>6. All prior messages

    SRV->>AI: messages.stream(system, messages, maxTokens=8192)

    loop Streaming chunks
        AI-->>SRV: text delta
        SRV-->>UI: SSE: data: { "content": "chunk" }
        UI->>UI: append to streamingContent state
    end

    AI-->>SRV: stream complete (full response)

    alt Response contains <!--BMC_START-->...<!--BMC_END-->
        SRV->>SRV: extractCanvasData() — parse JSON
        SRV->>DB: updateWorkflowCanvas(id, canvasData)
        DB-->>SRV: updated
    end

    SRV->>DB: INSERT message (role=assistant, cleanContent, step)
    DB-->>SRV: saved

    SRV-->>UI: SSE: data: { "done": true, "canvasUpdated": true/false }

    UI->>UI: invalidate React Query cache
    UI->>SRV: GET /api/workflows/:id (refetch)
    SRV->>DB: getWorkflow + getMessages
    DB-->>SRV: fresh data
    SRV-->>UI: JSON response

    alt canvasUpdated = true
        UI->>UI: open CanvasPopup
    end
```

---

## 3. Session & Multi-Tab Model

```mermaid
graph LR
    subgraph Browser
        LS["localStorage\nchi_session_id = 'uuid-xxxx'"]

        subgraph Tab1["Workflow Tab 1\nworkflowId = 3"]
            S1["Step 1 ✓"]
            S2["Step 2 ✓"]
            S3["Step 3 (active)"]
        end

        subgraph Tab2["Workflow Tab 2\nworkflowId = 7"]
            S4["Step 1 (active)"]
        end
    end

    subgraph DB["PostgreSQL"]
        W3["workflows row\nid=3, sessionId='uuid-xxxx'\ncurrentStep=3"]
        W7["workflows row\nid=7, sessionId='uuid-xxxx'\ncurrentStep=1"]
        M3["messages WHERE\nworkflowId=3"]
        M7["messages WHERE\nworkflowId=7"]
    end

    LS -->|"X-Session-ID header\non every request"| W3
    LS -->|"X-Session-ID header\non every request"| W7
    W3 --> M3
    W7 --> M7

    Tab1 -->|"GET /api/workflows/3"| W3
    Tab2 -->|"GET /api/workflows/7"| W7
```

---

## 4. Business Model Canvas Update Flow

```mermaid
flowchart TD
    A["AI generates response"] --> B{"Response contains\n<!--BMC_START-->?"}
    B -- No --> C["Save response as-is\nto messages table"]
    B -- Yes --> D["extractCanvasData()\nparse JSON block"]
    D --> E["Strip BMC markers\nfrom message content"]
    E --> F["UPDATE workflows\nSET canvasData = parsed JSON"]
    F --> G["Save clean message\nto messages table"]
    G --> H["SSE: done event\ncanvasUpdated: true"]
    C --> I["SSE: done event\ncanvasUpdated: false"]
    H --> J["Frontend opens\nCanvasPopup"]
    I --> K["Frontend silent\nrefresh"]
```
