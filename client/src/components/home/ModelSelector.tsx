import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { MODEL_OPTIONS } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

type AvailableProviders = {
    anthropic: boolean;
};

export function ModelSelector({
    workflowId,
    currentModel,
    disabled,
}: {
    workflowId: number;
    currentModel: string;
    disabled: boolean;
}) {
    const { toast } = useToast();
    const { data: available } = useQuery<AvailableProviders>({
        queryKey: ["/api/available-providers"],
        staleTime: Infinity,
    });

    const updateModel = useMutation({
        mutationFn: async (selectedModel: string) => {
            if (available) {
                const option = MODEL_OPTIONS.find((m) => m.id === selectedModel);
                if (option && !available[option.provider as keyof AvailableProviders]) {
                    throw new Error(`No API key configured for ${option.provider}.`);
                }
            }
            const res = await apiRequest("PATCH", `/api/workflows/${workflowId}/model`, { selectedModel });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/workflows", workflowId] });
            queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
        },
        onError: (error: Error) => {
            toast({
                title: "Cannot switch model",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Auto-swap if the current model's provider has no API key
    useEffect(() => {
        if (!available) return;
        const currentOption = MODEL_OPTIONS.find((m) => m.id === currentModel);
        if (currentOption && !available[currentOption.provider as keyof AvailableProviders]) {
            const fallback = MODEL_OPTIONS.find((m) => available[m.provider as keyof AvailableProviders]);
            if (fallback) {
                updateModel.mutate(fallback.id);
            }
        }
    }, [available, currentModel]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <Select
            value={currentModel}
            onValueChange={(value) => updateModel.mutate(value)}
            disabled={disabled || updateModel.isPending}
        >
            <SelectTrigger
                className="w-[120px] sm:w-[180px] text-xs"
                data-testid="select-model"
            >
                <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
                {MODEL_OPTIONS.map((m) => {
                    const unavailable = available && !available[m.provider as keyof AvailableProviders];
                    return (
                        <SelectItem
                            key={m.id}
                            value={m.id}
                            disabled={!!unavailable}
                            data-testid={`model-option-${m.id}`}
                            className={unavailable ? "opacity-40 cursor-not-allowed" : ""}
                        >
                            <span className="text-xs">{m.label}</span>
                            <span className="text-[10px] text-muted-foreground ml-1.5 capitalize">
                                ({m.provider})
                            </span>
                            {unavailable && (
                                <span className="text-[10px] text-destructive ml-1">
                                    — no API key
                                </span>
                            )}
                        </SelectItem>
                    );
                })}
            </SelectContent>
        </Select>
    );
}
