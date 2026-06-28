import { create } from "zustand";
import {
  uploadFile,
  processImage,
  confirmCrop as apiConfirmCrop,
  deleteSession,
  ApiError,
  ProcessParams,
  ProcessResult,
} from "../lib/api";
import {
  cloneCorners,
  CropCorners,
  fromCornerArrays,
  toCornerArrays,
} from "../lib/cropGeometry";
import { useMe } from "./useMe";

export type GradePrefillPayload = {
  front: { pngBase64: string; filename: string };
  back?: { pngBase64: string; filename: string };
};

export interface AppState {
  sessionId: string | null;
  filename: string | null;
  originalBase64: string | null;
  editImageBase64: string | null;
  resultBase64: string | null;
  metadata: ProcessResult["metadata"] | null;
  cropCorners: CropCorners | null;
  autoCropCorners: CropCorners | null;
  // Corners that produced the currently displayed result, used to revert
  // unapplied edits when the user cancels the crop editor.
  appliedCropCorners: CropCorners | null;
  editImageSize: [number, number] | null;
  // 3x3 row-major homography mapping the current edit-preview's pixels back to
  // the original image, so manual corner edits can be re-warped at full res.
  editTransform: number[] | null;
  cropDirty: boolean;
  error: string | null;
  // Set when the daily free-crop limit is hit (drives the upgrade prompt).
  limitReached: boolean;
  uploading: boolean;
  processing: boolean;
  params: ProcessParams;
  // Snapshot of the params used for the most recent successful process, so the
  // UI can tell when the current settings differ and surface an "Apply" action.
  appliedParams: ProcessParams | null;

  // Hand-off payload for "Send to grading": cropped card PNGs (no data: prefix),
  // consumed once by the grade page on mount.
  gradePrefill: GradePrefillPayload | null;
  historyEventId: number | null;
  cropConfirmed: boolean;
  confirmBusy: boolean;

  upload: (file: File) => Promise<void>;
  process: () => Promise<void>;
  confirmCrop: () => Promise<void>;
  setCropCorners: (corners: CropCorners) => void;
  resetCrop: () => void;
  revertCrop: () => void;
  setParam: <K extends keyof ProcessParams>(key: K, value: ProcessParams[K]) => void;
  rotateOutput: (deltaDeg: number) => void;
  resetParams: () => void;
  clearLimit: () => void;
  setGradePrefill: (p: GradePrefillPayload) => void;
  clearGradePrefill: () => void;
  reset: () => void;
}

const DEFAULT_PARAMS: ProcessParams = {
  corner_radius: 0.5,
  crop_padding: 8,
  output_rotation: 0,
  output_size: "standard",
};

function buildProcessParams(
  params: ProcessParams,
  cropCorners: CropCorners | null,
  cropDirty: boolean,
  metadata: ProcessResult["metadata"] | null,
  editTransform: number[] | null
): ProcessParams {
  const payload: ProcessParams = { ...params };
  if (cropDirty && cropCorners) {
    payload.manual_corners = toCornerArrays(cropCorners);
    payload.rotation_deg = metadata?.rotation_deg ?? 0;
    // Corners are in the rectified edit-preview space; pair them with the
    // homography that maps that space back to the original image.
    if (editTransform && editTransform.length === 9) {
      payload.manual_transform = editTransform;
    }
  }
  return payload;
}

