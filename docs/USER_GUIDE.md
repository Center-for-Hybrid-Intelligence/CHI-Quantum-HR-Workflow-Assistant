# HI Business Model Innovation Workshop - User Guide

## What Is This Tool?

This is an AI-powered facilitation tool for running **Hybrid Intelligence (HI) Business Model Innovation workshops**. It guides you through a structured 5-step process to examine how human judgment and AI capabilities can work together in your organization's workflows.

The tool uses a conversational AI facilitator that asks questions, generates analyses, and helps you build a concrete implementation plan -- all while progressively building a Business Model Canvas.

---

## Getting Started

### Creating a Workflow

1. Open the application in your browser.
2. Click the **+** button in the top-left area to create a new workflow tab.
3. A new tab appears (e.g., "Workflow 1") and the AI facilitator automatically introduces Step 1.

You can create multiple workflow tabs to explore different workflows or run separate workshops in parallel. Each tab maintains its own independent conversation and progress.

### Entering Your Company Website (Optional)

During **Step 1**, a URL input bar appears at the top of the chat area:

1. Enter your company's website URL (e.g., `https://yourcompany.com`).
2. Click **Save**.

The AI facilitator uses this context to tailor its questions and suggestions to your industry and organization. This input is only shown during Step 1.

### Choosing an AI Model

A **model selector dropdown** appears in the header when a workflow is active. You can choose from:

| Model | Provider | Notes |
|---|---|---|
| GPT-5.2 | OpenAI | Default model |
| GPT-4.1 | OpenAI | |
| Claude Sonnet 4.6 | Anthropic | |
| Claude Haiku 4.5 | Anthropic | Faster, lighter |
| Gemini 2.5 Pro | Google | |
| Gemini 2.5 Flash | Google | Faster, lighter |

Your model selection is saved per workflow. You can switch models at any time (when the AI is not currently responding). The new model takes effect on the next message.

---

## The 5-Step Process

Each workflow guides you through five steps. The AI facilitator introduces each step automatically and maintains full context from all previous steps throughout the conversation.

### Step 1: Select a High-Value Existing Workflow

The AI helps you identify and clearly define an existing workflow in your organization that would benefit from examining through a Hybrid Intelligence lens. Good candidates are workflows that:

- Matter economically or reputationally
- Involve non-trivial judgment, coordination, or expertise
- Are familiar to you so discussion stays concrete

**What happens:** The AI asks questions about your workflow's purpose, constraints, who is involved, and current pain points. It helps you articulate tacit knowledge.

### Step 2: Examine Through HI Lens (Prediction vs. Judgment)

The AI decomposes your selected workflow into two categories:

- **Prediction-oriented activities** -- where AI can generate options, drafts, estimates, or process data
- **Judgment-oriented activities** -- where context, responsibility, experience, or values require human involvement

**What happens:** The AI presents structured tables breaking down each activity and its classification. This is a strategic clarification, not a task-automation exercise.

### Step 3: Prototype Human-AI Interaction (Speech Pairs)

Together with the AI, you create realistic dialogue snippets showing how humans and AI would actually interact in the workflow.

**What happens:** The AI generates multiple dialogue variants for key interaction points. You critique, rewrite, and refine them until they reflect how the interaction should actually feel in practice.

### Step 4: Derive Targeted Automation Opportunities

Now automation enters the discussion. Based on the shared understanding built in Steps 1-3, the AI helps identify specific, bounded automation opportunities.

**What happens:** The AI presents opportunities in structured tables with impact, effort, and type indicators. You decide what is acceptable, valuable, and trustworthy.

### Step 5: Business Model Direction, Implementation Roadmap & Canvas Update

This is the final step, combining strategic synthesis with concrete action planning.

**What happens:** The AI helps you:
- Reflect on what the entire exercise means for your broader business model
- Articulate strategic direction, accountability statements, and capability development priorities
- Create a detailed implementation roadmap with phased timelines, AI/Human/Hybrid indicators for each action item, dependencies, quick wins vs. longer-term initiatives, and resource requirements
- Generate a final updated Business Model Canvas reflecting all workshop insights

---

## Navigating Steps

### Step Indicator Bar

Below the header, a **step indicator bar** shows all 5 steps:

