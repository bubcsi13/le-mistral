// root/src/components/Sidebar.tsx
// -----------------------------------------------------------------------------
// ✅ Unified Sidebar
//   • Desktop: docked column, full viewport height, footer pinned to bottom.
//   • Mobile: slide-in overlay with backdrop + close button, footer pinned,
//     safe-area bottom padding respected.
//   • Middle list is the only scrollable area (no double scroll).
// -----------------------------------------------------------------------------

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Plus,
  User,
  X,
  LogOut,
  Ellipsis,
  Trash2,
  Info,
  ImagePlus,
  ChevronUp,
  BarChart3,
  Rows3,
  NotebookPen,
} from "lucide-react";
import { AuthDialog } from "@/components/AuthDialog";
import { AboutDialog } from "@/components/AboutDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { ChatSession } from "@/lib/chatStorage";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

type SidebarProps = {
  open: boolean;
  onNewChat: () => void;
  onClose?: () => void;
  sessions?: ChatSession[];
  currentSessionId?: string | null;
  sessionsLoading?: boolean;
  onSelectSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => Promise<void> | void;
  onDeleteAllSessions?: () => Promise<void> | void;
  onChangeProfilePic?: () => void;
  onAbout?: () => void;
  profileImageUrl?: string | null;
  onOpenDashboard?: () => void;
  onOpenEval?: () => void;
  onOpenSystemPrompt?: () => void;
  onShowCat?: () => void;
};