export const useAppStore = create<AppState>((set, get) => ({
  sessionId: null,
  filename: null,
  originalBase64: null,
  editImageBase64: null,
  resultBase64: null,
  metadata: null,
  cropCorners: null,
  autoCropCorners: null,
  appliedCropCorners: null,
  editImageSize: null,
  editTransform: null,
  cropDirty: false,
  error: null,
  limitReached: false,
  uploading: false,
  processing: false,
  params: { ...DEFAULT_PARAMS },
  appliedParams: null,
  gradePrefill: null,
  historyEventId: null,
  cropConfirmed: false,
  confirmBusy: false,

  upload: async (file: File) => {
    set({
      uploading: true,
      error: null,
      editImageBase64: null,
      resultBase64: null,
      metadata: null,
      cropCorners: null,
      autoCropCorners: null,
      appliedCropCorners: null,
      editImageSize: null,
      editTransform: null,
      cropDirty: false,
      historyEventId: null,
      cropConfirmed: false,
    });
    try {
      const result = await uploadFile(file);
      set({
        sessionId: result.sessionId,
        filename: result.filename,
        originalBase64: result.originalBase64,
        uploading: false,
      });
      try {
        await get().process();
      } catch (procErr: unknown) {
        const msg = procErr instanceof Error ? procErr.message : "Processing failed";
        set({ processing: false, error: msg });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      set({ uploading: false, error: msg });
    }
  },

  process: async () => {
    const { sessionId, params, cropCorners, cropDirty, metadata, editTransform } = get();
    if (!sessionId) return;

    set({ processing: true, error: null });
    try {
      const payload = buildProcessParams(params, cropCorners, cropDirty, metadata, editTransform);
      const result = await processImage(sessionId, payload);
      if (result.error) {
        set({ processing: false, error: result.error });
        return;
      }

      const parsedCorners = fromCornerArrays(result.metadata.crop_corners ?? []);
      const corners = parsedCorners ? cloneCorners(parsedCorners) : null;

      set({
        processing: false,
        editImageBase64: result.edit_image_jpeg ?? null,
        resultBase64: result.result_web_png,
        metadata: result.metadata,
        editImageSize: result.metadata.edit_image_size ?? null,
        editTransform: result.metadata.edit_transform ?? null,
        cropCorners: corners,
        autoCropCorners: get().autoCropCorners ?? corners,
        appliedCropCorners: corners ? cloneCorners(corners) : null,
        cropDirty: false,
        appliedParams: { ...params },
        historyEventId: result.historyEventId ?? get().historyEventId,
        cropConfirmed: Boolean(result.confirmed),
      });

      // Keep the remaining-crops indicator fresh after a metered crop.
      void useMe.getState().refresh();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 402) {
        set({
          processing: false,
          limitReached: true,
          error: err.message,
        });
        void useMe.getState().refresh();
        return;
      }
      const msg = err instanceof Error ? err.message : "Processing failed";
      set({ processing: false, error: msg });
    }
  },

  confirmCrop: async () => {
    const { sessionId } = get();
    if (!sessionId || get().confirmBusy) return;
    set({ confirmBusy: true, error: null });
    try {
      const result = await apiConfirmCrop(sessionId);
      set({
        confirmBusy: false,
        cropConfirmed: Boolean(result.confirmed),
        historyEventId: result.historyEventId ?? get().historyEventId,
      });
      void useMe.getState().refresh();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 402) {
        set({
          confirmBusy: false,
          limitReached: true,
          error: err.message,
        });
        void useMe.getState().refresh();
        return;
      }
      const msg = err instanceof Error ? err.message : "Could not confirm crop";
      set({ confirmBusy: false, error: msg });
    }
  },

  setCropCorners: (corners) => {
    set({ cropCorners: cloneCorners(corners), cropDirty: true });
  },

  resetCrop: () => {
    const { autoCropCorners } = get();
    if (!autoCropCorners) return;
    set({ cropCorners: cloneCorners(autoCropCorners), cropDirty: false });
    void get().process();
  },

  revertCrop: () => {
    const { appliedCropCorners } = get();
    if (!appliedCropCorners) {
      set({ cropDirty: false });
      return;
    }
    set({ cropCorners: cloneCorners(appliedCropCorners), cropDirty: false });
  },

  setParam: (key, value) => {
    set((s) => ({ params: { ...s.params, [key]: value } }));
  },

  // Manual orientation nudge in 90-degree steps. Applies on top of auto-orient
  // and re-processes immediately (re-processing a session never costs a crop).
  rotateOutput: (deltaDeg) => {
    const cur = get().params.output_rotation ?? 0;
    const next = (((cur + deltaDeg) % 360) + 360) % 360;
    set((s) => ({ params: { ...s.params, output_rotation: next } }));
    void get().process();
  },

  resetParams: () => {
    set({ params: { ...DEFAULT_PARAMS } });
  },

  clearLimit: () => set({ limitReached: false }),

  setGradePrefill: (p) => set({ gradePrefill: p }),

  clearGradePrefill: () => set({ gradePrefill: null }),

  reset: () => {
    const { sessionId } = get();
    if (sessionId) {
      deleteSession(sessionId).catch(() => {});
    }
    set({
      sessionId: null,
      filename: null,
      originalBase64: null,
      editImageBase64: null,
      resultBase64: null,
      metadata: null,
      cropCorners: null,
      autoCropCorners: null,
      appliedCropCorners: null,
      editImageSize: null,
      editTransform: null,
      cropDirty: false,
      error: null,
      limitReached: false,
      uploading: false,
      processing: false,
      params: { ...DEFAULT_PARAMS },
      appliedParams: null,
      historyEventId: null,
      cropConfirmed: false,
    });
  },
}));

export const PROCESS_PARAM_KEYS: (keyof ProcessParams)[] = [
  "corner_radius",
  "crop_padding",
  "output_rotation",
  "output_size",
];

export function paramsDiffer(
  a: ProcessParams | null,
  b: ProcessParams | null
): boolean {
  if (!a || !b) return false;
  return PROCESS_PARAM_KEYS.some((k) => a[k] !== b[k]);
}
