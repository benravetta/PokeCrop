import { AwsClient } from "aws4fetch";

// Cloudflare R2 over its S3-compatible API. The Fly backend authenticates with
// an R2 S3 access key (not a Workers binding). All of these must be set for
// archiving to activate; otherwise it is a safe no-op.
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID || "";
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const BUCKET = process.env.R2_BUCKET || "";

export function isR2Configured(): boolean {
  return Boolean(ACCOUNT_ID && ACCESS_KEY && SECRET_KEY && BUCKET);
}

let client: AwsClient | null = null;
function getClient(): AwsClient {
  if (!client) {
    client = new AwsClient({
      accessKeyId: ACCESS_KEY,
      secretAccessKey: SECRET_KEY,
      service: "s3",
      region: "auto",
    });
  }
  return client;
}

// Path-style object URL: https://<acct>.r2.cloudflarestorage.com/<bucket>/<key>
function objectUrl(key: string): string {
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  return `https://${ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET}/${encoded}`;
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const res = await getClient().fetch(objectUrl(key), {
    method: "PUT",
    // undici/aws4fetch accept a Buffer at runtime; cast to satisfy BodyInit.
    body: body as unknown as BodyInit,
    headers: { "Content-Type": contentType },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`R2 put failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

export interface R2Object {
  body: Buffer;
  contentType: string;
}

// Presigned GET URL so a browser <img> can load a private object directly
// from R2 for a limited window, without proxying bytes through the backend.
export async function signedGetUrl(key: string, expiresSeconds = 900): Promise<string | null> {
  if (!isR2Configured()) return null;
  const url = new URL(objectUrl(key));
  url.searchParams.set("X-Amz-Expires", String(expiresSeconds));
  const signed = await getClient().sign(url.toString(), {
    method: "GET",
    aws: { signQuery: true },
  });
  return signed.url;
}

export async function getObject(key: string): Promise<R2Object | null> {
  const res = await getClient().fetch(objectUrl(key), { method: "GET" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 get failed (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    body: buf,
    contentType: res.headers.get("content-type") || "application/octet-stream",
  };
}
