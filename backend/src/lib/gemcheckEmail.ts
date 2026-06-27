import fs from "fs";
import path from "path";

const ADMIN_INVITE_SUBJECT = "You're invited to GemCheck";
const ADMIN_INVITE_PREHEADER = "You've been invited to GemCheck — accept your invitation.";

let cachedLayout: string | null = null;
let cachedAdminInviteBody: string | null = null;
let cachedAppNotificationBody: string | null = null;

function findEmailTemplatesRoot(): string {
  const candidates = [
    path.join(process.cwd(), "supabase/email-templates"),
    path.join(process.cwd(), "../supabase/email-templates"),
    path.join(process.cwd(), "email-templates"),
    "/app/email-templates",
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "partials/layout.html"))) return dir;
  }
  throw new Error(
    "GemCheck email templates not found. Expected supabase/email-templates (copy into /app/email-templates in production)."
  );
}

function readLayout(): string {
  if (cachedLayout) return cachedLayout;
  const root = findEmailTemplatesRoot();
  cachedLayout = fs.readFileSync(path.join(root, "partials/layout.html"), "utf8");
  return cachedLayout;
}

function readTemplate(name: string): string {
  const root = findEmailTemplatesRoot();
  return fs.readFileSync(path.join(root, "templates", name), "utf8");
}

function adminInviteBodyTemplate(): string {
  if (!cachedAdminInviteBody) {
    cachedAdminInviteBody = readTemplate("admin_invite.html");
  }
  return cachedAdminInviteBody;
}

function appNotificationBodyTemplate(): string {
  if (!cachedAppNotificationBody) {
    cachedAppNotificationBody = readTemplate("app_notification.html");
  }
  return cachedAppNotificationBody;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function wrapGemCheckEmail(content: string, preheader: string): string {
  const html = readLayout()
    .replace("{{PREHEADER}}", escapeHtml(preheader))
    .replace("{{CONTENT}}", content.trim());
  return html.replace(/\r\n/g, "\n").replace(/\n+/g, "").replace(/>\s+</g, "><").trim();
}

export function buildAdminInviteEmail(opts: {
  registerUrl: string;
  role: "user" | "admin";
}): { subject: string; html: string; preheader: string } {
  const registerUrl = opts.registerUrl.trim();
  const safeUrl = escapeHtml(registerUrl);
  const adminNote =
    opts.role === "admin"
      ? `<p style="margin:0 0 16px;color:#5e6379;">You've been invited as an <strong style="color:#13151e;">administrator</strong>.</p>`
      : "";

  const body = adminInviteBodyTemplate()
    .replace(/\{\{ADMIN_NOTE\}\}/g, adminNote)
    .replace(/\{\{REGISTER_URL\}\}/g, safeUrl);

  return {
    subject: ADMIN_INVITE_SUBJECT,
    preheader: ADMIN_INVITE_PREHEADER,
    html: wrapGemCheckEmail(body, ADMIN_INVITE_PREHEADER),
  };
}

export function buildAppNotificationEmail(opts: {
  title: string;
  body: string;
  preheader?: string;
  ctaHref?: string;
  ctaLabel?: string;
}): { subject: string; html: string; preheader: string } {
  const title = escapeHtml(opts.title.trim() || "GemCheck update");
  const body = escapeHtml(opts.body.trim());
  const preheader = opts.preheader?.trim() || opts.body.trim() || opts.title.trim() || "GemCheck update";

  let ctaBlock = "";
  if (opts.ctaHref && opts.ctaLabel) {
    const href = escapeHtml(opts.ctaHref.trim());
    const label = escapeHtml(opts.ctaLabel.trim());
    ctaBlock = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;">
  <tr>
    <td align="center" style="border-radius:10px;background-color:#7c6cf6;">
      <a href="${href}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;background-color:#7c6cf6;">${label}</a>
    </td>
  </tr>
</table>`;
  }

  const content = appNotificationBodyTemplate()
    .replace("{{TITLE}}", title)
    .replace("{{BODY}}", body)
    .replace("{{CTA_BLOCK}}", ctaBlock);

  const subject = opts.title.trim() || "GemCheck update";

  return {
    subject,
    preheader,
    html: wrapGemCheckEmail(content, preheader),
  };
}
