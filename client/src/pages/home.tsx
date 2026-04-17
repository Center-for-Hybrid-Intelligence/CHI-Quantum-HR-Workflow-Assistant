import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { sessionId } from "@/lib/session";

const base = import.meta.env.BASE_URL.replace(/\/$/, "");
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Send,
  Trash2,
  Bot,
  Loader2,
  Sparkles,
  ArrowRight,
  MessageSquare,
  LayoutGrid,
  Map,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Workflow, Message, CanvasData } from "@shared/schema";
import { MODEL_OPTIONS } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

const STEP_PROMPTS: Record<number, string[]> = {
  1: [
    "Suggest similar roles from quantum dataset",
    "Generate job role description",
    "Identify required skills",
    "Suggest salary range"
  ],
  2: [
    "Extract key responsibilities",
    "Identify required technical skills",
    "Identify soft skills",
    "Suggest required education",
    "Compare with similar quantum jobs"
  ],
  3: [
    "Generate full job description",
    "Improve inclusivity wording",
    "Align with company culture",
    "Shorten description",
    "Expand responsibilities"
  ],
  4: [
    "Optimize for LinkedIn",
    "Optimize for diversity",
    "Optimize for search",
    "Generate alternative titles",
    "Benchmark against job database"
  ],
  5: [
    "Generate hiring roadmap",
    "Create interview structure",
    "Generate screening questions",
    "Suggest evaluation criteria",
    "Generate hiring workflow"
  ]
};

interface WorkflowWithMessages extends Workflow {
  messages: Message[];
}

import { StepIndicator, STEPS } from "@/components/home/StepIndicator";
import { MarkdownContent } from "@/components/home/MarkdownContent";
import { ChatMessage } from "@/components/home/ChatMessage";
import { CanvasPopup } from "@/components/home/CanvasPopup";
import { RoadmapPopup } from "@/components/home/RoadmapPopup";
import { CompanyUrlInput } from "@/components/home/CompanyUrlInput";
import { ModelSelector } from "@/components/home/ModelSelector";

function EmptyState({ stepName }: { stepName: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
      <div className="w-16 h-16 rounded-md bg-primary/10 flex items-center justify-center">
        <Sparkles className="w-8 h-8 text-primary" />
      </div>
      <div className="space-y-2 max-w-md">
        <h2 className="text-lg font-semibold" data-testid="text-empty-title">
          {stepName}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Start the conversation below. The AI facilitator will guide you through this step
          of the HI Business Model Innovation process.
        </p>
      </div>
    </div>
  );
}

