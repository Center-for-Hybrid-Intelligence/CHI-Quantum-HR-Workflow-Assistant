import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import type { CanvasData } from "@shared/schema";
import { MODEL_OPTIONS } from "@shared/schema";
import { streamChat } from "./llm";

const STEP_NAMES = [
  "",
  "Define the Hiring Need",
  "Analyze Job Requirements",
  "Generate Job Post Draft",
  "Optimization",
  "HR Strategy",
];

const CANVAS_INSTRUCTION = `

IMPORTANT: When you have enough information about the business model, include a Business Model Canvas in your response using the following exact JSON format wrapped in markers. Update it whenever new relevant information emerges during the conversation.

<!--BMC_START-->
{
  "keyPartners": "bullet points of key partners",
  "keyActivities": "bullet points of key activities",
  "keyResources": "bullet points of key resources",
  "valuePropositions": "bullet points of value propositions",
  "customerRelationships": "bullet points of customer relationships",
  "channels": "bullet points of channels",
  "customerSegments": "bullet points of customer segments",
  "costStructure": "bullet points of cost structure",
  "revenueStreams": "bullet points of revenue streams"
}
<!--BMC_END-->

Fill each field with concise bullet points (use "\\n- " to separate items). Update the canvas progressively as you learn more. Always include ALL 9 fields even if some are "To be determined". Place the canvas block at the END of your message, after your conversational text.`;

