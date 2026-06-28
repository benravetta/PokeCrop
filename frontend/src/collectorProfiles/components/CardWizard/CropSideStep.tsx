import { useCallback, useState } from "react";
import { ArrowRight, Check, RotateCcw, Upload } from "lucide-react";
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
import { CollectorProcessingStage } from "../CollectorProcessingStage";

type CropMetadata = {
  crop_corners?: number[][];
  corners?: number[][];
  edit_image_size?: [number, number];
  edit_transform?: number[];
  estimated_corner_radius_px?: number;
  rotation_deg?: number;
  needs_manual?: boolean;
};

type FlowPhase =
  | "pick"
  | "uploading"
  | "processing"
  | "confirming"
  | "preview"
  | "manual"
  | "confirmed";

const DEFAULT_PARAMS = {
  corner_radius: 0.5,
  crop_padding: 8,
  output_rotation: 0,
  output_size: "standard" as const,
};

function cornersFromMetadata(meta: CropMetadata | null): CropCorners | null {
  if (!meta) return null;
  const parsed = fromCornerArrays(meta.crop_corners ?? meta.corners ?? []);
  return parsed ? cloneCorners(parsed) : null;
}

function buildConfirmParams(
  metadata: CropMetadata | null,
  corners: CropCorners | null,
  cropDirty: boolean
) {
  const params: Record<string, unknown> = { ...DEFAULT_PARAMS };
  const useCorners = cropDirty ? corners : (corners ?? cornersFromMetadata(metadata));
  if (useCorners) {
    params.manual_corners = toCornerArrays(useCorners);
    params.rotation_deg = metadata?.rotation_deg ?? 0;
    if (metadata?.edit_transform?.length === 9) {
      params.manual_transform = metadata.edit_transform;
    }
  }
  return params;
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function CropSideStep({
  publicCardId,
  role,
  title,
  description,
  required,
  confirmed,
  existingDisplayUrl,
  onConfirmed,
  onUnconfirm,
}: {
  publicCardId: string;
  role: "front" | "back";
  title: string;
  description?: string;
  required?: boolean;
  confirmed: boolean;
  existingDisplayUrl?: string | null;
  onConfirmed: () => void;
  onUnconfirm?: () => void;
}) {
  const me = useMe((s) => s.me);
  const cropUsage = cropUsageFromMe(me);
  const [phase, setPhase] = useState<FlowPhase>(confirmed ? "confirmed" : "pick");
  const [error, setError] = useState<string | null>(null);
  const [editImageBase64, setEditImageBase64] = useState<string | null>(null);
  const [previewBase64, setPreviewBase64] = useState<string | null>(null);
  const [displayUrl, setDisplayUrl] = useState<string | null>(existingDisplayUrl ?? null);
  const [metadata, setMetadata] = useState<CropMetadata | null>(null);
  const [editImageSize, setEditImageSize] = useState<[number, number] | null>(null);
  const [cropCorners, setCropCorners] = useState<CropCorners | null>(null);
  const [autoCropCorners, setAutoCropCorners] = useState<CropCorners | null>(null);
  const [cropDirty, setCropDirty] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const setCorners = useCallback((corners: CropCorners) => {
    setCropCorners(corners);
    setCropDirty(true);
  }, []);

  const runProcess = async () => {
    const res = await apiFetch(`/api/collector/cards/${publicCardId}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, params: DEFAULT_PARAMS }),
    });
    if (!res.ok) {
      throw new Error(await readApiError(res, "Could not prepare your card photo"));
    }
    const data = await res.json();
    const meta = (data.metadata ?? {}) as CropMetadata;
    const editImageJpeg = (data.editImageJpeg as string | null | undefined) ?? null;
    const preview = (data.previewBase64 as string | null | undefined) ?? null;
    const size = meta.edit_image_size ?? null;
    const corners = cornersFromMetadata(meta);
    const needsManual = Boolean(data.needsManual ?? meta.needs_manual);

    setMetadata(meta);
    setEditImageBase64(editImageJpeg);
    setPreviewBase64(preview);
    setEditImageSize(size);
    setCropCorners(corners);
    setAutoCropCorners(corners);
    setCropDirty(false);

    return { needsManual, editImageJpeg, preview, size, corners, meta };
  };

  const confirmCrop = async (opts?: {
    metadata?: CropMetadata | null;
    corners?: CropCorners | null;
    cropDirty?: boolean;
  }) => {
    const params = buildConfirmParams(
      opts?.metadata ?? metadata,
      opts?.corners ?? cropCorners,
      opts?.cropDirty ?? cropDirty
    );
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
      throw new Error(body.error ?? "Could not add this card to your collection");
    }
    const data = await res.json();
    if (data.previewBase64) setPreviewBase64(data.previewBase64);
    const image = data.image as { displayUrl?: string | null } | undefined;
    if (image?.displayUrl) setDisplayUrl(image.displayUrl);
    setCropDirty(false);
    void useMe.getState().refresh();
  };

  const resetLocal = () => {
    setPhase("pick");
    setEditImageBase64(null);
    setPreviewBase64(null);
    setDisplayUrl(null);
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
    setError(null);
    setPhase("uploading");
    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("role", role);
      const res = await apiFetch(`/api/collector/cards/${publicCardId}/images`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        throw new Error(await readApiError(res, "Upload failed"));
      }

      setPhase("processing");
      const processed = await runProcess();

      const manualNeeded =
        processed.needsManual &&
        processed.editImageJpeg &&
        processed.size &&
        processed.corners &&
        processed.size[0] > 0 &&
        processed.size[1] > 0;

      if (manualNeeded) {
        setPhase("manual");
        return;
      }

      setPhase("confirming");
      await confirmCrop({
        metadata: processed.meta,
        corners: processed.corners,
        cropDirty: false,
      });
      setPhase("preview");
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
      setPhase("pick");
    }
  };

  const finishManualCrop = async () => {
    setConfirmBusy(true);
    setError(null);
    setPhase("confirming");
    try {
      await confirmCrop();
      setPhase("preview");
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Could not confirm crop");
      }
      setPhase("manual");
    } finally {
      setConfirmBusy(false);
    }
  };

  const resetCrop = () => {
    if (autoCropCorners) {
      setCropCorners(cloneCorners(autoCropCorners));
      setCropDirty(false);
    }
  };

  const previewSrc =
    displayUrl ??
    (previewBase64 ? `data:image/png;base64,${previewBase64}` : null);

  const canEdit =
    editImageBase64 &&
    editImageSize &&
    cropCorners &&
    editImageSize[0] > 0 &&
    editImageSize[1] > 0;

  const busyPhase = phase === "uploading" || phase === "processing" || phase === "confirming";

  return (
    <CollectorSection title={title} description={description}>
      {cropUsage && !cropUsage.unlimited && (
        <p className="mb-4 text-xs text-text-muted">{cropUsageHeadline(cropUsage)}</p>
      )}

      {phase === "pick" && !confirmed && (
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle bg-surface px-4 py-10 text-center transition hover:border-accent/40">
          <Upload className="h-8 w-8 text-text-muted" />
          <span className="mt-3 text-sm font-medium text-text-primary">
            {role === "front" ? "Drop front photo" : "Drop back photo"}
          </span>
          <span className="mt-1 text-xs text-text-muted">
            {required ? "Required to publish · we crop it for you" : "Optional"}
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

      {busyPhase && (
        <CollectorProcessingStage
          phase={
            phase === "uploading"
              ? "uploading"
              : phase === "confirming"
                ? "confirming"
                : "processing"
          }
          label={
            phase === "uploading"
              ? role === "front"
                ? "Uploading front photo…"
                : "Uploading back photo…"
              : phase === "confirming"
                ? "Adding to your collection…"
                : undefined
          }
        />
      )}

      {phase === "manual" && canEdit && (
        <>
          <p className="mb-3 text-sm text-amber-200/90">
            We couldn&apos;t clearly see every edge. Drag the corners to line them up, then confirm.
          </p>
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
          <div className="mt-4 flex flex-wrap gap-2">
            <CollectorButton variant="secondary" onClick={resetCrop} disabled={confirmBusy}>
              <RotateCcw className="h-4 w-4" />
              Reset
            </CollectorButton>
            <CollectorButton loading={confirmBusy} onClick={() => void finishManualCrop()}>
              <Check className="h-4 w-4" />
              Confirm crop
            </CollectorButton>
          </div>
        </>
      )}

      {(phase === "preview" || phase === "confirmed") && (
        <div className="space-y-4">
          {previewSrc ? (
            <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-overlay p-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-text-muted">
                {role === "front" ? "Front · showcase preview" : "Back · showcase preview"}
              </p>
              <img
                src={previewSrc}
                alt={`${role} preview`}
                className="mx-auto max-h-80 object-contain"
                draggable={false}
              />
            </div>
          ) : phase === "confirmed" ? (
            <p className="text-sm text-text-secondary">Photo confirmed for your collection.</p>
          ) : null}
          {phase === "preview" && (
            <>
              <p className="text-sm text-text-secondary">
                {role === "front"
                  ? "This is how visitors will see the front of your card. Continue to review autofill and add details."
                  : "Back photo cropped. Continue to choose sections and publish."}
              </p>
              <CollectorButton onClick={() => onConfirmed()}>
                Looks good
                <ArrowRight className="h-4 w-4" />
              </CollectorButton>
            </>
          )}
          {phase === "confirmed" && (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-success">Crop confirmed</p>
              <CollectorButton variant="secondary" onClick={replacePhoto}>
                <Upload className="h-4 w-4" />
                Replace photo
              </CollectorButton>
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-error">{error}</p>}
    </CollectorSection>
  );
}
