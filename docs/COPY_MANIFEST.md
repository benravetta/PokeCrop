# GemCheck copy manifest

Last updated: 2026-06-24. Implementation SSOT: `frontend/src/lib/marketingCopy.ts`, `frontend/src/lib/gradeUploadCopy.ts`.

## Brand positioning

GemCheck helps collectors make a better grading decision before they spend money submitting a card. The user is buying clarity before submission, not a number.

## Target audiences

- Pokémon, sports and TCG collectors deciding whether to submit
- First-time submitters learning what graders look for
- Sellers pricing raw vs slabbed stock
- Trade users (shops, breakers, dealers) triaging volume

## Brand promise

Honest pre-grade estimates from clear photographs, with reasons you can act on before paying submission fees.

## Functional benefits

- Compare five supported graders side by side
- Visible condition breakdown (centering, corners, edges, surface)
- Photo quality gate before a report runs
- Crop and centring tools included on free tier
- No subscription required for occasional checks

## Emotional benefits

- Confidence before posting a card
- Less regret after a disappointing slab
- Feels like a collector tool, not enterprise software

## Differentiators

- Estimate-first, not “AI-powered” lead
- Front and back analysis
- Independent of grading companies
- British English, collector-native tone

## Tone of voice

Knowledgeable, honest, calm, direct, lightly playful (one pun per major page max). 80% clarity, 15% collector personality, 5% wordplay.

**Humour allowed:** headings, supporting copy, success states.  
**Humour not allowed:** payment errors, privacy, limitations, photo rejection, security, terms, refunds.

## Approved terminology

| Use | For |
|-----|-----|
| card check | the action |
| pre-grade estimate | predicted result |
| report | finished deliverable |
| official grade | result from a grading company |
| supported grader / grading company | PSA, Beckett, CGC, ACE, TAG |
| likely best fit | where product calculates it |
| visible condition | photo-limited assessment |

## Disallowed terminology

Revolutionary, game-changing, seamless, unlock, maximise, guaranteed, expert grade, official grade (for GemCheck output), AI-powered (as lead), random alternation of scan/appraisal/assessment.

## CTA hierarchy

1. Primary guest: **Check a card free** → `/register`
2. Primary logged-in: **Check a card** → `/grade`
3. Secondary: **View a sample report** → `/sample-report`
4. Nav: clear labels (How it works, Sample report, Pricing, FAQs, Sign in)

## Trust and transparency rules

- Never hide estimate-only nature
- Do not use “Estimate only” as a trust bullet
- Visible qualification near hero
- Dedicated transparency section on homepage
- No unverified testimonials, stats or savings claims

## Formatting rules

British English. Sentence case. No em dashes. Button labels 2–5 words, verb-first. Eyebrows uppercase via CSS.

## SEO rules

Human-first headings. Specific page titles. No keyword stuffing. Homepage title: “GemCheck | Trading Card Pre-Grading Before You Submit”.

---

## Verified product facts

| Fact | Value | Source |
|------|-------|--------|
| Supported graders | PSA, Beckett (BGS), CGC, TAG, ACE | `backend/src/lib/grading.ts` |
| Free card checks / month | 3 | `backend/src/lib/plans.ts` (`MONTHLY_GRADE_LIMITS`) |
| Free crops / day | 3 | `backend/src/lib/usage.ts` |
| Single report price | £2.99 | `frontend/src/components/landing/data.ts`, Stripe |
| Subscriptions | Premium £9.99, Pro £19.99, Enterprise £29.99/mo | `frontend/src/lib/plans.ts` |
| Account before upload | Required (ProtectedRoute) | `frontend/src/App.tsx` |
| Credit not used on | 422 capture block, not-a-card, processing fail | `backend/src/lib/gradeService.ts` |
| Max image size | 50 MB | `backend/src/routes/grade.ts` |
| Grade formats | JPG, PNG, WEBP, HEIC, HEIF, DNG | `backend/src/routes/grade.ts` |
| VAT in app | Not configured | `backend/src/routes/billing.ts` |

## Owner confirmation TODOs

- [ ] **VAT:** Confirm inclusive/exclusive wording before publishing
- [x] **Legal pages:** `/privacy`, `/terms`, `/refund` published with footer links
- [x] **Photo retention:** Wording aligned with privacy policy (in-memory grade photos, metadata in history, temporary crop sessions)
- [ ] **Testimonials:** Removed unverified quotes; restore only with permission
- [x] **Refund FAQ:** Points to refund policy

---

## Page-by-page inventory

Final strings live in code SSOT files. Summary:

| Surface | File(s) | Key copy |
|---------|---------|----------|
| Homepage hero | `HeroSection.tsx`, `HERO` | Know before you grade; Check a card free |
| Trust strip | `TRUST_STRIP` | Four bullets + qualification |
| Sample report | `SampleReportPage.tsx`, `ReportPreview.tsx` | Full example PDF-style mock |
| How it works | `CompareAndHow.tsx`, `HOW_IT_WORKS` | Four steps |
| What we check | `MarketingSections.tsx`, `WHAT_WE_CHECK` | Four condition areas |
| Grader compare | `MarketingSections.tsx`, `GRADER_COMPARE` | Multi-grader section |
| Transparency | `FooterSections.tsx`, `TRANSPARENCY` | Crystal ball section |
| Product proof | `SocialProof.tsx`, `PRODUCT_PROOF` | Replaces testimonials |
| Pricing | `PricingSection.tsx`, `PRICING`, `pricingCompare.ts` | One free check messaging |
| FAQ | `FaqPage.tsx`, `SITE_FAQ` | 14 questions |
| Footer | `FooterSections.tsx`, `FOOTER` | Tagline + grader independence |
| Auth | Login/Register pages, `AUTH` | Register-first |
| Grade upload | `GradeUploadWorkspace.tsx`, `GRADE_UPLOAD` | Check your card |
| Report | `GradePage.tsx`, `REPORT` | Section headings |
| Errors | `captureQuality.ts`, `UPLOAD_ERRORS` | Actionable messages |
| Emails | `supabase/email-templates/` | Branded auth emails |
| SEO | `index.html`, `SEO`, `seo.ts` | Per-route meta + sitemap |
| Legal | `legalCopy.ts`, `PrivacyPage`, `TermsPage`, `RefundPage` | Privacy, terms, refunds |

---

## Homepage section order (implemented)

1. Hero  
2. How it works  
3. What we check  
4. Grader comparison  
5. Transparency  
6. Product proof  
7. Pricing  
8. FAQ strip  
9. Final CTA  
10. (Secondary) Features, crop demo, trade, API  
11. Footer  

Sample report lives at `/sample-report` (linked from hero, nav and product proof).
