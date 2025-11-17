import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";

export type PromptOption = {
  id: string;
  name: string;
  description?: string;
  content: string;
  source: "builtin" | "custom";
};

type SystemPromptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompts: PromptOption[];
  selectedPromptId: string;
  onSelectPrompt: (promptId: string) => void;
  allowSave: boolean;
  onCreatePrompt?: (name: string, content: string) => Promise<void>;
  allowDelete?: boolean;
  onDeletePrompt?: (promptId: string) => void;
};

export function SystemPromptDialog({
  open,
  onOpenChange,
  prompts,
  selectedPromptId,
  onSelectPrompt,
  allowSave,
  onCreatePrompt,
  allowDelete,
  onDeletePrompt,
}: SystemPromptDialogProps) {
  const [previewPromptId, setPreviewPromptId] = useState(selectedPromptId);
  useEffect(() => {
    if (!open) return;
    setPreviewPromptId(selectedPromptId);
  }, [selectedPromptId, open]);

  useEffect(() => {
    if (!prompts.some((prompt) => prompt.id === previewPromptId)) {
      setPreviewPromptId(selectedPromptId);
    }
  }, [prompts, previewPromptId, selectedPromptId]);

  const previewPrompt =
    useMemo(() => prompts.find((p) => p.id === previewPromptId) ?? prompts[0], [prompts, previewPromptId]) ??
    prompts[0];
  const [draftName, setDraftName] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [saving, setSaving] = useState(false);

  const builtinPrompts = prompts.filter((prompt) => prompt.source === "builtin");
  const customPrompts = prompts.filter((prompt) => prompt.source === "custom");

  const handleSave = async () => {
    if (!allowSave || !onCreatePrompt) return;
    const trimmedName = draftName.trim();
    const trimmedContent = draftContent.trim();
    if (!trimmedName || trimmedContent.length < 10) return;
    setSaving(true);
    try {
      await onCreatePrompt(trimmedName, trimmedContent);
      setDraftName("");
      setDraftContent("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl border-4 border-border bg-card text-foreground font-pixel">
        <DialogHeader>
          <DialogTitle className="text-lg">System prompt library</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-[220px_1fr] text-[10px]">
          <div className="space-y-4">
            <PromptColumnHeading title="Preset prompts" />
            <PromptList
              prompts={builtinPrompts}
              activeId={previewPrompt?.id}
              onSelect={setPreviewPromptId}
              allowDelete={false}
            />
            <PromptColumnHeading title="Your prompts" />
            {customPrompts.length ? (
              <PromptList
                prompts={customPrompts}
                activeId={previewPrompt?.id}
                onSelect={setPreviewPromptId}
                allowDelete={Boolean(allowDelete && onDeletePrompt)}
                onDeletePrompt={onDeletePrompt}
                emptyLabel="No custom prompts yet"
              />
            ) : (
              <p className="text-[10px] text-muted-foreground">
                Save a custom prompt below to reuse it anywhere.
              </p>
            )}
          </div>

          <div className="space-y-6">
            {previewPrompt && (
              <div className="border-4 border-border bg-background px-4 py-3 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[12px] uppercase tracking-widest text-muted-foreground">
                      Selected prompt
                    </p>
                    <h3 className="text-lg">{previewPrompt.name}</h3>
                  </div>
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                    {previewPrompt.source === "builtin" ? "Preset" : "Custom"}
                  </span>
                </div>
                {previewPrompt.description && (
                  <p className="text-[10px] text-muted-foreground">{previewPrompt.description}</p>
                )}
                <div className="border-2 border-border/70 bg-card/60 px-3 py-2 text-[11px] whitespace-pre-wrap">
                  {previewPrompt.content}
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onSelectPrompt(previewPrompt.id)}
                    disabled={previewPrompt.id === selectedPromptId}
                    className="border-4 border-border font-pixel text-[10px]"
                  >
                    {previewPrompt.id === selectedPromptId ? "In use" : "Set prompt"}
                  </Button>
                </div>
              </div>
            )}

            <div className="border-4 border-border bg-background px-4 py-3 space-y-3">
              <div>
                <p className="text-[12px] uppercase tracking-widest text-muted-foreground">
                  Create custom prompt
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {allowSave
                    ? "Craft your own instructions and reuse them on any device."
                    : "Sign in to save custom prompts to your account."}
                </p>
              </div>
              <Input
                placeholder="Prompt name"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                disabled={!allowSave || saving}
                className="border-4 border-border bg-card text-foreground text-[11px]"
              />
              <Textarea
                placeholder="Write the instructions the assistant should follow..."
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                disabled={!allowSave || saving}
                className="border-4 border-border bg-card text-foreground text-[11px] min-h-[140px]"
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  disabled={!allowSave || saving || !draftName.trim() || draftContent.trim().length < 10}
                  onClick={handleSave}
                  className="border-4 border-border font-pixel text-[10px]"
                >
                  {saving ? "Saving..." : "Save prompt"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PromptColumnHeading({ title }: { title: string }) {
  return <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{title}</p>;
}

function PromptList({
  prompts,
  activeId,
  onSelect,
  emptyLabel = "No prompts",
  allowDelete = false,
  onDeletePrompt,
}: {
  prompts: PromptOption[];
  activeId?: string;
  onSelect: (id: string) => void;
  emptyLabel?: string;
  allowDelete?: boolean;
  onDeletePrompt?: (id: string) => void;
}) {
  if (!prompts.length) {
    return <p className="text-[10px] text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-2">
      {prompts.map((prompt) => (
        <button
          type="button"
          key={prompt.id}
          onClick={() => onSelect(prompt.id)}
          className={cn(
            "w-full text-left border-4 px-3 py-2 text-[10px] transition-colors",
            activeId === prompt.id
              ? "border-primary bg-primary/20 text-foreground"
              : "border-border bg-background hover:bg-muted/50"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-semibold">{prompt.name}</div>
              {prompt.description && (
                <p className="text-[9px] text-muted-foreground mt-1">{prompt.description}</p>
              )}
            </div>
            {allowDelete && prompt.source === "custom" && onDeletePrompt && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onDeletePrompt(prompt.id);
                }}
                className="text-destructive hover:text-destructive/80 border-2 border-transparent hover:border-destructive rounded px-1 py-0.5"
                title="Delete prompt"
              >
                <Trash2 className="w-3 h-3" strokeWidth={2.5} />
              </button>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
