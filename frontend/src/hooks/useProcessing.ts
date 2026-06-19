import { create } from "zustand";
import {
  uploadFile,
  processImage,
  deleteSession,
  ProcessParams,
  ProcessResult,
} from "../lib/api";
import {
  cloneCorners,
  CropCorners,
  fromCornerArrays,
  toCornerArrays,
} from "../lib/cropGeometry";

export interface AppState {
  sessionId: string | null;
  filename: string | null;
  originalBase64: string | null;
  editImageBase64: string | null;
  overlayBase64: string | null;
  resultBase64: string | null;
  metadata: ProcessResult["metadata"] | null;
  cropCorners: CropCorners | null;
  autoCropCorners: CropCorners | null;
  editImageSize: [number, number] | null;
  cropDirty: boolean;
  error: string | null;
  uploading: boolean;
  processing: boolean;
  params: ProcessParams;

  upload: (file: File) => Promise<void>;
  process: () => Promise<void>;
  setCropCorners: (corners: CropCorners) => void;
  resetCrop: () => void;
  setParam: <K extends keyof ProcessParams>(key: K, value: ProcessParams[K]) => void;
  resetParams: () => void;
  reset: () => void;
}

const DEFAULT_PARAMS: ProcessParams = {
  edge_sensitivity: 0.5,
  contour_threshold: 0.5,
  crop_padding: 0,
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
  overlayBase64: null,
  resultBase64: null,
  metadata: null,
  cropCorners: null,
  autoCropCorners: null,
  editImageSize: null,
  cropDirty: false,
  error: null,
  uploading: false,
  processing: false,
  params: { ...DEFAULT_PARAMS },

  upload: async (file: File) => {
    set({
      uploading: true,
      error: null,
      overlayBase64: null,
      editImageBase64: null,
      resultBase64: null,
      metadata: null,
      cropCorners: null,
      autoCropCorners: null,
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
        overlayBase64: result.overlay_png,
        editImageBase64: result.edit_image_jpeg ?? null,
        resultBase64: result.result_web_png,
        metadata: result.metadata,
        editImageSize: result.metadata.edit_image_size ?? null,
        cropCorners: corners,
        autoCropCorners: get().autoCropCorners ?? corners,
        cropDirty: false,
      });
    } catch (err: unknown) {
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

  setParam: (key, value) => {
    set((s) => ({ params: { ...s.params, [key]: value } }));
  },

  resetParams: () => {
    set({ params: { ...DEFAULT_PARAMS } });
  },

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
      overlayBase64: null,
      resultBase64: null,
      metadata: null,
      cropCorners: null,
      autoCropCorners: null,
      editImageSize: null,
      cropDirty: false,
      error: null,
      uploading: false,
      processing: false,
      params: { ...DEFAULT_PARAMS },
    });
  },
}));