export default function Home() {
  const { toast } = useToast();
  const [activeWorkflowId, setActiveWorkflowId] = useState<number | null>(null);
  const [viewingStep, setViewingStep] = useState<number>(1);
  const [inputValue, setInputValue] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [introTriggeredFor, setIntroTriggeredFor] = useState<string | null>(null);
  const [showCanvas, setShowCanvas] = useState(false);
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [showNewWorkflowDialog, setShowNewWorkflowDialog] = useState(false);
  const [newWorkflowModel, setNewWorkflowModel] = useState<string>("claude-sonnet-4-6");
  const scrollRef = useRef<HTMLDivElement>(null);
  // True when the user has manually scrolled away from the bottom.
  // We use a ref (not state) so that the scroll handler never triggers a re-render.
  const userScrolledUpRef = useRef(false);

  const { data: allWorkflows = [] } = useQuery<Workflow[]>({
    queryKey: ["/api/workflows"],
  });

  const { data: availableProviders } = useQuery<{ anthropic: boolean }>({
    queryKey: ["/api/available-providers"],
    staleTime: Infinity,
  });

  const { data: workflowDetail, isLoading: loadingDetail } = useQuery<WorkflowWithMessages>({
    queryKey: ["/api/workflows", activeWorkflowId],
    enabled: !!activeWorkflowId,
  });

  useEffect(() => {
    if (allWorkflows.length > 0 && !activeWorkflowId) {
      setActiveWorkflowId(allWorkflows[0].id);
    }
  }, [allWorkflows, activeWorkflowId]);

  useEffect(() => {
    if (workflowDetail) {
      setViewingStep(workflowDetail.currentStep);
    }
  }, [workflowDetail?.currentStep, activeWorkflowId]);

  // Attach a scroll listener to the Radix viewport so we can detect when the
  // user scrolls away from the bottom.  Re-attached whenever the active workflow
  // changes (which causes the ScrollArea to remount).
  useEffect(() => {
    const el = scrollRef.current?.querySelector<HTMLElement>(
      "[data-radix-scroll-area-viewport]"
    );
    if (!el) return;

    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      // Consider "at bottom" if within 60 px.
      userScrolledUpRef.current = distFromBottom > 60;
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [activeWorkflowId]);

  const scrollToBottom = useCallback((opts: { force?: boolean; smooth?: boolean } = {}) => {
    const el = scrollRef.current?.querySelector<HTMLElement>(
      "[data-radix-scroll-area-viewport]"
    );
    if (!el) return;
    // Skip auto-scroll if the user has scrolled up, unless forced.
    if (!opts.force && userScrolledUpRef.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior: opts.smooth ? "smooth" : "instant" });
  }, []);

  // Auto-scroll when new committed messages arrive (smooth) or while streaming
  // (instant, to keep up with the incoming text).
  useEffect(() => {
    scrollToBottom({ smooth: !isStreaming });
  }, [workflowDetail?.messages, scrollToBottom]);

  useEffect(() => {
    scrollToBottom({ smooth: false });
  }, [streamingContent, scrollToBottom]);

  const allMessages = workflowDetail?.messages || [];
  const visibleMessages = allMessages.filter((m) => m.step === viewingStep);

  const hasMessagesForStep = useCallback(
    (step: number) => allMessages.some((m) => m.step === step),
    [allMessages]
  );

  const streamSSEResponse = useCallback(
    async (url: string, method: string, body?: object) => {
      setIsStreaming(true);
      setStreamingContent("");

      try {
        const response = await fetch(`${base}${url}`, {
          method,
          headers: {
            "X-Session-ID": sessionId,
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          const text = await response.text();
          try {
            const json = JSON.parse(text);
            if (json.skipped) {
              setIsStreaming(false);
              return;
            }
          } catch {
            // Response body is not JSON — treat as generic error
          }
          throw new Error("Request failed");
        }

        const contentType = response.headers.get("Content-Type") || "";
        if (contentType.includes("application/json")) {
          const json = await response.json();
          if (json.skipped) {
            setIsStreaming(false);
            return;
          }
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";
        let receivedDone = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.content) {
                accumulated += event.content;
                setStreamingContent(accumulated);
              }
              if (event.done) {
                receivedDone = true;
                setIsStreaming(false);
                setStreamingContent("");
                if (event.canvasUpdated) {
                  setShowCanvas(true);
                }
                queryClient.invalidateQueries({ queryKey: ["/api/workflows", activeWorkflowId] });
                queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
              }
            } catch (e) {
              console.warn("Failed to parse SSE event:", e);
            }
          }
        }

        // If the stream closed without a done event (e.g. server error), reset streaming state
        if (!receivedDone) {
          setIsStreaming(false);
          setStreamingContent("");
          queryClient.invalidateQueries({ queryKey: ["/api/workflows", activeWorkflowId] });
        }
      } catch (error) {
        console.error("Error streaming:", error);
        setIsStreaming(false);
        setStreamingContent("");
        queryClient.invalidateQueries({ queryKey: ["/api/workflows", activeWorkflowId] });
      }
    },
    [activeWorkflowId]
  );

  const triggerStepIntro = useCallback(
    async (workflowId: number, step: number) => {
      const key = `${workflowId}-${step}`;
      if (introTriggeredFor === key) return;
      setIntroTriggeredFor(key);
      await streamSSEResponse(`/api/workflows/${workflowId}/step-intro`, "POST");
    },
    [introTriggeredFor, streamSSEResponse]
  );

  const currentStep = Math.min(workflowDetail?.currentStep || 1, 5);

  useEffect(() => {
    if (
      activeWorkflowId &&
      workflowDetail &&
      viewingStep === currentStep &&
      !isStreaming &&
      !hasMessagesForStep(currentStep)
    ) {
      triggerStepIntro(activeWorkflowId, currentStep);
    }
  }, [activeWorkflowId, workflowDetail, viewingStep, currentStep, isStreaming, hasMessagesForStep, triggerStepIntro]);

  useEffect(() => {
    if (!availableProviders) return;
    const fallback = MODEL_OPTIONS.find((m) => availableProviders[m.provider as keyof typeof availableProviders]);
    if (fallback) setNewWorkflowModel(fallback.id);
  }, [availableProviders]);

  const createWorkflow = useMutation({
    mutationFn: async (selectedModel: string) => {
      const res = await apiRequest("POST", "/api/workflows", {
        title: `Workflow ${allWorkflows.length + 1}`,
        workflowName: "",
        selectedModel,
      });
      return res.json();
    },
    onSuccess: (data: Workflow) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      setActiveWorkflowId(data.id);
      setViewingStep(1);
      setIntroTriggeredFor(null);
      setShowCanvas(false);
      setShowNewWorkflowDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create workflow",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteWorkflow = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/workflows/${id}`);
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      if (activeWorkflowId === deletedId) {
        const remaining = allWorkflows.filter((w) => w.id !== deletedId);
        setActiveWorkflowId(remaining.length > 0 ? remaining[0].id : null);
      }
    },
  });

  const advanceStep = useMutation({
    mutationFn: async ({ id, step }: { id: number; step: number }) => {
      const res = await apiRequest("PATCH", `/api/workflows/${id}/step`, { step });
      return res.json();
    },
    onSuccess: (_, { step }) => {
      setViewingStep(step);
      setIntroTriggeredFor(null);
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workflows", activeWorkflowId] });
    },
  });

  const sendMessage = useCallback(async (forcedContent?: string) => {
    const messageContent = forcedContent || inputValue.trim();
    if (!messageContent || !activeWorkflowId || isStreaming) return;
    if (viewingStep !== currentStep) return;

    if (!forcedContent) {
      setInputValue("");
    }

    // When the user actively sends a message, always snap to the bottom.
    userScrolledUpRef.current = false;
    scrollToBottom({ force: true, smooth: true });

    const optimisticMsg: Message = {
      id: Date.now(),
      workflowId: activeWorkflowId,
      role: "user",
      content: messageContent,
      step: currentStep,
      createdAt: new Date(),
    };

    queryClient.setQueryData(
      ["/api/workflows", activeWorkflowId],
      (old: WorkflowWithMessages | undefined) =>
        old ? { ...old, messages: [...(old.messages || []), optimisticMsg] } : old
    );

    await streamSSEResponse(`/api/workflows/${activeWorkflowId}/messages`, "POST", {
      content: messageContent,
    });
  }, [inputValue, activeWorkflowId, isStreaming, viewingStep, currentStep, streamSSEResponse]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const viewingStepName = STEPS.find((s) => s.step === viewingStep)?.name || "";
  const isViewingCurrentStep = viewingStep === currentStep;
  const canvasData = workflowDetail?.canvasData as CanvasData | null | undefined;

  const handleStepClick = (step: number) => {
    if (isStreaming) return;
    setViewingStep(step);
  };

  const handleAdvanceStep = (step: number) => {
    if (!activeWorkflowId || isStreaming) return;
    advanceStep.mutate({ id: activeWorkflowId, step });
  };

  return (
    <div className="flex flex-col h-screen bg-background" data-testid="home-page">
      <header className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-background z-50 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight" data-testid="text-app-title">
              HR Workflow Assistant
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeWorkflowId && workflowDetail && (
            <ModelSelector
              workflowId={activeWorkflowId}
              currentModel={workflowDetail.selectedModel || "claude-sonnet-4-6"}
              disabled={isStreaming}
            />
          )}
        </div>
      </header>

      <div className="flex items-center gap-1 px-3 py-2 border-b bg-card/50 overflow-x-auto">
        {allWorkflows.map((w) => (
          <div key={w.id} className="flex items-center shrink-0">
            <button
              onClick={() => {
                setActiveWorkflowId(w.id);
                setShowCanvas(false);
              }}
              data-testid={`tab-workflow-${w.id}`}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${w.id === activeWorkflowId
                ? "bg-background border border-border font-medium"
                : "text-muted-foreground"
                }`}
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              <span className="max-w-[120px] truncate">{w.title}</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {Math.min(w.currentStep, 5)}/5
              </Badge>
            </button>
            {w.id === activeWorkflowId && allWorkflows.length > 1 && (
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteWorkflow.mutate(w.id);
                }}
                data-testid={`button-delete-workflow-${w.id}`}
                className="ml-0.5 w-7 h-7"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        ))}
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setShowNewWorkflowDialog(true)}
          disabled={createWorkflow.isPending}
          data-testid="button-new-workflow"
          className="shrink-0"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {activeWorkflowId && (
        <div className="border-b bg-card/30">
          <StepIndicator
            currentStep={currentStep}
            viewingStep={viewingStep}
            onStepClick={handleStepClick}
            hasMessagesForStep={hasMessagesForStep}
          />
        </div>
      )}

      {activeWorkflowId && viewingStep === 1 && isViewingCurrentStep && currentStep === 1 && (
        <CompanyUrlInput
          workflowId={activeWorkflowId}
          currentUrl={workflowDetail?.companyUrl || ""}
        />
      )}

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-h-0">
          {!activeWorkflowId ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-md bg-primary/10 flex items-center justify-center mx-auto">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold">Start Your First Workshop</h2>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Create a new workflow to begin the HI Business Model Innovation process.
                  </p>
                </div>
                <Button
                  onClick={() => setShowNewWorkflowDialog(true)}
                  disabled={createWorkflow.isPending}
                  data-testid="button-create-first-workflow"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Workflow
                </Button>
              </div>
            </div>
          ) : (
            <>
              {!isViewingCurrentStep && (
                <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b">
                  <Badge variant="secondary" className="text-xs">
                    Viewing Step {viewingStep}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {viewingStepName} (read-only)
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewingStep(currentStep)}
                    data-testid="button-back-to-current"
                    className="ml-auto text-xs"
                  >
                    Back to Step {currentStep}
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              )}

              <ScrollArea className="flex-1" ref={scrollRef}>
                <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
                  {loadingDetail ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : visibleMessages.length === 0 && !streamingContent ? (
                    isViewingCurrentStep ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        <span className="ml-3 text-sm text-muted-foreground">
                          Starting Step {viewingStep}...
                        </span>
                      </div>
                    ) : (
                      <EmptyState stepName={viewingStepName} />
                    )
                  ) : (
                    <>
                      {visibleMessages.map((msg) => (
                        <ChatMessage key={msg.id} message={msg} />
                      ))}
                      {streamingContent && isViewingCurrentStep && (
                        <ChatMessage
                          message={{ role: "assistant", content: streamingContent }}
                          isStreaming={true}
                        />
                      )}
                      {viewingStep === 5 && !isStreaming && visibleMessages.length > 0 && (
                        <div className="flex items-center justify-center gap-3 py-4 mt-2" data-testid="popup-buttons">
                          {canvasData && (
                            <Button
                              variant="outline"
                              onClick={() => setShowCanvas(true)}
                              data-testid="button-open-canvas-popup"
                              className="gap-2"
                            >
                              <LayoutGrid className="w-4 h-4" />
                              View Business Model Canvas
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            onClick={() => setShowRoadmap(true)}
                            data-testid="button-open-roadmap-popup"
                            className="gap-2"
                          >
                            <Map className="w-4 h-4" />
                            View Implementation Roadmap
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </ScrollArea>

              <div className="border-t bg-background px-4 py-3">
                <div className="max-w-3xl mx-auto space-y-2">
                  {isViewingCurrentStep && currentStep <= 5 && visibleMessages.length > 0 && !isStreaming && (
                    <div className="flex justify-end gap-2 items-center">
                      <div className="flex flex-wrap gap-2 flex-1 items-center">
                        {STEP_PROMPTS[currentStep]?.map((prompt, idx) => (
                          <Button
                            key={idx}
                            variant="outline"
                            size="sm"
                            className="text-[10px] h-6 px-2.5 py-0 rounded-full bg-primary/5 hover:bg-primary/20 border-primary/20 text-primary transition-colors"
                            onClick={() => sendMessage(prompt)}
                          >
                            <Bot className="w-3 h-3 mr-1" />
                            {prompt}
                          </Button>
                        ))}
                      </div>
                      {currentStep < 5 && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="shrink-0"
                          onClick={() => handleAdvanceStep(currentStep + 1)}
                          data-testid="button-next-step"
                        >
                          Next: {STEPS[currentStep]?.name}
                          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                        </Button>
                      )}
                    </div>
                  )}
                  {isViewingCurrentStep ? (
                    <div className="flex items-end gap-2">
                      <Textarea
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={`Type your message for Step ${currentStep}: ${viewingStepName}...`}
                        className="resize-none min-h-[44px] max-h-[160px] text-sm"
                        rows={1}
                        disabled={isStreaming}
                        data-testid="input-message"
                      />
                      <Button
                        onClick={() => sendMessage()}
                        disabled={!inputValue.trim() || isStreaming}
                        data-testid="button-send"
                      >
                        {isStreaming ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-1">
                      <p className="text-xs text-muted-foreground">
                        Viewing past step. Go to Step {currentStep} to continue the conversation.
                      </p>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground text-center">
                    {isViewingCurrentStep
                      ? `Step ${currentStep} of 5 — ${viewingStepName}`
                      : `Viewing Step ${viewingStep} — Current: Step ${currentStep}`}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

      </div>

      {canvasData && (
        <CanvasPopup canvas={canvasData} open={showCanvas} onOpenChange={setShowCanvas} />
      )}
      {workflowDetail && (
        <RoadmapPopup messages={allMessages} open={showRoadmap} onOpenChange={setShowRoadmap} />
      )}

      <Dialog open={showNewWorkflowDialog} onOpenChange={setShowNewWorkflowDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Workflow</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">AI Model</label>
              <Select value={newWorkflowModel} onValueChange={setNewWorkflowModel}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_OPTIONS.map((m) => {
                    const unavailable = availableProviders && !availableProviders[m.provider as keyof typeof availableProviders];
                    return (
                      <SelectItem
                        key={m.id}
                        value={m.id}
                        disabled={!!unavailable}
                        className={unavailable ? "opacity-40 cursor-not-allowed" : ""}
                      >
                        <span>{m.label}</span>
                        <span className="text-xs text-muted-foreground ml-1.5 capitalize">({m.provider})</span>
                        {unavailable && <span className="text-xs text-destructive ml-1">— no API key</span>}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {availableProviders && (() => {
                const selected = MODEL_OPTIONS.find((m) => m.id === newWorkflowModel);
                const unavailable = selected && !availableProviders[selected.provider as keyof typeof availableProviders];
                return unavailable ? (
                  <p className="text-xs text-destructive">
                    No API key configured for {selected.provider}. Add one to your environment to use this model.
                  </p>
                ) : null;
              })()}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewWorkflowDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createWorkflow.mutate(newWorkflowModel)}
                disabled={createWorkflow.isPending || (() => {
                  if (!availableProviders) return false;
                  const selected = MODEL_OPTIONS.find((m) => m.id === newWorkflowModel);
                  return !!selected && !availableProviders[selected.provider as keyof typeof availableProviders];
                })()}
                data-testid="button-confirm-new-workflow"
              >
                {createWorkflow.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
