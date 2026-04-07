# Building the HI Workshop App with Replit Agent - Creation Guide

This document describes how the HI Business Model Innovation Workshop application was built using Replit Agent, including the prompts and sequence of steps used to create it. Use this as a reference for building similar AI-powered workshop applications.

---

## Prerequisites

- A Replit account with access to Replit Agent
- The **Node.js** template (Replit will set up a fullstack JavaScript/TypeScript project)
- A PostgreSQL database (Replit provides one built-in)

---

## Build Sequence Overview

The application was built incrementally through a series of prompts to Replit Agent. Each prompt builds on the previous state. Below is the recommended sequence with the key prompts and what they accomplish.

---

## Phase 1: Core Chat Application

### Prompt 1 - Initial Application Setup

> Build an AI-powered chat application for Hybrid Intelligence (HI) Business Model Innovation workshops. Users should be able to create workflow tabs. Each workflow is guided through a 5-step process within a single conversation. The steps are:
> 1. Select a High-Value Existing Workflow
> 2. Examine Through HI Lens (Prediction vs. Judgment)
> 3. Prototype Human-AI Interaction (Speech Pairs)
> 4. Derive Targeted Automation Opportunities
> 5. Business Model Direction, Implementation Roadmap & Canvas Update
>
> Each step's messages should be isolated in view (only showing messages for the current step) but the AI should retain full cross-step context when generating responses. Include step-specific system prompts that guide the AI's behavior for each step.
>
> Use PostgreSQL for storage with tables for workflows (id, title, workflowName, companyUrl, currentStep 1-5, timestamps) and messages (id, workflowId, role, content, step, createdAt). Use real-time streaming for AI responses via Server-Sent Events.

**What this creates:**
- Express backend with PostgreSQL via Drizzle ORM
- React frontend with tabbed workflow interface
- Step indicator bar with navigation
- Chat interface with markdown rendering (including table support)
- SSE streaming for AI responses
- Step-specific system prompts for the AI facilitator
- Full cross-step context in AI conversations

### Prompt 2 - Auto-Generated AI Introductions

> Add auto-generated AI introductions for each step. When the user enters a step for the first time (no messages exist for that step), automatically trigger an AI response that introduces the step and gets the conversation started. Include a company URL input field that only appears during Step 1, allowing users to optionally share their company website for more relevant AI facilitation. Use an introTriggeredFor state variable to prevent duplicate auto-introductions.

**What this creates:**
- `POST /api/workflows/:id/step-intro` endpoint
- Automatic step introductions with step-specific intro prompts
- Company URL input component shown only in Step 1
- `PATCH /api/workflows/:id/company-url` endpoint
- De-duplication logic for intro triggers

---

## Phase 2: Business Model Canvas

### Prompt 3 - Canvas Generation and Display

> Add a Business Model Canvas feature. The AI should auto-generate and update a 9-block Business Model Canvas during the conversation. Use HTML comment markers (<!--BMC_START--> and <!--BMC_END-->) to wrap JSON canvas data in AI responses. The backend should extract this data, parse it, store it as JSONB in the workflows table (canvasData field), and strip the markers from the displayed message.
>
> The canvas has 9 blocks: Key Partners, Key Activities, Key Resources, Value Propositions, Customer Relationships, Channels, Customer Segments, Cost Structure, Revenue Streams.
>
> Display the canvas in a side panel (420px wide) that can be toggled via a header button. The panel should auto-open when the canvas is updated. Include the canvas instruction in each step's system prompt so the AI knows how to output canvas data.

**What this creates:**
- `canvasData` JSONB field in the workflows table
- `extractCanvasData()` function in routes for parsing BMC markers
- `BusinessModelCanvas` component with a 9-block grid layout
- Canvas toggle button in the header
- Auto-open behavior on canvas updates
- Canvas instruction appended to all step system prompts
- Wide blocks for Value Propositions, Cost Structure, and Revenue Streams

### Prompt 4 - Step 5 Roadmap with Canvas Update

