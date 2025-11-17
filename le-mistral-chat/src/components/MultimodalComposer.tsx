// root/src/components/MultimodalComposer.tsx
// root/src/components/MultimodalComposer.tsx
// -----------------------------------------------------------------------------
// PURPOSE
//   Minimal, screenshot-style composer in your pixel aesthetic,
//   now WITH a "Create image" button again.
//   • Top: large, borderless input area with placeholder.
//   • Bottom row: left "+" (attachments) + "🖼" (generate image), right send + mic.
//   • Submit on Enter (Shift+Enter for newline) OR send button.
//   • Image mode: when active, send button generates image instead of sending text
//   • Real audio-reactive recording card with pixel visualizer
//   • Fully responsive for mobile devices
//
// INTEGRATION
//   - onSend: called when user presses Enter (no Shift) or clicks send button.
//   - onAttachFiles?: shows + and returns chosen files.
//   - onGenerateImage?: shows 🖼 and calls with current prompt.
//   - transcribeUrlOverride?: optional override for /api/transcribe.
//
// DEPENDENCIES: lucide-react, your shadcn Button/Textarea, Tailwind utilities.
// -----------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { resolveApiPath } from "@/lib/apiBase";
import {
  Plus,
  Mic,
  Square,
  Image as ImageIcon,
  Send,
  X,
  ArrowUp,
  Globe,
} from "lucide-react";

export type WebSearchMode = "web_search" | "web_search_premium";

export type ComposerSendOptions = {
  webSearchMode?: WebSearchMode;
};

type Props = {
  onSend: (message: string, files?: File[], options?: ComposerSendOptions) => void;
  onAttachFiles?: (files: File[]) => void;
  onGenerateImage?: (prompt: string) => void;
  transcribeUrlOverride?: string;
  isStreaming?: boolean;
  onAbortStreaming?: () => void;
  webSearchEnabled?: boolean;
  onToggleWebSearch?: () => void;
  webSearchMode?: WebSearchMode;
};

