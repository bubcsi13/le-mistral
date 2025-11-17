// root/src/pages/Index.tsx
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import ChatMessage from "@/components/ChatMessage";
import MultimodalComposer, {
  type ComposerSendOptions,
  type WebSearchMode,
} from "@/components/MultimodalComposer";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { ProfilePictureDialog } from "@/components/ProfilePictureDialog";
import { supabase } from "@/lib/supabase";

import { useAutoFollow } from "@/hooks/useAutoFollow";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  streamMistralReply,
  initialAssistantGreeting,
  generateImagesViaAgent,
  prepareAttachments,
  generateSessionTitle,
} from "@/lib/chatApi";
import {
  createSession,
  deleteSession,
  fetchMessages as fetchStoredMessages,
  fetchSessions,
  persistMessage,
  renameSession,
  deleteAllSessions,
} from "@/lib/chatStorage";
import type { Message } from "@/types/chat";
import type { ChatSession } from "@/lib/chatStorage";
import { cn } from "@/lib/utils";
import {
  recordMistralMetric,
  estimateTokensFromChars,
} from "@/lib/metricsStore";
import { SystemPromptDialog, type PromptOption } from "@/components/SystemPromptDialog";
import { BUILT_IN_SYSTEM_PROMPTS } from "@/lib/systemPromptPresets";
import { fetchSystemPrompts, createSystemPrompt, deleteSystemPrompt } from "@/lib/systemPrompts";
import { generateId } from "@/lib/id";
import { CatModal } from "@/components/CatModal";
import { useNavigate } from "react-router-dom";

const MISTRAL_MODEL_STORAGE_KEY = "mistral:model";
const GUEST_SESSION_ID = "guest-local-session";
const MAX_SESSION_TITLE_LENGTH = 48;
const MAX_SESSION_TITLE_WORDS = 3;
const MAX_TITLE_PROMPT_LENGTH = 600;
const DEFAULT_COMPOSER_HEIGHT = 220;
const DEFAULT_WEB_SEARCH_MODE: WebSearchMode = "web_search_premium";
const SYSTEM_PROMPT_STORAGE_KEY = "mistral:systemPrompt:selected";
const DEFAULT_MODEL = "mistral-small-latest";
const ALL_MODELS: string[] = [
  "mistral-small-latest",
  "mistral-medium-latest",
  "mistral-large-latest",
  "codestral-latest",
  "pixtral-large-latest",
  "magistral-medium-latest",
  "magistral-small-latest",
  "devstral-medium-latest",
  "devstral-small-latest",
];
const WEB_SEARCH_COMPATIBLE_MODELS: string[] = [
  "mistral-small-latest",
  "mistral-medium-latest",
  "mistral-large-latest",
];
const WEB_SEARCH_COMPATIBLE_MODEL_SET = new Set(WEB_SEARCH_COMPATIBLE_MODELS);
const ALL_MODEL_SET = new Set(ALL_MODELS);
const BUILT_IN_PROMPT_OPTIONS: PromptOption[] = BUILT_IN_SYSTEM_PROMPTS.map((prompt) => ({
  ...prompt,
  source: "builtin" as const,
}));
const DEFAULT_SYSTEM_PROMPT_ID = BUILT_IN_PROMPT_OPTIONS[0]?.id ?? "balanced-helper";
const FALLBACK_SYSTEM_PROMPT_TEXT =
  BUILT_IN_PROMPT_OPTIONS[0]?.content ||
  "You are Le Chat, a helpful assistant. Provide clear, accurate, and friendly answers.";

function normalizeSnippet(text: string, limit = MAX_SESSION_TITLE_LENGTH) {
  return text.replace(/\s+/g, " ").trim().slice(0, limit);
}

function limitWords(text: string, wordLimit = MAX_SESSION_TITLE_WORDS) {
  const words = text.split(/\s+/).filter(Boolean);
  return words.slice(0, wordLimit).join(" ");
}

function toTitleCase(text: string) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function sanitizeModelTitle(title?: string | null) {
  if (!title) return "";
  const normalized = normalizeSnippet(title);
  const limited = limitWords(normalized);
  const trimmed = limited.replace(/^[-\u2022]+/, "").trim();
  if (!trimmed) return "";
  return toTitleCase(trimmed);
}

function prepareTitlePrompt(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_TITLE_PROMPT_LENGTH);
}

function fallbackTitleFromPrompt(prompt: string) {
  return sanitizeModelTitle(prompt);
}

