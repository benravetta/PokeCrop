import { create } from "zustand";
import {
  uploadFile,
  processImage,
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

  upload: (file: File) => Promise<void>;
  process: () => Promise<void>;
  setCropCorners: (corners: CropCorners) => void;
  resetCrop: () => void;
  revertCrop: () => void;
  setParam: <K extends keyof ProcessParams>(key: K, value: ProcessParams[K]) => void;
  resetParams: () => void;
  clearLimit: () => void;
  reset: () => void;
}

const DEFAULT_PARAMS: ProcessParams = {
  edge_sensitivity: 0.5,
  contour_threshold: 0.5,
  crop_padding: 0,
  edge_trim: 0,
  bg_removal: 0,
  top_edge_cleanup: 0.7,
  corner_radius: 0.5,
  rotate_correction: true,
};

function buildProcessParams(
  params: ProcessParams,
  cropCorners: CropCorners | null,
  cropDirty: boolean,
  metadata: ProcessResult["metadata"] | null
): ProcessParams {
  const payload: ProcessParams = { ...params };
  if (cropDirty && cropCorners) {
    payload.manual_corners = toCornerArrays(cropCorners);
    payload.rotation_deg = metadata?.rotation_deg ?? 0;
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
  cropDirty: false,
  error: null,
  limitReached: false,
  uploading: false,
  processing: false,
  params: { ...DEFAULT_PARAMS },
  appliedParams: null,

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
      cropDirty: false,
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
    const { sessionId, params, cropCorners, cropDirty, metadata } = get();
    if (!sessionId) return;

    set({ processing: true, error: null });
    try {
      const payload = buildProcessParams(params, cropCorners, cropDirty, metadata);
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
        cropCorners: corners,
        autoCropCorners: get().autoCropCorners ?? corners,
        appliedCropCorners: corners ? cloneCorners(corners) : null,
        cropDirty: false,
        appliedParams: { ...params },
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

  resetParams: () => {
    set({ params: { ...DEFAULT_PARAMS } });
  },

  clearLimit: () => set({ limitReached: false }),

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
      cropDirty: false,
      error: null,
      limitReached: false,
      uploading: false,
      processing: false,
      params: { ...DEFAULT_PARAMS },
      appliedParams: null,
    });
  },
}));

export const PROCESS_PARAM_KEYS: (keyof ProcessParams)[] = [
  "edge_sensitivity",
  "contour_threshold",
  "crop_padding",
  "edge_trim",
  "bg_removal",
  "top_edge_cleanup",
  "corner_radius",
  "rotate_correction",
];

export function paramsDiffer(
  a: ProcessParams | null,
  b: ProcessParams | null
): boolean {
  if (!a || !b) return false;
  return PROCESS_PARAM_KEYS.some((k) => a[k] !== b[k]);
}
