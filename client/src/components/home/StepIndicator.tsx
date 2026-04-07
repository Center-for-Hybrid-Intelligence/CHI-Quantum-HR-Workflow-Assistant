import { Check, ChevronRight } from "lucide-react";

export const STEPS = [
  { step: 1, name: "Define the Hiring Need", shortName: "Hiring Need" },
  { step: 2, name: "Analyze Job Requirements", shortName: "Analyze" },
  { step: 3, name: "Generate Job Post Draft", shortName: "Generate Draft" },
  { step: 4, name: "Optimization", shortName: "Optimize" },
  { step: 5, name: "HR Strategy", shortName: "HR Strategy" },
];

export function StepIndicator({
  currentStep,
  viewingStep,
  onStepClick,
  hasMessagesForStep,
}: {
  currentStep: number;
  viewingStep: number;
  onStepClick: (step: number) => void;
  hasMessagesForStep: (step: number) => boolean;
}) {
  return (
    <div className="flex items-center gap-1 px-4 py-3 overflow-x-auto" data-testid="step-indicator">
      {STEPS.map((s, i) => {
        const isViewing = s.step === viewingStep;
        const isCurrent = s.step === currentStep;
        const isCompleted = s.step < currentStep;
        const hasMessages = hasMessagesForStep(s.step);
        return (
          <div key={s.step} className="flex items-center gap-1">
            <button
              onClick={() => onStepClick(s.step)}
              data-testid={`step-button-${s.step}`}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors
                ${isViewing ? "bg-primary text-primary-foreground" : ""}
                ${!isViewing && isCompleted ? "bg-muted text-foreground" : ""}
                ${!isViewing && isCurrent && !isCompleted ? "bg-secondary text-secondary-foreground" : ""}
                ${!isViewing && !isCompleted && !isCurrent ? "text-muted-foreground" : ""}
              `}
            >
              <span
                className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0
                  ${isViewing ? "bg-primary-foreground text-primary" : ""}
                  ${!isViewing && isCompleted ? "bg-foreground/20 text-foreground" : ""}
                  ${!isViewing && !isCompleted ? "bg-muted text-muted-foreground" : ""}
                `}
              >
                {isCompleted ? <Check className="w-3 h-3" /> : s.step}
              </span>
              <span className="hidden sm:inline">{s.shortName}</span>
              {hasMessages && !isViewing && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
              )}
            </button>
            {i < STEPS.length - 1 && (
              <ChevronRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
