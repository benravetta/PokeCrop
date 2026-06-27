import { useCallback, useState } from "react";
import { Check, RotateCcw, Scissors, Upload } from "lucide-react";
import { CropEditor } from "../../../components/CropEditor";
import {
  cloneCorners,
  CropCorners,
  fromCornerArrays,
  toCornerArrays,
} from "../../../lib/cropGeometry";
import { ApiError } from "../../../lib/api";
import { apiFetch } from "../../../lib/sessionFetch";
import { cropUsageHeadline, cropUsageFromMe } from "../../../lib/planUsageDisplay";
import { useMe } from "../../../hooks/useMe";
import { CollectorButton, CollectorSection } from "../ui";

type CropMetadata = {
  crop_corners?: number[][];
  edit_image_size?: [number, number];
  edit_transform?: number[];
  estimated_corner_radius_px?: number;
  rotation_deg?: number;
};

const DEFAULT_PARAMS = {
  corner_radius: 0.5,
  crop_padding: 8,
  output_rotation: 0,
  output_size: "standard" as const,
};

function buildConfirmParams(
  metadata: CropMetadata | null,
  corners: CropCorners | null,
  _cropDirty: boolean
) {
  const params: Record<string, unknown> = { ...DEFAULT_PARAMS };
  if (corners) {
    params.manual_corners = toCornerArrays(corners);
    params.rotation_deg = metadata?.rotation_deg ?? 0;
    if (metadata?.edit_transform?.length === 9) {
      params.manual_transform = metadata.edit_transform;
    }
  }
  return params;
}

export function CropSideStep({
  publicCardId,
  role,
  title,
  description,
  required,
  confirmed,
  onConfirmed,
  onUnconfirm,
}: {
  publicCardId: string;
  role: "front" | "back";
  title: string;
  description?: string;
  required?: boolean;
  confirmed: boolean;
  onConfirmed: () => void;
  onUnconfirm?: () => void;
}) {
  const me = useMe((s) => s.me);
  const cropUsage = cropUsageFromMe(me);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const [editImageBase64, setEditImageBase64] = useState<string | null>(null);
  const [previewBase64, setPreviewBase64] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<CropMetadata | null>(null);
  const [editImageSize, setEditImageSize] = useState<[number, number] | null>(null);
  const [cropCorners, setCropCorners] = useState<CropCorners | null>(null);
  const [autoCropCorners, setAutoCropCorners] = useState<CropCorners | null>(null);
  const [cropDirty, setCropDirty] = useState(false);

  const setCorners = useCallback((corners: CropCorners) => {
    setCropCorners(corners);
    setCropDirty(true);
  }, []);

  const runProcess = async () => {
    setBusy("process");
    setError(null);
    try {
      const res = await apiFetch(`/api/collector/cards/${publicCardId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, params: DEFAULT_PARAMS }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Auto crop failed");
      }
      const data = await res.json();
      const meta = (data.metadata ?? {}) as CropMetadata;
      setMetadata(meta);
      setEditImageBase64(data.editImageJpeg ?? null);
      setPreviewBase64(data.previewBase64 ?? null);
      setEditImageSize(meta.edit_image_size ?? null);
      const parsed = fromCornerArrays(meta.crop_corners ?? []);
      const corners = parsed ? cloneCorners(parsed) : null;
      setCropCorners(corners);
      setAutoCropCorners(corners);
      setCropDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed");
    } finally {
      setBusy(null);
    }
  };

  const resetLocal = () => {
    setUploaded(false);
    setEditImageBase64(null);
    setPreviewBase64(null);
    setMetadata(null);
    setEditImageSize(null);
    setCropCorners(null);
    setAutoCropCorners(null);
    setCropDirty(false);
    setError(null);
  };

  const replacePhoto = () => {
    resetLocal();
    onUnconfirm?.();
  };

  const upload = async (file: File) => {
    setBusy("upload");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("role", role);
      const res = await apiFetch(`/api/collector/cards/${publicCardId}/images`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("Upload failed");
      setUploaded(true);
      await runProcess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  };

  const confirmCrop = async () => {
    setBusy("confirm");
    setError(null);
    try {
      const params = buildConfirmParams(metadata, cropCorners, cropDirty);
      const res = await apiFetch(`/api/collector/cards/${publicCardId}/crop/${role}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, params }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 402) {
          throw new ApiError(body.error ?? "Crop limit reached", 402, body);
        }
        throw new Error(body.error ?? "Could not confirm crop");
      }
      const data = await res.json();
      if (data.previewBase64) setPreviewBase64(data.previewBase64);
      setCropDirty(false);
      void useMe.getState().refresh();
      onConfirmed();
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Confirm failed");
      }
    } finally {
      setBusy(null);
    }
  };

  const resetCrop = () => {
    if (autoCropCorners) {
      setCropCorners(cloneCorners(autoCropCorners));
      setCropDirty(false);
    }
  };

  const canEdit =
    editImageBase64 &&
    editImageSize &&
    cropCorners &&
    editImageSize[0] > 0 &&
    editImageSize[1] > 0;

  return (
    <CollectorSection title={title} description={description}>
      {cropUsage && !cropUsage.unlimited && (
        <p className="mb-4 text-xs text-text-muted">{cropUsageHeadline(cropUsage)}</p>
      )}

      {!uploaded && !confirmed && (
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle bg-surface px-4 py-10 text-center transition hover:border-accent/40">
          <Upload className="h-8 w-8 text-text-muted" />
          <span className="mt-3 text-sm font-medium text-text-primary">
            {role === "front" ? "Drop front photo" : "Drop back photo"}
          </span>
          <span className="mt-1 text-xs text-text-muted">
            {required ? "Required to publish" : "Optional"}
          </span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
        </label>
      )}

      {canEdit && (
        <div className="relative min-h-[320px] overflow-hidden rounded-xl bg-surface-overlay">
          <CropEditor
            imageSrc={`data:image/jpeg;base64,${editImageBase64}`}
            imageWidth={editImageSize![0]}
            imageHeight={editImageSize![1]}
            corners={cropCorners!}
            cornerRadiusPx={metadata?.estimated_corner_radius_px ?? 8}
            onChange={setCorners}
          />
        </div>
      )}

      {previewBase64 && !canEdit && (
        <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-overlay p-3">
          <img
            src={`data:image/png;base64,${previewBase64}`}
            alt={`${role} preview`}
            className="mx-auto max-h-80 object-contain"
            draggable={false}
          />
        </div>
      )}

      {(uploaded || confirmed) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {!confirmed && canEdit && (
            <>
              <CollectorButton variant="secondary" onClick={resetCrop} disabled={!!busy}>
                <RotateCcw className="h-4 w-4" />
                Reset
              </CollectorButton>
              <CollectorButton
                loading={busy === "confirm"}
                onClick={() => void confirmCrop()}
                disabled={!!busy}
              >
                <Check className="h-4 w-4" />
                Confirm crop
              </CollectorButton>
            </>
          )}
          {!confirmed && !canEdit && uploaded && (
            <CollectorButton
              variant="secondary"
              loading={busy === "process"}
              onClick={() => void runProcess()}
            >
              <Scissors className="h-4 w-4" />
              Detect crop
            </CollectorButton>
          )}
          {confirmed && (
            <>
              <p className="text-sm text-success">Crop confirmed</p>
              <CollectorButton variant="secondary" onClick={replacePhoto} disabled={!!busy}>
                <Upload className="h-4 w-4" />
                Replace photo
              </CollectorButton>
            </>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-error">{error}</p>}
    </CollectorSection>
  );
}
