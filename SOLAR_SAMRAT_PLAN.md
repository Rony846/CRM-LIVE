# 👑 Solar Samrat — Plan & Phase-1 Spec

**Tagline:** *Where every dealer rules.*
A standalone, open-industry solar community super-app. Marketplace + community +
leads, monetized free-first → commission → memberships/leads/ads. The MuscleGrid
CRM is the admin/control plane; the member app is a separate Expo app/brand.

Decisions (founder, 2026-06-12): **Standalone product · Super-app (all three) ·
Open to the whole solar industry · all monetization streams · name "Solar Samrat"**.

---

## Three pillars
1. **Community** — feed, groups (Residential, C&I, Off-grid, Subsidy/Policy,
   Troubleshooting, Market), Q&A, knowledge/subsidy hub.
2. **Leads & RFQ** — post product RFQs / project leads, matchmaking, quotes.
3. **AI Solar Quote** — Claude sizes a rooftop system → BOM + PM Surya Ghar
   subsidy + payback (the "single-player" hook that beats cold-start).

## 👑 Samrat status system (the loyalty loop)
Ranks **Sipahi → Sardar → Raja → Maharaja → Samrat**, earned via **Crowns**
(verification, posts, answer upvotes, best-answers, lead responses, referrals).
Leaderboards (global/state/role), badges, profile crowns → daily engagement.

## Roles + open-but-verified
Dealer · Distributor · EPC/Installer · Brand · Approved Customer. Open signup →
GST/PAN business verification → "Verified" badge. Neutral brand (MuscleGrid is
just one member, not the owner of the network).

## Monetization (phased)
- **P1 Free** — grow the network.
- **P2 Commission** — marketplace GMV + Razorpay-Route escrow.
- **P3 Memberships + Leads/Ads** — Pro-seller tiers, verified-lead sales,
  promoted listings, brand storefronts, financing, price index.

## Cold-start play
Seed supply (MuscleGrid + distributor partners) + demand (existing dealer
network) + single-player AI tools + 1–2 state geographic density first.

---

## Phase-1 MVP (BUILT — 2026-06-12)

**Backend** (in the CRM monolith, `server.py`, all under `/api/samrat/*`):
- Open signup OTP (`/samrat/auth/otp/{send,verify}`) — auto-creates the user.
- Membership: `apply`, `me`, `meta`.
- Community: `groups`, `feed`, `posts` (+like/comments), `posts/{id}`.
- Q&A: `questions` (+detail), `answers`, `answers/{id}/upvote`, `best`.
- Leads: `leads` (+detail), `leads/{id}/quotes`.
- AI quote: `ai/quote` (Claude `_claude_json`, PM Surya Ghar subsidy slabs).
- Directory + leaderboard.
- **Admin/control plane** (`/samrat/admin/*`, role `admin`): overview, members
  (filter/search), member detail, **verify approve/reject**, suspend/reactivate,
  manual Crowns, leads + posts moderation, leaderboard.
- Collections: `samrat_members`, `samrat_crown_ledger`, `samrat_posts`,
  `samrat_questions`, `samrat_leads`, `samrat_ai_quotes` (+ indexes in INDEX_PLAN).
- Crown rules + rank thresholds + `_samrat_award_crowns` helper.

**CRM admin tab**: `frontend/src/pages/admin/AdminSolarSamrat.jsx` at
`/admin/solar-samrat` (nav group "Solar Samrat", admin-only) — Overview /
Members (approve-reject-suspend, crown adjust) / Leaderboard / Leads / Content.

**Member app**: `/var/www/solar-samrat-app` (Expo SDK 54, "Royal Dark" theme).
Tabs Feed · Leads · AI Quote · Rank · Profile, plus apply/login/qa/directory and
post/lead/question detail + create modals. Typecheck clean; `codemagic.yaml`
mirrors the proven iOS/Android pipeline. Bundle `in.solarsamrat.app`.

### Verified end-to-end
apply → admin verify (+50/+20 Crowns) → post/feed → ask question → create lead →
quote (+10 Crowns) → rank promotion (Crowns→rank) → leaderboard → AI quote
(5 kW, ₹78k subsidy, 4.9-yr payback).

## Next steps (not yet done)
- `eas init` to set `app.json` → `extra.eas.projectId`; create ASC + Play records
  for `in.solarsamrat.app`; real brand artwork (current icon/splash are generated
  placeholders).
- Push `solar-samrat-app` to a GitHub repo + wire Codemagic.
- **Phase 2**: transactional marketplace (orders + escrow + commission).
