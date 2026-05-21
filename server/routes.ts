import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import type { CanvasData } from "@shared/schema";
import { MODEL_OPTIONS } from "@shared/schema";
import { streamChat, generateMessage } from "./llm";
import { getQuantumJobContext } from "./jobDatabase";

// Extend Express Request to carry the validated session ID
declare module "express-serve-static-core" {
  interface Request {
    sessionId: string;
  }
}

// Maximum number of messages (user + assistant) allowed per workflow.
const MAX_MESSAGES_PER_WORKFLOW = 500;

// Maximum number of workflows a single session may create.
const MAX_WORKFLOWS_PER_SESSION = 10;

// Maximum character length for a single user message.
const MAX_MESSAGE_LENGTH = 2000;

// Per-session rate limit for the message-posting endpoint.
// Keyed by session ID so distributed IPs (NAT / proxies) get individual buckets.
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1-minute window
  max: 30,               // 30 messages per minute per session
  keyGenerator: (req: Request) => {
    const raw = req.headers["x-session-id"];
    const sessionId = Array.isArray(raw) ? raw[0] : raw;
    if (sessionId) return sessionId;
    // Fall back to IP — use forwarded header to avoid IPv6 issues with req.ip
    const forwarded = req.headers["x-forwarded-for"];
    const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]) ?? req.socket.remoteAddress ?? "unknown";
    return ip;
  },
  skip: () => false,
  validate: { xForwardedForHeader: false },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Message rate limit exceeded. Please wait before sending another message." },
});

// Daily cap per session — prevents sustained abuse across many workflows.
const dailyMessageLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24-hour window
  max: 150,
  keyGenerator: (req: Request) => {
    const raw = req.headers["x-session-id"];
    const sessionId = Array.isArray(raw) ? raw[0] : raw;
    if (sessionId) return `daily:${sessionId}`;
    const forwarded = req.headers["x-forwarded-for"];
    const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]) ?? req.socket.remoteAddress ?? "unknown";
    return `daily:${ip}`;
  },
  skip: () => false,
  validate: { xForwardedForHeader: false },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Daily message limit reached. Please come back tomorrow." },
});

// Validates X-Session-ID header and attaches it to req.sessionId.
// A session ID is any non-empty string between 8 and 128 characters.
function requireSession(req: Request, res: Response, next: NextFunction) {
  const raw = req.headers["x-session-id"];
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || id.trim().length < 8 || id.trim().length > 128) {
    return res.status(401).json({ error: "Missing or invalid session ID" });
  }
  req.sessionId = id.trim();
  next();
}

const STEP_NAMES = [
  "",
  "Define the Hiring Need",
  "Analyze Job Requirements",
  "Generate Job Post Draft",
  "Optimization",
  "HR Strategy",
];