> Enhance Step 5 to produce a detailed implementation roadmap with markdown tables including columns for Phase, Action, Timeline, Type (AI/Human/Hybrid with emoji indicators), Owner, and Dependencies. The AI should also produce a final updated Business Model Canvas in Step 5 that incorporates all workshop insights. Update the Step 5 system prompt and intro prompt accordingly.

**What this creates:**
- Enhanced Step 5 system prompt with roadmap table format and strategic synthesis
- AI/Human/Hybrid emoji indicators (robot, person, handshake)
- Final canvas update instruction for Step 5

---

## Phase 3: Multi-Model Support

### Prompt 5 - LLM Abstraction Layer

> Add multi-model AI support. Create an LLM abstraction layer (server/llm.ts) with a streamChat() function that routes to OpenAI, Anthropic, or Gemini based on model selection. Use Replit AI Integrations for all three providers.
>
> Available models:
> - OpenAI: gpt-5.2, gpt-4.1
> - Anthropic: claude-sonnet-4-6, claude-haiku-4-5
> - Gemini: gemini-2.5-pro, gemini-2.5-flash
>
> Add a selectedModel field (default "gpt-5.2") to the workflows table, a PATCH /api/workflows/:id/model endpoint, a GET /api/models endpoint, and a MODEL_OPTIONS constant in the shared schema. Handle provider-specific differences (Anthropic uses separate system param, Gemini uses "model" role instead of "assistant", etc.).

**What this creates:**
- `server/llm.ts` with `streamChat()` routing function
- Provider-specific streaming implementations
- `selectedModel` field in database schema
- Model management API endpoints
- `MODEL_OPTIONS` constant in shared schema

### Prompt 6 - Frontend Model Selector

> Add a model selector dropdown to the frontend header. Use the MODEL_OPTIONS from the shared schema. Show the model name and provider for each option. The dropdown should update the workflow's selected model via the PATCH endpoint. Disable the selector while the AI is streaming a response.

**What this creates:**
- `ModelSelector` component using shadcn Select
- Dropdown in the header next to the Canvas button
- Per-workflow model persistence
- Disabled state during streaming

---

## Phase 4: Popups, Formatting, and AI/Human Indicators

### Prompt 7 - Full-Page Popups for Canvas and Roadmap

> Put both the roadmap and the BMC as full page popups created by buttons at the end of step 5. Improve the formatting of the BMC. Add clear indications of what is AI and what is human. Update documentation.

**What this creates:**
- `CanvasPopup` component -- full-page dialog with improved BMC formatting (color-coded icon badges per block, card-based grid, responsive 3-column layout)
- `RoadmapPopup` component -- full-page dialog showing step 5 messages with AI/Human/Hybrid legend in the header
- Popup trigger buttons in chat area during Step 5 ("View Business Model Canvas", "View Implementation Roadmap")
- Header buttons for Canvas and Roadmap (appear when data exists)
- AI/Human labels on every chat message (bot icon + "AI" label, person icon + "Human" label)
- Removed old 420px side panel in favor of full-page popup modals
- Updated both USER_GUIDE.md and REPLIT_CREATION_GUIDE.md

---

## Key Architecture Decisions

### Why SSE Instead of WebSockets

Server-Sent Events are simpler for this use case since communication is unidirectional (server to client) during streaming. The client sends regular HTTP POST requests and receives streaming responses.

### Why Step Isolation with Full Context

Messages are filtered by step number for display (`visibleMessages = allMessages.filter(m => m.step === viewingStep)`), but ALL messages across all steps are included in the AI's chat history. This means the AI builds understanding progressively while the user interface stays focused.

### Why BMC Markers Instead of Separate API Calls

Using inline markers (`<!--BMC_START-->...<!--BMC_END-->`) in the AI response allows the canvas to be updated as part of the natural conversation flow. The backend extracts the data transparently, so the AI can decide when canvas updates are appropriate based on conversation context.

### Why Per-Workflow Model Selection

Each workflow stores its own `selectedModel` so users can compare how different AI models facilitate the same workshop process, or use faster models for simpler workshops.

---

## Replit AI Integrations Setup

The application uses Replit AI Integrations for all three AI providers. These are installed as blueprints:

