/** Client-side heuristics to catch bad photos before upload. */

export type CaptureCoachIssue = {
  code: "blur" | "resolution" | "brightness";
  message: string;
};

const MIN_LONG_EDGE = 900;
const MIN_LAPLACIAN_VAR = 80;

function loadToCanvas(file: File, maxDim = 640): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("could not read image"));
    };
    img.src = url;
  });
}

function laplacianVariance(data: Uint8ClampedArray, w: number, h: number): number {
  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const c = gray[y * w + x];
      const lap =
        gray[(y - 1) * w + x] +
        gray[(y + 1) * w + x] +
        gray[y * w + (x - 1)] +
        gray[y * w + (x + 1)] -
        4 * c;
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

export async function assessCapture(file: File): Promise<CaptureCoachIssue[]> {
  const issues: CaptureCoachIssue[] = [];

  try {
    const canvas = await loadToCanvas(file);
    const w = canvas.width;
    const h = canvas.height;
    if (Math.max(w, h) < MIN_LONG_EDGE * 0.45) {
      issues.push({
        code: "resolution",
        message: "This photo looks small. Use your camera's full resolution if you can.",
      });
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return issues;
    const { data } = ctx.getImageData(0, 0, w, h);
    const sharp = laplacianVariance(data, w, h);
    if (sharp < MIN_LAPLACIAN_VAR) {
      issues.push({
        code: "blur",
        message: "The photo looks soft or blurry. Hold steady and tap to focus, then retake.",
      });
    }

    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    const mean = sum / (data.length / 4);
    if (mean < 35) {
      issues.push({
        code: "brightness",
        message: "The photo is very dark. Add light so the card edges are visible.",
      });
    } else if (mean > 230) {
      issues.push({
        code: "brightness",
        message: "The photo looks overexposed. Reduce glare and avoid blowing out the card.",
      });
    }
  } catch {
    // Non-fatal — server-side assess still runs.
  }

  return issues;
}
