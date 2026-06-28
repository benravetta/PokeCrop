import { useCallback, useState, type ReactNode } from "react";
import { useDropzone } from "react-dropzone";
import { useAppStore } from "../hooks/useProcessing";
import { assessCapture } from "../lib/captureCoach";
import { Upload, FileImage, FileText, Loader2, HelpCircle } from "lucide-react";
import { SingleGradePromo } from "./SingleGradePromo";

export function UploadZone({
  onHelp,
  cropUsage,
}: {
  onHelp?: () => void;
  cropUsage?: ReactNode;
}) {
  const { upload, uploading, error } = useAppStore();
  const [coachTips, setCoachTips] = useState<string[]>([]);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (accepted.length === 0) return;
      const file = accepted[0];
      const tips = await assessCapture(file).catch(() => []);
      setCoachTips(tips.map((t) => t.message));
      upload(file);
    },
    [upload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
      "image/heic": [".heic"],
      "image/heif": [".heif"],
      "image/x-adobe-dng": [".dng"],
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
    disabled: uploading,
  });

  return (
    <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8 anim-rise">
          <h2 className="text-2xl font-semibold text-text-primary mb-2 tracking-tight">
            Let&apos;s crop your card
          </h2>
          <p className="text-text-secondary text-sm max-w-md mx-auto leading-relaxed">
            Drop in a scan or photo and we&apos;ll lift the frontmost card off its
            background — borders and rounded corners intact — as a clean
            transparent PNG.
          </p>
          <p className="text-text-muted text-xs max-w-md mx-auto leading-relaxed mt-2">
            Use the highest-quality image you have — full-resolution and sharp.
            We keep every pixel we can, so a crisp source means a crisp crop
            (and an accurate grade later).
          </p>
        </div>

        {cropUsage}

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
                ? "Uploading…"
                : isDragActive
                  ? "Drop it right here"
                  : "Drag & drop, or click to browse"}
            </p>
            <p className="text-text-muted text-xs mt-1">Up to 50 MB</p>
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

        {coachTips.length > 0 && !uploading && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <ul className="list-disc pl-4 space-y-1">
              {coachTips.map((tip, i) => (
                <li key={i} className="text-xs text-amber-200/90 leading-snug">
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        <SingleGradePromo className="mt-6" />

        {onHelp && (
          <div className="mt-5 text-center">
            <button
              onClick={onHelp}
              className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              New here? See how it works
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
