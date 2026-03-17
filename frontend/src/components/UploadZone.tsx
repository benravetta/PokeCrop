import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useAppStore } from "../hooks/useProcessing";
import { Upload, FileImage, FileText, Loader2 } from "lucide-react";

export function UploadZone() {
  const { upload, uploading, error } = useAppStore();

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) upload(accepted[0]);
    },
    [upload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
    disabled: uploading,
  });

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-text-primary mb-2">
            Upload a card scan
          </h2>
          <p className="text-text-secondary text-sm">
            Drop an image or PDF scan of a trading card. PokeCrop will detect
            and extract the frontmost card with transparent background.
          </p>
        </div>

        <div
          {...getRootProps()}
          className={`
            relative border-2 border-dashed rounded-2xl p-12
            flex flex-col items-center justify-center gap-4
            cursor-pointer transition-all duration-200
            ${
              isDragActive
                ? "border-accent bg-accent/5 scale-[1.01]"
                : "border-border-subtle hover:border-text-muted hover:bg-surface-raised"
            }
            ${uploading ? "pointer-events-none opacity-60" : ""}
          `}
        >
          <input {...getInputProps()} />

          {uploading ? (
            <Loader2 className="w-10 h-10 text-accent animate-spin" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-surface-overlay flex items-center justify-center">
              <Upload className="w-7 h-7 text-text-secondary" />
            </div>
          )}

          <div className="text-center">
            <p className="text-text-primary font-medium">
              {uploading
                ? "Uploading..."
                : isDragActive
                  ? "Drop file here"
                  : "Drag & drop or click to browse"}
            </p>
            <p className="text-text-muted text-xs mt-1">
              Up to 100 MB
            </p>
          </div>

          <div className="flex gap-3 mt-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-text-muted bg-surface-overlay px-2.5 py-1 rounded-md">
              <FileImage className="w-3.5 h-3.5" />
              JPG / PNG / WEBP
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-text-muted bg-surface-overlay px-2.5 py-1 rounded-md">
              <FileText className="w-3.5 h-3.5" />
              PDF
            </span>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
