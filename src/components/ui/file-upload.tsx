"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CloudUpload, File, X } from "lucide-react";

interface FileUploadProps {
  accept?: string;
  onChange?: (file: File | null) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

function FileUpload({ accept, onChange, disabled, className, id }: FileUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);

  const handleFile = (file: File | null) => {
    setSelectedFile(file);
    onChange?.(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0] ?? null;
    if (file) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0] ?? null);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileExtension = (name: string) =>
    name.split(".").pop()?.toUpperCase() ?? "FILE";

  return (
    <div className={cn("w-full", className)}>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        onChange={handleChange}
        disabled={disabled}
        className="sr-only"
      />

      {selectedFile ? (
        /* ── File selected state ── */
        <div className="group flex items-center gap-4 border border-border bg-muted/30 p-4 transition-colors hover:bg-muted/40">
          {/* File icon + extension badge */}
          <div className="relative flex h-12 w-9 shrink-0 flex-col items-center justify-center bg-primary/10">
            <File className="size-5 text-primary/50" />
            <span className="mt-0.5 text-[9px] font-bold tracking-widest text-primary">
              {getFileExtension(selectedFile.name)}
            </span>
          </div>

          {/* File info */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight">
              {selectedFile.name}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatSize(selectedFile.size)}
            </p>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
              className="h-7 text-xs text-muted-foreground"
            >
              Changer
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={disabled}
              aria-label="Supprimer le fichier"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        /* ── Drop zone ── */
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "group relative flex w-full flex-col items-center justify-center gap-5 border border-dashed border-border px-6 py-14 text-center transition-all duration-200",
            "hover:border-primary/50 hover:bg-primary/[0.025]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            isDragging && "border-primary bg-primary/[0.04]",
            disabled && "pointer-events-none opacity-50"
          )}
        >
          {/* Corner brackets — visible on drag */}
          <span
            className={cn(
              "absolute left-0 top-0 h-4 w-4 border-l-2 border-t-2 border-primary transition-opacity duration-200",
              isDragging ? "opacity-100" : "opacity-0"
            )}
          />
          <span
            className={cn(
              "absolute right-0 top-0 h-4 w-4 border-r-2 border-t-2 border-primary transition-opacity duration-200",
              isDragging ? "opacity-100" : "opacity-0"
            )}
          />
          <span
            className={cn(
              "absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-primary transition-opacity duration-200",
              isDragging ? "opacity-100" : "opacity-0"
            )}
          />
          <span
            className={cn(
              "absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-primary transition-opacity duration-200",
              isDragging ? "opacity-100" : "opacity-0"
            )}
          />

          {/* Upload icon */}
          <div
            className={cn(
              "flex h-14 w-14 items-center justify-center border border-border bg-background transition-all duration-200",
              "group-hover:border-primary/40 group-hover:bg-primary/5",
              isDragging && "border-primary bg-primary/10 scale-110"
            )}
          >
            <CloudUpload
              className={cn(
                "size-6 text-muted-foreground transition-all duration-200",
                "group-hover:text-primary/70",
                isDragging && "-translate-y-0.5 text-primary"
              )}
            />
          </div>

          {/* Copy */}
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">
              {isDragging ? (
                "Déposez le fichier ici"
              ) : (
                <>
                  Glissez un fichier ici, ou{" "}
                  <span className="text-primary underline underline-offset-2">
                    parcourez
                  </span>
                </>
              )}
            </p>
            <p className="text-xs text-muted-foreground">CSV ou TXT · Max 10 MB</p>
          </div>
        </button>
      )}
    </div>
  );
}

export { FileUpload };
export type { FileUploadProps };