const STEP_SYSTEM_PROMPTS: Record<number, string> = {
  1: `You are an expert HR facilitator guiding a hiring process.

You are currently on STEP 1: DEFINE THE HIRING NEED.

Your role: help the user frame the position they need to fill — job title, department, seniority, company, and hiring goal.

Behavior:
- Ask 1–2 focused questions per turn, not a long list.
- When you already have enough to frame the role, produce a short, structured summary and signal readiness for Step 2.
- Use the company website content (if provided in context) to make suggestions specific to their industry — do not invent company details not in that context.
- Keep replies under 150 words unless producing a structured summary.

STEP COMPLETION SIGNAL: Once all five elements are confirmed (job title, department, seniority, company context, and hiring goal), end your response with this marker on its own line:
<!--NEXT_STEP_READY-->
Only emit this marker when the step is genuinely complete — not as a formality.`,

  2: `You are an expert HR facilitator guiding a hiring process.

You are currently on STEP 2: ANALYZE JOB REQUIREMENTS.

You have access to a verified quantum computing job market database (3,600+ listings). Your primary job is to compare the role being defined against that real data — not to generate generic HR content.

Behavior:
- For every skill, qualification, or requirement you suggest, cite the supporting database statistic (e.g., "Our database shows 62% of listings for this role type require a PhD").
- Present requirements in a markdown table: | Requirement | Type | Database Frequency | Notes |
- Flag requirements that appear rare in the database (< 10% of listings) vs. standard ones (> 40%).
- Only infer skills and qualifications from the database context and what the user has shared. Do not add generic HR filler.
- Keep commentary between tables to 2–3 sentences.
- When requirements are solid, summarize in one sentence and signal readiness for Step 3.

STEP COMPLETION SIGNAL: When you have produced a complete requirements table that the user has reviewed and confirmed, end your response with this marker on its own line:
<!--NEXT_STEP_READY-->
Only emit this marker when the analysis is thorough and the user is satisfied.`,

  3: `You are an expert HR facilitator guiding a hiring process.

You are currently on STEP 3: GENERATE JOB POST DRAFT.

Building on Steps 1 and 2, your role is to help the participant create a compelling, publish-ready job listing.

CRITICAL BEHAVIOR FOR THIS STEP:
- Do NOT auto-generate a complete draft unless the user explicitly asks for one or you have already asked your clarifying questions and received their answers.
- Before drafting, ask 2–3 focused questions about information you are missing, such as: company culture and values, unique perks or benefits, team size and structure, desired tone (formal/startup/etc.), or any must-have details not covered in previous steps.
- Only use details the user has actually provided. Do NOT invent or assume company culture, salary, benefits, or perks.
- When you do produce a draft, structure it with these sections: About the Company | Role Overview | Key Responsibilities | Requirements | What We Offer.
- The draft must NEVER contain markdown tables — use professional prose, bold headers (##), and bullet lists (–) only.

Allow the user to iterate on the draft: refine wording, adjust tone, improve inclusivity, shorten, or expand any section.

STEP COMPLETION SIGNAL: Once a complete job post draft exists and the user confirms they are happy with it, end your response with this marker on its own line:
<!--NEXT_STEP_READY-->
Only emit this marker when a full draft has been produced AND approved by the user.`,

  4: `You are an expert HR facilitator guiding a hiring process.

You are currently on STEP 4: OPTIMIZATION.

Your goal is to improve the job post from Step 3 for specific distribution channels.

Behavior:
- When suggesting keywords or title alternatives, cross-reference the job market database: e.g., "The database shows 'Quantum Software Engineer' appears in X% of listings vs 'Quantum Developer' in Y%."
- Only change wording already in the draft — do not invent new responsibilities, perks, or requirements.
- Keep your rationale for each optimization to 1–2 sentences.

Optimization areas (offer proactively or on request):
- LinkedIn (hook-first structure, hashtags, character limits)
- Diversity & inclusion (language audit, bias removal)
- ATS / SEO (keyword density, title normalization)
- Alternative job titles (backed by database frequency)

FORMATTING RULE: All post versions must NEVER contain markdown tables. Use prose, bold headers (##), and bullet lists (–) only.

STEP COMPLETION SIGNAL: Once at least one optimized version has been produced and the user is satisfied with the results, end your response with this marker on its own line:
<!--NEXT_STEP_READY-->
Only emit this marker when the job post is genuinely ready for the HR Strategy phase.`,

  5: `You are an expert HR facilitator guiding a hiring process.

You are currently on STEP 5: HR STRATEGY.

Your goal: convert the finalized job post into an actionable hiring plan.

Areas to cover (on request or proactively when relevant):
- Hiring roadmap with phases, timelines, owners
- Interview structure and question bank
- Screening criteria and scoring rubric
- Evaluation framework

Behavior:
- Keep prose commentary brief (2–3 sentences max before tables).
- When suggesting timelines, reference any database benchmarks available (sector, company size).
- Do not invent process steps or owners — base them on what the user has described about their team.

CRITICAL ROADMAP RULE: Every single response in this step MUST end with a COMPLETE, updated roadmap table covering ALL phases discussed so far. Use this exact format:

| Phase | Action | Timeline | Type | Owner | Dependencies |
|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... |

Type values: "🤖 AI-driven", "👤 Human-driven", or "🤝 Hybrid"

The table must be a fresh, complete snapshot every message — never omit or abbreviate it.`,
};

