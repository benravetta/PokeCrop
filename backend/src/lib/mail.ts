import nodemailer from "nodemailer";

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  );
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  if (!isSmtpConfigured()) {
    throw new Error("SMTP is not configured.");
  }
  const to = opts.to.trim();
  if (!to || /[\r\n\x00]/.test(to)) {
    throw new Error("Invalid recipient email.");
  }
  const from = process.env.SMTP_FROM?.trim() || "GemCheck <noreply@gemcheck.co.uk>";
  await getTransporter().sendMail({
    from,
    to,
    subject: opts.subject.replace(/[\r\n\x00]/g, ""),
    html: opts.html,
    text: opts.text ?? opts.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  });
}
