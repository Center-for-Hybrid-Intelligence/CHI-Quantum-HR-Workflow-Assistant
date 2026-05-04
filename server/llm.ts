import Anthropic from "@anthropic-ai/sdk";
import { type ModelId } from "@shared/schema";

const anthropicClient = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY!,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function generateMessage(
  modelId: ModelId | string,
  messages: ChatMessage[],
): Promise<string> {
  const systemMessages = messages.filter((m) => m.role === "system");
  const chatMessages = messages.filter((m) => m.role !== "system");
  const systemText = systemMessages.map((m) => m.content).join("\n\n");

  const response = await anthropicClient.messages.create({
    model: modelId as string,
    max_tokens: 512,
    system: systemText || undefined,
    messages: chatMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  });

  const block = response.content[0];
  return block.type === "text" ? block.text : "";
}

export async function streamChat(
  modelId: ModelId | string,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
): Promise<string> {
  return streamAnthropic(modelId, messages, onChunk);
}

async function streamAnthropic(
  model: string,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
): Promise<string> {
  const systemMessages = messages.filter((m) => m.role === "system");
  const chatMessages = messages.filter((m) => m.role !== "system");

  const systemText = systemMessages.map((m) => m.content).join("\n\n");

  const stream = anthropicClient.messages.stream({
    model,
    max_tokens: 8192,
    system: systemText || undefined,
    messages: chatMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  });

  let fullResponse = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      const text = event.delta.text;
      if (text) {
        fullResponse += text;
        onChunk(text);
      }
    }
  }
  return fullResponse;
}
