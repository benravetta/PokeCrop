/**
 * Shared GemCheck email layout + body components.
 * Used by build-templates.mjs and mirrored in backend/src/lib/gemcheckEmail.ts.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

export function readLayoutHtml() {
  return fs.readFileSync(path.join(ROOT, "partials/layout.html"), "utf8");
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function minifyHtml(html) {
  return html
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, "")
    .replace(/>\s+</g, "><")
    .trim();
}

export function wrapEmailBody(content, preheader, layout = readLayoutHtml()) {
  const html = layout
    .replace("{{PREHEADER}}", escapeHtml(preheader))
    .replace("{{CONTENT}}", content.trim());
  return minifyHtml(html);
}

export function emailHeading(text) {
  return `<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;line-height:1.3;color:#13151e;">${escapeHtml(text)}</h1>`;
}

export function emailParagraph(html) {
  return `<p style="margin:0 0 16px;color:#5e6379;">${html}</p>`;
}

export function emailMuted(html) {
  return `<p style="margin:0 0 8px;font-size:13px;color:#5e6379;">${html}</p>`;
}

export function emailButton(href, label) {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr>
    <td align="center" style="border-radius:10px;background-color:#7c6cf6;">
      <a href="${safeHref}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;background-color:#7c6cf6;">${safeLabel}</a>
    </td>
  </tr>
</table>`;
}

export function emailLinkFallback(url) {
  const safe = escapeHtml(url);
  return `<p style="margin:0;font-size:12px;color:#5e6379;line-height:1.5;">Or copy this link:<br><a href="${safe}" style="color:#7c6cf6;word-break:break-all;">${safe}</a></p>`;
}

export function emailNotice(html) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0;background-color:#fffbeb;border-radius:10px;border:1px solid #fcd34d;">
  <tr>
    <td style="padding:14px 16px;">
      <p style="margin:0;font-size:13px;color:#92400e;line-height:1.5;">${html}</p>
    </td>
  </tr>
</table>`;
}
