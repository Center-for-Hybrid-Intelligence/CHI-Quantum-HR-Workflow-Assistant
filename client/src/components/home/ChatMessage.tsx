import { Bot, User } from "lucide-react";
import { MarkdownContent } from "./MarkdownContent";

export function ChatMessage({ message, isStreaming }: { message: { role: string; content: string }; isStreaming?: boolean }) {
    const isUser = message.role === "user";

    return (
        <div
            className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
            data-testid={`message-${message.role}`}
        >
            {!isUser && (
                <div className="flex flex-col items-center gap-1 pt-1">
                    <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4 text-primary" />
                    </div>
                </div>
            )}
            <div
                className={`max-w-[80%] rounded-md px-4 py-3 ${isUser
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border border-card-border"
                    }`}
            >
                {isUser ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                ) : (
                    <MarkdownContent content={message.content} />
                )}
                {isStreaming && (
                    <span className="inline-block w-1.5 h-4 bg-foreground/60 animate-pulse ml-0.5 align-text-bottom" />
                )}
            </div>
            {isUser && (
                <div className="flex flex-col items-center gap-1 pt-1">
                    <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                </div>
            )}
        </div>
    );
}