- **Numbered circles** show step numbers (completed steps show a checkmark)
- **Highlighted step** indicates which step you are currently viewing
- **Small dots** indicate steps that have conversation messages

### Viewing Previous Steps

Click any step in the indicator bar to view its conversation. Each step's messages are shown independently, but the AI retains context from all steps when generating responses.

### Advancing to the Next Step

When you and the AI have completed a step's work, click the **"Continue to Step X"** button that appears in the chat input area. This advances the workflow to the next step and triggers an AI introduction for it.

You can only advance forward -- the current step moves from 1 to 5 sequentially. At Step 5, the "Next Step" button is replaced by popup buttons for the Canvas and Roadmap.

---

## AI and Human Indicators

Each message in the conversation is clearly labeled:

- **AI** messages are marked with a bot icon and an "AI" label beneath it. These are the facilitator's responses.
- **Human** messages are marked with a person icon and a "Human" label beneath it. These are your inputs.

This makes it immediately clear who said what, which is especially useful when reviewing past steps or sharing workshop results.

---

## Business Model Canvas

### How It Works

As you progress through the workshop, the AI automatically generates and updates a **9-block Business Model Canvas** based on your conversation. The canvas captures:

| Block | Description |
|---|---|
| Key Partners | External partners and suppliers |
| Key Activities | Core activities the business performs |
| Key Resources | Assets required to deliver value |
| Value Propositions | The value delivered to customers |
| Customer Relationships | How you interact with customers |
| Channels | How you reach customers |
| Customer Segments | Who you serve |
| Cost Structure | Major costs in the business model |
| Revenue Streams | How revenue is generated |

### Viewing the Canvas

The canvas can be viewed in a **full-page popup**:

- A **Canvas** button appears in the header once canvas data has been generated
- During **Step 5**, a dedicated "View Business Model Canvas" button appears directly in the chat area
- Clicking either opens a full-screen overlay showing all 9 blocks in a clear, color-coded card layout
- Each block has a colored icon badge (e.g., KP for Key Partners, VP for Value Propositions) for quick visual scanning
- The canvas popup automatically opens when the AI generates or updates canvas data

### Canvas Updates

The canvas is updated progressively:
- **Steps 1-4:** The AI updates individual blocks as new relevant information emerges
- **Step 5:** The AI generates a comprehensive final canvas incorporating all workshop insights

---

## Implementation Roadmap

### What It Is

The implementation roadmap is generated during Step 5. It provides a phased action plan with concrete milestones, timelines, and ownership assignments.

### AI/Human/Hybrid Indicators

Each action item in the roadmap is clearly marked:

- **AI-driven** -- tasks that can be automated or handled by AI
- **Human-driven** -- tasks requiring human judgment, decisions, or actions
- **Hybrid** -- collaborative tasks involving both human and AI working together

The roadmap popup includes a visual legend at the top showing these three categories with distinct icons.

### Viewing the Roadmap

- A **Roadmap** button appears in the header once Step 5 content has been generated
- During **Step 5**, a "View Implementation Roadmap" button appears directly in the chat area
- Clicking either opens a full-screen overlay showing the complete roadmap with formatted tables and structured content

---

## Managing Workflows

### Deleting a Workflow

Each workflow tab has a small **trash icon** that appears when you hover. Click it to delete that workflow and all its messages. If you delete the active workflow, the app automatically switches to the next available one.

### Multiple Workflows

You can run multiple workshops simultaneously using separate workflow tabs. Each workflow:
- Has its own independent conversation history
- Tracks its own step progress (1-5)
- Maintains its own Business Model Canvas
- Can use a different AI model

---

## Tips for Getting the Best Results

1. **Be specific and concrete** when describing your workflow. The more detail you provide, the more targeted the AI's analysis will be.
2. **Share your company website** in Step 1 -- it helps the AI understand your industry context.
3. **Push back on the AI** -- if speech pairs or automation suggestions don't feel right, say so. The AI will refine its approach.
4. **Take your time with each step** -- the process is designed to build understanding progressively. Rushing through steps reduces the quality of later insights.
5. **Try different models** -- if you feel the conversation style isn't working well, switch to a different AI model and see if it suits your preferences better.
