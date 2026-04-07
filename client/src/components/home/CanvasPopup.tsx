import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LayoutGrid } from "lucide-react";
import type { CanvasData } from "@shared/schema";

const CANVAS_LABELS: { key: keyof CanvasData; label: string; icon: string; color: string }[] = [
    { key: "keyPartners", label: "Key Partners", icon: "KP", color: "bg-blue-500/10 text-blue-700 border-blue-200" },
    { key: "keyActivities", label: "Key Activities", icon: "KA", color: "bg-indigo-500/10 text-indigo-700 border-indigo-200" },
    { key: "keyResources", label: "Key Resources", icon: "KR", color: "bg-violet-500/10 text-violet-700 border-violet-200" },
    { key: "valuePropositions", label: "Value Propositions", icon: "VP", color: "bg-emerald-500/10 text-emerald-700 border-emerald-200" },
    { key: "customerRelationships", label: "Customer Relationships", icon: "CR", color: "bg-rose-500/10 text-rose-700 border-rose-200" },
    { key: "channels", label: "Channels", icon: "CH", color: "bg-orange-500/10 text-orange-700 border-orange-200" },
    { key: "customerSegments", label: "Customer Segments", icon: "CS", color: "bg-pink-500/10 text-pink-700 border-pink-200" },
    { key: "costStructure", label: "Cost Structure", icon: "C$", color: "bg-amber-500/10 text-amber-700 border-amber-200" },
    { key: "revenueStreams", label: "Revenue Streams", icon: "R$", color: "bg-green-500/10 text-green-700 border-green-200" },
];

export function CanvasPopup({ canvas, open, onOpenChange }: { canvas: CanvasData; open: boolean; onOpenChange: (open: boolean) => void }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0" data-testid="canvas-popup">
                <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <LayoutGrid className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl">Business Model Canvas</DialogTitle>
                            <p className="text-sm text-muted-foreground mt-0.5">HI-enhanced business model overview</p>
                        </div>
                    </div>
                </DialogHeader>
                <ScrollArea className="flex-1 overflow-auto px-6 pb-6">
                    <div className="py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="canvas-grid">
                            {CANVAS_LABELS.map(({ key, label, icon, color }) => {
                                const value = canvas[key] || "To be determined";
                                const items = value.split("\n").filter((l) => l.trim());
                                const isWide = key === "costStructure" || key === "revenueStreams" || key === "valuePropositions";
                                return (
                                    <div
                                        key={key}
                                        className={`rounded-lg border p-4 ${isWide ? "md:col-span-2 lg:col-span-3" : ""}`}
                                        data-testid={`canvas-block-${key}`}
                                    >
                                        <div className="flex items-center gap-2.5 mb-3">
                                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-[10px] font-bold border ${color}`}>
                                                {icon}
                                            </span>
                                            <h4 className="text-sm font-semibold">{label}</h4>
                                        </div>
                                        <div className="space-y-1.5 pl-1">
                                            {items.map((item, idx) => {
                                                const cleanItem = item.replace(/^[-•]\s*/, "").trim();
                                                return (
                                                    <div key={idx} className="flex items-start gap-2">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-primary/40 mt-1.5 shrink-0" />
                                                        <p className="text-sm text-muted-foreground leading-relaxed">{cleanItem}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
