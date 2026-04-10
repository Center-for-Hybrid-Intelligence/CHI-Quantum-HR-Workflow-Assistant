import { db } from "./db";
import { workflows, messages, type Workflow, type InsertWorkflow, type Message, type InsertMessage, type CanvasData } from "@shared/schema";
import { eq, desc, asc } from "drizzle-orm";

export interface IStorage {
  getWorkflow(id: number): Promise<Workflow | undefined>;
  getWorkflowsBySession(sessionId: string): Promise<Workflow[]>;
  createWorkflow(data: InsertWorkflow): Promise<Workflow>;
  updateWorkflowStep(id: number, step: number): Promise<Workflow | undefined>;
  updateWorkflowTitle(id: number, title: string): Promise<Workflow | undefined>;
  updateWorkflowCompanyUrl(id: number, companyUrl: string): Promise<Workflow | undefined>;
  updateWorkflowCanvas(id: number, canvasData: CanvasData): Promise<Workflow | undefined>;
  updateWorkflowModel(id: number, selectedModel: string): Promise<Workflow | undefined>;
  deleteWorkflow(id: number): Promise<void>;
  getMessagesByWorkflow(workflowId: number): Promise<Message[]>;
  createMessage(data: InsertMessage): Promise<Message>;
}

export class DatabaseStorage implements IStorage {
  async getWorkflow(id: number): Promise<Workflow | undefined> {
    const [workflow] = await db.select().from(workflows).where(eq(workflows.id, id));
    return workflow;
  }

  async getWorkflowsBySession(sessionId: string): Promise<Workflow[]> {
    return db.select().from(workflows)
      .where(eq(workflows.sessionId, sessionId))
      .orderBy(desc(workflows.updatedAt));
  }

  async createWorkflow(data: InsertWorkflow): Promise<Workflow> {
    const [workflow] = await db.insert(workflows).values(data).returning();
    return workflow;
  }

  async updateWorkflowStep(id: number, step: number): Promise<Workflow | undefined> {
    const [workflow] = await db
      .update(workflows)
      .set({ currentStep: step, updatedAt: new Date() })
      .where(eq(workflows.id, id))
      .returning();
    return workflow;
  }

  async updateWorkflowTitle(id: number, title: string): Promise<Workflow | undefined> {
    const [workflow] = await db
      .update(workflows)
      .set({ title, updatedAt: new Date() })
      .where(eq(workflows.id, id))
      .returning();
    return workflow;
  }

  async updateWorkflowCompanyUrl(id: number, companyUrl: string): Promise<Workflow | undefined> {
    const [workflow] = await db
      .update(workflows)
      .set({ companyUrl, updatedAt: new Date() })
      .where(eq(workflows.id, id))
      .returning();
    return workflow;
  }

  async updateWorkflowCanvas(id: number, canvasData: CanvasData): Promise<Workflow | undefined> {
    const [workflow] = await db
      .update(workflows)
      .set({ canvasData, updatedAt: new Date() })
      .where(eq(workflows.id, id))
      .returning();
    return workflow;
  }

  async updateWorkflowModel(id: number, selectedModel: string): Promise<Workflow | undefined> {
    const [workflow] = await db
      .update(workflows)
      .set({ selectedModel, updatedAt: new Date() })
      .where(eq(workflows.id, id))
      .returning();
    return workflow;
  }

  async deleteWorkflow(id: number): Promise<void> {
    await db.delete(messages).where(eq(messages.workflowId, id));
    await db.delete(workflows).where(eq(workflows.id, id));
  }

  async getMessagesByWorkflow(workflowId: number): Promise<Message[]> {
    return db.select().from(messages).where(eq(messages.workflowId, workflowId)).orderBy(asc(messages.createdAt));
  }

  async createMessage(data: InsertMessage): Promise<Message> {
    const [message] = await db.insert(messages).values(data).returning();
    return message;
  }
}

export const storage = new DatabaseStorage();
