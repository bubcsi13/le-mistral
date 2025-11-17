import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export function ResetPasswordDialog() {
  const { passwordResetRequested, dismissPasswordReset, completePasswordReset } = useAuth();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!passwordResetRequested) return null;

  const handleClose = (open: boolean) => {
    if (!open) {
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
      setFormError(null);
      dismissPasswordReset();
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password || password.length < 6) {
      const message = "Password must be at least 6 characters.";
      setFormError(message);
      toast({ title: "Password too short", description: message, variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      const message = "Passwords do not match.";
      setFormError(message);
      toast({ title: "Passwords mismatch", description: message, variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await completePasswordReset(password);
    setLoading(false);
    if (error) {
      const message = error.message || "Unable to update password, please try again.";
      setFormError(message);
      toast({ title: "Reset failed", description: message, variant: "destructive" });
      return;
    }
    toast({
      title: "Password updated",
      description: "You can now continue chatting with your new password.",
    });
    handleClose(false);
  };

  return (
    <Dialog open={passwordResetRequested} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md border-4 border-border pixel-shadow-white bg-card">
        <DialogHeader>
          <DialogTitle className="font-pixel text-xs text-foreground">Reset password</DialogTitle>
          <DialogDescription className="text-[11px] text-muted-foreground">
            Enter a brand new password for your account. You will be signed in automatically after
            saving the change.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4 mt-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="new-password" className="font-pixel text-[10px] uppercase tracking-[0.08em]">
              New password
            </Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
                autoComplete="new-password"
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

          <div className="space-y-1.5">
            <Label
              htmlFor="confirm-new-password"
              className="font-pixel text-[10px] uppercase tracking-[0.08em]"
            >
              Confirm password
            </Label>
            <div className="relative">
              <Input
                id="confirm-new-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                required
                autoComplete="new-password"
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

          {formError && (
            <p className="text-[11px] text-destructive font-pixel" role="alert">
              {formError}
            </p>
          )}

          <DialogFooter className="flex flex-col gap-3 pt-2">
            <Button
              type="submit"
              disabled={loading}
              className="w-full border-4 border-border font-pixel text-[10px] pixel-shadow"
            >
              {loading ? "Saving..." : "Save new password"}
            </Button>
            <button
              type="button"
              onClick={() => handleClose(false)}
              className="text-[11px] text-muted-foreground underline-offset-2 underline font-pixel"
            >
              Cancel
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
