import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { sessionId } from "@/lib/session";

const base = import.meta.env.BASE_URL.replace(/\/$/, "");
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Send,
  Trash2,
  Loader2,
  Sparkles,
  ArrowRight,
  MessageSquare,
  LayoutGrid,
  Map,
  BookOpen,
  UserRound,
  Lightbulb,
  Globe,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
    "How common is this role?",
    "Suggest alternative titles",
    "What seniority level fits?",
    "What details are missing?",
  ],
  2: [
    "Show database stats",
    "Most common skills?",
    "Rare vs standard requirements",
    "Must-have vs nice-to-have",
  ],
  3: [
    "Write the full draft",
    "More inclusive language",
    "Strengthen the benefits",
    "Startup tone",
  ],
  4: [
    "LinkedIn version",
    "Audit for bias",
    "Top ATS keywords",
    "Social media teaser",
  ],
  5: [
    "Add interview stage",
    "Screening questions",
    "Build a scoring rubric",
    "Estimate hiring timeline",
  ],
};

interface WorkflowWithMessages extends Workflow {
  messages: Message[];
}

import { StepIndicator, STEPS } from "@/components/home/StepIndicator";
import { ChatMessage } from "@/components/home/ChatMessage";
import { CanvasPopup } from "@/components/home/CanvasPopup";
import { RoadmapPopup } from "@/components/home/RoadmapPopup";
import { TutorialDialog } from "@/components/home/TutorialDialog";
import { ModelSelector } from "@/components/home/ModelSelector";

