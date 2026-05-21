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

          <section>
            <p className="text-muted-foreground leading-relaxed">
              Welcome! This assistant is here to help HR professionals in the quantum computing industry
              hire with confidence. It guides you through a <strong>5-step process</strong> — from
              defining your need all the way to a ready-to-execute hiring plan — backed by a database
              of 3,600+ real quantum job listings. Think of it as a knowledgeable colleague who knows
              the market inside-out.
            </p>
          </section>

          <section>
            <h3 className="font-semibold mb-2">Getting Started</h3>
            <ul className="space-y-1.5 text-muted-foreground list-disc list-inside">
              <li>
                <strong>Create a workflow</strong> — Click <strong>+</strong> in the tab bar. You can start
                from your company website (the AI reads your page for context) or jump straight into the chat.
                Up to 10 workflows can run in parallel.
              </li>
              <li>
                <strong>Choose a model</strong> — Use the dropdown in the header:{" "}
                <em>Claude Sonnet 4.6</em> for the best output quality, or <em>Claude Haiku 4.5</em> if
                you prefer faster, lighter responses.
              </li>
              <li>
                <strong>Take your time.</strong> Each step builds on the last. You can always go back and
                review earlier steps in read-only mode.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold mb-3">The 5 Steps</h3>
            <div className="space-y-3">
              <div>
                <p className="font-medium">Step 1 · Define the Hiring Need</p>
                <p className="text-muted-foreground">
                  The AI asks focused questions — one or two at a time — to pin down the job title,
                  department, seniority, company context, and hiring goal. Once all five are confirmed,
                  the <strong>Next Step</strong> button lights up.
                </p>
              </div>
              <div>
                <p className="font-medium">Step 2 · Analyze Job Requirements</p>
                <p className="text-muted-foreground">
                  You'll receive a requirements table grounded in real data — for instance,{" "}
                  <em>"68% of listings for this role require a PhD."</em> Each requirement is flagged
                  as <strong>standard</strong> (&gt;40% of listings) or <strong>rare</strong> (&lt;10%),
                  so you know what's expected vs. what sets you apart.
                </p>
              </div>
              <div>
                <p className="font-medium">Step 3 · Generate Job Post Draft</p>
                <p className="text-muted-foreground">
                  Before drafting, the AI asks a few targeted questions about culture, tone, and benefits
                  — so the result feels genuinely yours. The draft follows a clean structure: About the
                  Company · Role Overview · Key Responsibilities · Requirements · What We Offer.
                </p>
              </div>
              <div>
                <p className="font-medium">Step 4 · Optimization</p>
                <p className="text-muted-foreground">
                  Refine your draft for four channels: <strong>LinkedIn</strong> (hook-first structure,
                  character limits), <strong>D&I</strong> (language audit and bias removal),{" "}
                  <strong>ATS/SEO</strong> (keyword density and title normalization), and{" "}
                  <strong>social media</strong> (280-character teasers). All keyword suggestions are
                  backed by frequency data from the database.
                </p>
              </div>
              <div>
                <p className="font-medium">Step 5 · HR Strategy</p>
                <p className="text-muted-foreground">
                  Every response ends with a complete, updated roadmap covering Phase, Action, Timeline,
                  Type (AI-driven / Human-driven / Hybrid), Owner, and Dependencies. Click{" "}
                  <strong>View Implementation Roadmap</strong> to open the full popup and share it with
                  your team.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold mb-2">Navigation</h3>
            <ul className="space-y-1.5 text-muted-foreground list-disc list-inside">
              <li>
                <strong>Step indicator</strong> — Shows all 5 steps at a glance. Completed steps show a
                checkmark; steps with messages show a dot. Click any step to review it.
              </li>
              <li>
                <strong>Next Step button</strong> — Only activates once the AI signals the step is
                complete. You can still proceed early — a confirmation prompt will appear to let you decide.
              </li>
              <li>
                <strong>Suggestions</strong> — The Suggestions button above the chat input opens a panel
                with context-aware prompts for the current step. Great when you're not sure what to ask next.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold mb-2">Usage Limits</h3>
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

          <section>
            <h3 className="font-semibold mb-2">Tips for the Best Results</h3>
            <ul className="space-y-1.5 text-muted-foreground list-disc list-inside">
              <li>
                <strong>Be specific.</strong> The more concrete your answers, the more targeted and
                data-backed the output will be.
              </li>
              <li>
                <strong>Use the website option</strong> when creating a workflow — it saves you from
                explaining your company from scratch.
              </li>
              <li>
                <strong>Answer Step 3 questions</strong> before asking for the draft. This prevents the
                AI from filling in details it doesn't actually know.
              </li>
              <li>
                <strong>Push back freely.</strong> If something doesn't feel right, just say so — the AI
                will revise without any fuss.
              </li>
              <li>
                <strong>Ask for database comparisons</strong> at any point — frequency stats, title
                alternatives, and outlier flags are always available.
              </li>
            </ul>
          </section>

        </div>
      </DialogContent>
    </Dialog>
  );
}
