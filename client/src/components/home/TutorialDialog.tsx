import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlayCircle, FileText } from "lucide-react";

// ─── Placeholder slots ────────────────────────────────────────────────────────
// Replace VIDEO_SRC with a URL or an imported video/iframe src when ready.
// Replace DOCUMENT_SRC with a URL to a PDF / embedded doc when ready.
const VIDEO_SRC = "";
const DOCUMENT_SRC = "";

function VideoTab() {
  if (VIDEO_SRC) {
    return (
      <div className="rounded-lg overflow-hidden border bg-black aspect-video">
        <iframe
          src={VIDEO_SRC}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="Tutorial video"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/40 aspect-video text-center px-6">
      <PlayCircle className="w-12 h-12 text-muted-foreground/40" />
      <p className="text-sm font-medium text-muted-foreground">Video tutorial coming soon</p>
      <p className="text-xs text-muted-foreground/70">
        A walkthrough of the 5-step hiring workflow will be available here.
      </p>
    </div>
  );
}

function DocumentTab() {
  if (DOCUMENT_SRC) {
    return (
      <div className="rounded-lg overflow-hidden border aspect-video">
        <iframe
          src={DOCUMENT_SRC}
          className="w-full h-full"
          title="User guide document"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/40 aspect-video text-center px-6">
      <FileText className="w-12 h-12 text-muted-foreground/40" />
      <p className="text-sm font-medium text-muted-foreground">User guide coming soon</p>
      <p className="text-xs text-muted-foreground/70">
        A detailed PDF guide covering all steps and features will be available here.
      </p>
    </div>
  );
}

interface TutorialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TutorialDialog({ open, onOpenChange }: TutorialDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl w-[95vw]">
        <DialogHeader>
          <DialogTitle>Tutorial</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="video" className="mt-1">
          <TabsList className="w-full">
            <TabsTrigger value="video" className="flex-1 gap-2">
              <PlayCircle className="w-3.5 h-3.5" />
              Video
            </TabsTrigger>
            <TabsTrigger value="guide" className="flex-1 gap-2">
              <FileText className="w-3.5 h-3.5" />
              User Guide
            </TabsTrigger>
          </TabsList>

          <TabsContent value="video" className="mt-4">
            <VideoTab />
          </TabsContent>

          <TabsContent value="guide" className="mt-4">
            <DocumentTab />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
