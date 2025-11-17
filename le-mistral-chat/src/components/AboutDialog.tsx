import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type AboutDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="font-pixel text-sm">
        <DialogHeader>
          <DialogTitle>About</DialogTitle>
          <DialogDescription className="text-xs">
            Mistral project made by Gabor Juhasz.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-xs leading-relaxed">
          <p>
            This chat experience is built with Mistral models and Supabase persistence. All UI
            tweaks in this demo were crafted with love for the pixel aesthetic.
          </p>
          <p>
            Want to learn more about my work? Visit{" "}
            <a
              href="https://gaborj.com"
              target="_blank"
              rel="noreferrer"
              className="underline text-primary"
            >
              gaborj.com
            </a>{" "}
            for other projects and contact info.
          </p>
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
