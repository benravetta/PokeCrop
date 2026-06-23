import http from "http";
import https from "https";
import dns from "dns";
import net from "net";
import ipaddr from "ipaddr.js";

// Guarded fetch for user-supplied image URLs. Blocks requests that resolve to
// private, loopback, link-local, unique-local (incl. Fly.io 6PN fdaa::/16),
// or cloud-metadata addresses, and re-validates every redirect hop.
//
// DNS-rebinding is closed: rather than validating with one DNS lookup and then
// letting the HTTP client re-resolve (a TOCTOU gap), we connect through a custom
// `lookup` that enforces the IP policy at socket-connect time. The socket only
// ever connects to an address we have just approved.

export const MAX_REMOTE_BYTES = 50 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 15_000;

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export class RemoteFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RemoteFetchError";
  }
}

// Allowlist approach: only globally-routable unicast addresses may be fetched.
// ipaddr.js classifies every address; anything that is not plain "unicast" —
// loopback, private, link-local, unique-local (incl. Fly.io 6PN fdaa::/16),
// CGNAT, multicast, reserved, IPv4-mapped/compat, teredo, 6to4, NAT64, ... — is
// rejected. This canonicalises all IPv6 forms (e.g. ::ffff:7f00:1) so dotted-
// and hex-mapped IPv4 cannot smuggle a private target past the filter.
function isBlockedIp(ip: string): boolean {
  let addr: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    addr = ipaddr.parse(ip);
  } catch {
    return true; // unparseable → treat as unsafe
  }
  if (addr.kind() === "ipv6") {
    const v6 = addr as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) addr = v6.toIPv4Address();
  }
  return addr.range() !== "unicast";
}

async function assertHostAllowed(hostname: string): Promise<void> {
  // URL.hostname keeps the brackets on IPv6 literals ("[::1]"); strip them so
  // the literal check below applies (literals never go through `lookup`).
  const host = hostname.replace(/^\[/, "").replace(/\]$/, "");
  // If the host is already an IP literal, check it directly.
  if (net.isIP(host)) {
    if (isBlockedIp(host)) {
      throw new RemoteFetchError("URL resolves to a disallowed address.");
    }
    return;
  }
  let records: { address: string }[];
  try {
    records = await dns.promises.lookup(host, { all: true });
  } catch {
    throw new RemoteFetchError("Could not resolve URL host.");
  }
  if (!records.length) throw new RemoteFetchError("Could not resolve URL host.");
  for (const r of records) {
    if (isBlockedIp(r.address)) {
      throw new RemoteFetchError("URL resolves to a disallowed address.");
    }
  }
}

export interface RemoteImage {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

// Custom DNS resolver used for the actual socket connection. It re-runs the
// policy at connect time and only ever hands back an approved address, so the
// connection cannot be rebound to an internal IP between validation and connect.
const safeLookup = ((
  hostname: string,
  options: dns.LookupAllOptions | dns.LookupOneOptions | ((...args: unknown[]) => void),
  callback?: (...args: unknown[]) => void
): void => {
  const cb = (typeof options === "function" ? options : callback) as (
    err: NodeJS.ErrnoException | null,
    address?: unknown,
    family?: number
  ) => void;
  const opts = (typeof options === "function" ? {} : options) as dns.LookupAllOptions;

  dns.lookup(hostname, { ...opts, all: true }, (err, addresses) => {
    if (err) return cb(err);
    const safe = (addresses as dns.LookupAddress[]).filter(
      (a) => !isBlockedIp(a.address)
    );
    if (!safe.length) {
      const blocked: NodeJS.ErrnoException = new RemoteFetchError(
        "URL resolves to a disallowed address."
      );
      blocked.code = "ENOTFOUND";
      return cb(blocked);
    }
    if (opts.all) cb(null, safe);
    else cb(null, safe[0].address, safe[0].family);
  });
}) as unknown as net.LookupFunction;

function requestOnce(url: URL): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      {
        method: "GET",
        lookup: safeLookup,
        timeout: FETCH_TIMEOUT_MS,
        headers: {
          Accept: "image/*,application/pdf",
          "User-Agent": "GemCheck/1.0 (+https://cardcrop.uk)",
        },
      },
      (res) => resolve(res)
    );
    req.on("timeout", () =>
      req.destroy(new RemoteFetchError("Remote fetch timed out."))
    );
    req.on("error", (err) =>
      reject(
        err instanceof RemoteFetchError
          ? err
          : new RemoteFetchError("Could not fetch image.")
      )
    );
    req.end();
  });
}

export async function fetchRemoteImage(rawUrl: string): Promise<RemoteImage> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new RemoteFetchError("Invalid image_url.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new RemoteFetchError("image_url must be http or https.");
  }

  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    // Friendly pre-check (clear error); the connect-time lookup is authoritative.
    await assertHostAllowed(current.hostname);

    const res = await requestOnce(current);
    const status = res.statusCode ?? 0;

    if (status >= 300 && status < 400) {
      res.resume(); // drain so the socket can be freed
      const location = res.headers.location;
      if (!location) throw new RemoteFetchError("Redirect without location.");
      current = new URL(location, current);
      if (current.protocol !== "http:" && current.protocol !== "https:") {
        throw new RemoteFetchError("Redirect to non-http(s) URL.");
      }
      continue;
    }

    if (status < 200 || status >= 300) {
      res.resume();
      throw new RemoteFetchError(`Could not fetch image (HTTP ${status}).`);
    }

    const contentType = (res.headers["content-type"] || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      res.resume();
      throw new RemoteFetchError(`Unsupported content-type: ${contentType || "unknown"}.`);
    }

    const declaredLength = Number(res.headers["content-length"] || "0");
    if (declaredLength > MAX_REMOTE_BYTES) {
      res.resume();
      throw new RemoteFetchError("Remote image exceeds the 50 MB limit.");
    }

    const buffer = await readCapped(res, MAX_REMOTE_BYTES);
    const filename = filenameFor(current, contentType);
    return { buffer, contentType, filename };
  }

  throw new RemoteFetchError("Too many redirects.");
}

function readCapped(res: http.IncomingMessage, max: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    res.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > max) {
        res.destroy();
        reject(new RemoteFetchError("Remote image exceeds the 50 MB limit."));
        return;
      }
      chunks.push(chunk);
    });
    res.on("end", () => resolve(Buffer.concat(chunks)));
    res.on("error", (err) =>
      reject(
        err instanceof RemoteFetchError
          ? err
          : new RemoteFetchError("Error reading remote image.")
      )
    );
  });
}

function filenameFor(url: URL, contentType: string): string {
  const fromPath = url.pathname.split("/").pop() || "";
  if (/\.(jpe?g|png|webp|pdf)$/i.test(fromPath)) return fromPath;
  const ext =
    contentType === "application/pdf"
      ? "pdf"
      : contentType === "image/png"
        ? "png"
        : contentType === "image/webp"
          ? "webp"
          : "jpg";
  return `remote.${ext}`;
}