const STEP_SYSTEM_PROMPTS: Record<number, string> = {
  1: `You are an expert HR facilitator guiding a hiring process.

You are currently on STEP 1: DEFINE THE HIRING NEED.

Your role is to help the HR professional describe the position they are trying to fill.
Help them collaboratively frame:
- job title
- department
- seniority
- company
- hiring goal

If the user provides a company website URL, acknowledge it and use any publicly available context about their industry and company type to make your questions and suggestions more relevant and specific.

Ask thoughtful questions to help them articulate the need clearly. When the goal is well-defined, summarize what you've discussed and let them know you're ready to move to Step 2.

Be conversational, warm, and professional. Use clear language. Do not be overly verbose - keep responses focused and actionable.

When you have gathered enough information, you can optionally generate a structured role description.`,

  2: `You are an expert HR facilitator guiding a hiring process.

You are currently on STEP 2: ANALYZE JOB REQUIREMENTS.

Building on the hiring need identified in Step 1, your role is to help extract skills and responsibilities for the role.
Use the job database context or your general knowledge to:
- Extract key responsibilities
- Identify required technical skills
- Identify soft skills
- Suggest required education
- Compare with similar roles

When presenting the analysis, use markdown tables to make the skills and requirements clear and structured.
When the requirements feel thorough and clear, summarize them and indicate readiness for Step 3.`,

  3: `You are an expert HR facilitator guiding a hiring process.

You are currently on STEP 3: GENERATE JOB POST DRAFT.

Building on Steps 1 and 2, your role is to help the participant create a structured job listing.
You should draft a comprehensive job post containing the following sections:
- About company
- Role overview
- Responsibilities
- Requirements
- Benefits

Allow the user to improve inclusivity wording, align with company culture, shorten the description, or expand responsibilities.
Make the job post professional and engaging.`,

  4: `You are an expert HR facilitator guiding a hiring process.

You are currently on STEP 4: OPTIMIZATION.

Building on the job post draft from Step 3, your goal is to improve the job post.
Assist the user in optimizing the listing for various contexts:
- Optimize for LinkedIn
- Optimize for diversity
- Optimize for search engines (SEO)
- Generate alternative job titles

Provide the optimized listing variations and explain the benefits of the optimizations.`,

  5: `You are an expert HR facilitator guiding a hiring process.

You are currently on STEP 5: HR STRATEGY.

This is the FINAL step. Your goal is to convert the job post into an actionable hiring plan.
Help the user:
- Generate a hiring roadmap
- Create an interview structure
- Generate screening questions
- Suggest evaluation criteria
- Generate the hiring workflow

Present the roadmap using markdown tables with clear phases, timelines, and action items.

Remember the full context from Steps 1-4. This complete hiring plan should empower the HR team to confidently fill the position.`,
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

IMPORTANT FORMATTING RULES:
- When presenting structured comparisons, analyses, or lists of items with multiple attributes, use markdown tables.
- Use proper markdown table syntax with | column | separators | and |---|---| header dividers.
- Make your output clean, scannable, and extremely professional.`;

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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/workflows", async (req, res) => {
    try {
      const allWorkflows = await storage.getAllWorkflows();
      res.json(allWorkflows);
    } catch (error) {
      console.error("Error fetching workflows:", error);
      res.status(500).json({ error: "Failed to fetch workflows" });
    }
  });

  app.get("/api/workflows/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const workflow = await storage.getWorkflow(id);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      const msgs = await storage.getMessagesByWorkflow(id);
      res.json({ ...workflow, messages: msgs });
    } catch (error) {
      console.error("Error fetching workflow:", error);
      res.status(500).json({ error: "Failed to fetch workflow" });
    }
  });

  app.post("/api/workflows", async (req, res) => {
    try {
      const { title, workflowName, selectedModel } = req.body;
      const workflow = await storage.createWorkflow({
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

  app.patch("/api/workflows/:id/step", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { step } = req.body;
      if (step < 1 || step > 5) {
        return res.status(400).json({ error: "Step must be between 1 and 5" });
      }
      const workflow = await storage.updateWorkflowStep(id, step);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      res.json(workflow);
    } catch (error) {
      console.error("Error updating step:", error);
      res.status(500).json({ error: "Failed to update step" });
    }
  });

  app.patch("/api/workflows/:id/company-url", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { companyUrl } = req.body;
      const workflow = await storage.updateWorkflowCompanyUrl(id, companyUrl || "");
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      res.json(workflow);
    } catch (error) {
      console.error("Error updating company URL:", error);
      res.status(500).json({ error: "Failed to update company URL" });
    }
  });

  app.get("/api/workflows/:id/canvas", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const workflow = await storage.getWorkflow(id);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      res.json({ canvasData: workflow.canvasData || null });
    } catch (error) {
      console.error("Error fetching canvas:", error);
      res.status(500).json({ error: "Failed to fetch canvas" });
    }
  });

  app.post("/api/workflows/:id/step-intro", async (req, res) => {
    try {
      const workflowId = parseInt(req.params.id);
      const workflow = await storage.getWorkflow(workflowId);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }

      const currentStep = workflow.currentStep;
      const stepHasMessages = (await storage.getMessagesByWorkflow(workflowId))
        .some((m) => m.step === currentStep);

      if (stepHasMessages) {
        return res.status(200).json({ skipped: true });
      }

      const allMessages = await storage.getMessagesByWorkflow(workflowId);
      const chatHistory: { role: "system" | "user" | "assistant"; content: string }[] = [
        { role: "system", content: MASTER_SYSTEM_PROMPT },
        { role: "system", content: STEP_SYSTEM_PROMPTS[currentStep] || STEP_SYSTEM_PROMPTS[1] },
      ];

      if (workflow.companyUrl) {
        chatHistory.push({
          role: "system",
          content: `The participant has provided their company website: ${workflow.companyUrl}. Use this context to make your facilitation more relevant to their industry and organization.`,
        });
      }

      if (workflow.canvasData) {
        chatHistory.push({
          role: "system",
          content: `Current Business Model Canvas state:\n${JSON.stringify(workflow.canvasData, null, 2)}\n\nUpdate this canvas if new insights emerge.`,
        });
      }

      for (const m of allMessages) {
        chatHistory.push({
          role: m.role as "user" | "assistant",
          content: m.content,
        });
      }

      const STEP_INTRO_PROMPTS: Record<number, string> = {
        1: "Please introduce this step. Welcome me to the Hiring needs definition step and ask me about the job title, department, seniority, company, and hiring goal I am focusing on today. Keep it brief and professional.",
        2: "We're now moving to Step 2. Based on the hiring need we defined in Step 1, please introduce this step and begin helping me analyze the job requirements, including key responsibilities and necessary skills.",
        3: "We're now moving to Step 3. Based on our requirements analysis, please introduce this step and show me a first draft of the full Job Post containing sections for About the company, Role overview, Responsibilities, Requirements, and Benefits.",
        4: "We're now moving to Step 4. Let's optimize our draft. Please introduce this step and explain how we can improve the job post—such as emphasizing inclusivity, SEO, or LinkedIn readiness. Feel free to provide one optimized variation right away.",
        5: "We're now moving to the final Step 5. Based on our finalized job post, please introduce this step and help convert it into an actionable HR Strategy. Please provide a brief hiring roadmap and prompt me to explore interview structure and evaluation criteria.",
      };

      chatHistory.push({
        role: "user",
        content: STEP_INTRO_PROMPTS[currentStep] || STEP_INTRO_PROMPTS[1],
      });

      await storage.createMessage({
        workflowId,
        role: "user",
        content: STEP_INTRO_PROMPTS[currentStep] || STEP_INTRO_PROMPTS[1],
        step: currentStep,
      });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const modelId = workflow.selectedModel || "gpt-5.2";
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

  app.delete("/api/workflows/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteWorkflow(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting workflow:", error);
      res.status(500).json({ error: "Failed to delete workflow" });
    }
  });

  app.post("/api/workflows/:id/messages", async (req, res) => {
    try {
      const workflowId = parseInt(req.params.id);
      const { content } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({ error: "Message content is required" });
      }

      const workflow = await storage.getWorkflow(workflowId);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }

      const currentStep = workflow.currentStep;

      await storage.createMessage({
        workflowId,
        role: "user",
        content: content.trim(),
        step: currentStep,
      });

      const allMessages = await storage.getMessagesByWorkflow(workflowId);
      const chatHistory: { role: "system" | "user" | "assistant"; content: string }[] = [
        { role: "system", content: MASTER_SYSTEM_PROMPT },
        { role: "system", content: STEP_SYSTEM_PROMPTS[currentStep] || STEP_SYSTEM_PROMPTS[1] },
      ];

      if (workflow.companyUrl) {
        chatHistory.push({
          role: "system",
          content: `The participant has provided their company website: ${workflow.companyUrl}. Use this context to make your facilitation more relevant to their industry and organization.`,
        });
      }

      if (workflow.canvasData) {
        chatHistory.push({
          role: "system",
          content: `Current Business Model Canvas state:\n${JSON.stringify(workflow.canvasData, null, 2)}\n\nUpdate this canvas with <!--BMC_START-->...<!--BMC_END--> markers if new insights emerge from this conversation.`,
        });
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

      const modelId = workflow.selectedModel || "gpt-5.2";
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
  });

  app.patch("/api/workflows/:id/model", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { selectedModel } = req.body;
      const valid = MODEL_OPTIONS.some((m) => m.id === selectedModel);
      if (!valid) {
        return res.status(400).json({ error: "Invalid model selection" });
      }
      const workflow = await storage.updateWorkflowModel(id, selectedModel);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }
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
      openai: !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      anthropic: !!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
      gemini: !!process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
    });
  });

  app.get("/api/steps", (req, res) => {
    res.json(STEP_NAMES.slice(1).map((name, i) => ({ step: i + 1, name })));
  });

  return httpServer;
}
