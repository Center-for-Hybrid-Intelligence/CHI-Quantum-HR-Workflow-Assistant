import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Map, Cpu, UserCheck, Handshake } from "lucide-react";
import type { Message } from "@shared/schema";
import { MarkdownContent } from "./MarkdownContent";

export interface RoadmapItem {
    phase: string;
    action: string;
    timeline: string;
    type: "ai" | "human" | "hybrid";
    owner: string;
    dependencies: string;
}

export function parseRoadmapType(raw: string): "ai" | "human" | "hybrid" {
    const lower = raw.toLowerCase();
    if (lower.includes("hybrid") || lower.includes("🤝")) return "hybrid";
    if (lower.includes("ai") || lower.includes("🤖") || lower.includes("automat")) return "ai";
    if (lower.includes("human") || lower.includes("👤")) return "human";
    return "hybrid";
}

function parseTableRow(line: string): string[] {
    let trimmed = line.trim();
    if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
    if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
    return trimmed.split("|").map((c) => c.trim());
}

function isSeparatorRow(cells: string[]): boolean {
    return cells.every((c) => /^[-:]+$/.test(c) || c === "");
}

export function parseRoadmapFromMarkdown(content: string): RoadmapItem[] {
    const items: RoadmapItem[] = [];
    const lines = content.split("\n");
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.includes("|")) continue;
        const cells = parseTableRow(trimmed);
        if (cells.length < 4) continue;
        if (isSeparatorRow(cells)) continue;
        if (/phase/i.test(cells[0]) && /action/i.test(cells[1])) continue;
        items.push({
            phase: cells[0] || "",
            action: cells[1] || "",
            timeline: cells[2] || "",
            type: parseRoadmapType(cells[3] || ""),
            owner: cells[4] || "",
            dependencies: cells[5] || "",
        });
    }
    return items;
}

export function groupByPhase(items: RoadmapItem[]): { phase: string; items: RoadmapItem[] }[] {
    const groups: { phase: string; items: RoadmapItem[] }[] = [];
    let currentPhase = "";
    for (const item of items) {
        const phase = item.phase || currentPhase || "Implementation";
        if (phase !== currentPhase || groups.length === 0) {
            groups.push({ phase, items: [item] });
            currentPhase = phase;
        } else {
            groups[groups.length - 1].items.push(item);
        }
    }
    return groups;
}

export const TYPE_CONFIG = {
    ai: {
        label: "AI-driven",
        icon: Cpu,
        bg: "bg-violet-500/10",
        border: "border-violet-200",
        text: "text-violet-700",
        badgeBg: "bg-violet-50 dark:bg-violet-950",
        badgeBorder: "border-violet-200 dark:border-violet-800",
        badgeText: "text-violet-700 dark:text-violet-300",
        barColor: "bg-violet-500",
    },
    human: {
        label: "Human-driven",
        icon: UserCheck,
        bg: "bg-sky-500/10",
        border: "border-sky-200",
        text: "text-sky-700",
        badgeBg: "bg-sky-50 dark:bg-sky-950",
        badgeBorder: "border-sky-200 dark:border-sky-800",
        badgeText: "text-sky-700 dark:text-sky-300",
        barColor: "bg-sky-500",
    },
    hybrid: {
        label: "Hybrid",
        icon: Handshake,
        bg: "bg-amber-500/10",
        border: "border-amber-200",
        text: "text-amber-700",
        badgeBg: "bg-amber-50 dark:bg-amber-950",
        badgeBorder: "border-amber-200 dark:border-amber-800",
        badgeText: "text-amber-700 dark:text-amber-300",
        barColor: "bg-amber-500",
    },
};

export function TypeBadge({ type }: { type: "ai" | "human" | "hybrid" }) {
    const cfg = TYPE_CONFIG[type];
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.badgeBg} ${cfg.badgeBorder} ${cfg.badgeText}`}>
            <Icon className="w-3 h-3" />
            {cfg.label}
        </span>
    );
}

export function RoadmapPopup({ messages, open, onOpenChange }: { messages: Message[]; open: boolean; onOpenChange: (open: boolean) => void }) {
    const step5Messages = messages.filter((m) => m.step === 5 && m.role === "assistant");
    const roadmapContent = step5Messages.map((m) => m.content).join("\n\n");
    const roadmapItems = parseRoadmapFromMarkdown(roadmapContent);
    const phaseGroups = groupByPhase(roadmapItems);
    const hasVisualRoadmap = roadmapItems.length > 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl w-[96vw] h-[90vh] flex flex-col p-0" data-testid="roadmap-popup">
                <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Map className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl">Implementation Roadmap</DialogTitle>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {(["ai", "human", "hybrid"] as const).map((type) => (
                                <TypeBadge key={type} type={type} />
                            ))}
                        </div>
                    </div>
                </DialogHeader>
                <ScrollArea className="flex-1 overflow-auto">
                    <div className="px-6 py-4">
                        {hasVisualRoadmap ? (
                            <div className="space-y-5" data-testid="roadmap-visual">
                                {phaseGroups.map((group, gi) => (
                                    <div key={gi} data-testid={`roadmap-phase-${gi}`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
                                                {gi + 1}
                                            </span>
                                            <h3 className="text-sm font-semibold">{group.phase}</h3>
                                        </div>
                                        <div className="rounded-lg border overflow-hidden">
                                            <table className="w-full text-sm" data-testid={`roadmap-table-${gi}`}>
                                                <thead>
                                                    <tr className="bg-muted/50">
                                                        <th className="text-left font-medium text-muted-foreground px-4 py-2.5 w-[4%]"></th>
                                                        <th className="text-left font-medium text-muted-foreground px-4 py-2.5 w-[36%]">Action</th>
                                                        <th className="text-left font-medium text-muted-foreground px-4 py-2.5 w-[15%]">Timeline</th>
                                                        <th className="text-left font-medium text-muted-foreground px-4 py-2.5 w-[15%]">Type</th>
                                                        <th className="text-left font-medium text-muted-foreground px-4 py-2.5 w-[15%]">Owner</th>
                                                        <th className="text-left font-medium text-muted-foreground px-4 py-2.5 w-[15%]">Dependencies</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {group.items.map((item, ii) => {
                                                        const cfg = TYPE_CONFIG[item.type];
                                                        return (
                                                            <tr
                                                                key={ii}
                                                                className="border-t hover:bg-muted/30 transition-colors"
                                                                data-testid={`roadmap-item-${gi}-${ii}`}
                                                            >
                                                                <td className="px-4 py-3 align-top">
                                                                    <span className={`block w-3 h-3 rounded-full mt-0.5 ${cfg.barColor}`} />
                                                                </td>
                                                                <td className="px-4 py-3 align-top font-medium">{item.action}</td>
                                                                <td className="px-4 py-3 align-top text-muted-foreground">{item.timeline || "—"}</td>
                                                                <td className="px-4 py-3 align-top">
                                                                    <TypeBadge type={item.type} />
                                                                </td>
                                                                <td className="px-4 py-3 align-top text-muted-foreground">{item.owner || "—"}</td>
                                                                <td className="px-4 py-3 align-top text-muted-foreground">{item.dependencies || "—"}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : roadmapContent ? (
                            <MarkdownContent content={roadmapContent} />
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Map className="w-12 h-12 text-muted-foreground/30 mb-3" />
                                <p className="text-sm text-muted-foreground">
                                    The implementation roadmap will be generated during Step 5.
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Continue the conversation in Step 5 to build your roadmap.
                                </p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