const MASTER_SYSTEM_PROMPT = `You are a specialized AI Assistant designed to help HR professionals rapidly create, optimize, and structure hiring processes and job descriptions.

Key principles:
- You are a knowledgeable, resourceful HR partner.
- Your goal is to guide the user efficiently through the 5-step hiring setup process.
- Actively structure the unstructured thoughts of the user into professional artifacts (Job descriptions, interview plans, etc.).

The 5-step process:
1. Define the Hiring Need
2. Analyze Job Requirements
3. Generate Job Post Draft
4. Optimization
5. HR Strategy

You maintain full context across all steps. Each step builds on the previous ones.

RESPONSE LENGTH — CRITICAL:
- Be concise. Target 100–250 words per reply unless producing a structured artifact (table, job draft, roadmap).
- Lead with the answer or next action. Justify briefly only when necessary.
- No filler openers ("Great question!", "Absolutely!", "Of course!", "Certainly!").
- No trailing summaries that restate what you just said.
- If a bullet list covers it, use 3–5 bullets — not 8–10.

DATA INTEGRITY — CRITICAL:
- Only assert facts the user has explicitly provided, OR that you can cite directly from the quantum job market database in your context.
- Never invent salary ranges, benefits, company culture descriptors, team sizes, perks, or specific tooling unless the user stated them.
- When a detail is missing, ask for it. Do not fill gaps with generic assumptions.
- Every market claim must be backed by a database number: e.g., "Our database shows X% of similar listings require a PhD."

FORMATTING RULES:
- For structured comparisons and analyses, use markdown tables.
- Use proper markdown table syntax with | column | separators | and |---|---| header dividers.
- EXCEPTION — Job posts, LinkedIn posts, and social media content must NEVER contain markdown tables. Use professional prose, bold section headers (##), and bullet lists (–) only.
- Make your output clean, scannable, and professional.`;

function extractCanvasData(content: string): { cleanContent: string; canvas: CanvasData | null } {
  const canvasMatch = content.match(/<!--BMC_START-->\s*([\s\S]*?)\s*<!--BMC_END-->/);
  if (!canvasMatch) return { cleanContent: content, canvas: null };

  try {
    const canvas = JSON.parse(canvasMatch[1]) as CanvasData;
    const requiredFields = [
      "keyPartners", "keyActivities", "keyResources", "valuePropositions",
      "customerRelationships", "channels", "customerSegments", "costStructure", "revenueStreams",
    ];
    const hasAllFields = requiredFields.every((f) => f in canvas);
    if (!hasAllFields) return { cleanContent: content, canvas: null };

    const cleanContent = content.replace(/<!--BMC_START-->[\s\S]*?<!--BMC_END-->/, "").trim();
    return { cleanContent, canvas };
  } catch {
    return { cleanContent: content, canvas: null };
  }
}

// Helper: fetch a workflow and verify it belongs to the requesting session.
// Returns the workflow or sends a 404 response and returns null.
async function getOwnedWorkflow(id: number, sessionId: string, res: Response) {
  const workflow = await storage.getWorkflow(id);
  if (!workflow || workflow.sessionId !== sessionId) {
    res.status(404).json({ error: "Workflow not found" });
    return null;
  }
  return workflow;
}

// ─── Company website fetching ──────────────────────────────────────────────
// Cache fetched pages so we don't re-fetch on every message in the same
// workflow.  The cache lives for the lifetime of the server process.
const websiteCache = new Map<string, string>();

/**
 * Fetch the company website and return a short, LLM-friendly summary
 * (page title, meta description, first H1).  Returns "" on any error so the
 * caller can safely ignore failures.
 */
