# GemCheck Supabase email templates

Branded HTML templates for all Supabase Auth emails (sign-up, magic link, password reset, and security notifications).

## Structure

| Path | Purpose |
|------|---------|
| `partials/layout.html` | Shared wrapper — logo, preheader, footer |
| `templates/*.html` | Per-email body content (Go template variables) |
| `subjects.json` | Email subject lines |
| `build-templates.mjs` | Merges layout + bodies → `auth-config.patch.json` |
| `auth-config.patch.json` | Generated payload for the Management API |

## Customise

1. Edit the relevant file in `templates/` or update subjects in `subjects.json`.
2. Rebuild:

```bash
node supabase/email-templates/build-templates.mjs
```

3. Preview locally — open a template body in your browser, or paste generated HTML from `auth-config.patch.json` into [Litmus](https://litmus.com) / [Email on Acid](https://www.emailonacid.com) if you use one.

Preheaders are defined in `build-templates.mjs` (`MANIFEST` array).

## Apply to Supabase

**Before applying**, confirm in Supabase **Authentication → URL Configuration**:

- Site URL: `https://gemcheck.co.uk`
- Redirect URLs include `https://gemcheck.co.uk/reset-password`

**Apply:**

```bash
export SUPABASE_ACCESS_TOKEN="your-token"   # https://supabase.com/dashboard/account/tokens
export SUPABASE_PROJECT_REF="wymzhmbjlfaoahlhzhgd"   # optional; this is the default

./scripts/apply-email-templates.sh
```

Or build only:

```bash
node supabase/email-templates/build-templates.mjs
```

Then paste from `auth-config.patch.json` into the Supabase dashboard under **Authentication → Emails**, or PATCH manually:

```bash
curl -X PATCH "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d @supabase/email-templates/auth-config.patch.json
```

## Verify

1. Supabase dashboard → **Authentication → Emails** → send test emails for **Confirm sign up** and **Reset password**.
2. Check Gmail and Apple Mail: logo loads, CTA works, preheader shows in inbox list.
3. Confirm password reset still redirects to `/reset-password`.

## Templates included

**Authentication:** confirm sign up, invite, magic link, change email, reset password, reauthentication.

**Security (enabled):** password changed, email changed, phone changed, sign-in linked/removed, MFA added/removed.

## Design notes

- Light transactional layout for email client compatibility (not the dark app theme).
- Logo: `https://gemcheck.co.uk/gemcheck-logo-light.png` (dark wordmark for light email backgrounds)
- Accent: `#7c6cf6`
- Link-based auth emails include a 6-digit OTP fallback (`{{ .Token }}`) for accessibility and Microsoft Safe Links prefetch issues.
- British English copy throughout.

## Go template variables

See [Supabase email template docs](https://supabase.com/docs/guides/auth/auth-email-templates) for `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .Email }}`, `{{ .NewEmail }}`, `{{ .OldEmail }}`, `{{ .Provider }}`, `{{ .FactorType }}`, etc.

Do not HTML-escape these placeholders — Supabase renders them server-side.
