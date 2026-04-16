"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Camera, X, Loader2 } from "lucide-react";

interface AvatarUploadProps {
  value: string | null | undefined;
  fallback: string;
  onUpload: (file: File) => Promise<void>;
  onDelete: () => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export function AvatarUpload({
  value,
  fallback,
  onUpload,
  onDelete,
  disabled,
  className,
}: AvatarUploadProps) {
  const [preview, setPreview] = React.useState<string | null>(value ?? null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setPreview(value ?? null);
  }, [value]);

  const busy = isUploading || isDeleting || !!disabled;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objUrl = URL.createObjectURL(file);
    setPreview(objUrl);
    setIsUploading(true);
    try {
      await onUpload(file);
    } catch {
      URL.revokeObjectURL(objUrl);
      setPreview(value ?? null);
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
    try {
      await onDelete();
      setPreview(null);
    } catch {
      setPreview(value ?? null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={cn("relative group inline-block", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        disabled={busy}
        className="sr-only"
      />

      <button
        type="button"
        onClick={() => !busy && inputRef.current?.click()}
        disabled={busy}
        className="relative block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="Changer la photo de profil"
      >
        <Avatar className="size-16 text-base">
          {preview && <AvatarImage src={preview} />}
          <AvatarFallback>{fallback}</AvatarFallback>
        </Avatar>

        <div
          className={cn(
            "absolute inset-0 rounded-full bg-black/40 flex items-center justify-center transition-opacity duration-150",
            busy ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
        >
          {busy ? (
            <Loader2 className="size-4 text-white animate-spin" />
          ) : (
            <Camera className="size-4 text-white" />
          )}
        </div>
      </button>

      {preview && !busy && (
        <button
          type="button"
          onClick={handleDelete}
          className={cn(
            "absolute -top-0.5 -right-0.5 size-5 rounded-full",
            "bg-background border border-border shadow-sm",
            "flex items-center justify-center",
            "opacity-0 group-hover:opacity-100 transition-opacity duration-150",
            "hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
          )}
          aria-label="Supprimer la photo"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}
