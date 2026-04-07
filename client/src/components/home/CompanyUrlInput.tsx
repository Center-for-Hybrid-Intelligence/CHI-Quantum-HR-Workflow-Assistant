import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Link as LinkIcon, Loader2 } from "lucide-react";

export function CompanyUrlInput({
    workflowId,
    currentUrl,
}: {
    workflowId: number;
    currentUrl: string;
}) {
    const [url, setUrl] = useState(currentUrl);
    const [saved, setSaved] = useState(!!currentUrl);

    const saveMutation = useMutation({
        mutationFn: async (companyUrl: string) => {
            const res = await apiRequest("PATCH", `/api/workflows/${workflowId}/company-url`, { companyUrl });
            return res.json();
        },
        onSuccess: () => {
            setSaved(true);
            queryClient.invalidateQueries({ queryKey: ["/api/workflows", workflowId] });
            queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
        },
    });

    useEffect(() => {
        setUrl(currentUrl);
        setSaved(!!currentUrl);
    }, [currentUrl, workflowId]);

    const handleSave = () => {
        if (url.trim()) {
            saveMutation.mutate(url.trim());
        }
    };

    return (
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b" data-testid="company-url-section">
            <LinkIcon className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground shrink-0">Company website:</span>
            <Input
                type="url"
                value={url}
                onChange={(e) => {
                    setUrl(e.target.value);
                    setSaved(false);
                }}
                placeholder="https://yourcompany.com"
                className="h-7 text-xs flex-1 max-w-xs"
                data-testid="input-company-url"
            />
            <Button
                size="sm"
                variant={saved ? "secondary" : "default"}
                onClick={handleSave}
                disabled={!url.trim() || saveMutation.isPending || saved}
                className="h-7 text-xs px-3"
                data-testid="button-save-url"
            >
                {saved ? (
                    <>
                        <Check className="w-3 h-3 mr-1" />
                        Saved
                    </>
                ) : saveMutation.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                    "Save"
                )}
            </Button>
        </div>
    );
}
