import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { MODEL_OPTIONS, type ModelId } from "@shared/schema";

const openaiClient = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const anthropicClient = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY!,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

const geminiClient = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

function getProvider(modelId: string): string {
  const model = MODEL_OPTIONS.find((m) => m.id === modelId);
  return model?.provider || "openai";
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function streamChat(
  modelId: string,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
): Promise<string> {
  const provider = getProvider(modelId);

  if (provider === "openai") {
    return streamOpenAI(modelId, messages, onChunk);
  } else if (provider === "anthropic") {
    return streamAnthropic(modelId, messages, onChunk);
  } else if (provider === "gemini") {
    return streamGemini(modelId, messages, onChunk);
  }

  return streamOpenAI("gpt-5.2", messages, onChunk);
}

async function streamOpenAI(
  model: string,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
): Promise<string> {
  const stream = await openaiClient.chat.completions.create({
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    stream: true,
    max_completion_tokens: 8192,
  });

  let fullResponse = "";
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || "";
    if (delta) {
      fullResponse += delta;
      onChunk(delta);
    }
  }
  return fullResponse;
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

async function streamGemini(
  model: string,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
): Promise<string> {
  const systemMessages = messages.filter((m) => m.role === "system");
  const chatMessages = messages.filter((m) => m.role !== "system");

  const systemInstruction = systemMessages.map((m) => m.content).join("\n\n");

  const geminiContents = chatMessages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const stream = await geminiClient.models.generateContentStream({
    model,
    contents: geminiContents as any,
    config: {
      maxOutputTokens: 8192,
      systemInstruction: systemInstruction || undefined,
    },
  });

  let fullResponse = "";
  for await (const chunk of stream) {
    const text = chunk.text || "";
    if (text) {
      fullResponse += text;
      onChunk(text);
    }
  }
  return fullResponse;
}
