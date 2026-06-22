import fs from "fs";

const PYTHON_URL = process.env.PYTHON_URL || "http://localhost:5001";
const PYTHON_TIMEOUT_MS = parseInt(process.env.PYTHON_TIMEOUT_MS || "120000", 10);

if (!/^https?:\/\/localhost[:/]/.test(PYTHON_URL) && !PYTHON_URL.startsWith("http://127.0.0.1")) {
  console.warn(`WARNING: PYTHON_URL (${PYTHON_URL}) is not localhost — ensure this is intentional`);
}

export async function sendToPython(
  filePath: string,
  filename: string,
  params: Record<string, unknown>
): Promise<Record<string, any>> {
  const fileBuffer = await fs.promises.readFile(filePath);
  const blob = new Blob([fileBuffer]);

  const formData = new FormData();
  formData.append("image", blob, filename);
  formData.append("params", JSON.stringify(params));

  const response = await fetch(`${PYTHON_URL}/process`, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(PYTHON_TIMEOUT_MS),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Python service error (${response.status}): ${text}`);
  }

  const data = await response.json();
  if (typeof data !== "object" || data === null) {
    throw new Error("Python service returned invalid response");
  }
  return data as Record<string, any>;
}

// Decode any supported upload (incl. HEIC/HEIF) and return it re-encoded as a
// plain JPEG buffer. Used to normalise phone formats that the OpenAI vision API
// cannot read directly. No cropping is applied.
export async function transcodeViaPython(
  buffer: Buffer,
  filename: string
): Promise<Buffer> {
  const formData = new FormData();
  formData.append("image", new Blob([new Uint8Array(buffer)]), filename || "image");

  const response = await fetch(`${PYTHON_URL}/transcode`, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(PYTHON_TIMEOUT_MS),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Python transcode error (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { jpeg?: string };
  if (!data.jpeg) throw new Error("Python transcode returned no image");
  return Buffer.from(data.jpeg, "base64");
}
