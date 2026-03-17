import { create } from "zustand";
import {
  uploadFile,
  processImage,
  deleteSession,
  ProcessParams,
  ProcessResult,
} from "../lib/api";

export interface AppState {
  sessionId: string | null;
  filename: string | null;
  originalBase64: string | null;
  overlayBase64: string | null;
  resultBase64: string | null;
  metadata: ProcessResult["metadata"] | null;
  error: string | null;
  uploading: boolean;
  processing: boolean;
  params: ProcessParams;

  upload: (file: File) => Promise<void>;
  process: () => Promise<void>;
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

export const useAppStore = create<AppState>((set, get) => ({
  sessionId: null,
  filename: null,
  originalBase64: null,
  overlayBase64: null,
  resultBase64: null,
  metadata: null,
  error: null,
  uploading: false,
  processing: false,
  params: { ...DEFAULT_PARAMS },

  upload: async (file: File) => {
    set({ uploading: true, error: null, overlayBase64: null, resultBase64: null, metadata: null });
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
        set({ error: msg });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      set({ uploading: false, error: msg });
    }
  },

  process: async () => {
    const { sessionId, params } = get();
    if (!sessionId) return;

    set({ processing: true, error: null });
    try {
      const result = await processImage(sessionId, params);
      if (result.error) {
        set({ processing: false, error: result.error });
        return;
      }
      set({
        processing: false,
        overlayBase64: result.overlay_png,
        resultBase64: result.result_web_png,
        metadata: result.metadata,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Processing failed";
      set({ processing: false, error: msg });
    }
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
      overlayBase64: null,
      resultBase64: null,
      metadata: null,
      error: null,
      uploading: false,
      processing: false,
      params: { ...DEFAULT_PARAMS },
    });
  },
}));
