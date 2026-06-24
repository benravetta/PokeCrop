#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PATCH="${ROOT}/supabase/email-templates/auth-config.patch.json"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Error: SUPABASE_ACCESS_TOKEN is required." >&2
  echo "Create one at https://supabase.com/dashboard/account/tokens" >&2
  exit 1
fi

PROJECT_REF="${SUPABASE_PROJECT_REF:-wymzhmbjlfaoahlhzhgd}"

echo "Building email templates…"
node "${ROOT}/supabase/email-templates/build-templates.mjs"

echo "Applying to Supabase project ${PROJECT_REF}…"
HTTP_CODE=$(curl -sS -o /tmp/supabase-email-apply.json -w "%{http_code}" \
  -X PATCH "https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d @"${PATCH}")

if [[ "${HTTP_CODE}" != "200" ]]; then
  echo "Error: Management API returned HTTP ${HTTP_CODE}" >&2
  cat /tmp/supabase-email-apply.json >&2
  exit 1
fi

echo "Email templates applied successfully."
echo "Verify in Supabase Dashboard → Authentication → Emails, then send test emails."
