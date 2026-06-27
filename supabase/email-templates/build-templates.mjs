#!/usr/bin/env node
/**
 * Builds auth-config.patch.json for Supabase Management API.
 * Usage: node supabase/email-templates/build-templates.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  readLayoutHtml,
  wrapEmailBody,
} from "./lib/emailLayout.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const TEMPLATES_DIR = path.join(ROOT, "templates");
const OUT = path.join(ROOT, "auth-config.patch.json");

const layout = readLayoutHtml();
const subjects = JSON.parse(
  fs.readFileSync(path.join(ROOT, "subjects.json"), "utf8")
);

/** @type {{ file: string; contentKey: string; subjectKey: string; preheader: string }[]} */
const MANIFEST = [
  {
    file: "confirmation.html",
    contentKey: "mailer_templates_confirmation_content",
    subjectKey: "mailer_subjects_confirmation",
    preheader: "Confirm your email to start cropping and pre-grading with GemCheck.",
  },
  {
    file: "invite.html",
    contentKey: "mailer_templates_invite_content",
    subjectKey: "mailer_subjects_invite",
    preheader: "You've been invited to GemCheck — accept your invitation.",
  },
  {
    file: "magic_link.html",
    contentKey: "mailer_templates_magic_link_content",
    subjectKey: "mailer_subjects_magic_link",
    preheader: "Your one-time GemCheck sign-in link is inside.",
  },
  {
    file: "email_change.html",
    contentKey: "mailer_templates_email_change_content",
    subjectKey: "mailer_subjects_email_change",
    preheader: "Confirm your new GemCheck email address.",
  },
  {
    file: "recovery.html",
    contentKey: "mailer_templates_recovery_content",
    subjectKey: "mailer_subjects_recovery",
    preheader: "Reset your GemCheck password using the link inside.",
  },
  {
    file: "reauthentication.html",
    contentKey: "mailer_templates_reauthentication_content",
    subjectKey: "mailer_subjects_reauthentication",
    preheader: "Your GemCheck verification code is inside.",
  },
  {
    file: "password_changed.html",
    contentKey: "mailer_templates_password_changed_notification_content",
    subjectKey: "mailer_subjects_password_changed_notification",
    preheader: "Your GemCheck password was recently changed.",
  },
  {
    file: "email_changed.html",
    contentKey: "mailer_templates_email_changed_notification_content",
    subjectKey: "mailer_subjects_email_changed_notification",
    preheader: "Your GemCheck email address was recently changed.",
  },
  {
    file: "phone_changed.html",
    contentKey: "mailer_templates_phone_changed_notification_content",
    subjectKey: "mailer_subjects_phone_changed_notification",
    preheader: "Your GemCheck phone number was recently changed.",
  },
  {
    file: "identity_linked.html",
    contentKey: "mailer_templates_identity_linked_notification_content",
    subjectKey: "mailer_subjects_identity_linked_notification",
    preheader: "A new sign-in method was linked to your GemCheck account.",
  },
  {
    file: "identity_unlinked.html",
    contentKey: "mailer_templates_identity_unlinked_notification_content",
    subjectKey: "mailer_subjects_identity_unlinked_notification",
    preheader: "A sign-in method was removed from your GemCheck account.",
  },
  {
    file: "mfa_enrolled.html",
    contentKey: "mailer_templates_mfa_factor_enrolled_notification_content",
    subjectKey: "mailer_subjects_mfa_factor_enrolled_notification",
    preheader: "A verification method was added to your GemCheck account.",
  },
  {
    file: "mfa_unenrolled.html",
    contentKey: "mailer_templates_mfa_factor_unenrolled_notification_content",
    subjectKey: "mailer_subjects_mfa_factor_unenrolled_notification",
    preheader: "A verification method was removed from your GemCheck account.",
  },
];

function buildEmail(body, preheader) {
  return wrapEmailBody(body, preheader, layout);
}

const patch = { ...subjects };

for (const entry of MANIFEST) {
  const body = fs.readFileSync(path.join(TEMPLATES_DIR, entry.file), "utf8");
  patch[entry.contentKey] = buildEmail(body, entry.preheader);
  if (!patch[entry.subjectKey]) {
    throw new Error(`Missing subject for ${entry.subjectKey} in subjects.json`);
  }
}

// Enable all security notification emails.
patch.mailer_notifications_password_changed_enabled = true;
patch.mailer_notifications_email_changed_enabled = true;
patch.mailer_notifications_phone_changed_enabled = true;
patch.mailer_notifications_identity_linked_enabled = true;
patch.mailer_notifications_identity_unlinked_enabled = true;
patch.mailer_notifications_mfa_factor_enrolled_enabled = true;
patch.mailer_notifications_mfa_factor_unenrolled_enabled = true;

fs.writeFileSync(OUT, JSON.stringify(patch, null, 2) + "\n");

console.log(`Wrote ${OUT}`);
console.log(`  ${MANIFEST.length} templates`);
console.log(`  ${Object.keys(patch).length} config keys`);
