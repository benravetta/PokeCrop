import { getServiceClient } from "../../lib/supabase.js";
import { HumanPregradeError } from "../domain/types.js";
import { transitionOrder } from "./statusService.js";
import { buildReportData, renderReportHtml } from "../reports/buildReport.js";
import { buildHumanPregradePdfBuffer } from "../reports/pdf.js";
import { putObject, isR2Configured } from "../../lib/r2.js";
import type { TransitionContext } from "../domain/types.js";

export async function publishReport(opts: {
  orderId: string;
  assessmentId: string;
  ctx: TransitionContext;
}): Promise<{ reportId: string; publicToken: string | null }> {
  const sb = getServiceClient();
  const { data: order } = await sb
    .from("human_pregrade_orders")
    .select("*")
    .eq("id", opts.orderId)
    .maybeSingle();
  if (!order) throw new HumanPregradeError("HUMAN_PREGRADE_NOT_FOUND", "Order not found", 404);

  const { data: assessment } = await sb
    .from("human_pregrade_assessments")
    .select("*")
    .eq("id", opts.assessmentId)
    .eq("order_id", opts.orderId)
    .maybeSingle();
  if (!assessment || assessment.status !== "approved") {
    throw new HumanPregradeError(
      "HUMAN_PREGRADE_ASSESSMENT_INCOMPLETE",
      "Assessment must be approved",
      409
    );
  }

  const { data: predictions } = await sb
    .from("human_pregrade_grader_predictions")
    .select("*")
    .eq("assessment_id", opts.assessmentId);
  const { data: defects } = await sb
    .from("human_pregrade_defects")
    .select("*")
    .eq("assessment_id", opts.assessmentId);

  const reportData = buildReportData(
    order as never,
    assessment as Record<string, unknown>,
    predictions ?? [],
    defects ?? []
  );
  const html = renderReportHtml(reportData);

  let pdfKey: string | null = null;
  if (isR2Configured()) {
    pdfKey = `human-pregrade/${opts.orderId}/report-${Date.now()}.pdf`;
    await putObject(pdfKey, buildHumanPregradePdfBuffer(reportData), "application/pdf");
  }

  const { data: prev } = await sb
    .from("human_pregrade_reports")
    .select("id, version")
    .eq("order_id", opts.orderId)
    .eq("status", "published")
    .maybeSingle();
  if (prev) {
    await sb
      .from("human_pregrade_reports")
      .update({ status: "superseded", superseded_at: new Date().toISOString() })
      .eq("id", prev.id);
  }

  const version = prev ? Number(prev.version ?? 1) + 1 : 1;
  const publicToken = crypto.randomUUID();
  const { data: report, error } = await sb
    .from("human_pregrade_reports")
    .insert({
      order_id: opts.orderId,
      assessment_id: opts.assessmentId,
      version,
      status: "published",
      public_token: publicToken,
      report_data: reportData,
      html_snapshot: html,
      pdf_storage_object_id: pdfKey,
      template_version: "1.1",
      disclaimer_version: order.disclaimer_version,
      published_by_user_id: opts.ctx.actorId,
      published_at: new Date().toISOString(),
    })
    .select("id, public_token")
    .single();
  if (error) throw error;

  if (order.status === "quality_check" || order.status === "report_drafting") {
    await transitionOrder(opts.orderId, "completed", {
      ...opts.ctx,
      customerVisibleNote: "Your expert review report is ready.",
    });
  }

  console.info("[humanPregrade]", {
    event: "human_pregrade.report_published",
    orderId: opts.orderId,
    reportId: report.id,
  });

  return { reportId: String(report.id), publicToken: report.public_token as string | null };
}
