import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookOpen } from "lucide-react";

interface TutorialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TutorialDialog({ open, onOpenChange }: TutorialDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl w-[95vw] max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            User Guide
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 pr-1 text-sm space-y-5">

          {/* What Is This Tool */}
          <section>
            <p className="text-muted-foreground leading-relaxed">
              An AI-powered tool for HR professionals in the quantum computing industry. It guides you through a{" "}
              <strong>5-step process</strong> to define, draft, optimize, and plan the execution of a new hire —
              grounded in a verified database of 3,600+ real quantum job listings.
            </p>
          </section>

          {/* Getting Started */}
          <section>
            <h3 className="font-semibold mb-2">Getting Started</h3>
            <ul className="space-y-1 text-muted-foreground list-disc list-inside">
              <li><strong>Create a workflow</strong> — Click <strong>+</strong> in the tab bar, choose an AI model, and click <strong>Create</strong>. Up to 10 workflows can be open in parallel.</li>
              <li><strong>Add your company website</strong> — Enter your URL in the bar above the chat during Step 1 and click <strong>Save</strong>. The AI uses it throughout the conversation.</li>
              <li><strong>Choose a model</strong> — Use the dropdown in the header: <em>Claude Sonnet 4.6</em> (default, best quality) or <em>Claude Haiku 4.5</em> (faster, lighter).</li>
            </ul>
          </section>

          {/* The 5 Steps */}
          <section>
            <h3 className="font-semibold mb-3">The 5 Steps</h3>
            <div className="space-y-3">
              <div>
                <p className="font-medium">Step 1 · Define the Hiring Need</p>
                <p className="text-muted-foreground">The AI asks 1–2 questions per turn to pin down: job title, department, seniority, company context, and hiring goal. Once all five are confirmed, the <strong>Next Step</strong> button activates.</p>
              </div>
              <div>
                <p className="font-medium">Step 2 · Analyze Job Requirements</p>
                <p className="text-muted-foreground">Produces a requirements table backed by database statistics (e.g. <em>"68% of listings for this role require a PhD"</em>). Requirements are flagged as <strong>standard</strong> (&gt;40%) or <strong>rare</strong> (&lt;10%).</p>
              </div>
              <div>
                <p className="font-medium">Step 3 · Generate Job Post Draft</p>
                <p className="text-muted-foreground">The AI first asks 2–3 targeted questions about culture, tone, and benefits — then drafts a structured post with sections: About the Company · Role Overview · Key Responsibilities · Requirements · What We Offer.</p>
              </div>
              <div>
                <p className="font-medium">Step 4 · Optimization</p>
                <p className="text-muted-foreground">Optimizes for LinkedIn (hook-first, character limits), D&I (language audit, bias removal), ATS/SEO (keyword density, title normalization), and social media (280-character teaser). All alternatives are backed by database frequency data.</p>
              </div>
              <div>
                <p className="font-medium">Step 5 · HR Strategy</p>
                <p className="text-muted-foreground">Every response ends with a complete, updated roadmap table covering Phase, Action, Timeline, Type (🤖 AI · 👤 Human · 🤝 Hybrid), Owner, and Dependencies. Click <strong>View Implementation Roadmap</strong> to open the full popup.</p>
              </div>
            </div>
          </section>

          {/* Navigation */}
          <section>
            <h3 className="font-semibold mb-2">Navigation</h3>
            <ul className="space-y-1 text-muted-foreground list-disc list-inside">
              <li><strong>Step indicator</strong> — Shows all 5 steps. Checkmarks on completed steps, dots on steps with messages. Click any step to review it in read-only mode.</li>
              <li><strong>Next Step button</strong> — Appears only after the AI signals the current step is complete. Clicking it early shows a confirmation warning.</li>
              <li><strong>Quick prompts</strong> — Suggestion chips appear above the input box when the AI is idle. On mobile, tap <strong>Suggestions</strong> to open a panel.</li>
            </ul>
          </section>

          {/* Limits */}
          <section>
            <h3 className="font-semibold mb-2">Limits</h3>
            <div className="rounded-md border overflow-hidden text-xs">
              <table className="w-full">
                <tbody>
                  {[
                    ["Workflows per session", "10"],
                    ["Messages per workflow", "500"],
                    ["Messages per day", "150"],
                    ["Messages per minute", "30"],
                    ["Max message length", "2 000 chars"],
                  ].map(([label, value]) => (
                    <tr key={label} className="border-b last:border-0">
                      <td className="px-3 py-2 text-muted-foreground">{label}</td>
                      <td className="px-3 py-2 font-medium text-right">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Tips */}
          <section>
            <h3 className="font-semibold mb-2">Tips</h3>
            <ul className="space-y-1 text-muted-foreground list-disc list-inside">
              <li><strong>Be specific.</strong> Concrete detail produces targeted, data-backed output.</li>
              <li><strong>Add your company URL</strong> in Step 1 to avoid generic phrasing.</li>
              <li><strong>Answer Step 3 questions</strong> before asking for the draft to prevent invented details.</li>
              <li><strong>Push back freely.</strong> Tell the AI when something feels wrong — it will revise.</li>
              <li><strong>Ask for database comparisons</strong> at any time — frequency stats and title alternatives are always available.</li>
            </ul>
          </section>

        </div>
      </DialogContent>
    </Dialog>
  );
}