// RecordingCard Component (now with real audio reactivity and mobile responsive)
function RecordingCard({
  onCancel,
  onSend,
}: {
  onCancel?: () => void;
  onSend?: () => void;
}) {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(true);
  const rafRef = useRef<number>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // --- Timer ---
  useEffect(() => {
    if (!running) return;
    const i = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(i);
  }, [running]);

  // --- Real Audio Analysis ---
  useEffect(() => {
    const initAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false
          } 
        });
        streamRef.current = stream;
        
        const extendedWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
        const AudioContextCtor = window.AudioContext || extendedWindow.webkitAudioContext;
        if (!AudioContextCtor) {
          console.error("AudioContext is not supported in this browser");
          return;
        }
        const audioContext = new AudioContextCtor();
        audioContextRef.current = audioContext;
        
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.5;
        analyserRef.current = analyser;
        
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        
        const bufferLength = analyser.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);
        
        // Also set up media recorder for the parent
        const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        mediaRecorderRef.current = recorder;
        
        startVisualization();
      } catch (error) {
        console.error('Error accessing microphone:', error);
      }
    };

    initAudio();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startVisualization = () => {
    const c = canvasRef.current;
    if (!c || !analyserRef.current || !dataArrayRef.current) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    // Responsive canvas dimensions
    const isMobile = window.innerWidth < 768;
    const logicalW = isMobile ? 280 : 400;
    const logicalH = isMobile ? 60 : 80;
    
    c.width = logicalW * dpr;
    c.height = logicalH * dpr;
    c.style.width = logicalW + "px";
    c.style.height = logicalH + "px";
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);

    const cols = isMobile ? 17 : 21; // Fewer columns on mobile
    const rows = isMobile ? 9 : 11;
    const cell = Math.floor(Math.min(logicalW / cols, logicalH / rows));
    const gap = 1;
    const ox = (logicalW - cols * cell) / 2;
    const oy = (logicalH - rows * cell) / 2;

    const centerCol = Math.floor(cols / 2);
    const maxAmp = Math.floor(rows / 2);

    const draw = () => {
      if (!analyserRef.current || !dataArrayRef.current) return;

      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      
      // Calculate overall volume level with even more sensitivity
      let sum = 0;
      // Focus on broader voice frequencies for more response
      for (let i = 2; i < 30; i++) {
        sum += dataArrayRef.current[i];
      }
      const average = sum / 28;
      // Much more sensitive - idle will be near 0, loud will reach max
      const normalizedLevel = Math.min(1, average / 64);
      
      // Apply aggressive curve for dramatic response
      const responsiveLevel = Math.pow(normalizedLevel, 0.5);
      
      // Clear with transparent background
      ctx.clearRect(0, 0, logicalW, logicalH);

      for (let x = 0; x < cols; x++) {
        const distFromCenter = Math.abs(x - centerCol);
        const base = 1 - distFromCenter / (centerCol + 0.0001);
        
        // Idle is just 1 pixel, loud reaches maxAmp
        const amp = Math.max(0, Math.min(1, base * responsiveLevel));
        // Start from 0.1 so idle is nearly 0, scale up dramatically
        const heightInCells = Math.floor(0.1 + amp * maxAmp * 1.5);

        for (let y = -heightInCells; y <= heightInCells; y++) {
          // Skip if we're at the very center to maintain 1-pixel idle
          if (heightInCells <= 1 && y === 0) continue;
          
          const level = Math.abs(y) / (maxAmp || 1);
          
          // More aggressive color changes
          let hue = 120 - (level * 160);
          if (level > 0.4) hue = 45;
          if (level > 0.6) hue = 25;  
          if (level > 0.8) hue = 0;
          
          const col = `hsl(${hue}, 95%, 65%)`;

          const px = ox + x * cell + gap / 2;
          const py = oy + (rows / 2 + y) * cell + gap / 2;

          ctx.fillStyle = col;
          ctx.fillRect(px, py, cell - gap, cell - gap);
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
  };

  const handleCancel = () => {
    // Stop visualization
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    
    // Stop media recorder if it exists
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    
    // Stop audio stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Stop audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    
    setRunning(false);
    onCancel?.();
  };

  const handleSend = () => {
    // Stop visualization but keep audio context for processing
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    
    setRunning(false);
    onSend?.();
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="w-full px-2 sm:px-4">
      <div
        className="
          mx-auto w-full max-w-[600px]
          rounded-lg bg-card p-3 sm:p-4
          border-4 border-border
          flex items-center gap-2 sm:gap-3
        "
      >
        {/* Close / cancel */}
        <button
          onClick={handleCancel}
          className="grid h-8 w-8 sm:h-10 sm:w-10 place-items-center border-4 border-border bg-background text-foreground hover:bg-destructive hover:border-destructive hover:text-destructive-foreground transition"
          aria-label="Cancel"
        >
          <X className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={3} />
        </button>

        {/* Visualizer */}
        <div className="relative flex-1 grid place-items-center min-w-0">
          <canvas
            ref={canvasRef}
            className="block [image-rendering:pixelated] select-none max-w-full"
            aria-hidden="true"
          />
        </div>

        {/* Timer */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="tabular-nums text-foreground font-pixel text-[10px] sm:text-[12px] whitespace-nowrap">
            {mm}:{ss}
          </span>
        </div>

        {/* Send - Wider Button */}
        <button
          onClick={handleSend}
          className="grid h-10 w-12 sm:h-12 sm:w-16 place-items-center border-4 border-border bg-foreground text-background hover:opacity-90 transition flex-shrink-0"
          aria-label="Send"
        >
          <ArrowUp className="h-4 w-4 sm:h-6 sm:w-6" strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}

export default function MultimodalComposer({
  onSend,
  onAttachFiles,
  onGenerateImage,
  transcribeUrlOverride,
  isStreaming,
  onAbortStreaming,
  webSearchEnabled = false,
  onToggleWebSearch,
  webSearchMode,
}: Props) {
  const [message, setMessage] = useState("");
  const [recording, setRecording] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const recordingCanceledRef = useRef(false);
  const resolvedWebSearchMode: WebSearchMode = webSearchMode ?? "web_search_premium";
  const isWebSearchEnabled = Boolean(webSearchEnabled);
  const canToggleWebSearch = typeof onToggleWebSearch === "function";
  const webSearchModeLabel =
    resolvedWebSearchMode === "web_search_premium"
      ? "Premium web search (news + web)"
      : "Standard web search";
  const webSearchButtonTitle = isWebSearchEnabled
    ? "Disable websearch for this chat"
    : `Enable websearch (${webSearchModeLabel})`;
  const webSearchStatusText =
    resolvedWebSearchMode === "web_search_premium"
      ? "WEBSEARCH: Premium (search + verified news)"
      : "WEBSEARCH: Standard search engine";
  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isStreaming) {
      return;
    }
    const text = message.trim();
    if (!text && attachedFiles.length === 0) {
      inputRef.current?.focus();
      return;
    }

    if (imageMode && onGenerateImage) {
      onGenerateImage(text);
      setImageMode(false);
    } else {
      const sendOptions = isWebSearchEnabled ? { webSearchMode: resolvedWebSearchMode } : undefined;
      onSend(text, attachedFiles.length > 0 ? attachedFiles : undefined, sendOptions);
    }
    
    setMessage("");
    setAttachedFiles([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isStreaming && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleImageMode = () => {
    setImageMode(!imageMode);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const toggleWebSearch = () => {
    if (!canToggleWebSearch || isStreaming) return;
    onToggleWebSearch?.();
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  function getTranscribeUrl() {
    return transcribeUrlOverride || resolveApiPath("/api/transcribe");
  }

  const startRecording = async () => {
    if (isStreaming) return;
    try {
      recordingCanceledRef.current = false;
      audioChunksRef.current = [];
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false
        } 
      });
      
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = rec;

      rec.ondataavailable = (evt) => {
        if (evt.data && evt.data.size > 0) {
          audioChunksRef.current.push(evt.data);
        }
      };
      
      rec.onstop = async () => {
        // Only process if not canceled
        if (!recordingCanceledRef.current && audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          await sendForTranscription(blob);
        }
        
        // Always stop the stream
        stream.getTracks().forEach((t) => t.stop());
      };

      rec.start();
      setRecording(true);
    } catch (e) {
      console.error("Mic error:", e);
    }
  };

  const stopRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
    }
    setRecording(false);
  };

  const cancelRecording = () => {
    recordingCanceledRef.current = true;
    audioChunksRef.current = [];
    
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
    }
    
    setRecording(false);
  };

  const handleRecordingSend = () => {
    stopRecording();
  };

  const sendForTranscription = async (blob: Blob) => {
    // Double-check we're not canceled
    if (recordingCanceledRef.current) {
      return;
    }

    try {
      const ab = await blob.arrayBuffer();
      const b64 = arrayBufferToBase64(ab);
      const res = await fetch(getTranscribeUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: b64, mime_type: blob.type || "audio/webm" }),
      });
      if (!res.ok) {
        const txt = await res.text();
        console.error("Transcribe error:", txt);
        return;
      }
      const data = await res.json();
      const transcript = data?.text || "";
      if (transcript) {
        setMessage((prev) => (prev ? prev + " " + transcript : transcript));
      }
    } catch (e) {
      console.error("Transcribe request failed:", e);
    }
  };

  function arrayBufferToBase64(buffer: ArrayBuffer) {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
  }

  useEffect(() => {
    return () => {
      try {
        const rec = mediaRecorderRef.current;
        if (rec && rec.state !== "inactive") rec.stop();
      } catch (error) {
        console.warn("Failed to stop composer recorder on cleanup", error);
      }
    };
  }, []);

  const triggerFilePicker = () => {
    if (isStreaming) return;
    fileInputRef.current?.click();
  };

  const handleFilesChosen: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) {
      setAttachedFiles(files);
      if (onAttachFiles) {
        onAttachFiles(files);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Show RecordingCard when recording, otherwise show normal composer
  if (recording) {
    return (
      <div className="w-full border-4 border-border bg-card p-2 sm:p-4">
        <RecordingCard
          onCancel={cancelRecording}
          onSend={handleRecordingSend}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full md:max-w-3xl md:mx-auto">
      <div className="w-full border-4 border-border bg-card px-2 sm:px-3 md:px-4 pt-3 md:pt-4 pb-3 md:pb-4 space-y-3">
        
        {/* File Preview Attachments */}
        {attachedFiles.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-secondary border-4 border-border px-3 py-2"
              >
                <span className="font-pixel text-[10px] text-foreground max-w-[120px] truncate">
                  {file.name}
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="h-6 w-6 grid place-items-center bg-destructive border-2 border-destructive text-destructive-foreground hover:opacity-90 transition"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="w-3 h-3" strokeWidth={3} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* TOP: big, borderless input area */}
        <Textarea
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            imageMode
              ? "Describe the image you want to create..."
              : isWebSearchEnabled
                ? "Ask anything - websearch is ON"
                : "Ask Le Chat anything"
          }
          className={[
            "w-full bg-background text-foreground border-0 focus:outline-none focus:ring-0",
            "min-h-[60px] sm:min-h-[72px] md:min-h-[96px] max-h-[180px] sm:max-h-[220px] resize-y",
            "font-pixel text-[10px] sm:text-[11px] md:text-[10px] leading-relaxed caret-white",
          ].join(" ")}
        />

        {/* BOTTOM ACTION ROW */}
        <div className="mt-3 md:mt-4 flex items-center justify-between">
          {/* Left: + (attachments) + image mode toggle */}
          <div className="flex items-center gap-1 sm:gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.txt,.doc,.docx"
              className="hidden"
              onChange={handleFilesChosen}
            />
            <button
              type="button"
              onClick={triggerFilePicker}
              disabled={isStreaming}
              title="Attach files"
              aria-label="Attach files"
              className={[
                "h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 grid place-items-center border-4 border-border transition",
                isStreaming
                  ? "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                  : "bg-secondary text-foreground hover:bg-primary hover:text-primary-foreground",
              ].join(" ")}
            >
              <Plus className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" strokeWidth={3} />
            </button>

            {onGenerateImage && (
              <button
                type="button"
                onClick={toggleImageMode}
                disabled={isStreaming}
                title={imageMode ? "Switch to text mode" : "Create image from prompt"}
                aria-label={imageMode ? "Switch to text mode" : "Create image from prompt"}
                className={[
                  "h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 grid place-items-center border-4 transition",
                  imageMode
                    ? "bg-primary border-primary text-primary-foreground"
                    : isStreaming
                      ? "bg-muted border-border text-muted-foreground cursor-not-allowed opacity-60"
                      : "bg-secondary border-border text-foreground hover:bg-primary hover:text-primary-foreground"
                ].join(" ")}
              >
                <ImageIcon className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" strokeWidth={3} />
              </button>
            )}

            {canToggleWebSearch && (
              <button
                type="button"
                onClick={toggleWebSearch}
                disabled={isStreaming}
                title={webSearchButtonTitle}
                aria-label={webSearchButtonTitle}
                aria-pressed={isWebSearchEnabled}
                className={[
                  "h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 grid place-items-center border-4 transition",
                  isWebSearchEnabled
                    ? "bg-emerald-500 border-emerald-500 text-emerald-950 dark:text-emerald-50"
                    : isStreaming
                      ? "bg-muted border-border text-muted-foreground cursor-not-allowed opacity-60"
                      : "bg-secondary border-border text-foreground hover:bg-primary hover:text-primary-foreground"
                ].join(" ")}
              >
                <Globe className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" strokeWidth={3} />
              </button>
            )}

          </div>

          {/* Right: send + mic */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Send Button */}
            <button
              type={isStreaming ? "button" : "submit"}
              onClick={isStreaming ? onAbortStreaming : undefined}
              disabled={isStreaming ? !onAbortStreaming : !message.trim() && attachedFiles.length === 0}
              title={
                isStreaming
                  ? "Stop response"
                  : imageMode
                    ? "Generate image"
                    : "Send message"
              }
              aria-label={
                isStreaming
                  ? "Stop response"
                  : imageMode
                    ? "Generate image"
                    : "Send message"
              }
              className={[
                "h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 grid place-items-center border-4 transition",
                isStreaming
                  ? "bg-destructive border-destructive text-destructive-foreground hover:bg-destructive/80"
                  : message.trim() || attachedFiles.length > 0
                    ? "bg-primary border-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted border-border text-muted-foreground cursor-not-allowed"
              ].join(" ")}
            >
              {isStreaming ? (
                <Square className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" strokeWidth={3} />
              ) : (
                <Send className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" strokeWidth={3} />
              )}
            </button>

            {/* Mic Button */}
            <button
              type="button"
              onClick={startRecording}
              disabled={isStreaming}
              title="Start recording"
              aria-label="Start recording"
              className={[
                "h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 grid place-items-center border-4 border-border transition",
                isStreaming
                  ? "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                  : "bg-foreground text-background hover:bg-foreground/90",
              ].join(" ")}
            >
              <Mic className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" strokeWidth={3} />
            </button>
          </div>
        </div>

        {/* Mode Indicators */}
        {(imageMode || isWebSearchEnabled) && (
          <div className="mt-2 text-center flex flex-col items-center gap-1">
            {imageMode && (
              <span className="font-pixel text-[8px] sm:text-[10px] text-primary bg-primary/10 px-2 py-1 border-2 border-primary">
                IMAGE MODE: Enter prompt and click send to generate
              </span>
            )}
            {isWebSearchEnabled && (
              <span className="font-pixel text-[8px] sm:text-[10px] text-emerald-500 bg-emerald-500/10 px-2 py-1 border-2 border-emerald-500 uppercase">
                {webSearchStatusText}
              </span>
            )}
          </div>
        )}
      </div>
    </form>
  );
}