export default function Sidebar({
  open,
  onNewChat,
  onClose,
  sessions = [],
  currentSessionId,
  sessionsLoading = false,
  onSelectSession,
  onDeleteSession,
  onDeleteAllSessions,
  onChangeProfilePic,
  onAbout,
  profileImageUrl,
  onOpenDashboard,
  onOpenEval,
  onOpenSystemPrompt,
  onShowCat,
}: SidebarProps) {
  const { user, initializing, signOut } = useAuth();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const { toast } = useToast();
  const { resolvedTheme } = useTheme();
  const logoSrc =
    resolvedTheme === "dark"
      ? "/assets/logo-mistral-white.png"
      : "/assets/logo-mistral-black.png";

  const handleFooterAction = async () => {
    if (user) {
      try {
        await signOut();
        toast({ title: "Signed out", description: "Your chats stay synced in Supabase." });
      } catch (error) {
        toast({
          title: "Failed to sign out",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      }
    } else {
      setAuthDialogOpen(true);
    }
  };

  const footerButtonLabel = user ? "Sign out" : "Sign in";
  const footerLabel = user ? user.email ?? "Account" : initializing ? "Checking session..." : "Guest";

  const formatTimestamp = (session: ChatSession) => {
    const raw = session.updated_at ?? session.created_at;
    try {
      return formatDistanceToNow(new Date(raw), { addSuffix: true });
    } catch {
      return "";
    }
  };

  const handleSessionClick = (sessionId: string) => {
    setMenuOpenId(null);
    onSelectSession?.(sessionId);
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!onDeleteSession) return;
    const confirmed = window.confirm("Delete this chat? This action cannot be undone.");
    if (!confirmed) return;
    setDeletingId(sessionId);
    setMenuOpenId(null);
    try {
      await onDeleteSession(sessionId);
    } finally {
      setDeletingId((current) => (current === sessionId ? null : current));
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          // Positioning: overlay on mobile, docked on desktop
          "fixed md:relative inset-y-0 left-0 z-40 md:z-auto",
          // Sizing: ensure full viewport height on desktop so footer can sit at bottom
          "w-[85vw] max-w-xs md:max-w-none md:w-80 h-full md:h-screen",
          // Surface & layout: column with a dedicated scroll area in the middle
          "bg-card border-r-8 border-border flex flex-col",
          // Smooth slide on mobile; desktop also animates when toggled
          "transition-transform duration-200 will-change-transform md:transition-transform",
          open ? "translate-x-0 md:translate-x-0" : "-translate-x-full md:-translate-x-full",
          // Hide completely on desktop when closed (via parent grid column)
          "md:overflow-hidden",
        ].join(" ")}
      >
        {/* Mobile-only close button */}
        <button
          type="button"
          onClick={onClose}
          className="md:hidden absolute top-3 right-3 h-10 w-10 grid place-items-center bg-background text-foreground border-4 border-border pixel-shadow-white"
          aria-label="Close sidebar"
          title="Close sidebar"
        >
          <X className="w-5 h-5" strokeWidth={3} />
        </button>

        {/* Header (fixed height, non-scrollable) */}
        <div className="p-6 border-b-8 border-border bg-background shrink-0">
          <div className="flex items-center justify-center">
            <img
              src={logoSrc}
              alt="Mistral logo"
              className="h-10 md:h-12 w-auto object-contain"
              loading="lazy"
            />
            <span className="sr-only">Mistral Chat</span>
          </div>
        </div>

        {/* Scrollable middle content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          <Button
            variant="outline"
            onClick={() => {
              onNewChat();
            }}
            className="w-full justify-start gap-3 h-16 border-4 border-primary bg-background hover:bg-primary hover:text-primary-foreground text-foreground font-pixel text-[10px] transition-all"
          >
            <Plus className="w-5 h-5" strokeWidth={3} />
            NEW
          </Button>

          <div className="mt-4 space-y-2">
            <div className="font-pixel text-[9px] text-muted-foreground uppercase tracking-wide">
              History
            </div>
            {user ? (
              sessionsLoading ? (
                <p className="text-[10px] text-muted-foreground">Loading chats...</p>
              ) : sessions.length ? (
                <div className="space-y-2">
                  {sessions.map((session) => {
                    const isActive = session.id === currentSessionId;
                    return (
                      <div key={session.id} className="flex items-stretch gap-2 relative">
                        <button
                          type="button"
                          onClick={() => handleSessionClick(session.id)}
                          className={cn(
                            "flex-1 text-left border-4 border-border px-3 py-3 font-pixel text-[9px]",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "bg-card text-foreground hover:bg-muted/30"
                          )}
                        >
                            <div className="truncate">{session.title || "New chat"}</div>
                            <div className="text-[8px] text-muted-foreground mt-1">
                              {formatTimestamp(session)}
                            </div>
                          </button>
                        {onDeleteSession && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() =>
                                setMenuOpenId((prev) => (prev === session.id ? null : session.id))
                              }
                              className={cn(
                                "w-10 h-full border-4 border-border flex items-center justify-center transition-colors",
                                isActive
                                  ? "bg-primary text-primary-foreground hover:bg-primary/80"
                                  : "bg-card text-muted-foreground hover:bg-muted/60"
                              )}
                              aria-haspopup="menu"
                              aria-expanded={menuOpenId === session.id}
                              aria-label="Chat actions"
                              title="Chat actions"
                            >
                              <Ellipsis className="w-4 h-4" strokeWidth={3} />
                            </button>
                            {menuOpenId === session.id && (
                              <div className="absolute right-0 mt-1 w-32 border-4 border-border bg-card z-10">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSession(session.id)}
                                  disabled={deletingId === session.id}
                                  className={cn(
                                    "w-full px-3 py-2 text-left font-pixel text-[9px] text-destructive hover:bg-destructive hover:text-destructive-foreground transition",
                                    deletingId === session.id && "opacity-70 pointer-events-none"
                                  )}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground">Start chatting to create history.</p>
              )
            ) : (
              <p className="text-[10px] text-muted-foreground">Sign in to sync your chats.</p>
            )}
          </div>
        </div>

        {/* Footer (always at visual bottom) */}
        <div
          className="p-6 border-t-8 border-border bg-background shrink-0"
          style={{
            // Respect iOS safe area on mobile without affecting desktop
            paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
          }}
        >
          <div className="space-y-4">
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileMenuOpen((prev) => !prev)}
                className="w-full flex items-center gap-3 border-4 border-border bg-card px-3 py-2"
              >
                <div className="w-12 h-12 bg-secondary border-4 border-border flex items-center justify-center rounded-md overflow-hidden">
                  {profileImageUrl ? (
                    <img
                      src={profileImageUrl}
                      alt="Profile picture"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <User className="w-5 h-5 text-foreground" strokeWidth={3} />
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-[11px] text-muted-foreground truncate">{footerLabel}</div>
                  <div className="text-[9px] text-muted-foreground mt-1">
                    {user ? "Sync enabled" : "Sign in to sync chats"}
                  </div>
                </div>
                <ChevronUp
                  className={cn(
                    "w-4 h-4 text-muted-foreground transition-transform",
                    profileMenuOpen && "rotate-180"
                  )}
                  strokeWidth={3}
                />
              </button>
              {profileMenuOpen && (
                <div className="absolute left-0 right-0 bottom-full mb-2 border-4 border-border bg-card pixel-shadow-white z-50">
                  <div className="space-y-1">
                    {onShowCat && (
                      <button
                        type="button"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          onShowCat();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-[10px] hover:bg-muted/40"
                      >
                        🐱 Meet Le Cat
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        if (onAbout) onAbout();
                        else setAboutOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-[10px] hover:bg-muted/40"
                    >
                      <Info className="w-4 h-4" strokeWidth={3} />
                      About
                    </button>
                    {user ? (
                      <>
                        <button
                          type="button"
                          onClick={async () => {
                            setProfileMenuOpen(false);
                            if (!onDeleteAllSessions) return;
                            const confirmed = window.confirm(
                              "Delete all chats? This cannot be undone."
                            );
                            if (!confirmed) return;
                            try {
                              await onDeleteAllSessions();
                              toast({ title: "All chats deleted" });
                            } catch (error) {
                              toast({
                                title: "Failed to delete chats",
                                description:
                                  error instanceof Error ? error.message : "Please try again.",
                                variant: "destructive",
                              });
                            }
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-[10px] text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <Trash2 className="w-4 h-4" strokeWidth={3} />
                          Delete all chats
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setProfileMenuOpen(false);
                            onChangeProfilePic?.();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-[10px] hover:bg-muted/40"
                        >
                          <ImagePlus className="w-4 h-4" strokeWidth={3} />
                          Change profile picture
                        </button>
                        {onOpenSystemPrompt && (
                          <button
                            type="button"
                            onClick={() => {
                              setProfileMenuOpen(false);
                              onOpenSystemPrompt();
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-[10px] hover:bg-muted/40"
                          >
                            <NotebookPen className="w-4 h-4" strokeWidth={3} />
                            Manage system prompt
                          </button>
                        )}
                        {onOpenDashboard && (
                          <button
                            type="button"
                            onClick={() => {
                              setProfileMenuOpen(false);
                              onOpenDashboard();
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-[10px] hover:bg-muted/40"
                          >
                            <BarChart3 className="w-4 h-4" strokeWidth={3} />
                            Open dashboard
                          </button>
                        )}
                        {onOpenEval && (
                          <button
                            type="button"
                            onClick={() => {
                              setProfileMenuOpen(false);
                              onOpenEval();
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-[10px] hover:bg-muted/40"
                          >
                            <Rows3 className="w-4 h-4" strokeWidth={3} />
                            Run evals
                          </button>
                        )}
                      </>
                    ) : (
                      <p className="px-3 py-2 text-[10px] text-muted-foreground">
                        Sign in to access more profile options.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <Button
              size="sm"
              variant={user ? "destructive" : "outline"}
              onClick={handleFooterAction}
              disabled={initializing}
              className="w-full border-4 border-border font-pixel text-[9px] h-10 px-3 text-foreground inline-flex items-center gap-2 justify-center"
            >
              {user && <LogOut className="w-3 h-3" strokeWidth={3} />}
              {footerButtonLabel}
            </Button>
          </div>
        </div>
        <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
        <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      </aside>
    </>
  );
}
