import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff } from "lucide-react";

type AuthDialogProps = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
};

const GoogleLogo = () => (
  <svg
    className="h-5 w-5"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.37.61 4.63 1.8l3.48-3.48C17.96 1.21 15.24 0 12 0A12 12 0 001.25 6.59l3.98 3.1A7.17 7.17 0 0112 4.75z"
    />
    <path
      fill="#FBBC05"
      d="M5.23 14.31a7.19 7.19 0 010-4.62V6.59H1.25a12.01 12.01 0 000 10.82l3.98-3.1z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.86-3a7.43 7.43 0 01-4.08 1.18 7.17 7.17 0 01-6.77-4.96H1.25v3.1A12 12 0 0012 24z"
    />
    <path
      fill="#4285F4"
      d="M23.49 12.27c0-.78-.07-1.53-.2-2.27H12v4.3h6.44a5.52 5.52 0 01-2.39 3.62v3h3.86c2.26-2.08 3.58-5.15 3.58-8.65z"
    />
  </svg>
);

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotCooldownUntil, setForgotCooldownUntil] = useState<number | null>(null);
  const [forgotCountdown, setForgotCountdown] = useState(0);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);

  useEffect(() => {
    if (forgotCooldownUntil === null) {
      setForgotCountdown(0);
      return;
    }
    const updateForgotCountdown = () => {
      const remaining = Math.max(0, Math.ceil((forgotCooldownUntil - Date.now()) / 1000));
      setForgotCountdown(remaining);
      if (remaining <= 0) {
        setForgotCooldownUntil(null);
      }
    };
    updateForgotCountdown();
    const interval = window.setInterval(updateForgotCountdown, 500);
    return () => window.clearInterval(interval);
  }, [forgotCooldownUntil]);

  const forgotCooldownActive = forgotCountdown > 0;

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setMode("signin");
    setFormError(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setForgotLoading(false);
    setConfirmationEmail(null);
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      resetForm();
    }
    onOpenChange(next);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email || !password) {
      toast({ title: "Missing info", description: "Email and password are required.", variant: "destructive" });
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      const mismatch = "Passwords do not match.";
      setFormError(mismatch);
      toast({
        title: "Passwords mismatch",
        description: mismatch,
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    setFormError(null);
    const action = mode === "signin" ? signIn : signUp;
    const { error } = await action(email, password);
    setLoading(false);
    if (error) {
      const fallback =
        error.message ||
        (mode === "signin" ? "Unable to sign you in. Please check your email/password." : "Unable to create account.");
      setFormError(fallback);
      toast({
        title: mode === "signin" ? "Sign in error" : "Sign up error",
        description: fallback,
        variant: "destructive",
      });
      return;
    }
    if (mode === "signin") {
      toast({
        title: "Signed in",
        description: "Welcome back! Your chats will now sync.",
      });
      handleClose(false);
      return;
    }

    toast({
      title: "Confirm your email",
      description: "We sent a confirmation link to your inbox. Open it to activate your account.",
    });
    setConfirmationEmail(email);
    return;
  };

  const toggleMode = () => {
    setMode((prev) => (prev === "signin" ? "signup" : "signin"));
    setFormError(null);
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setForgotLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setOauthLoading(true);
    const { error } = await signInWithGoogle();
    setOauthLoading(false);
    if (error) {
      const disabled =
        typeof error.message === "string" &&
        error.message.toLowerCase().includes("provider is not enabled");
      const fallback = disabled
        ? "Google sign in is disabled in Supabase. Enable the Google provider under Auth → Providers to use this option."
        : error.message || "Google sign in failed. Please try again.";
      setFormError(fallback);
      toast({
        title: "Google sign in",
        description: fallback,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Redirecting to Google",
    });
  };

  const handleForgotPassword = async () => {
    if (forgotCooldownActive) return;
    if (!email) {
      const message = "Enter your email first so we can send reset instructions.";
      setFormError(message);
      toast({
        title: "Email required",
        description: message,
        variant: "destructive",
      });
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      const message = "Please enter a valid email before requesting a reset link.";
      setFormError(message);
      toast({
        title: "Invalid email",
        description: message,
        variant: "destructive",
      });
      return;
    }
    setForgotLoading(true);
    const { error } = await resetPassword(email);
    setForgotLoading(false);
    if (error) {
      const fallback = error.message || "We couldn't send the reset email. Try again.";
      setFormError(fallback);
      toast({
        title: "Reset failed",
        description: fallback,
        variant: "destructive",
      });
      return;
    }
    setFormError(null);
    setForgotCooldownUntil(Date.now() + 30_000);
    toast({
      title: "Check your inbox",
      description: "We sent password reset instructions to your email.",
    });
  };

  const handleDismissConfirmation = () => {
    setConfirmationEmail(null);
    handleClose(false);
  };

  const isConfirmationNotice = Boolean(confirmationEmail);

  const dialogMaxWidthClass = "max-w-[520px]";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={`w-[calc(100vw-1.5rem)] ${dialogMaxWidthClass} border-4 border-border pixel-shadow-white bg-card`}
      >
        <DialogHeader>
          <DialogTitle className="font-pixel text-xs text-foreground">
            {isConfirmationNotice ? "Check your email" : mode === "signin" ? "Sign in to chat" : "Create account"}
          </DialogTitle>
        </DialogHeader>

        {isConfirmationNotice ? (
          <div className="space-y-5 mt-4 text-center">
            <p className="font-pixel text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              We sent a confirmation link to <span className="text-primary">{confirmationEmail}</span>.
            </p>
            <p className="text-[11px] font-pixel text-foreground">
              Open the link in that email to activate your account and start using the app. This helps us keep your data
              secure.
            </p>
            <DialogFooter className="flex flex-col gap-3">
              <Button
                type="button"
                onClick={handleDismissConfirmation}
                className="w-full border-4 border-border font-pixel text-[10px] pixel-shadow"
              >
                Got it
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleSignIn}
                  disabled={loading || oauthLoading}
                  className="border-4 border-border font-pixel text-[10px] flex items-center justify-center gap-3 pixel-shadow-white px-6"
                >
                  <GoogleLogo />
                  <span>{oauthLoading ? "Connecting..." : "Continue with Google"}</span>
                </Button>
              </div>
            </div>

            <form className="space-y-4 mt-6" onSubmit={handleSubmit}>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="font-pixel text-[10px] uppercase tracking-[0.08em]">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="font-pixel text-[11px] uppercase border-4 border-border h-11 px-3 pixel-shadow-white focus-visible:ring-offset-0"
                  />
                </div>
                <div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="font-pixel text-[10px] uppercase tracking-[0.08em]">
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete={mode === "signin" ? "current-password" : "new-password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        minLength={6}
                        required
                        className="font-pixel text-[11px] uppercase border-4 border-border h-11 px-3 pr-12 pixel-shadow-white focus-visible:ring-offset-0"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  {mode === "signin" && (
                    <button
                      type="button"
                      className="text-[10px] font-pixel underline underline-offset-2 text-primary mt-6 block text-left disabled:text-muted-foreground disabled:opacity-70"
                      onClick={handleForgotPassword}
                      disabled={forgotLoading || forgotCooldownActive}
                    >
                      {forgotLoading
                        ? "Sending reset..."
                        : forgotCooldownActive
                          ? `Resend in ${forgotCountdown}s`
                          : "Forgot password?"}
                    </button>
                  )}
                </div>
                {mode === "signup" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password" className="font-pixel text-[10px] uppercase tracking-[0.08em]">
                      Confirm password
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        minLength={6}
                        required
                        className="font-pixel text-[11px] uppercase border-4 border-border h-11 px-3 pr-12 pixel-shadow-white focus-visible:ring-offset-0"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        aria-label={showConfirmPassword ? "Hide confirmation" : "Show confirmation"}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {formError && (
                <p className="text-[11px] text-destructive font-pixel" role="alert">
                  {formError}
                </p>
              )}

              <DialogFooter className="flex flex-col gap-3">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full border-4 border-border font-pixel text-[10px] pixel-shadow"
                >
                  {loading ? "Working..." : mode === "signin" ? "Sign in" : "Create account"}
                </Button>
                <button
                  type="button"
                  onClick={toggleMode}
                  className="text-[11px] text-primary underline-offset-2 underline font-pixel"
                >
                  {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
                </button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
