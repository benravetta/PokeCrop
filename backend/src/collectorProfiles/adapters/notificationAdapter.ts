import { logActivity } from "../../lib/activity.js";
import { sendMail } from "../../lib/mail.js";
import { getServiceClient } from "../../lib/supabase.js";

export async function sendCollectorNotification(opts: {
  userId: string;
  eventType: string;
  subject: string;
  preview: string;
}): Promise<void> {
  const { data } = await getServiceClient().auth.admin.getUserById(opts.userId);
  const email = data.user?.email;
  if (!email) return;
  await sendMail({
    to: email,
    subject: opts.subject,
    text: opts.preview,
    html: `<p>${opts.preview}</p>`,
  }).catch((err) => console.error("collector notification email failed:", err));
}

export async function notifyCollectorEvent(opts: {
  userId: string;
  eventType: string;
  entityId?: string;
  subject?: string;
  preview?: string;
}): Promise<void> {
  const idempotencyKey = `${opts.userId}:${opts.eventType}:${opts.entityId ?? "none"}:${Math.floor(Date.now() / 60000)}`;
  const { error: dupErr } = await getServiceClient().from("collector_notification_deliveries").insert({
    user_id: opts.userId,
    event_type: opts.eventType,
    entity_id: opts.entityId ?? null,
    idempotency_key: idempotencyKey,
  });
  if (dupErr?.code === "23505") return;

  logActivity({
    userId: opts.userId,
    action: `collector.${opts.eventType}`,
    actorId: opts.userId,
    detail: { entityId: opts.entityId, preview: opts.preview },
  });

  await sendCollectorNotification({
    userId: opts.userId,
    eventType: opts.eventType,
    subject: opts.subject ?? "GemCheck Collector Profile update",
    preview: opts.preview ?? "You have a new update on your collector profile.",
  });
}