1. `javascript_openai_ai_integrations` - Provides OpenAI client with auto-configured environment variables
2. `javascript_anthropic_ai_integrations` - Provides Anthropic client with auto-configured environment variables
3. `javascript_gemini_ai_integrations` - Provides Google Gemini client with auto-configured environment variables

No API keys need to be manually configured. The integrations handle authentication automatically through environment variables prefixed with `AI_INTEGRATIONS_OPENAI_*`, `AI_INTEGRATIONS_ANTHROPIC_*`, and `AI_INTEGRATIONS_GEMINI_*`.

To install these integrations in a new Replit project, use Replit's integrations panel or ask Replit Agent to set them up.

---

## Database Schema

The application uses two tables:

```sql
-- Workflows table
CREATE TABLE workflows (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  workflow_name TEXT NOT NULL DEFAULT '',
  company_url TEXT DEFAULT '',
  selected_model TEXT NOT NULL DEFAULT 'gpt-5.2',
  current_step INTEGER NOT NULL DEFAULT 1,
  canvas_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Messages table
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  step INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

---

## Project File Structure

```
client/
  src/
    pages/
      home.tsx          # Main application page (chat, tabs, canvas, steps)
    components/
      ui/               # shadcn/ui components
    lib/
      queryClient.ts    # TanStack Query setup
    hooks/
      use-toast.ts      # Toast notification hook
    index.css           # Global styles and theme
    App.tsx             # Router setup
    main.tsx            # Entry point

server/
  routes.ts             # API routes, system prompts, canvas extraction
  llm.ts                # Multi-LLM abstraction layer
  storage.ts            # Database storage interface and implementation
  db.ts                 # Drizzle database connection
  index.ts              # Express server setup
  vite.ts               # Vite dev server integration

shared/
  schema.ts             # Database schema, types, MODEL_OPTIONS

docs/
  USER_GUIDE.md         # End-user documentation
  REPLIT_CREATION_GUIDE.md  # This file
```

---

## Customization Points

### Adding New Steps

1. Add the step definition to the `STEPS` array in `home.tsx`
2. Add a system prompt to `STEP_SYSTEM_PROMPTS` in `routes.ts`
3. Add an intro prompt to `STEP_INTRO_PROMPTS` in `routes.ts`
4. Update the step name in `STEP_NAMES` in `routes.ts`
5. Update the step range validation (currently 1-5) in the step update endpoint

### Adding New AI Models

1. Add the model to `MODEL_OPTIONS` in `shared/schema.ts`
2. If it's from a new provider, add the provider's streaming logic to `server/llm.ts`
3. If using Replit, install the corresponding AI Integration blueprint

### Modifying the Business Model Canvas

1. Update the `CanvasData` interface in `shared/schema.ts`
2. Update `CANVAS_LABELS` in `home.tsx` for display
3. Update the `CANVAS_INSTRUCTION` in `routes.ts` for AI generation
4. Update the `requiredFields` check in `extractCanvasData()` in `routes.ts`

### Changing the System Prompts

All system prompts are in `server/routes.ts`:
- `MASTER_SYSTEM_PROMPT` -- Applied to every conversation, defines the overall workshop framework
- `STEP_SYSTEM_PROMPTS` -- Step-specific facilitator instructions
- `CANVAS_INSTRUCTION` -- Appended to each step prompt, tells the AI how to output canvas data
- `STEP_INTRO_PROMPTS` -- The "user" message sent to trigger step introductions

---

## Troubleshooting

### AI Responses Not Streaming

- Check that the workflow's `selectedModel` matches a valid model ID in `MODEL_OPTIONS`
- Verify Replit AI Integrations are installed (check for the integration files in the project)
- Check server logs for streaming errors

### Canvas Not Updating

- The AI must output canvas data wrapped in `<!--BMC_START-->` and `<!--BMC_END-->` markers
- All 9 canvas fields must be present in the JSON
- Check server logs for JSON parse errors in `extractCanvasData()`

### Step Intros Firing Multiple Times

- The `introTriggeredFor` state variable prevents duplicates using a `workflowId-step` key
- If intros fire unexpectedly, check that the step already has messages (the intro is skipped if messages exist)
