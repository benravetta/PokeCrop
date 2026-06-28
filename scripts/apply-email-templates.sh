#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PATCH="${ROOT}/supabase/email-templates/auth-config.patch.json"

echo "Building email templates…"
node "${ROOT}/supabase/email-templates/build-templates.mjs"

PROJECT_REF="${SUPABASE_PROJECT_REF:-wymzhmbjlfaoahlhzhgd}"

if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Applying to Supabase project ${PROJECT_REF} via Management API…"
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

  echo "Email templates applied successfully (Management API)."
  exit 0
fi

echo "SUPABASE_ACCESS_TOKEN not set — applying via Supabase CLI (config push)…"
if ! command -v supabase >/dev/null 2>&1; then
  echo "Error: supabase CLI not found and SUPABASE_ACCESS_TOKEN is unset." >&2
  echo "Create a token at https://supabase.com/dashboard/account/tokens" >&2
  exit 1
fi

# CLI resolves template paths from the repo root, not supabase/.
mkdir -p "${ROOT}/email-templates"
ln -sfn "${ROOT}/supabase/email-templates/built" "${ROOT}/email-templates/built"

supabase config push --project-ref "${PROJECT_REF}" --yes
echo "Email templates applied successfully (Supabase CLI)."
echo "Note: reauthentication template requires SUPABASE_ACCESS_TOKEN (Management API)."