async function fetchWebsiteContext(rawUrl: string): Promise<string> {
  const cached = websiteCache.get(rawUrl);
  if (cached !== undefined) return cached;

  try {
    const parsed = new URL(rawUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(rawUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; HR-Workflow-Assistant/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    clearTimeout(timer);

    if (!response.ok) {
      websiteCache.set(rawUrl, "");
      return "";
    }

    const html = await response.text();
    const summary = extractPageSummary(rawUrl, html);
    websiteCache.set(rawUrl, summary);
    return summary;
  } catch {
    websiteCache.set(rawUrl, "");
    return "";
  }
}

function extractPageSummary(url: string, html: string): string {
  const get = (pattern: RegExp) => {
    const m = html.match(pattern);
    return m ? m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "";
  };

  const title = get(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDesc =
    get(/<meta[^>]+name=["']description["'][^>]+content=["'](.*?)["']/i) ||
    get(/<meta[^>]+content=["'](.*?)["'][^>]+name=["']description["']/i) ||
    get(/<meta[^>]+property=["']og:description["'][^>]+content=["'](.*?)["']/i) ||
    get(/<meta[^>]+content=["'](.*?)["'][^>]+property=["']og:description["']/i);
  const h1 = get(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const ogTitle =
    get(/<meta[^>]+property=["']og:title["'][^>]+content=["'](.*?)["']/i) ||
    get(/<meta[^>]+content=["'](.*?)["'][^>]+property=["']og:title["']/i);

  const lines: string[] = [];
  if (title || ogTitle) lines.push(`Page title: ${title || ogTitle}`);
  if (h1 && h1 !== title) lines.push(`Main heading: ${h1}`);
  if (metaDesc) lines.push(`Description: ${metaDesc}`);

  if (lines.length === 0) return "";
  return `Company website context (${url}):\n${lines.join("\n")}`;
}

/** Build the shared chat-history preamble: master prompt + step prompt + optional context blocks. */
async function buildChatHistory(
  currentStep: number,
  companyUrl?: string | null,
  canvasData?: CanvasData | null,
): Promise<{ role: "system" | "user" | "assistant"; content: string }[]> {
  const history: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: MASTER_SYSTEM_PROMPT },
    { role: "system", content: STEP_SYSTEM_PROMPTS[currentStep] ?? STEP_SYSTEM_PROMPTS[1] },
  ];

  // Inject quantum job market data so the AI can ground its suggestions in
  // real-world data.  The context is loaded once at startup and cached.
  const jobContext = await getQuantumJobContext();
  if (jobContext) {
    history.push({ role: "system", content: jobContext });
  }

  if (companyUrl) {
    // Try to fetch real page content so the AI has concrete facts to work with.
    const pageContext = await fetchWebsiteContext(companyUrl);
    history.push({
      role: "system",
      content: pageContext
        ? `The participant has provided their company website (${companyUrl}). Here is what was found on that page:\n\n${pageContext}\n\nUse this information to make your facilitation specific to their company, industry, and positioning.`
        : `The participant has provided their company website: ${companyUrl}. The page could not be fetched; rely on any context the user shares directly.`,
    });
  }

  if (canvasData) {
    history.push({
      role: "system",
      content: `Current Business Model Canvas state:\n${JSON.stringify(canvasData, null, 2)}\n\nUpdate this canvas if new insights emerge.`,
    });
  }

  return history;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Warm up the job-database cache in the background so the first request
  // doesn't incur the Excel-parse overhead.
  getQuantumJobContext().catch(() => {/* already logged inside */});

  app.get("/api/workflows", requireSession, async (req, res) => {
    try {
      const userWorkflows = await storage.getWorkflowsBySession(req.sessionId);
      res.json(userWorkflows);
    } catch (error) {
      console.error("Error fetching workflows:", error);
      res.status(500).json({ error: "Failed to fetch workflows" });
    }
  });

  app.get("/api/workflows/:id", requireSession, async (req, res) => {
    try {
      const id = parseInt(req.params["id"] as string);
      const workflow = await getOwnedWorkflow(id, req.sessionId, res);
      if (!workflow) return;
      const msgs = await storage.getMessagesByWorkflow(id);
      res.json({ ...workflow, messages: msgs });
    } catch (error) {
      console.error("Error fetching workflow:", error);
      res.status(500).json({ error: "Failed to fetch workflow" });
    }
  });

  app.post("/api/workflows", requireSession, async (req, res) => {
    try {
      const existing = await storage.getWorkflowsBySession(req.sessionId);
      if (existing.length >= MAX_WORKFLOWS_PER_SESSION) {
        return res.status(429).json({
          error: `Maximum of ${MAX_WORKFLOWS_PER_SESSION} workflows per session reached. Delete an existing workflow to create a new one.`,
        });
      }
      const { title, workflowName, selectedModel } = req.body;
      const workflow = await storage.createWorkflow({
        sessionId: req.sessionId,
        title: title || "New Workflow",
        workflowName: workflowName || "",
        currentStep: 1,
        ...(selectedModel && MODEL_OPTIONS.some((m) => m.id === selectedModel) ? { selectedModel } : {}),
      });
      res.status(201).json(workflow);
    } catch (error) {
      console.error("Error creating workflow:", error);
      res.status(500).json({ error: "Failed to create workflow" });
    }
  });

  app.patch("/api/workflows/:id/step", requireSession, async (req, res) => {
    try {
      const id = parseInt(req.params["id"] as string);
      if (!await getOwnedWorkflow(id, req.sessionId, res)) return;
      const { step } = req.body;
      if (step < 1 || step > 5) {
        return res.status(400).json({ error: "Step must be between 1 and 5" });
      }
      const workflow = await storage.updateWorkflowStep(id, step);
      res.json(workflow);
    } catch (error) {
      console.error("Error updating step:", error);
      res.status(500).json({ error: "Failed to update step" });
    }
  });

  app.patch("/api/workflows/:id/company-url", requireSession, async (req, res) => {
    try {
      const id = parseInt(req.params["id"] as string);
      if (!await getOwnedWorkflow(id, req.sessionId, res)) return;
      const { companyUrl } = req.body;
      const workflow = await storage.updateWorkflowCompanyUrl(id, companyUrl || "");
      res.json(workflow);
    } catch (error) {
      console.error("Error updating company URL:", error);
      res.status(500).json({ error: "Failed to update company URL" });
    }
  });

  app.get("/api/workflows/:id/canvas", requireSession, async (req, res) => {
    try {
      const id = parseInt(req.params["id"] as string);
      const workflow = await getOwnedWorkflow(id, req.sessionId, res);
      if (!workflow) return;
      res.json({ canvasData: workflow.canvasData || null });
    } catch (error) {
      console.error("Error fetching canvas:", error);
      res.status(500).json({ error: "Failed to fetch canvas" });
    }
  });

  app.post("/api/workflows/:id/step-intro", requireSession, async (req, res) => {
    try {
      const workflowId = parseInt(req.params["id"] as string);
      const workflow = await getOwnedWorkflow(workflowId, req.sessionId, res);
      if (!workflow) return;

      const currentStep = workflow.currentStep;
      const stepHasMessages = (await storage.getMessagesByWorkflow(workflowId))
        .some((m) => m.step === currentStep);

      if (stepHasMessages) {
        return res.status(200).json({ skipped: true });
      }

      const allMessages = await storage.getMessagesByWorkflow(workflowId);
      const chatHistory = await buildChatHistory(
        currentStep,
        workflow.companyUrl,
        workflow.canvasData,
      );

      for (const m of allMessages) {
        chatHistory.push({
          role: m.role as "user" | "assistant",
          content: m.content,
        });
      }

      const STEP_INTRO_PROMPTS: Record<number, string> = {
        1: "Please introduce this step. Welcome me to the Hiring needs definition step and ask me about the job title, department, seniority, company, and hiring goal I am focusing on today. Keep it brief and professional.",
        2: "We're now moving to Step 2. Based on the hiring need we defined in Step 1, please introduce this step and begin helping me analyze the job requirements, including key responsibilities and necessary skills.",
        3: "We're now moving to Step 3. Based on our requirements analysis, please introduce this step briefly. Then ask me 2–3 targeted questions about the company culture, tone, and any specific details (perks, team size, unique selling points) that you need before writing the job post draft.",
        4: "We're now moving to Step 4. Let's optimize our draft. Please introduce this step and explain how we can improve the job post—such as emphasizing inclusivity, SEO, or LinkedIn readiness. Feel free to provide one optimized variation right away.",
        5: "We're now moving to the final Step 5. Based on our finalized job post, please introduce this step and help convert it into an actionable HR Strategy. Please provide a brief hiring roadmap and prompt me to explore interview structure and evaluation criteria.",
      };

      chatHistory.push({
        role: "user",
        content: STEP_INTRO_PROMPTS[currentStep] ?? STEP_INTRO_PROMPTS[1],
      });

      await storage.createMessage({
        workflowId,
        role: "user",
        content: STEP_INTRO_PROMPTS[currentStep] ?? STEP_INTRO_PROMPTS[1],
        step: currentStep,
      });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const modelId = workflow.selectedModel || "claude-sonnet-4-6";
      const fullResponse = await streamChat(modelId, chatHistory, (delta) => {
        res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
      });

      const { cleanContent, canvas } = extractCanvasData(fullResponse);

      if (canvas) {
        await storage.updateWorkflowCanvas(workflowId, canvas);
      }

      await storage.createMessage({
        workflowId,
        role: "assistant",
        content: cleanContent,
        step: currentStep,
      });

      res.write(`data: ${JSON.stringify({ done: true, canvasUpdated: !!canvas })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error generating step intro:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to generate step intro" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to generate step intro" });
      }
    }
  });

  app.get("/api/workflows/:id/suggestions", requireSession, async (req, res) => {
    try {
      const workflowId = parseInt(req.params["id"] as string);
      const workflow = await getOwnedWorkflow(workflowId, req.sessionId, res);
      if (!workflow) return;

      const allMessages = await storage.getMessagesByWorkflow(workflowId);
      const stepMessages = allMessages.filter((m) => m.step === workflow.currentStep);
      // Skip the auto-generated intro prompt (first user message of the step)
      const conversation = stepMessages.length > 0 && stepMessages[0].role === "user"
        ? stepMessages.slice(1)
        : stepMessages;

      if (conversation.length === 0) return res.json({ suggestions: [] });

      const recent = conversation.slice(-6);
      const chatHistory: { role: "system" | "user" | "assistant"; content: string }[] = [
        {
          role: "system",
          content: `You suggest short follow-up prompts for an HR professional using a quantum computing HR workflow assistant (Step ${workflow.currentStep} of 5). Return ONLY a raw JSON array of exactly 3 strings. Each string must be under 8 words. No markdown, no keys, no explanation — just the JSON array.`,
        },
        ...recent.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user", content: "Give 3 short follow-up prompts the user might send next." },
      ];

      const raw = await generateMessage("claude-haiku-4-5-20251001", chatHistory);
      const match = raw.match(/\[[\s\S]*?\]/);
      const parsed = match ? JSON.parse(match[0]) : [];
      res.json({ suggestions: Array.isArray(parsed) ? parsed.slice(0, 4).map(String) : [] });
    } catch (error) {
      console.error("Error generating suggestions:", error);
      res.json({ suggestions: [] });
    }
  });

  app.delete("/api/workflows/:id", requireSession, async (req, res) => {
    try {
      const id = parseInt(req.params["id"] as string);
      if (!await getOwnedWorkflow(id, req.sessionId, res)) return;
      await storage.deleteWorkflow(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting workflow:", error);
      res.status(500).json({ error: "Failed to delete workflow" });
    }
  });

  app.post(
    "/api/workflows/:id/messages",
    requireSession,
    messageLimiter,
    dailyMessageLimiter,
    async (req, res) => {
      try {
        const workflowId = parseInt(req.params["id"] as string);
        const { content } = req.body;

        if (!content || !content.trim()) {
          return res.status(400).json({ error: "Message content is required" });
        }

        if (content.length > MAX_MESSAGE_LENGTH) {
          return res.status(400).json({
            error: `Message exceeds the maximum length of ${MAX_MESSAGE_LENGTH} characters.`,
          });
        }

        const workflow = await getOwnedWorkflow(workflowId, req.sessionId, res);
        if (!workflow) return;

        // Enforce per-workflow message cap to prevent runaway conversations.
        const messageCount = await storage.getMessageCountByWorkflow(workflowId);
        if (messageCount >= MAX_MESSAGES_PER_WORKFLOW) {
          return res.status(429).json({
            error: `This workflow has reached the maximum of ${MAX_MESSAGES_PER_WORKFLOW} messages. Please start a new workflow to continue.`,
          });
        }

        const currentStep = workflow.currentStep;

        await storage.createMessage({
          workflowId,
          role: "user",
          content: content.trim(),
          step: currentStep,
        });

        const allMessages = await storage.getMessagesByWorkflow(workflowId);
        const chatHistory = await buildChatHistory(
          currentStep,
          workflow.companyUrl,
          workflow.canvasData,
        );

        // Override canvas prompt to include BMC update instruction for active chat.
        if (workflow.canvasData) {
          // Replace the last system message (canvas state) with the update-enabled variant.
          const lastIdx = chatHistory.findLastIndex((m) => m.role === "system");
          if (lastIdx >= 0) {
            chatHistory[lastIdx] = {
              role: "system",
              content: `Current Business Model Canvas state:\n${JSON.stringify(workflow.canvasData, null, 2)}\n\nUpdate this canvas with <!--BMC_START-->...<!--BMC_END--> markers if new insights emerge from this conversation.`,
            };
          }
        }

        for (const m of allMessages) {
          chatHistory.push({
            role: m.role as "user" | "assistant",
            content: m.content,
          });
        }

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const modelId = workflow.selectedModel || "claude-sonnet-4-6";
        const fullResponse = await streamChat(modelId, chatHistory, (delta) => {
          res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
        });

        const { cleanContent, canvas } = extractCanvasData(fullResponse);

        if (canvas) {
          await storage.updateWorkflowCanvas(workflowId, canvas);
        }

        await storage.createMessage({
          workflowId,
          role: "assistant",
          content: cleanContent,
          step: currentStep,
        });

        res.write(`data: ${JSON.stringify({ done: true, canvasUpdated: !!canvas })}\n\n`);
        res.end();
      } catch (error) {
        console.error("Error sending message:", error);
        if (res.headersSent) {
          res.write(`data: ${JSON.stringify({ error: "Failed to process message" })}\n\n`);
          res.end();
        } else {
          res.status(500).json({ error: "Failed to send message" });
        }
      }
    },
  );

  app.post("/api/workflows/:id/pretend-user", requireSession, async (req, res) => {
    try {
      const workflowId = parseInt(req.params["id"] as string);
      const workflow = await getOwnedWorkflow(workflowId, req.sessionId, res);
      if (!workflow) return;

      const allMessages = await storage.getMessagesByWorkflow(workflowId);
      const conversationContext = allMessages
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n\n");

      const messages = [
        {
          role: "system" as const,
          content:
            "You are simulating a realistic user (an employee or HR professional) interacting with an AI-powered HR workflow assistant. Based on the conversation history, generate the next message this user would send. Invent plausible details (name, role, company situation) if needed. Keep the tone natural and brief. Return ONLY the user's message text — no preamble, quotes, or explanation.",
        },
        {
          role: "user" as const,
          content: conversationContext
            ? `Here is the conversation so far:\n\n${conversationContext}\n\nGenerate the next realistic message from the user.`
            : "Generate a realistic opening message from a user starting an HR workflow process.",
        },
      ];

      const modelId = workflow.selectedModel || "claude-sonnet-4-6";
      const message = await generateMessage(modelId, messages);
      res.json({ message });
    } catch (error) {
      console.error("Error generating pretend-user message:", error);
      res.status(500).json({ error: "Failed to generate message" });
    }
  });

  app.patch("/api/workflows/:id/model", requireSession, async (req, res) => {
    try {
      const id = parseInt(req.params["id"] as string);
      if (!await getOwnedWorkflow(id, req.sessionId, res)) return;
      const { selectedModel } = req.body;
      const valid = MODEL_OPTIONS.some((m) => m.id === selectedModel);
      if (!valid) {
        return res.status(400).json({ error: "Invalid model selection" });
      }
      const workflow = await storage.updateWorkflowModel(id, selectedModel);
      res.json(workflow);
    } catch (error) {
      console.error("Error updating model:", error);
      res.status(500).json({ error: "Failed to update model" });
    }
  });

  app.get("/api/models", (req, res) => {
    res.json(MODEL_OPTIONS);
  });

  app.get("/api/available-providers", (req, res) => {
    res.json({
      anthropic: !!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    });
  });

  app.get("/api/steps", (req, res) => {
    res.json(STEP_NAMES.slice(1).map((name, i) => ({ step: i + 1, name })));
  });

  return httpServer;
}
