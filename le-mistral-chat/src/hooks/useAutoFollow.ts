// root/src/hooks/useAutoFollow.ts
import { useEffect, useRef, useState } from "react";

type ScrollBehavior = "auto" | "smooth";

export function useAutoFollow(streamingAssistantId: string | null, deps: unknown[] = []) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const [autoScroll, setAutoScroll] = useState(true);
  const [showJump, setShowJump] = useState(false);

  // Observe bottom sentinel visibility
  useEffect(() => {
    const root = containerRef.current;
    const end = endRef.current;
    if (!root || !end) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        const atBottom = entry.isIntersecting;
        setAutoScroll(atBottom);
        setShowJump(!atBottom);
      },
      { root, threshold: 1, rootMargin: "0px 0px 120px 0px" }
    );

    obs.observe(end);
    return () => obs.disconnect();
  }, []);

  // Stick to bottom only when autoScroll is true
  useEffect(() => {
    if (autoScroll && endRef.current) {
      endRef.current.scrollIntoView({
        behavior: streamingAssistantId ? "auto" : "auto",
        block: "end",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScroll, streamingAssistantId, ...deps]);

  const jumpToLatest = (behavior: ScrollBehavior = "smooth") => {
    const root = containerRef.current;
    setShowJump(false);
    setAutoScroll(true);
    if (root) root.scrollTo({ top: root.scrollHeight, behavior });
    endRef.current?.scrollIntoView({ behavior, block: "end" });
  };

  return { containerRef, endRef, autoScroll, showJump, jumpToLatest };
}
