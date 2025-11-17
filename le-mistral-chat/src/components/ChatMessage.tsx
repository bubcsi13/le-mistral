// root/src/components/ChatMessage.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { User, Sparkles, Copy, Check } from "lucide-react";
import MarkdownMessage from "@/components/MarkdownMessage";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  modelUsed?: string; // Add this field
}

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

const ChatMessage = ({ message, isStreaming = false }: ChatMessageProps) => {
  const isUser = message.role === "user";
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      toast({ title: "Copied", description: "Message content copied to clipboard." });
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast({ title: "Copy failed", description: "Please try again.", variant: "destructive" });
    }
  };

  // Determine model display name
  const getModelDisplayName = (modelUsed?: string) => {
    if (!modelUsed) return "ASSISTANT";

    const modelMap: Record<string, string> = {
      "pixtral-large-latest": "PIXTRAL (VISION)",
      "mistral-small-latest": "MISTRAL SMALL",
      "mistral-medium-latest": "MISTRAL MEDIUM",
      "mistral-large-latest": "MISTRAL LARGE",
      "codestral-latest": "CODestral",
      "image-generation": "IMAGE GENERATION",
    };

    return modelMap[modelUsed] || modelUsed.replace(/-latest$/, "").toUpperCase();
  };

  return (
    <div
      className={[
        "flex mb-6 md:mb-8 animate-fade-in overflow-x-hidden",
        isUser ? "justify-end" : "justify-start",
        "gap-3 md:gap-6",
      ].join(" ")}
    >
      {/* Left icon (assistant) */}
      {!isUser && (
        <div className="w-10 h-10 md:w-14 md:h-14 bg-primary flex items-center justify-center flex-shrink-0 pixel-shadow">
          <Sparkles className="w-5 h-5 md:w-7 md:h-7 text-primary-foreground" strokeWidth={3} />
        </div>
      )}

      {/* Bubble + label + copy */}
      <div
        className={[
          "flex flex-col gap-2 max-w-[85%] md:max-w-2xl",
          isUser ? "items-end" : "items-start",
        ].join(" ")}
      >
        <div className="font-pixel text-[9px] md:text-[8px] text-muted-foreground">
          {isUser ? "YOU" : getModelDisplayName(message.modelUsed)}
        </div>

        <div
          className={[
            "border-4 px-4 py-3 md:px-6 md:py-4 message-hover break-words overflow-x-hidden max-w-full",
            isUser
              ? "bg-primary border-primary text-primary-foreground/90 pixel-shadow"
              : "bg-card border-border text-card-foreground pixel-shadow-white",
          ].join(" ")}
          style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
        >
          {/* Render the assistant/user content if present */}
          {message.content && <MarkdownMessage content={message.content} />}

          {/* Typing indicator: assistant + currently streaming */}
          {!isUser && isStreaming && (
            <div
              className="
                mt-2 inline-flex items-center gap-2
                font-pixel text-[9px] md:text-[8px] text-muted-foreground
              "
              aria-label="Assistant is typing"
            >
              {/* Waving dots - animation is defined in index.css */}
              <div className="typing-dots">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            </div>
          )}
        </div>

        <div className={isUser ? "self-end mt-1" : "self-start mt-1"}>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleCopy}
            aria-label="Copy message"
            className={[
              "h-8 px-3 border-4 border-border text-foreground bg-background transition-all",
              isUser ? "pixel-shadow" : "pixel-shadow-white",
              "font-pixel text-[9px]",
              "hover:bg-primary hover:text-primary-foreground",
            ].join(" ")}
          >
            {copied ? (
              <span className="inline-flex items-center gap-2">
                <Check className="h-4 w-4" strokeWidth={3} />
                Copied
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Copy className="h-4 w-4" strokeWidth={3} />
                Copy
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Right icon (user) */}
      {isUser && (
        <div className="w-10 h-10 md:w-14 md:h-14 bg-muted border-4 border-border flex items-center justify-center flex-shrink-0 pixel-shadow-white">
          <User className="w-5 h-5 md:w-7 md:h-7 text-foreground" strokeWidth={3} />
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