export default function Home() {
  const { toast } = useToast();
  const [activeWorkflowId, setActiveWorkflowId] = useState<number | null>(null);
  const [viewingStep, setViewingStep] = useState<number>(1);
  const [inputValue, setInputValue] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isIntroStreaming, setIsIntroStreaming] = useState(false);
  const [isPretending, setIsPretending] = useState(false);
  const [introTriggeredFor, setIntroTriggeredFor] = useState<string | null>(null);
  const [showCanvas, setShowCanvas] = useState(false);
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [showNewWorkflowDialog, setShowNewWorkflowDialog] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [showNextStepWarning, setShowNextStepWarning] = useState(false);
  const [showPromptSheet, setShowPromptSheet] = useState(false);
  const [newWorkflowMode, setNewWorkflowMode] = useState<"website" | "manual">("manual");
  const [newWorkflowUrl, setNewWorkflowUrl] = useState("");
  const [showTutorial, setShowTutorial] = useState(
    () => localStorage.getItem("chi-hr-tutorial-seen") !== "1"
  );

  const handleTutorialOpenChange = (open: boolean) => {
    if (!open) localStorage.setItem("chi-hr-tutorial-seen", "1");
    setShowTutorial(open);
  };
  const [newWorkflowModel, setNewWorkflowModel] = useState<string>("claude-sonnet-4-6");
  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);
  const scrolledUpAtStreamEndRef = useRef(false);
  const wasStreamingRef = useRef(false);
  const fetchSuggestionsAfterStreamRef = useRef(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

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

  useEffect(() => {
    const el = scrollRef.current?.querySelector<HTMLElement>(
      "[data-radix-scroll-area-viewport]"
    );
    if (!el) return;

    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
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
    if (!opts.force && userScrolledUpRef.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior: opts.smooth ? "smooth" : "instant" });
  }, []);

  useEffect(() => {
    if (scrolledUpAtStreamEndRef.current) {
      userScrolledUpRef.current = true;
      scrolledUpAtStreamEndRef.current = false;
      return;
    }
    scrollToBottom({ smooth: !isStreaming });
  }, [workflowDetail?.messages, scrollToBottom]);

  useEffect(() => {
    scrollToBottom({ smooth: false });
  }, [streamingContent, scrollToBottom]);

  // Fetch AI suggestions after each non-intro stream completes
  useEffect(() => {
    const justFinished = wasStreamingRef.current && !isStreaming;
    wasStreamingRef.current = isStreaming;
    if (!justFinished || !activeWorkflowId || !fetchSuggestionsAfterStreamRef.current) return;
    fetchSuggestionsAfterStreamRef.current = false;
    setLoadingSuggestions(true);
    fetch(`${base}/api/workflows/${activeWorkflowId}/suggestions`, {
      headers: { "X-Session-ID": sessionId },
    })
      .then((r) => r.json())
      .then((data) => setAiSuggestions(data.suggestions || []))
      .catch(() => setAiSuggestions([]))
      .finally(() => setLoadingSuggestions(false));
  }, [isStreaming, activeWorkflowId]);

  // Clear stale suggestions when switching workflow or step
  useEffect(() => {
    setAiSuggestions([]);
    setLoadingSuggestions(false);
  }, [activeWorkflowId, viewingStep]);

  const allMessages = workflowDetail?.messages || [];
  const visibleMessages = allMessages.filter((m) => m.step === viewingStep);

  // Skip the first user message of each step — it's the auto-generated intro prompt, not a real user message
  const displayMessages =
    visibleMessages.length > 0 && visibleMessages[0].role === "user"
      ? visibleMessages.slice(1)
      : visibleMessages;

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
            // not JSON
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
                scrolledUpAtStreamEndRef.current = userScrolledUpRef.current;
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
      fetchSuggestionsAfterStreamRef.current = false;
      setIsIntroStreaming(true);
      await streamSSEResponse(`/api/workflows/${workflowId}/step-intro`, "POST");
      setIsIntroStreaming(false);
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
    mutationFn: async ({ model, companyUrl }: { model: string; companyUrl: string }) => {
      const res = await apiRequest("POST", "/api/workflows", {
        title: `Workflow ${allWorkflows.length + 1}`,
        workflowName: "",
        selectedModel: model,
      });
      const workflow = await res.json();
      if (companyUrl) {
        await apiRequest("PATCH", `/api/workflows/${workflow.id}/company-url`, { companyUrl });
      }
      return workflow;
    },
    onSuccess: (data: Workflow) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      setActiveWorkflowId(data.id);
      setViewingStep(1);
      setIntroTriggeredFor(null);
      setShowCanvas(false);
      setShowNewWorkflowDialog(false);
      setNewWorkflowUrl("");
      setNewWorkflowMode("manual");
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

    setAiSuggestions([]);
    setLoadingSuggestions(false);
    fetchSuggestionsAfterStreamRef.current = true;
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

  const pretendToBeMe = useCallback(async () => {
    if (!activeWorkflowId || isStreaming || isPretending) return;
    setIsPretending(true);
    try {
      const response = await fetch(`${base}/api/workflows/${activeWorkflowId}/pretend-user`, {
        method: "POST",
        headers: { "X-Session-ID": sessionId },
      });
      if (!response.ok) throw new Error("Failed to generate message");
      const { message } = await response.json();
      if (message) await sendMessage(message);
    } catch (error) {
      console.error("Error generating pretend-user message:", error);
    } finally {
      setIsPretending(false);
    }
  }, [activeWorkflowId, isStreaming, isPretending, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const viewingStepName = STEPS.find((s) => s.step === viewingStep)?.name || "";
  const isViewingCurrentStep = viewingStep === currentStep;
  const canvasData = workflowDetail?.canvasData as CanvasData | null | undefined;

  const isNextStepReady = visibleMessages.some(
    (m) => m.role === "assistant" && m.content.includes("<!--NEXT_STEP_READY-->")
  );

  const handleStepClick = (step: number) => {
    if (isStreaming) return;
    setViewingStep(step);
  };

  const handleAdvanceStep = (step: number) => {
    if (!activeWorkflowId || isStreaming) return;
    advanceStep.mutate({ id: activeWorkflowId, step });
  };

  const isModelUnavailable = (() => {
    if (!availableProviders) return false;
    const selected = MODEL_OPTIONS.find((m) => m.id === newWorkflowModel);
    return !!selected && !availableProviders[selected.provider as keyof typeof availableProviders];
  })();

  return (
    <div
      className="flex flex-col h-screen relative overflow-hidden bg-gradient-to-br from-white via-slate-50/80 to-blue-50/40"
      data-testid="home-page"
    >
      {/* Background blobs */}
      <div aria-hidden className="pointer-events-none select-none absolute -top-48 -right-48 w-[700px] h-[700px] rounded-full bg-primary/[0.07] blur-3xl" />
      <div aria-hidden className="pointer-events-none select-none absolute -bottom-48 -left-48 w-[600px] h-[600px] rounded-full bg-sky-400/[0.06] blur-3xl" />
      <div aria-hidden className="pointer-events-none select-none absolute top-1/2 right-1/3 w-[500px] h-[400px] -translate-y-1/2 rounded-[50%] bg-violet-300/[0.05] blur-3xl" />

      <header className="flex items-center justify-between gap-2 px-3 sm:px-4 py-3 border-b bg-white/80 backdrop-blur-sm z-50 sticky top-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <h1 className="text-sm font-semibold leading-tight truncate" data-testid="text-app-title">
            HR Workflow Assistant
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {activeWorkflowId && workflowDetail && (
            <ModelSelector
              workflowId={activeWorkflowId}
              currentModel={workflowDetail.selectedModel || "claude-sonnet-4-6"}
              disabled={isStreaming}
            />
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowTutorial(true)}
            title="Tutorial"
            data-testid="button-tutorial"
          >
            <BookOpen className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="flex items-center gap-1 px-3 py-2 border-b bg-white/60 backdrop-blur-sm overflow-x-auto">
        {allWorkflows.map((w) => (
          <div key={w.id} className="flex items-center shrink-0">
            <button
              onClick={() => {
                setActiveWorkflowId(w.id);
                setShowCanvas(false);
              }}
              data-testid={`tab-workflow-${w.id}`}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${w.id === activeWorkflowId
                ? "bg-white border border-border font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              <span className="max-w-[80px] sm:max-w-[120px] truncate">{w.title}</span>
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
                  setPendingDeleteId(w.id);
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
        <div className="border-b bg-white/60 backdrop-blur-sm">
          <StepIndicator
            currentStep={currentStep}
            viewingStep={viewingStep}
            onStepClick={handleStepClick}
            hasMessagesForStep={hasMessagesForStep}
          />
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-h-0">
          {!activeWorkflowId ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center space-y-6 max-w-md">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mx-auto shadow-sm">
                  <Sparkles className="w-10 h-10 text-primary" />
                </div>
                <div className="space-y-3">
                  <h2 className="text-2xl font-semibold">Welcome to your HR Workflow Assistant</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Ready to find your next quantum hire? This tool will guide you step by step —
                    from defining your need to a polished job post and execution plan, all backed by
                    real market data.
                  </p>
                </div>
                <Button
                  size="lg"
                  onClick={() => setShowNewWorkflowDialog(true)}
                  disabled={createWorkflow.isPending}
                  data-testid="button-create-first-workflow"
                  className="gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Start a New Workflow
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
                <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
                  {loadingDetail ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : isIntroStreaming || (!hasMessagesForStep(viewingStep) && isViewingCurrentStep && !isStreaming) ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      <span className="ml-3 text-sm text-muted-foreground">
                        Starting Step {viewingStep}...
                      </span>
                    </div>
                  ) : displayMessages.length === 0 && !streamingContent ? (
                    isViewingCurrentStep ? null : (
                      <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center py-12">
                        <div className="w-16 h-16 rounded-md bg-primary/10 flex items-center justify-center">
                          <Sparkles className="w-8 h-8 text-primary" />
                        </div>
                        <div className="space-y-2 max-w-md">
                          <h2 className="text-lg font-semibold" data-testid="text-empty-title">
                            {viewingStepName}
                          </h2>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            No messages for this step yet.
                          </p>
                        </div>
                      </div>
                    )
                  ) : (
                    <>
                      {displayMessages.map((msg) => (
                        <ChatMessage key={msg.id} message={msg} />
                      ))}
                      {streamingContent && isViewingCurrentStep && !isIntroStreaming && (
                        <ChatMessage
                          message={{ role: "assistant", content: streamingContent }}
                          isStreaming={true}
                        />
                      )}
                      {viewingStep === 5 && !isStreaming && displayMessages.length > 0 && (
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

              <div className="border-t bg-white/80 backdrop-blur-sm px-3 sm:px-4 py-3">
                <div className="max-w-4xl mx-auto space-y-2">
{isViewingCurrentStep && currentStep <= 5 && visibleMessages.length > 0 && !isStreaming && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs text-primary border-primary/20 bg-primary/5 hover:bg-primary/10"
                        onClick={() => setShowPromptSheet(true)}
                      >
                        <Lightbulb className="w-3.5 h-3.5" />
                        Suggestions
                      </Button>
                      {currentStep < 5 && (
                        <Button
                          variant={isNextStepReady ? "default" : "outline"}
                          size="sm"
                          className={`ml-auto shrink-0 ${isNextStepReady
                            ? "font-semibold shadow-md animate-pulse hover:animate-none"
                            : "text-muted-foreground"}`}
                          onClick={() => {
                            if (isNextStepReady) {
                              handleAdvanceStep(currentStep + 1);
                            } else {
                              setShowNextStepWarning(true);
                            }
                          }}
                          data-testid="button-next-step"
                        >
                          Next: {STEPS[currentStep]?.name}
                          <ArrowRight className="w-3.5 h-3.5 ml-1" />
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
                        placeholder="Type your message..."
                        className="resize-none min-h-[44px] max-h-[160px] text-sm flex-1 bg-white/70"
                        rows={1}
                        disabled={isStreaming}
                        data-testid="input-message"
                      />
                      <Button
                        variant="outline"
                        onClick={pretendToBeMe}
                        disabled={isStreaming || isPretending}
                        title="Playtester: generate a user message and send it"
                        data-testid="button-pretend-user"
                        className="shrink-0 gap-1.5 text-muted-foreground"
                        size="sm"
                      >
                        {isPretending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <UserRound className="w-3.5 h-3.5" />
                        )}
                        <span className="text-xs hidden sm:inline">Pretend to be me</span>
                      </Button>
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

      <TutorialDialog open={showTutorial} onOpenChange={handleTutorialOpenChange} />

      {/* Suggestions panel */}
      <Sheet open={showPromptSheet} onOpenChange={setShowPromptSheet}>
        <SheetContent side="bottom" className="px-4 pb-8 pt-5">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="w-4 h-4 text-primary" />
              Suggestions for Step {currentStep}
            </SheetTitle>
          </SheetHeader>
          <div className="max-w-4xl mx-auto grid grid-cols-2 gap-3">
            {/* Left column — static step prompts */}
            <div className="flex flex-col gap-2">
              {STEP_PROMPTS[currentStep]?.map((prompt, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  className="w-full justify-start gap-3 h-auto py-3 text-sm"
                  onClick={() => {
                    sendMessage(prompt);
                    setShowPromptSheet(false);
                  }}
                >
                  <Sparkles className="w-4 h-4 shrink-0 text-primary" />
                  {prompt}
                </Button>
              ))}
            </div>

            {/* Right column — AI-generated contextual prompts */}
            <div className="flex flex-col gap-2">
              {loadingSuggestions ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="h-[46px] rounded-md bg-amber-100/60 animate-pulse" />
                ))
              ) : aiSuggestions.map((prompt, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  className="w-full justify-start gap-3 h-auto py-3 text-sm bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800"
                  onClick={() => {
                    sendMessage(prompt);
                    setShowPromptSheet(false);
                  }}
                >
                  <Sparkles className="w-4 h-4 shrink-0 text-amber-500" />
                  {prompt}
                </Button>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showNextStepWarning} onOpenChange={setShowNextStepWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Not all information provided yet</AlertDialogTitle>
            <AlertDialogDescription>
              The AI assistant hasn't confirmed that all required information for this step has been covered. Proceeding now may result in an incomplete step.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay on this step</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowNextStepWarning(false);
                handleAdvanceStep(currentStep + 1);
              }}
            >
              Proceed anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workflow?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the workflow and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDeleteId !== null) {
                  deleteWorkflow.mutate(pendingDeleteId);
                  setPendingDeleteId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Workflow Dialog */}
      <Dialog
        open={showNewWorkflowDialog}
        onOpenChange={(open) => {
          setShowNewWorkflowDialog(open);
          if (!open) {
            setNewWorkflowMode("manual");
            setNewWorkflowUrl("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Workflow</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">

            {/* Mode selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">How would you like to start?</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewWorkflowMode("website")}
                  className={`flex flex-col gap-2 p-3 rounded-lg border-2 text-left transition-colors ${
                    newWorkflowMode === "website"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <Globe className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">From my website</p>
                    <p className="text-xs text-muted-foreground leading-snug">AI reads your company page for context</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setNewWorkflowMode("manual")}
                  className={`flex flex-col gap-2 p-3 rounded-lg border-2 text-left transition-colors ${
                    newWorkflowMode === "manual"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <MessageSquare className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Start manually</p>
                    <p className="text-xs text-muted-foreground leading-snug">I'll share details in the chat</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Website URL (shown when website mode is selected) */}
            {newWorkflowMode === "website" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Company website URL</label>
                <Input
                  type="url"
                  value={newWorkflowUrl}
                  onChange={(e) => setNewWorkflowUrl(e.target.value)}
                  placeholder="https://yourcompany.com"
                  className="text-sm"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  The AI will fetch your page and use it as context throughout the workflow.
                </p>
              </div>
            )}

            {/* Model selector */}
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
              {isModelUnavailable && (
                <p className="text-xs text-destructive">
                  No API key configured for this model's provider.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewWorkflowDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createWorkflow.mutate({
                  model: newWorkflowModel,
                  companyUrl: newWorkflowMode === "website" ? newWorkflowUrl.trim() : "",
                })}
                disabled={
                  createWorkflow.isPending ||
                  isModelUnavailable ||
                  (newWorkflowMode === "website" && !newWorkflowUrl.trim())
                }
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
