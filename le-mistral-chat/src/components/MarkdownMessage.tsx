// root/src/components/MarkdownMessage.tsx
// -----------------------------------------------------------------------------
// PURPOSE
//   Slightly larger default text on phones for readability. Data-URI images
//   still allowed (fix you already liked).
// -----------------------------------------------------------------------------

import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

type Props = { content: string };

function repairFencesAdvanced(s: string) {
  const lines = s.split(/\r?\n/);
  const out: string[] = [];
  let inFence = false;
  let fenceMarker: "`" | "~" | null = null;
  let fenceLen = 0;
  const fenceRegex = /^\s{0,3}([`~]{3,})(.*)$/;

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const m = line.match(fenceRegex);
    if (m) {
      const markers = m[1];
      const markerChar = markers[0] as "`" | "~";
      const len = markers.length;
      const rest = m[2] ?? "";
      const indent = line.slice(0, line.indexOf(markers));

      if (!inFence) {
        inFence = true;
        fenceMarker = markerChar;
        fenceLen = len;
        out.push(line);
        continue;
      } else {
        if (markerChar === fenceMarker && len >= fenceLen) {
          const trailing = rest.replace(/\s+$/, "");
          out.push(indent + markers);
          if (trailing.length > 0) out.push(trailing.trimStart());
          inFence = false;
          fenceMarker = null;
          fenceLen = 0;
          continue;
        }
      }
    }
    out.push(line);
  }
  if (inFence && fenceMarker) out.push(fenceMarker.repeat(Math.max(3, fenceLen)));
  return out.join("\n");
}

function maybeWrapHtmlAsFence(s: string) {
  if (s.includes("```") || s.includes("~~~")) return s;
  const looksLikeHtmlDoc =
    /^\s*<!DOCTYPE html>/i.test(s) ||
    /^\s*<html[\s>]/i.test(s) ||
    /^\s*<head[\s>]/i.test(s) ||
    /^\s*<body[\s>]/i.test(s);
  return looksLikeHtmlDoc ? "```html\n" + s.trim() + "\n```" : s;
}

function allowAllUrls(uri: string) {
  return uri;
}

export default function MarkdownMessage({ content }: Props) {
  const prepared = useMemo(() => {
    const step1 = content ?? "";
    const step2 = repairFencesAdvanced(step1);
    const step3 = maybeWrapHtmlAsFence(step2);
    return step3;
  }, [content]);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      urlTransform={allowAllUrls}
      components={{
        p({ children }) {
          return (
            <p
              className="font-pixel text-[12px] md:text-[10px] leading-loose whitespace-pre-wrap mb-3 break-words"
              style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
            >
              {children}
            </p>
          );
        },
        img({ src, alt }) {
          return (
            <img
              src={src || ""}
              alt={alt || "image"}
              className="block max-w-full h-auto my-2"
              style={{ imageRendering: "auto", display: "block" }}
            />
          );
        },
        code({ inline, className, children, ...props }) {
          const txt = String(children ?? "");
          if (inline) {
            return (
              <code
                className="font-mono text-[11px] md:text-[10px] bg-background/60 border border-border px-1.5 py-[2px] rounded break-words"
                style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
                {...props}
              >
                {txt}
              </code>
            );
          }
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
        pre({ children }) {
          const child = (Array.isArray(children) ? children[0] : children) as ReactElement | undefined;
          const className: string = child?.props?.className || "";
          const lang = (className.match(/language-([\w+-]+)/)?.[1] || "text")
            .replace(/_/g, "")
            .toLowerCase();
          const raw = String(child?.props?.children ?? "").replace(/\n$/, "");
          return <BlockWithCopy lang={lang} code={raw} />;
        },
        h1({ children }) {
          return <h1 className="font-pixel text-[13px] md:text-xs mb-2 break-words">{children}</h1>;
        },
        h2({ children }) {
          return <h2 className="font-pixel text-[12px] md:text-[11px] mb-2 break-words">{children}</h2>;
        },
        ul({ children }) {
          return <ul className="list-disc ml-5 mb-3 break-words">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal ml-5 mb-3 break-words">{children}</ol>;
        },
        li({ children }) {
          return (
            <li
              className="font-pixel text-[12px] md:text-[10px] leading-loose break-words"
              style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
            >
              {children}
            </li>
          );
        },
        a({ href, children }) {
          const isDataUrl = typeof href === "string" && href.startsWith("data:");
          const downloadName = isDataUrl ? "generated-image" : undefined;
          return (
            <a
              href={href}
              className="underline hover:no-underline text-primary break-words"
              style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
              download={downloadName}
              target={isDataUrl ? "_blank" : undefined}
              rel={isDataUrl ? "noopener noreferrer" : undefined}
            >
              {children}
            </a>
          );
        },
      }}
    >
      {prepared}
    </ReactMarkdown>
  );
}

function BlockWithCopy({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      console.warn("Copy failed:", error);
    }
  };

  return (
    <div className="group border-4 border-border bg-background/60 pixel-shadow-white mb-3 overflow-hidden max-w-full">
      <div className="flex items-center justify-between px-3 py-2 border-b-4 border-border bg-card">
        <span className="font-pixel text-[9px] uppercase text-muted-foreground">{lang || "code"}</span>
        <button
          type="button"
          onClick={doCopy}
          className="inline-flex items-center gap-1 font-pixel text-[9px] border-2 border-border px-2 py-1 bg-background hover:bg-primary hover:text-primary-foreground transition-all"
          aria-label="Copy code"
          title="Copy code"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <SyntaxHighlighter
        language={lang}
        style={oneDark}
        PreTag="div"
        CodeTag="code"
        wrapLongLines
        lineProps={{
          style: {
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
          },
        }}
        customStyle={{
          margin: 0,
          background: "transparent",
          fontSize: "11px",
          padding: "12px 14px",
          overflowX: "hidden",
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
