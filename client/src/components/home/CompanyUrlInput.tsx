import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    const handleChange = (value: string) => {
        setUrl(value);
        setSaved(false);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            saveMutation.mutate(value.trim());
        }, 800);
    };

    const handleBlur = () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!saved) saveMutation.mutate(url.trim());
    };

    return (
        <div className="flex items-center px-3 py-1.5 border-b">
            <div className="flex items-center gap-2" data-testid="company-url-section">
                <LinkIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">Company website:</span>
                <div className="relative">
                    <Input
                        type="url"
                        value={url}
                        onChange={(e) => handleChange(e.target.value)}
                        onBlur={handleBlur}
                        placeholder="https://yourcompany.com"
                        className="h-7 text-xs w-52 pr-6"
                        data-testid="input-company-url"
                    />
                    {saveMutation.isPending ? (
                        <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-muted-foreground" />
                    ) : saved && url ? (
                        <Check className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-green-500" />
                    ) : null}
                </div>
            </div>
        </div>
    );
}
