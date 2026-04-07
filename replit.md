# HI Business Model Innovation

## Overview
An AI-powered chat application for conducting Hybrid Intelligence (HI) Business Model Innovation workshops. Users create workflow tabs, each guiding them through a 5-step process using AI facilitation.

## Architecture
- **Frontend**: React + TypeScript with Vite, TailwindCSS, shadcn/ui components
- **Backend**: Express.js with streaming SSE responses
- **Database**: PostgreSQL (Neon) via Drizzle ORM
- **AI**: Multi-LLM support via Replit AI Integrations (OpenAI, Anthropic, Gemini)

## Key Features
- Tabbed interface for multiple concurrent workflows
- 5-step guided process per workflow (all in one conversation with full context)
- Real-time AI response streaming via SSE
- Step navigation with progress indicators
- Markdown rendering for AI responses (including table support)
- Company URL input in Step 1 for contextual AI guidance
- Business Model Canvas auto-generated and updated by AI during conversation
- Step 5: Strategy, Implementation Roadmap & Canvas Update (final step combining business model direction, roadmap with timeline/AI/Human/Hybrid indicators, and final Canvas)
- Full-page popup dialogs for Canvas and Roadmap (buttons in chat at Step 5 only, no header buttons)
- Improved BMC formatting with color-coded icon badges, card grid, responsive layout
- Bot/user icons on chat messages (no text labels)
- Multi-model selector (GPT-5.2, GPT-4.1, Claude Sonnet 4.6, Claude Haiku 4.5, Gemini 2.5 Pro, Gemini 2.5 Flash)

## The 5 Steps
1. Select a High-Value Existing Workflow
2. Examine Through HI Lens (Prediction vs. Judgment)
3. Prototype Human-AI Interaction (Speech Pairs)
4. Derive Targeted Automation Opportunities
5. Business Model Direction, Implementation Roadmap & Canvas Update

## Business Model Canvas
- Stored as JSON in the `canvasData` field of workflows table
- AI outputs canvas data in `<!--BMC_START-->...<!--BMC_END-->` markers
- Backend extracts, parses, and stores canvas; strips markers from displayed message
- Canvas has 9 blocks: Key Partners, Key Activities, Key Resources, Value Propositions, Customer Relationships, Channels, Customer Segments, Cost Structure, Revenue Streams
- Displayed in full-page popup dialog (CanvasPopup component) with color-coded card grid

## Database Schema
- `workflows` - id, title, workflowName, companyUrl, selectedModel (default gpt-5.2), currentStep (1-5), canvasData (JSONB), timestamps
- `messages` - id, workflowId, role (user/assistant), content, step, createdAt

## File Structure
- `client/src/pages/home.tsx` - Main chat page with tabs, step navigation, canvas panel, company URL input
- `server/routes.ts` - API routes with step-specific system prompts, streaming, canvas extraction
- `server/llm.ts` - Multi-LLM abstraction layer (OpenAI, Anthropic, Gemini streaming)
- `server/storage.ts` - Database storage layer
- `server/db.ts` - Drizzle database connection
- `shared/schema.ts` - Database schema, types, and CanvasData interface

## Environment
- Uses Replit AI Integrations (no API key needed)
- PostgreSQL via DATABASE_URL
- Port 5000
