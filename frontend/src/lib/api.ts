const BASE = "/api";

export interface ProcessParams {
  edge_sensitivity: number;
  contour_threshold: number;
  crop_padding: number;
  top_edge_cleanup: number;
  corner_radius: number;
  rotate_correction: boolean;
  manual_corners?: number[][];
  rotation_deg?: number;
}

export interface UploadResult {
  sessionId: string;
  filename: string;
  originalBase64: string;
}

export interface ProcessResult {
  result_web_png: string;
  overlay_png: string;
  edit_image_jpeg?: string;
  metadata: {
    bbox: number[];
    confidence: number;
    estimated_corner_radius_px: number;
    rotation_deg: number;
    candidates_found: number;
    selected_candidate_index: number;
    pipeline_time_ms: number;
    crop_corners?: number[][];
    edit_image_size?: [number, number];
    score_breakdown: Record<string, number>;
  };
  error?: string;
  candidates_found?: number;
}

export async function uploadFile(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${BASE}/upload`, { method: "POST", body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Upload failed: ${res.statusText}`);
  }
  return res.json();
}

export async function processImage(
  sessionId: string,
  params: ProcessParams
): Promise<ProcessResult> {
  const res = await fetch(`${BASE}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, params }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Processing failed: ${res.statusText}`);
  }
  return res.json();
}

export async function deleteSession(sessionId: string): Promise<void> {
  await fetch(`${BASE}/session/${sessionId}`, { method: "DELETE" });
}

export function exportUrl(sessionId: string, size: "original" | "web"): string {
  return `${BASE}/export/${sessionId}?size=${size}`;
}
