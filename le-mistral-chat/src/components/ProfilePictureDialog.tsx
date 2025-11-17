import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { uploadProfilePicture, type ProfilePictureUploadResult } from "@/lib/profile";
import { cn } from "@/lib/utils";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
const TARGET_SIZE = 800;

async function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };
    image.src = url;
  });
}

function replaceExtension(name: string, nextExt: string) {
  const parts = name.split(".");
  if (parts.length <= 1) return `${name}.${nextExt}`;
  parts.pop();
  return `${parts.join(".")}.${nextExt}`;
}

async function convertToJpegSquare(file: File) {
  if (typeof window === "undefined") return file;
  const image = await loadImageFromFile(file);
  const canvas = document.createElement("canvas");
  canvas.width = TARGET_SIZE;
  canvas.height = TARGET_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  const ratio = Math.max(TARGET_SIZE / image.width, TARGET_SIZE / image.height);
  const drawWidth = image.width * ratio;
  const drawHeight = image.height * ratio;
  const offsetX = (TARGET_SIZE - drawWidth) / 2;
  const offsetY = (TARGET_SIZE - drawHeight) / 2;

  ctx.clearRect(0, 0, TARGET_SIZE, TARGET_SIZE);
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Unable to convert image to JPEG."));
      },
      "image/jpeg",
      0.9
    );
  });

  return new File([blob], replaceExtension(file.name, "jpg"), { type: "image/jpeg" });
}

type ProfilePictureDialogProps = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  userId?: string | null;
  currentAvatarUrl?: string | null;
  currentAvatarPath?: string | null;
  onUploaded?: (payload: ProfilePictureUploadResult) => void;
};

export function ProfilePictureDialog({
  open,
  onOpenChange,
  userId,
  currentAvatarUrl,
  currentAvatarPath,
  onUploaded,
}: ProfilePictureDialogProps) {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setUploading(false);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const fallbackPreview = useMemo(() => currentAvatarUrl ?? null, [currentAvatarUrl]);
  const shownPreview = previewUrl ?? fallbackPreview ?? null;

  const disabled = uploading || !selectedFile || !userId;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Unsupported file",
        description: "Please choose an image file (PNG, JPG, GIF, or WebP).",
        variant: "destructive",
      });
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      toast({
        title: "File is too large",
        description: "Please choose an image smaller than 5 MB.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({ title: "Choose an image first.", variant: "destructive" });
      return;
    }
    if (!userId) {
      toast({
        title: "Sign in required",
        description: "Please sign in to change your profile picture.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      let optimizedFile = selectedFile;
      try {
        optimizedFile = await convertToJpegSquare(selectedFile);
      } catch (optimizationError) {
        console.warn("[profile] Failed to optimize avatar, uploading original file", optimizationError);
      }
      const result = await uploadProfilePicture(optimizedFile, userId, currentAvatarPath);
      toast({ title: "Profile picture updated" });
      onUploaded?.(result);
      onOpenChange(false);
    } catch (error) {
      let description = error instanceof Error ? error.message : "Failed to upload image.";
      if (error instanceof Error && "message" in error && /Bucket not found/i.test(error.message)) {
        description =
          "Supabase storage bucket 'profile-pictures' is missing. Run the storage setup in supabase/schema.sql to create it and enable authenticated uploads.";
      }
      toast({
        title: "Upload failed",
        description,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-4 border-border bg-card font-pixel text-[10px]">
        <DialogHeader>
          <DialogTitle className="text-base">Update profile picture</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Choose an image up to 5 MB. Square images look best in the sidebar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            className={cn(
              "relative w-full aspect-square border-4 border-dashed border-border flex items-center justify-center overflow-hidden",
              shownPreview ? "bg-muted/40" : "bg-muted/10"
            )}
          >
            {shownPreview ? (
              <img src={shownPreview} alt="Profile preview" className="w-full h-full object-cover" />
            ) : (
              <p className="text-muted-foreground text-[11px] text-center px-6">
                Select an image to preview it here.
              </p>
            )}
          </div>

          <Input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="bg-background border-4 border-border file:font-pixel file:text-[10px]"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            className="font-pixel text-[10px] border-4 border-border"
            onClick={() => onOpenChange(false)}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="font-pixel text-[10px] border-4 border-border"
            disabled={disabled}
            onClick={handleUpload}
          >
            {uploading ? "Uploading..." : "Save picture"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
