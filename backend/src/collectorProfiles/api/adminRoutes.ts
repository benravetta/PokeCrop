import { Router, type Request } from "express";
import { requireActiveAuth } from "../../middleware/auth.js";
import { isAdminRole } from "../../lib/adminAccess.js";
import { getServiceClient } from "../../lib/supabase.js";
import {
  requireCollectorProfilesAdminEnv,
  requireCollectorPermission,
  sendCollectorProfileError,
} from "./middleware.js";
import { isCollectorProfilesEnvEnabled } from "../domain/featureFlag.js";
import {
  getCollectorProfileSettings,
  updateCollectorProfileSettings,
} from "../infrastructure/settingsRepo.js";
import {
  listProfilesAdmin,
  getProfileById,
  setProfileStatus,
} from "../infrastructure/profileRepo.js";
import { listCardsAdmin, getCardById, updateCard } from "../infrastructure/cardRepo.js";
import { logAdminConversationAccess } from "../adapters/adminAuditAdapter.js";
import {
  adminJoinConversation,
  freezeConversation,
  listMessages,
} from "../application/messagingService.js";
import { CollectorProfileError } from "../domain/types.js";

export const collectorProfilesAdminRoutes = Router();

const viewProfiles = [
  requireActiveAuth,
  requireCollectorProfilesAdminEnv,
  requireCollectorPermission("collector.admin.view_profiles"),
] as const;

collectorProfilesAdminRoutes.get("/admin/collector/profiles", ...viewProfiles, async (req, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const profiles = await listProfilesAdmin({ status, limit: 200 });
    res.json({ profiles });
  } catch (err) {
    sendCollectorProfileError(res, err);
  }
});

collectorProfilesAdminRoutes.get("/admin/collector/profiles/:id", ...viewProfiles, async (req, res) => {
  try {
    const profile = await getProfileById(req.params.id!);
    if (!profile) throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Not found.", 404);
    res.json({ profile });
  } catch (err) {
    sendCollectorProfileError(res, err);
  }
});

async function setProfileAdminStatus(req: Request, res: import("express").Response, status: string) {
  const profile = await setProfileStatus(req.params.id!, status);
  res.json({ profile });
}

