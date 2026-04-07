import { db } from "../../db";
import { workflows, messages } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IChatStorage {
  getConversation(id: number): Promise<typeof workflows.$inferSelect | undefined>;
  getAllConversations(): Promise<(typeof workflows.$inferSelect)[]>;
  createConversation(title: string): Promise<typeof workflows.$inferSelect>;
  deleteConversation(id: number): Promise<void>;
  getMessagesByConversation(workflowId: number): Promise<(typeof messages.$inferSelect)[]>;
  createMessage(workflowId: number, role: string, content: string): Promise<typeof messages.$inferSelect>;
}

export const chatStorage: IChatStorage = {
  async getConversation(id: number) {
    const [conversation] = await db.select().from(workflows).where(eq(workflows.id, id));
    return conversation;
  },

  async getAllConversations() {
    return db.select().from(workflows).orderBy(desc(workflows.createdAt));
  },

  async createConversation(title: string) {
    const [conversation] = await db.insert(workflows).values({ title }).returning();
    return conversation;
  },

  async deleteConversation(id: number) {
    await db.delete(messages).where(eq(messages.workflowId, id));
    await db.delete(workflows).where(eq(workflows.id, id));
  },

  async getMessagesByConversation(workflowId: number) {
    return db.select().from(messages).where(eq(messages.workflowId, workflowId)).orderBy(messages.createdAt);
  },

  async createMessage(workflowId: number, role: string, content: string) {
    const [message] = await db.insert(messages).values({ workflowId, role, content, step: undefined }).returning();
    return message;
  },
};