export default function Index() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([initialAssistantGreeting()]);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= 768;
  });
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_MODEL;
    const stored = localStorage.getItem(MISTRAL_MODEL_STORAGE_KEY);
    if (stored && ALL_MODEL_SET.has(stored)) {
      return stored;
    }
    return DEFAULT_MODEL;
  });
  const { user } = useAuth();
  const userId = user?.id;
  const { toast } = useToast();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [composerNode, setComposerNode] = useState<HTMLDivElement | null>(null);
  const [composerHeight, setComposerHeight] = useState(DEFAULT_COMPOSER_HEIGHT);
  const [profilePictureDialogOpen, setProfilePictureDialogOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [systemPromptDialogOpen, setSystemPromptDialogOpen] = useState(false);
  const [customSystemPrompts, setCustomSystemPrompts] = useState<PromptOption[]>([]);
  const [catOpen, setCatOpen] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_SYSTEM_PROMPT_ID;
    return localStorage.getItem(SYSTEM_PROMPT_STORAGE_KEY) || DEFAULT_SYSTEM_PROMPT_ID;
  });
  const modelBeforeWebSearchRef = useRef<string | null>(null);
  const activeMetricRef = useRef<{
    assistantId: string;
    start: number;
    model: string;
    promptChars: number;
    responseChars: number;
    promptPreview: string;
  } | null>(null);
  const allSystemPrompts: PromptOption[] = useMemo(
    () => [...BUILT_IN_PROMPT_OPTIONS, ...customSystemPrompts],
    [customSystemPrompts]
  );
  const activeSystemPrompt =
    allSystemPrompts.find((prompt) => prompt.id === selectedPromptId) ?? BUILT_IN_PROMPT_OPTIONS[0];
  const systemPromptText = activeSystemPrompt?.content ?? FALLBACK_SYSTEM_PROMPT_TEXT;
  const lastNotifiedPromptIdRef = useRef<string | null>(selectedPromptId);
  const modelsForSelect = webSearchEnabled ? WEB_SEARCH_COMPATIBLE_MODELS : ALL_MODELS;
  const renamedSessionsRef = useRef(new Set<string>());

  // Ensure sidebar closed by default on small screens
  const composerRef = useCallback((node: HTMLDivElement | null) => {
    setComposerNode(node);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setAvatarUrl(null);
      setAvatarPath(null);
      return;
    }
    const metadata = user.user_metadata ?? {};
    setAvatarUrl(typeof metadata.avatar_url === "string" ? metadata.avatar_url : null);
    setAvatarPath(typeof metadata.avatar_path === "string" ? metadata.avatar_path : null);
    if (typeof window !== "undefined") {
      (window as typeof window & { supabaseClient?: typeof supabase }).supabaseClient = supabase;
    }
  }, [user]);

  // Persist model selection
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(MISTRAL_MODEL_STORAGE_KEY, selectedModel);
    }
  }, [selectedModel]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(SYSTEM_PROMPT_STORAGE_KEY, selectedPromptId);
    }
  }, [selectedPromptId]);

  useEffect(() => {
    if (webSearchEnabled && !WEB_SEARCH_COMPATIBLE_MODEL_SET.has(selectedModel)) {
      setSelectedModel(DEFAULT_WEB_SEARCH_MODE);
    }
  }, [webSearchEnabled, selectedModel]);

  useEffect(() => {
    if (!allSystemPrompts.some((prompt) => prompt.id === selectedPromptId)) {
      setSelectedPromptId(DEFAULT_SYSTEM_PROMPT_ID);
    }
  }, [allSystemPrompts, selectedPromptId]);

  useEffect(() => {
    if (!activeSystemPrompt) return;
    if (lastNotifiedPromptIdRef.current === null) {
      lastNotifiedPromptIdRef.current = activeSystemPrompt.id;
      return;
    }
    if (lastNotifiedPromptIdRef.current !== activeSystemPrompt.id) {
      toast({
        title: "System prompt updated",
        description: `Now using "${activeSystemPrompt.name}".`,
      });
      lastNotifiedPromptIdRef.current = activeSystemPrompt.id;
    }
  }, [activeSystemPrompt, toast]);

  useEffect(() => {
    if (!userId) {
      setCustomSystemPrompts([]);
      return;
    }
    let ignore = false;
    const loadPrompts = async () => {
      try {
        const stored = await fetchSystemPrompts(userId);
        if (!ignore) {
          const mapped = stored.map<PromptOption>((prompt) => ({
            id: prompt.id,
            name: prompt.name,
            content: prompt.content,
            source: "custom",
          }));
          setCustomSystemPrompts(mapped);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message.includes("system_prompts table missing")) {
          console.warn("[system prompts] table missing; skipping load");
        } else {
          toast({
            title: "System prompts unavailable",
            description: message || "Unable to load system prompts.",
            variant: "destructive",
          });
        }
      }
    };
    loadPrompts();
    return () => {
      ignore = true;
    };
  }, [userId, toast]);

  // Load sessions when user changes
  useEffect(() => {
    if (!userId) {
      setSessions([]);
      setCurrentSessionId(null);
      setMessages([initialAssistantGreeting()]);
      setSessionsLoading(false);
      setHistoryLoading(false);
      return;
    }

    let ignore = false;
    const loadSessions = async () => {
      setSessionsLoading(true);
      try {
        const fetched = await fetchSessions(userId);
        if (ignore) return;
        let sessionsToUse = fetched;
        if (!fetched.length) {
          const created = await createSession(userId);
          if (ignore) return;
          sessionsToUse = [created];
        }

        setSessions(sessionsToUse);
        const initialSessionId = sessionsToUse[0]?.id ?? null;
        setCurrentSessionId(initialSessionId);
        setMessages([initialAssistantGreeting()]);
      } catch (error) {
        if (!ignore) {
          const description = error instanceof Error ? error.message : "Supabase request failed.";
          toast({
            title: "Failed to load chats",
            description,
            variant: "destructive",
          });
        }
      } finally {
        if (!ignore) setSessionsLoading(false);
      }
    };

    loadSessions();
    return () => {
      ignore = true;
    };
  }, [userId, toast]);

  useEffect(() => {
    const renamed = new Set<string>();
    sessions.forEach((session) => {
      if (session.title && session.title !== "New chat") {
        renamed.add(session.id);
      }
    });
    renamedSessionsRef.current = renamed;
  }, [sessions]);

  // Load messages when current session changes
  useEffect(() => {
    if (!userId || !currentSessionId) return;
    let cancelled = false;
    setHistoryLoading(true);
    fetchStoredMessages(currentSessionId)
      .then((stored) => {
        if (cancelled) return;
        if (stored.length) {
          setMessages(stored);
        } else {
          setMessages([initialAssistantGreeting()]);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        const description = error instanceof Error ? error.message : "Supabase request failed.";
        toast({
          title: "Failed to load chat",
          description,
          variant: "destructive",
        });
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, currentSessionId, toast]);

  const [streamingAssistantId, setStreamingAssistantId] = useState<string | null>(null);
  const [streamAbortController, setStreamAbortController] = useState<AbortController | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!composerNode || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const measured = Math.ceil(entry.contentRect.height);
      if (measured && Math.abs(measured - composerHeight) > 2) {
        setComposerHeight(measured);
      }
    });
    observer.observe(composerNode);
    return () => observer.disconnect();
  }, [composerNode, composerHeight]);

  const { containerRef, endRef, autoScroll, showJump, jumpToLatest } = useAutoFollow(
    streamingAssistantId,
    [messages]
  );

  // -------------------- MOBILE SCROLL LOCK FOR OVERLAY -----------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;

    if (isMobile && sidebarOpen) {
      const prevHtmlOverflow = document.documentElement.style.overflow;
      const prevBodyOverflow = document.body.style.overflow;
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      return () => {
        document.documentElement.style.overflow = prevHtmlOverflow;
        document.body.style.overflow = prevBodyOverflow;
      };
    }
  }, [sidebarOpen]);

  const bumpSession = (sessionId: string) => {
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === sessionId);
      if (idx === -1) return prev;
      const target = prev[idx];
      const rest = prev.filter((_, i) => i !== idx);
      const stamped = { ...target, updated_at: new Date().toISOString() };
      return [stamped, ...rest];
    });
  };

  const persistCurrentMessage = (message: Message) => {
    if (!user || !currentSessionId) return;
    persistMessage(currentSessionId, message)
      .then(() => bumpSession(currentSessionId))
      .catch((error) => console.error("Failed to persist message", error));
  };

  const applySessionTitle = async (sessionId: string, nextTitle: string) => {
    if (!nextTitle) return;

    let didChange = false;

    setSessions((prev) => {
      let found = false;
      const next = prev.map((s) => {
        if (s.id !== sessionId) return s;
        found = true;
        if (s.title === nextTitle) return s;
        didChange = true;
        return { ...s, title: nextTitle };
      });
      if (!found) {
        return [
          {
            id: sessionId,
            title: nextTitle,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as ChatSession,
          ...next,
        ];
      }
      return next;
    });

    if (!didChange) {
      const exists = sessions.some((s) => s.id === sessionId);
      if (exists && sessions.find((s) => s.id === sessionId)?.title === nextTitle) {
        return;
      }
    }

    console.log("[titles] applying title", { sessionId, nextTitle });

    try {
      await renameSession(sessionId, nextTitle, userId);
      renamedSessionsRef.current.add(sessionId);
      console.log("[titles] persisted to Supabase");
    } catch (error) {
      console.error("[titles] Failed to persist session title", error);
    }
  };

  const requestAndPersistSessionTitle = async (sessionId: string, prompt: string) => {
    const fallback = fallbackTitleFromPrompt(prompt);
    if (fallback) {
      await applySessionTitle(sessionId, fallback);
    }
    try {
      const aiTitleRaw = await generateSessionTitle(prompt);
      const cleaned = sanitizeModelTitle(aiTitleRaw);
      if (cleaned && cleaned !== fallback) {
        await applySessionTitle(sessionId, cleaned);
      }
    } catch (error) {
      console.error("Failed to generate session title", error);
    }
  };

  const maybeRenameCurrentSession = (message: Message, sessionOverride?: string) => {
    if (!user) return;
    const sessionId = sessionOverride ?? currentSessionId;
    if (!sessionId || message.role !== "user") return;
    if (renamedSessionsRef.current.has(sessionId)) return;

    const prompt = prepareTitlePrompt(message.content);
    if (!prompt) return;

    const current = sessions.find((s) => s.id === sessionId);
    if (current && current.title && current.title !== "New chat") return;

    renamedSessionsRef.current.add(sessionId);
    requestAndPersistSessionTitle(sessionId, prompt).catch(() => {
      renamedSessionsRef.current.delete(sessionId);
    });
  };

  const persistAssistantById = (
    assistantId: string,
    mutate?: (message: Message) => Message
  ) => {
    setMessages((prev) => {
      let found = false;
      let updatedMessage: Message | null = null;
      const next = mutate
        ? prev.map((m) => {
            if (m.id !== assistantId) return m;
            found = true;
            const candidate = mutate(m);
            updatedMessage = candidate;
            return candidate;
          })
        : prev;
      if (!found) {
        const original = prev.find((m) => m.id === assistantId);
        if (original) {
          found = true;
          updatedMessage = original;
        }
      }
      if (updatedMessage) {
        persistCurrentMessage(updatedMessage);
      }
      if (mutate && found) {
        return next;
      }
      return prev;
    });
  };

  const finalizeAssistantStreaming = (assistantId: string, note?: string) => {
    if (note) {
      persistAssistantById(assistantId, (message) => {
        const addition = message.content ? `\n\n${note}` : note;
        return { ...message, content: `${message.content}${addition}` };
      });
    } else {
      persistAssistantById(assistantId);
    }
    setStreamingAssistantId(null);
    setStreamAbortController(null);
  };

  const handleAbortStreaming = () => {
    if (streamAbortController) {
      try {
        streamAbortController.abort();
      } catch (error) {
        console.warn("Failed to abort response stream", error);
      }
      setStreamAbortController(null);
    }
    if (streamingAssistantId) {
      setStreamingAssistantId(null);
    }
  };

  const finalizeRequestMetric = (assistantId: string, success: boolean) => {
    const ctx = activeMetricRef.current;
    if (!ctx || ctx.assistantId !== assistantId) return;
    const durationMs = performance.now() - ctx.start;
    recordMistralMetric({
      model: ctx.model,
      promptPreview: ctx.promptPreview || "[empty prompt]",
      timestamp: Date.now(),
      durationMs,
      tokensEstimated: estimateTokensFromChars(ctx.promptChars + ctx.responseChars),
      success,
    });
    activeMetricRef.current = null;
  };

  const enableWebSearch = () => {
    if (webSearchEnabled) return;
    modelBeforeWebSearchRef.current = selectedModel;
    setWebSearchEnabled(true);
  };

  const disableWebSearch = () => {
    if (!webSearchEnabled) return;
    setWebSearchEnabled(false);
    const previous = modelBeforeWebSearchRef.current;
    if (previous && ALL_MODEL_SET.has(previous)) {
      setSelectedModel(previous);
    }
    modelBeforeWebSearchRef.current = null;
  };

  const handleToggleWebSearch = () => {
    if (webSearchEnabled) {
      disableWebSearch();
    } else {
      enableWebSearch();
    }
  };

  const handleCreateSystemPrompt = async (name: string, content: string) => {
    const trimmedName = name.trim();
    const trimmedContent = content.trim();
    if (!userId) {
      toast({
        title: "Sign in required",
        description: "Create an account to save system prompts.",
      });
      throw new Error("Sign in required");
    }
    if (!trimmedName || trimmedContent.length < 10) {
      toast({
        title: "Prompt is too short",
        description: "Add at least 10 characters before saving.",
      });
      throw new Error("Prompt too short");
    }
    try {
      const saved = await createSystemPrompt(userId, trimmedName, trimmedContent);
      const mapped: PromptOption = {
        id: saved.id,
        name: saved.name,
        content: saved.content,
        source: "custom",
      };
      setCustomSystemPrompts((prev) => [mapped, ...prev]);
      setSelectedPromptId(mapped.id);
      toast({
        title: "Prompt saved",
        description: "Available across browsers now.",
      });
    } catch (error) {
      const description =
        error instanceof Error ? error.message : "Supabase request failed.";
      toast({
        title: "Unable to save prompt",
        description,
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleDeleteSystemPrompt = async (promptId: string) => {
    if (!userId) return;
    const confirmDelete = window.confirm("Delete this system prompt?");
    if (!confirmDelete) return;
    try {
      await deleteSystemPrompt(promptId);
      setCustomSystemPrompts((prev) => prev.filter((prompt) => prompt.id !== promptId));
      if (selectedPromptId === promptId) {
        setSelectedPromptId(DEFAULT_SYSTEM_PROMPT_ID);
      }
      toast({
        title: "Prompt deleted",
        description: "It will no longer appear in your list.",
      });
    } catch (error) {
      const description =
        error instanceof Error ? error.message : "Supabase request failed.";
      toast({
        title: "Unable to delete prompt",
        description,
        variant: "destructive",
      });
    }
  };

  const handleModelChange = (model: string) => {
    if (!ALL_MODEL_SET.has(model)) {
      setSelectedModel(DEFAULT_MODEL);
      return;
    }
    if (webSearchEnabled && !WEB_SEARCH_COMPATIBLE_MODEL_SET.has(model)) {
      setSelectedModel(DEFAULT_WEB_SEARCH_MODE);
      return;
    }
    setSelectedModel(model);
  };

  const handleSendMessage = async (
    content: string,
    files?: File[],
    options?: ComposerSendOptions
  ) => {
    if (streamingAssistantId) return;
    const sessionId = user ? currentSessionId : GUEST_SESSION_ID;
    if (user && !sessionId) {
      toast({
        title: "Preparing your chat",
        description: "One moment while we finish setting up this session.",
      });
      return;
    }
    // Check attachment types
    const detectFileType = (file: File) => (file.type || "").toLowerCase();
    const hasImageFiles = files && files.some((file) => detectFileType(file).startsWith("image/"));
    const hasDocumentFiles = files && files.some((file) => !detectFileType(file).startsWith("image/"));

    // Determine which model to use for this request
    let modelForThisRequest = selectedModel;
    if (hasImageFiles) {
      modelForThisRequest = "pixtral-large-latest";
    } else if (hasDocumentFiles) {
      modelForThisRequest = "mistral-large-latest";
    }
    const selectedWebSearchMode = options?.webSearchMode;

    // Create user message with appropriate content
    let messageContent = content;
    if (files && files.length > 0) {
      const fileNames = files.map((f) => f.name).join(", ");

      if (hasImageFiles) {
        messageContent = content
          ? `${content}\n\n[Analyzing ${files.length} file(s) including images with vision model]`
          : `[Analyzing ${files.length} image file(s) with vision model]`;
      } else {
        messageContent = content
          ? `${content}\n\n[Analyzing ${files.length} file(s): ${fileNames}]`
          : `[Analyzing ${files.length} file(s): ${fileNames}]`;
      }
    }

    const promptPreview = messageContent.replace(/\s+/g, " ").trim().slice(0, 200);
    const userMessage: Message = {
      id: generateId("msg"),
      role: "user",
      content: messageContent,
      timestamp: new Date(),
    };

    const nextHistory = [...messages, userMessage];
    setMessages(nextHistory);
    persistCurrentMessage(userMessage);
    console.log("[titles] maybeRenameCurrentSession from handleSendMessage", {
      userId,
      sessionId,
      sessionsCount: sessions.length,
    });
    maybeRenameCurrentSession(userMessage, sessionId);
    setTimeout(() => jumpToLatest("smooth"), 0);

    let attachments: Awaited<ReturnType<typeof prepareAttachments>> = [];
    if (files && files.length > 0) {
      try {
        attachments = await prepareAttachments(files);
        console.log("Files processed as attachments:", attachments);
        console.log("Using model for this request:", modelForThisRequest);
      } catch (error) {
        console.error("Error processing attachments:", error);
      }
    }

    // Create appropriate instructions based on file types
    let detailInstruction = "Please respond to the user's query.";
    if (hasImageFiles) {
      detailInstruction =
        "You are analyzing images and other files. Provide a detailed description and answer any questions referencing both visual and textual evidence.";
    } else if (files && files.length > 0) {
      detailInstruction =
        "Please analyze the content of the attached files and respond to the user's query based on the file contents.";
    }
    let instructions = `${systemPromptText.trim()}\n\n${detailInstruction}`;

    if (selectedWebSearchMode) {
      const modeHint =
        selectedWebSearchMode === "web_search_premium"
          ? "Websearch is enabled via web_search_premium, which can query the open web and verified news sources. Use it whenever fresh or cited information is required."
          : "Websearch is enabled via the basic web_search tool. Run it whenever the answer needs current or sourced information.";
      instructions = `${instructions}\n\n${modeHint} Always cite the URLs returned by the tool when referencing external facts.`;
    }
    const toolPayloads = selectedWebSearchMode ? [{ type: selectedWebSearchMode }] : [];

    const abortController = new AbortController();
    setStreamAbortController(abortController);

    streamMistralReply(
      nextHistory,
      {
        model: modelForThisRequest,
        instructions,
        completion_args: { temperature: 0.7, max_tokens: 2048, top_p: 1 },
        tools: toolPayloads,
        attachments,
        signal: abortController.signal,
      },
      {
        onStart: (assistantId) => {
          activeMetricRef.current = {
            assistantId,
            start: performance.now(),
            model: modelForThisRequest,
            promptChars: messageContent.length,
            responseChars: 0,
            promptPreview,
          };
          setStreamingAssistantId(assistantId);
          setMessages((prev) => [
            ...prev,
            {
              id: assistantId,
              role: "assistant",
              content: "",
              timestamp: new Date(),
              modelUsed: modelForThisRequest,
            },
          ]);
          setTimeout(() => jumpToLatest("smooth"), 0);
        },
        onToken: (chunk, assistantId) => {
          if (activeMetricRef.current?.assistantId === assistantId) {
            activeMetricRef.current.responseChars += chunk.length;
          }
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m))
          );
        },
        onDone: (assistantId) => {
          finalizeRequestMetric(assistantId, true);
          finalizeAssistantStreaming(assistantId);
        },
        onError: (errText, assistantId) => {
          finalizeRequestMetric(assistantId, false);
          finalizeAssistantStreaming(assistantId, `[Error: ${errText}]`);
          console.error("Streaming error:", errText);
        },
        onAbort: (assistantId) => {
          finalizeRequestMetric(assistantId, false);
          finalizeAssistantStreaming(assistantId, "[Generation stopped by user]");
        },
      }
    );
  };

  const handleGenerateImage = async (prompt: string) => {
    const sessionId = user ? currentSessionId : GUEST_SESSION_ID;
    if (user && !sessionId) {
      toast({
        title: "Preparing your chat",
        description: "One moment while we finish setting up this session.",
      });
      return;
    }
    const userMessage: Message = {
      id: generateId("msg"),
      role: "user",
      content: prompt,
      timestamp: new Date(),
    };
    const assistantId = generateId("img");

    if (streamingAssistantId) return;

    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: assistantId,
        role: "assistant",
        content: "Creating image…",
        timestamp: new Date(),
        modelUsed: "image-generation",
      },
    ]);
    setTimeout(() => jumpToLatest("smooth"), 0);
    persistCurrentMessage(userMessage);
    maybeRenameCurrentSession(userMessage, sessionId);

    const controller = new AbortController();
    setStreamAbortController(controller);
    setStreamingAssistantId(assistantId);

    try {
      const { images } = await generateImagesViaAgent(prompt, { signal: controller.signal });
      const md =
        (images || [])
          .map((img, i) => {
            const dataUrl = `data:${img.mime};base64,${img.base64}`;
            return [
              "**Generated image:**",
              "",
              `![generated image](${dataUrl})`,
              "",
              `[Download image ${i + 1}](data:${img.mime};base64,${img.base64})`,
            ].join("\n");
          })
          .join("\n\n---\n\n") || "No image returned.";

      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: md } : m)));
      persistAssistantById(assistantId);
      finalizeAssistantStreaming(assistantId);
      setStreamAbortController(null);
      setTimeout(() => jumpToLatest("smooth"), 0);
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === "AbortError";
      const errText = error instanceof Error ? error.message : String(error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: aborted
                  ? "Image generation cancelled by user."
                  : `Image generation failed:\n\n\`\`\`\n${errText}\n\`\`\``,
              }
            : m
        )
      );
      persistAssistantById(assistantId);
      finalizeAssistantStreaming(
        assistantId,
        aborted ? "[Generation stopped by user]" : undefined
      );
      setStreamAbortController(null);
      if (!aborted) {
        console.error("generateImagesViaAgent error:", error);
      }
    }
  };

  const handleAttachFiles = (files: File[]) => {
    console.log("Files attached for preview:", files);
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!user) return;
    try {
      await deleteSession(sessionId);
      const updatedSessions = sessions.filter((s) => s.id !== sessionId);
      setSessions(updatedSessions);

      if (sessionId === currentSessionId) {
        handleAbortStreaming();
        if (updatedSessions.length) {
          const nextSession = updatedSessions[0];
          setMessages([initialAssistantGreeting()]);
          setHistoryLoading(true);
          setCurrentSessionId(nextSession.id);
          setTimeout(() => jumpToLatest("auto"), 0);
        } else {
          setCurrentSessionId(null);
          setMessages([initialAssistantGreeting()]);
          setHistoryLoading(false);
          setTimeout(() => jumpToLatest("auto"), 0);
        }
      }
    } catch (error) {
      const description = error instanceof Error ? error.message : "Supabase request failed.";
      toast({
        title: "Unable to delete chat",
        description,
        variant: "destructive",
      });
    }
  };

  const handleDeleteAllSessions = async () => {
    if (!user) {
      throw new Error("You must sign in to delete chats.");
    }
    await deleteAllSessions(user.id);
    handleAbortStreaming();
    setSessions([]);
    setMessages([initialAssistantGreeting()]);
    setCurrentSessionId(null);
    setHistoryLoading(false);
    renamedSessionsRef.current.clear();
  };

  const handleNewChat = async () => {
    if (user && currentSessionId) {
      const hasUserMessage = messages.some((m) => m.role === "user");
      if (!hasUserMessage) {
        toast({
          title: "Current chat is still empty",
          description: "Send a message before starting another chat.",
        });
        return;
      }
    }

    handleAbortStreaming();
    setHistoryLoading(false);
    setMessages([initialAssistantGreeting()]);
    if (user) {
      try {
        const session = await createSession(user.id);
        setSessions((prev) => [session, ...prev]);
        setCurrentSessionId(session.id);
      } catch (error) {
        const description = error instanceof Error ? error.message : "Supabase request failed.";
        toast({
          title: "Unable to start chat",
          description,
          variant: "destructive",
        });
      }
    } else {
      setCurrentSessionId(GUEST_SESSION_ID);
    }
    setTimeout(() => jumpToLatest("auto"), 0);
  };

  const handleSelectSession = (sessionId: string) => {
    if (sessionId === currentSessionId) return;
    handleAbortStreaming();
    setHistoryLoading(true);
    setMessages([initialAssistantGreeting()]);
    setCurrentSessionId(sessionId);
    setTimeout(() => jumpToLatest("auto"), 0);
  };

  const composerSpacing = `calc(${composerHeight}px + env(safe-area-inset-bottom, 0px) + 24px)`;
  const jumpButtonOffset = `calc(${composerHeight}px + env(safe-area-inset-bottom, 0px) + 36px)`;

  return (
    <>
    <div
      className={cn(
        // 🔧 KEY FIX: Make this a viewport-height app shell with internal scroll only
        "relative h-dvh md:h-screen bg-background font-pixel overflow-hidden",
        "md:grid",
        sidebarOpen ? "md:grid-cols-[20rem_1fr]" : "md:grid-cols-[0_1fr]"
      )}
    >
      <Sidebar
        open={sidebarOpen}
        onNewChat={handleNewChat}
        sessions={sessions}
        currentSessionId={currentSessionId}
        sessionsLoading={sessionsLoading}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onDeleteAllSessions={handleDeleteAllSessions}
        onChangeProfilePic={() => setProfilePictureDialogOpen(true)}
        profileImageUrl={avatarUrl ?? undefined}
        onClose={() => setSidebarOpen(false)}
        onOpenDashboard={() => navigate("/dashboard")}
        onOpenEval={() => navigate("/eval")}
        onOpenSystemPrompt={() => setSystemPromptDialogOpen(true)}
        onShowCat={() => setCatOpen(true)}
      />

      <main className="relative min-h-0 flex flex-col h-full w-full">
        <TopBar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          model={selectedModel}
          onModelChange={handleModelChange}
          models={modelsForSelect}
        />

        {/* Messages area: the ONLY scrollable vertical region */}
        <div
          ref={containerRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-background"
          id="chat-scroll-container"
        >
          <div className="relative px-4 sm:px-6 md:px-8 pt-4 md:pt-8 w-full md:max-w-5xl xl:max-w-6xl md:mx-auto">
            {historyLoading && (
              <div className="absolute inset-0 flex items-start justify-center pt-4 pointer-events-none z-20">
                <div className="border-4 border-border bg-card px-4 py-2 font-pixel text-[10px] text-foreground pixel-shadow-white animate-pulse">
                  Loading chat history...
                </div>
              </div>
            )}
            <div
              className={cn(
                "space-y-6 relative z-10 transition-opacity",
                historyLoading ? "opacity-40" : "opacity-100"
              )}
            >
              <div className="relative z-10">
                {messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    isStreaming={message.role === "assistant" && message.id === streamingAssistantId}
                  />
                ))}
              </div>

            <div ref={endRef} className="w-full" style={{ height: composerSpacing }} />

            {!autoScroll && showJump && (
              <div
                className="sticky z-40 flex justify-center"
                style={{ bottom: jumpButtonOffset }}
              >
                <button
                  type="button"
                  onClick={() => jumpToLatest("smooth")}
                  className="w-full max-w-xs sm:max-w-none sm:w-auto text-center border-4 border-border bg-card text-foreground font-pixel text-[10px] px-4 py-2 pixel-shadow-white hover:bg-primary hover:text-primary-foreground transition-all"
                  title="Jump to latest"
                >
                  ▼ Jump to latest
                </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Composer pinned to the bottom of the shell */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30">
          <div className="px-4 sm:px-6 md:px-8">
            <div className="pointer-events-none w-full md:max-w-5xl xl:max-w-6xl md:mx-auto">
              <div className="pointer-events-auto w-full md:max-w-3xl md:mx-auto" ref={composerRef}>
                <MultimodalComposer
                  onSend={handleSendMessage}
                  onAttachFiles={handleAttachFiles}
                  onGenerateImage={handleGenerateImage}
                  isStreaming={Boolean(streamingAssistantId)}
                  onAbortStreaming={handleAbortStreaming}
                  webSearchEnabled={webSearchEnabled}
                  onToggleWebSearch={handleToggleWebSearch}
                  webSearchMode={DEFAULT_WEB_SEARCH_MODE}
                />
              </div>
              <div style={{ height: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)" }} />
            </div>
          </div>
        </div>
      </main>
    </div>
    <ProfilePictureDialog
      open={profilePictureDialogOpen}
      onOpenChange={setProfilePictureDialogOpen}
      userId={user?.id}
      currentAvatarUrl={avatarUrl ?? undefined}
      currentAvatarPath={avatarPath ?? undefined}
      onUploaded={({ publicUrl, storagePath }) => {
        setAvatarUrl(publicUrl);
        setAvatarPath(storagePath);
      }}
    />
    <SystemPromptDialog
      open={systemPromptDialogOpen}
      onOpenChange={setSystemPromptDialogOpen}
      prompts={allSystemPrompts}
      selectedPromptId={activeSystemPrompt?.id ?? DEFAULT_SYSTEM_PROMPT_ID}
      onSelectPrompt={setSelectedPromptId}
      allowSave={Boolean(user)}
      onCreatePrompt={handleCreateSystemPrompt}
      allowDelete={Boolean(user)}
      onDeletePrompt={handleDeleteSystemPrompt}
    />
    <CatModal open={catOpen} onOpenChange={setCatOpen} />
    </>
  );
}