collectorProfilesAdminRoutes.post(
  "/admin/collector/profiles/:id/hide",
  ...viewProfiles,
  requireCollectorPermission("collector.admin.hide_profiles"),
  async (req, res) => {
    try {
      await setProfileAdminStatus(req, res, "hidden");
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesAdminRoutes.post(
  "/admin/collector/profiles/:id/restore",
  ...viewProfiles,
  requireCollectorPermission("collector.admin.hide_profiles"),
  async (req, res) => {
    try {
      await setProfileAdminStatus(req, res, "active");
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesAdminRoutes.post(
  "/admin/collector/profiles/:id/suspend",
  ...viewProfiles,
  requireCollectorPermission("collector.admin.suspend_profiles"),
  async (req, res) => {
    try {
      await setProfileAdminStatus(req, res, "suspended");
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesAdminRoutes.get(
  "/admin/collector/cards",
  requireActiveAuth,
  requireCollectorProfilesAdminEnv,
  requireCollectorPermission("collector.admin.view_cards"),
  async (_req, res) => {
    try {
      const cards = await listCardsAdmin({ limit: 200 });
      res.json({ cards });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesAdminRoutes.get(
  "/admin/collector/cards/:id",
  requireActiveAuth,
  requireCollectorProfilesAdminEnv,
  requireCollectorPermission("collector.admin.view_cards"),
  async (req, res) => {
    try {
      const card = await getCardById(req.params.id!);
      if (!card) throw new CollectorProfileError("COLLECTOR_CARD_NOT_FOUND", "Not found.", 404);
      res.json({ card });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesAdminRoutes.post(
  "/admin/collector/cards/:id/hide",
  requireActiveAuth,
  requireCollectorProfilesAdminEnv,
  requireCollectorPermission("collector.admin.view_cards"),
  async (req, res) => {
    try {
      const card = await updateCard(req.params.id!, { status: "hidden" });
      res.json({ card });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesAdminRoutes.post(
  "/admin/collector/cards/:id/remove",
  requireActiveAuth,
  requireCollectorProfilesAdminEnv,
  requireCollectorPermission("collector.admin.view_cards"),
  async (req, res) => {
    try {
      const card = await updateCard(req.params.id!, { status: "removed" });
      res.json({ card });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesAdminRoutes.get(
  "/admin/collector/reports",
  requireActiveAuth,
  requireCollectorProfilesAdminEnv,
  requireCollectorPermission("collector.admin.view_reports"),
  async (_req, res) => {
    try {
      const { data, error } = await getServiceClient()
        .from("collector_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      res.json({ reports: data ?? [] });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesAdminRoutes.get(
  "/admin/collector/reports/:id",
  requireActiveAuth,
  requireCollectorProfilesAdminEnv,
  requireCollectorPermission("collector.admin.view_reports"),
  async (req, res) => {
    try {
      const { data, error } = await getServiceClient()
        .from("collector_reports")
        .select("*")
        .eq("id", req.params.id!)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Not found.", 404);
      res.json({ report: data });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesAdminRoutes.post(
  "/admin/collector/reports/:id/triage",
  requireActiveAuth,
  requireCollectorProfilesAdminEnv,
  requireCollectorPermission("collector.admin.manage_reports"),
  async (req, res) => {
    try {
      const { data, error } = await getServiceClient()
        .from("collector_reports")
        .update({ status: "triaged", updated_at: new Date().toISOString() })
        .eq("id", req.params.id!)
        .select("*")
        .single();
      if (error) throw error;
      res.json({ report: data });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesAdminRoutes.get(
  "/admin/collector/moderation-cases",
  requireActiveAuth,
  requireCollectorProfilesAdminEnv,
  requireCollectorPermission("collector.admin.open_moderation_case"),
  async (_req, res) => {
    try {
      const { data, error } = await getServiceClient()
        .from("collector_moderation_cases")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      res.json({ cases: data ?? [] });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesAdminRoutes.get(
  "/admin/collector/moderation-cases/:caseId",
  requireActiveAuth,
  requireCollectorProfilesAdminEnv,
  requireCollectorPermission("collector.admin.open_moderation_case"),
  async (req, res) => {
    try {
      const { data, error } = await getServiceClient()
        .from("collector_moderation_cases")
        .select("*")
        .eq("id", req.params.caseId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new CollectorProfileError("COLLECTOR_NOT_FOUND", "Not found.", 404);
      res.json({ case: data });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesAdminRoutes.post(
  "/admin/collector/moderation-cases/:caseId/assign",
  requireActiveAuth,
  requireCollectorProfilesAdminEnv,
  requireCollectorPermission("collector.admin.manage_reports"),
  async (req, res) => {
    try {
      const { data, error } = await getServiceClient()
        .from("collector_moderation_cases")
        .update({
          assigned_admin_user_id: req.body?.adminUserId ?? req.user!.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", req.params.caseId!)
        .select("*")
        .single();
      if (error) throw error;
      res.json({ case: data });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesAdminRoutes.post(
  "/admin/collector/moderation-cases/:caseId/access-conversation",
  requireActiveAuth,
  requireCollectorProfilesAdminEnv,
  requireCollectorPermission("collector.admin.view_reported_conversations"),
  async (req, res) => {
    try {
      const settings = await getCollectorProfileSettings();
      const reason = String(req.body?.accessReason ?? req.body?.access_reason ?? "").trim();
      if (settings.require_admin_access_reason && !reason) {
        throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", "Access reason required.", 400);
      }
      const conversationId = String(req.body?.conversationId ?? req.body?.conversation_id ?? "");
      await logAdminConversationAccess({
        caseId: req.params.caseId!,
        adminUserId: req.user!.id,
        conversationId,
        accessType: "view_conversation",
        accessReason: reason || "moderation review",
        scope: String(req.body?.scope ?? "reported_thread"),
        ipAddress: req.ip,
      });
      const messages = await listMessages(conversationId);
      res.json({ messages });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesAdminRoutes.post(
  "/admin/collector/moderation-cases/:caseId/join-conversation",
  requireActiveAuth,
  requireCollectorProfilesAdminEnv,
  requireCollectorPermission("collector.admin.join_conversations"),
  async (req, res) => {
    try {
      const conversationId = String(req.body?.conversationId ?? req.body?.conversation_id ?? "");
      await logAdminConversationAccess({
        caseId: req.params.caseId!,
        adminUserId: req.user!.id,
        conversationId,
        accessType: "join_conversation",
        accessReason: String(req.body?.accessReason ?? "moderation intervention"),
        scope: "participant",
        ipAddress: req.ip,
      });
      await adminJoinConversation({
        conversationId,
        adminUserId: req.user!.id,
        notice: "GemCheck Support has joined this conversation following a report.",
      });
      res.json({ ok: true });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesAdminRoutes.post(
  "/admin/collector/moderation-cases/:caseId/action",
  requireActiveAuth,
  requireCollectorProfilesAdminEnv,
  requireCollectorPermission("collector.admin.manage_reports"),
  async (req, res) => {
    try {
      const { data, error } = await getServiceClient()
        .from("collector_moderation_actions")
        .insert({
          case_id: req.params.caseId!,
          admin_user_id: req.user!.id,
          action_type: String(req.body?.actionType ?? req.body?.action_type ?? "no_action"),
          target_type: String(req.body?.targetType ?? "profile"),
          target_id: String(req.body?.targetId ?? ""),
          reason: String(req.body?.reason ?? "admin action"),
        })
        .select("*")
        .single();
      if (error) throw error;
      if (req.body?.freezeConversation && req.body?.conversationId) {
        await freezeConversation(String(req.body.conversationId));
      }
      res.json({ action: data });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesAdminRoutes.post(
  "/admin/collector/moderation-cases/:caseId/resolve",
  requireActiveAuth,
  requireCollectorProfilesAdminEnv,
  requireCollectorPermission("collector.admin.manage_reports"),
  async (req, res) => {
    try {
      const { data, error } = await getServiceClient()
        .from("collector_moderation_cases")
        .update({
          status: "resolved",
          resolution: String(req.body?.resolution ?? ""),
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", req.params.caseId!)
        .select("*")
        .single();
      if (error) throw error;
      res.json({ case: data });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesAdminRoutes.post(
  "/admin/collector/moderation-cases/:caseId/escalate",
  requireActiveAuth,
  requireCollectorProfilesAdminEnv,
  requireCollectorPermission("collector.admin.manage_reports"),
  async (req, res) => {
    try {
      const { data, error } = await getServiceClient()
        .from("collector_moderation_cases")
        .update({ status: "escalated", updated_at: new Date().toISOString() })
        .eq("id", req.params.caseId!)
        .select("*")
        .single();
      if (error) throw error;
      res.json({ case: data });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesAdminRoutes.get(
  "/admin/collector/trades",
  requireActiveAuth,
  requireCollectorProfilesAdminEnv,
  requireCollectorPermission("collector.admin.view_reports"),
  async (_req, res) => {
    try {
      const { data, error } = await getServiceClient()
        .from("collector_trade_enquiries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      res.json({ enquiries: data ?? [] });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesAdminRoutes.get(
  "/admin/collector/conversations/:conversationId",
  requireActiveAuth,
  requireCollectorProfilesAdminEnv,
  requireCollectorPermission("collector.admin.view_reported_conversations"),
  async (req, res) => {
    try {
      if (!isAdminRole(req.user?.role)) {
        throw new CollectorProfileError("COLLECTOR_FORBIDDEN", "Case required for access.", 403);
      }
      const messages = await listMessages(req.params.conversationId!);
      res.json({ messages });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesAdminRoutes.get(
  "/admin/collector/settings",
  requireActiveAuth,
  requireCollectorPermission("collector.admin.manage_settings"),
  async (_req, res) => {
    try {
      const settings = await getCollectorProfileSettings();
      const envEnabled = isCollectorProfilesEnvEnabled();
      res.json({
        settings,
        envEnabled,
        effectiveEnabled: envEnabled && settings.collector_profiles_enabled,
      });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesAdminRoutes.put(
  "/admin/collector/settings",
  requireActiveAuth,
  requireCollectorPermission("collector.admin.manage_settings"),
  async (req, res) => {
    try {
      const settings = await updateCollectorProfileSettings(req.body ?? {});
      const envEnabled = isCollectorProfilesEnvEnabled();
      res.json({
        settings,
        envEnabled,
        effectiveEnabled: envEnabled && settings.collector_profiles_enabled,
      });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);

collectorProfilesAdminRoutes.get(
  "/admin/collector/audit",
  requireActiveAuth,
  requireCollectorProfilesAdminEnv,
  requireCollectorPermission("collector.admin.view_audit"),
  async (_req, res) => {
    try {
      const { data, error } = await getServiceClient()
        .from("collector_admin_access_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      res.json({ logs: data ?? [] });
    } catch (err) {
      sendCollectorProfileError(res, err);
    }
  }
);
