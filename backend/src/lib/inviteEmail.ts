export function buildInviteEmailHtml(opts: {
  registerUrl: string;
  role: "user" | "admin";
}): string {
  const roleNote =
    opts.role === "admin"
      ? "<p style=\"margin:0 0 16px;color:#5e6379;font-size:14px;line-height:1.6;\">You've been invited as an <strong>administrator</strong>.</p>"
      : "";
  return `<!DOCTYPE html>
<html lang="en-GB">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f8;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:16px;border:1px solid #e8eaf0;">
        <tr><td style="padding:28px 32px 8px;text-align:center;">
          <img src="https://gemcheck.co.uk/gemcheck-logo.png" alt="GemCheck" width="200" height="62" style="display:block;margin:0 auto;height:62px;width:auto;max-width:200px;border:0;">
          <p style="margin:12px 0 0;font-size:12px;color:#5e6379;">Know the grade before you submit</p>
        </td></tr>
        <tr><td style="padding:8px 32px 28px;color:#13151e;font-size:15px;line-height:1.65;">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#13151e;">You're invited to GemCheck</h1>
          <p style="margin:0 0 16px;color:#5e6379;font-size:14px;line-height:1.6;">You've been invited to join the GemCheck beta. Create your account to crop cards, measure centring and get honest pre-grade estimates.</p>
          ${roleNote}
          <p style="margin:0 0 24px;text-align:center;">
            <a href="${opts.registerUrl}" style="display:inline-block;background:#7c6cf6;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 28px;border-radius:10px;">Accept invitation</a>
          </p>
          <p style="margin:0;font-size:12px;color:#5e6379;line-height:1.5;">Or copy this link:<br><a href="${opts.registerUrl}" style="color:#7c6cf6;word-break:break-all;">${opts.registerUrl}</a></p>
        </td></tr>
        <tr><td style="padding:20px 32px 28px;border-top:1px solid #e8eaf0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#5e6379;">GemCheck by Looky Collectibles · Lake District, UK</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
