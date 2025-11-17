// root/src/components/ChatInput.tsx
import { useEffect, useRef, useState } from "react";
import { resolveApiPath } from "@/lib/apiBase";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Mic, Square } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
}

const ChatInput = ({ onSend }: ChatInputProps) => {
  const [message, setMessage] = useState("");
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSend(message.trim());
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Default container is fine (webm/opus in most browsers; mp4/aac on Safari)
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (evt) => {
        if (evt.data && evt.data.size > 0) chunksRef.current.push(evt.data);
      };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        await sendForTranscription(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      mediaRecorderRef.current = rec;
      setRecording(true);
    } catch (e) {
      console.error("Mic error:", e);
    }
  };

  const stopRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    setRecording(false);
  };

  function getTranscribeUrl() {
    return resolveApiPath("/api/transcribe");
  }

  async function blobToBase64(blob: Blob): Promise<string> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    // "data:audio/webm;base64,AAA..." -> take the base64 part
    const comma = dataUrl.indexOf(",");
    return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  }

  const sendForTranscription = async (blob: Blob) => {
    try {
      const audioB64 = await blobToBase64(blob);
      const res = await fetch(getTranscribeUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio: audioB64,
          mime: blob.type || "audio/webm",
          // Optionally hint language for accuracy (e.g., "hu" for Hungarian)
          // language: "hu",
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error("Transcribe error:", txt);
        // If STT fails, fall back to leaving nothing in the box
        return;
      }

      const data = await res.json();
      const transcript = (data?.text || "").trim();

      // Auto-send the transcript into chat so the assistant replies right away.
      // This keeps mic usage "audio talk only" while preserving your text UI.
      if (transcript) {
        onSend(transcript);
      }
    } catch (e) {
      console.error("Transcribe request failed:", e);
    }
  };

  useEffect(() => {
    return () => {
      try {
        const rec = mediaRecorderRef.current;
        if (rec && rec.state !== "inactive") rec.stop();
      } catch (error) {
        console.warn("Failed to stop recorder on cleanup", error);
      }
    };
  }, []);

  return (
    <form onSubmit={handleSubmit} className="flex gap-4 items-end">
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your message..."
        className="min-h-[80px] max-h-[200px] resize-none bg-background border-4 border-border focus:border-primary font-pixel text-[10px] leading-relaxed pixel-shadow-white text-foreground placeholder:text-muted-foreground caret-foreground"
      />

      <Button
        type="button"
        size="icon"
        onClick={recording ? stopRecording : startRecording}
        className={`h-[80px] w-[80px] flex-shrink-0 border-4 transition-all ${
          recording
            ? "bg-destructive border-destructive text-destructive-foreground"
            : "bg-secondary border-border text-foreground hover:bg-primary hover:text-primary-foreground"
        }`}
        title={recording ? "Stop recording" : "Start recording"}
        aria-label={recording ? "Stop recording" : "Start recording"}
      >
        {recording ? <Square className="w-8 h-8" strokeWidth={3} /> : <Mic className="w-8 h-8" strokeWidth={3} />}
      </Button>

      <Button
        type="submit"
        size="icon"
        className="h-[80px] w-[80px] flex-shrink-0 bg-primary hover:bg-accent border-4 border-primary hover:border-accent text-primary-foreground transition-all pixel-shadow hover:translate-x-1 hover:-translate-y-1"
        disabled={!message.trim()}
      >
        <Send className="w-8 h-8" strokeWidth={3} />
      </Button>
    </form>
  );
};

export default ChatInput;
