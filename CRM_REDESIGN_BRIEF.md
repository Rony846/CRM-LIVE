# MuscleGrid CRM — Full Redesign Brief ("Iron Console" / Direction 1a)

**Purpose of this document.** Hand this to a design tool (Claude design / Stitch / any generative UI tool) to redesign **every screen** of the MuscleGrid CRM in one consistent visual system. It contains: the product context, the exact design tokens, a full component library spec, layout patterns, and a complete inventory of every page grouped by user role with the pattern each page should follow.

Design the **whole system from these tokens and patterns** — do not invent new colors, fonts, or spacing. When a screen isn't fully specified here, apply the closest layout pattern (§5) and the component library (§4).

---

## 1. Product context

**MuscleGrid CRM** is an enterprise CRM for a company that manufactures and sells **batteries, inverters, stabilizers, and solar equipment** in India. It runs the whole business: service tickets, repairs, dispatch/logistics, warranties, accounting (Indian GST/financial-year), dealer & distributor management, e-commerce (Amazon/Shopify/Flipkart), and an AI support layer.

**It is a dense, data-heavy operations tool, not a marketing site.** Users are internal staff working long shifts — call support, supervisors, technicians, accountants, dispatchers, gate security — plus external dealers and customers. Screens must be **fast to scan, information-dense, and calm under high row counts** (queues routinely show hundreds of tickets). Favor clarity and legibility over decoration.

**Roles (each has its own workspace):** `admin` (sees everything), `supervisor`, `call_support`, `service_agent`/`technician`, `accountant`, `dispatcher`, `gate`, `dealer`, `customer`, plus read-only `ca` (chartered accountant), `lawyer`, and `importer`.

**Two visual worlds:**
- **Internal CRM (the bulk of this brief): the "Iron Console" system below** — light, industrial, precise.
- **Public marketing/showcase pages** (`public/` catalogue, product showcases): may be brighter and more expressive/consumer-facing, but must reuse the same brand color, logo, and type family. These are ~9 pages; treat them as a lighter sub-theme, not the core system.

---

## 2. Design direction: "Iron Console"

An industrial control-panel aesthetic for a power-electronics company. **Light paper background, iron greys, a single confident brand orange, and a voltage-yellow accent for anything urgent.** Monospaced numerals everywhere numbers matter (IDs, counts, SLA, money). Sharp hairlines, small uppercase labels, generous tabular data. Think "instrument cluster + spec sheet," not "SaaS pastel."

Feel: **precise, load-bearing, trustworthy.** No gradients on surfaces, no drop-shadow soup, no rounded-blob illustration. Restraint is the brand.

---

## 3. Design tokens (canonical — use these exact values)

### 3.1 Color

**Brand**
| Token | Hex | Use |
|---|---|---|
| `orange` | `#F58220` | Primary brand, primary buttons, active nav, key accents |
| `orange-deep` | `#D96A0A` | Hover/pressed orange, breached-SLA text |
| `orange-soft` | `#FFF1E3` | Orange tint fill (New / Escalated pills, subtle highlights) |

**Iron (neutrals — the backbone)**
| Token | Hex | Use |
|---|---|---|
| `iron-900` | `#1A1A1A` | Primary text |
| `iron-700` | `#3A3A3A` | Secondary text, icons |
| `iron-500` | `#6B6B6B` | Tertiary text |
| `iron-400` | `#9A9A9A` | Muted labels, placeholders |
| `iron-200` | `#E6E6E6` | Hairline borders, dividers |
| `iron-100` | `#F2F2F1` | Alt row / track fill |
| `iron-50` | `#FAFAF8` | Page background (paper) |
| `white` | `#FFFFFF` | Card/surface |
| `sidebar` | `#161616` | Left nav background (near-black) |
| `login-dark` | `#141414` | Login/auth dark panel |

**Semantic accents (always used as a triplet: tint fill / text / border)**
| Meaning | Fill | Text | Border |
|---|---|---|---|
| Voltage (urgent/warning) | `#FBF3D9` | `#8A6D00` | `#EDDFA6` | (accent color `#F4C518`) |
| Info / assigned (blue) | `#E8F1F8` | `#0B6FB8` | `#CBE0F0` |
| Success / resolved (green) | `#E9F4EE` | `#1F8A4C` | `#CBE5D6` |

### 3.2 Status pills (ticket lifecycle → category → color)

Tickets have many raw statuses; **collapse them into 5 display categories** with these exact pill colors (`bg / text / border`):

| Category | bg | text | border | Raw statuses that map here |
|---|---|---|---|---|
| **New** | `#FFF1E3` | `#C25E05` | `#F6D8BA` | new_request, new |
| **Assigned** | `#E8F1F8` | `#0B6FB8` | `#CBE0F0` | assigned, in progress, default |
| **Escalated** | `#FFF1E3` | `#D96A0A` | `#F6D8BA` | escalated_to_supervisor, customer_escalated, supervisor_followup |
| **In Repair** | `#F2F2F1` | `#4A4A4A` | `#E0E0DE` | received, in_repair, factory, parts_awaited, awaiting_invoice |
| **Dispatch** | `#FBF3D9` | `#8A6D00` | `#EDDFA6` | awaiting_label, awaiting_pickup, dispatched, ready |
| **Resolved** | `#E9F4EE` | `#1F8A4C` | `#CBE5D6` | resolved, closed, delivered, collected |

Pill style: pill radius (999px), 3px×9px padding, uppercase, `Inter Tight` 700, ~9.5px, letter-spacing .06em, 1px border.

### 3.3 Typography

Load from Google Fonts:
- **`Saira Condensed`** (700/800) — wordmark, big display, section eyebrows. Condensed, industrial.
- **`Inter Tight`** (500–800) — headlines, labels, uppercase captions, buttons.
- **`Inter`** (400–700) — body text, table content.
- **`JetBrains Mono`** (400/500/700) — **all numbers**: IDs, ticket numbers, counts, SLA, money, serials, dates-as-data. Use `font-variant-numeric: tabular-nums`.

Type rules:
- Uppercase micro-labels: `Inter Tight` 700, 8.5–11px, letter-spacing .10–.22em, color `iron-400`.
- KPI value: `JetBrains Mono` 700, ~26px, colored by metric accent.
- Card/section titles: `Inter Tight` 700, 11–16px.
- Body/table: `Inter` 11–13px, `iron-700`/`iron-900`.

### 3.4 Space, radius, elevation

- Radius: cards/inputs **8px**, buttons **6px**, pills **999px**, avatars **999px**.
- Card: `white` fill, `1px solid iron-200`, shadow `0 1px 2px rgba(15,15,15,.06)`. **One soft shadow max — no layered shadows.**
- Hairlines: `1px solid iron-200` for all dividers, table rules, borders.
- Grid gap 12–16px. Page padding 22px. Table cell padding ~9px×12px. Dense but breathable.
- Row hover: fill `iron-50`. Selected/active nav: orange tint `rgba(245,130,32,.16)`.

---

## 4. Component library

Design each of these once; reuse everywhere.

1. **App shell — sidebar** (226px, `#161616`, sticky full-height): logo lockup at top (orange MG monogram + `MUSCLEGRID` in Saira Condensed + role eyebrow in orange). "WORKSPACE" section label, then nav items (icon + `Inter Tight` 600 12.5px; active = orange tint bg + white text + orange icon; idle = `#c9c9c9` text, `#9a9a9a` icon). Bottom: user card (orange initials avatar + name + role) and a "Sign Out" row.
2. **App shell — top bar** (58px, `white`, bottom hairline, sticky): page title (`Inter Tight` 700 16px) + mono breadcrumb/subtitle, spacer, a search field (icon + input, 6px radius, hairline border), a refresh icon-button, a notification bell. Search is real and global where relevant (tickets by number/name/phone/serial/order id).
3. **KPI card**: white card, top uppercase micro-label (`iron-400`), big mono value colored by the metric's accent, bottom uppercase sub-label (`iron-500`). Rows of 4–5.
4. **Data table**: header row on `iron-50` with uppercase micro-labels; body rows separated by hairlines, hover `iron-50`; mono for IDs/numbers; ellipsis-truncate long text with max-widths; a small colored dot before urgent IDs; a status pill column; an SLA column (mono, colored: breached = `orange-deep`, urgent = voltage text, else `iron-700`); an owner avatar (initials chip) or a right-aligned action button. Include a footer "Showing X of Y". This is the single most-used component — make it excellent at 100s of rows.
5. **Filter chips / segmented control**: pill buttons; active = `iron-900` fill + white text; idle = white + hairline + `iron-700`. Each shows a mono count. Used above queues and as Agent/Dealer/Admin login switch.
6. **Buttons**: Primary = orange fill, white text, 6px radius, `Inter Tight` 700. Secondary/outline = white + hairline + `iron-700`. Small "action" button = white + orange border + `orange-deep` text + arrow icon. Destructive = uses the red destructive token.
7. **Status/utility chips**: warranty IN WARRANTY (green triplet) / EXPIRED (grey triplet); "URGENT"/"BREACHED" voltage/orange; count badges (mono).
8. **Dialog / modal**: centered, max-width by content, header (icon + title with the record's ID in mono), optional **tab bar** (orange active underline), body sections with uppercase micro-labels over values, footer with Cancel + primary action. Used for ticket details (tabs: Info / Warranties / History / Audit Trail), take-action forms, record editors.
9. **Form controls**: labels uppercase-ish `iron-500`; inputs white + hairline, 8px radius, focus ring in orange; selects, textareas with a live char-count where a minimum is enforced; file "View document" links in orange.
10. **Right-rail widgets**: "…by Status" horizontal bar list (each row: category label in its color + mono count + a track bar in the category color over `iron-100`); a "Watch"/alert callout on the voltage tint with a Zap icon.
11. **Timeline / audit trail**: left orange rule, dot per entry, action + mono timestamp + author + optional note block.
12. **Empty state**: centered icon (muted), one bold line, one muted line. Never a blank area.
13. **Tabs**: underline style, orange active indicator, `Inter Tight`.
14. **Toast**: concise, top-level; success/green, error/red, info/neutral.
15. **Card/section header**: uppercase eyebrow (`Inter Tight` 700, `iron-900`) + optional count badge + right-aligned actions.

**Numbers, IDs, money, dates-as-data → always JetBrains Mono, tabular.** Ticket numbers look like `MG-R-YYYYMMDD-XXXXX` (regular) / `MG-W-…` (walk-in). Money is INR (₹, lakh/crore context). Accounting uses Indian financial year ("2526" = FY 2025-26) and GST state codes.

---

## 5. Layout patterns (map every page to one)

- **A. Dashboard** — sidebar + top bar; KPI row (4–5) + main content grid (usually a queue/table 1fr + a right rail 292px of widgets); optional secondary table/section below. *(e.g. Supervisor, Admin, Dispatcher, Accountant dashboards.)*
- **B. List / Queue** — sidebar + top bar; filter chips; one big data table full-width; row → detail modal or detail page. *(e.g. Tickets, Orders, Sales/Purchase registers, Warranties, Dealers.)*
- **C. List → Detail (master-detail)** — a list (B) plus a rich detail page/panel with header, tabbed sections, and actions. *(e.g. Ticket detail, Dealer profile, Party ledger, Customer 360.)*
- **D. Record / Form / Wizard** — a focused form or multi-step flow on paper, grouped field sections, sticky action footer. *(e.g. Create ticket, Quotation form, Warranty registration, Place order.)*
- **E. Report / Analytics** — filter bar + tables and simple charts (bars/lines in brand + semantic colors, mono axes), export buttons. Keep charts flat and legible. *(e.g. Accounting/Finance/GST/analytics pages.)*
- **F. Auth** — split screen: left dark (`#141414`) hatched brand panel with Saira wordmark + tagline; right white form with role segmented control, inputs, primary orange button.
- **G. Kiosk / Mobile** — large-tap, single-column, high-contrast, for phones and TV. *(Gate mobile OTP, Dispatcher TV mode, customer/dealer mobile.)*
- **H. Public showcase** — brighter, marketing layout for the consumer catalogue; still on-brand type + orange.

Every internal page uses the shell (§4.1–4.2) unless it's F/G/H.

---

## 6. Full page inventory (redesign all of these)

Each entry: **page — purpose → pattern.** Group = left-nav workspace. Reuse §4 components throughout; apply the §5 pattern.

### Auth & shell (pattern F, plus the shell itself)
- Login / role login (Agent·Dealer·Admin segmented) → **F**
- Dealer login, Dealer register, Customer/warranty registration → **F / D**

### Admin workspace (admin sees all internal dashboards too)
Dashboard & analytics: **AdminDashboard**(A), **AdminAnalytics**(E), **ComplianceDashboard**(E), **AdminActivityLogs**(B), **CronRuns**(B).
People & org: **AdminUsers**(B), **AdminEmployees**(B), **AdminAttendance**(B/E), **AdminPayroll**(E), **AdminFirms**(B).
Service ops: **AdminTickets**(B), **AdminTicketDetail**(C), **AdminRepairs**(B), **AdminWarranties**(B), **AdminWarrantyClaims**(B), **AZClaims**(B), **KnowledgeBase**(B/C).
Catalog & inventory: **AdminMasterSKU**(B), **AdminSKUManagement**(B), **AdminSpareParts**(B), **AdminSpareOrders**(B), **SkuWeights**(B), **UnmappedAmazonSkus**(B), **ProductDatasheets**(B), **StockReports**(E).
Orders & e-commerce: **AdminOrders**(B), **AdminOnlineOrders**(B), **OrdersFoldersPage**(B), **AmazonSettings**(D), **AmazonRefunds**(B), **AmazonRefundLosses**(E), **AdminOmnidimCalls**(B).
Dealers: **DealerManagement**(B), **DealerProfile**(C), **AdminDealerApplications**(B), **AdminDealerTerms**(D).
Customers & data: **AdminCustomers**(B), **PartyMaster**(B), **AdminDataManagement**(B), **ClaudeFiles**(B — "Files for Claude"/FOC upload store).
Marketing & AI: **AdminCampaigns**(B), **AdminWhatsAppAgent**(C), **AdminWhatsAppChats**(C), **EmailAgent**(C), **SmartfloAgents**(B), **AdminReviewRescue**(B), **ReviewRewards**(B), **MissedLeads**(B), **AdminZohoForms**(B), **AdminZohoTickets**(B), **AdminSolarSamrat**(A), **AdminSupervisorProduction**(E), **LegalCases**(B), **ImporterReconciliation**(E), **browser-agent**(C), **whatsapp**(C).

### Supervisor workspace *(reference implementation already built in "Iron Console" — match it)*
- **SupervisorDashboard**(A) — KPI row + ticket queue + "Queue by Status" rail + "Escalation Watch" + Sales & Support Team table. **Use this as the canonical A example.**
- **SupervisorTeam**(A/B), **SupervisorProduction**(E), **SupervisorWarranties**(B), **SupervisorCalendar**(A/calendar), **QAScorecards**(E).

### Call support / service
- **CallSupportDashboard**(A), **CallSupportInbox**(C), **EmailTicketInbox**(C), **ServiceAgentDashboard**(A).

### Technician
- **TechnicianDashboard**(A) — assigned repairs, complaint + brief, actions; **TechnicianProduction**(E).

### Dispatcher & gate & dispatch
- **DispatcherDashboard**(A), **DispatcherTVMode**(G — big-screen board), **DispatchTasks**(B), **ViewDispatchQueue**(B).
- **GateDashboard**(A) + **GateDashboardMobile**(G — includes Return-OTP card: OTP revealed only after all parcels scanned inward). Kiosk-legible.

### Accountant & finance (Indian GST/FY — money in mono, ₹)
- Accountant: **AccountantDashboard**(A), **SalesRegister**(B), **PurchaseRegister**(B), **Payments**(B), **CreditNotes**(B), **PartyLedger**(C), **ExpensesDashboard**(E), **AccountingReports**(E), **ReconciliationReports**(E), **ProductionRequests**(B), **IncomingInventoryQueue**(B), **PendingFulfillment**(B), **AccountantInventory**(B), **ViewPendingFulfillment**(B).
- Finance: **FinanceDashboard**(A), **FinanceAnalytics**(E), **BankReconciliation**(E), **EcommerceReconciliation**(E), **ReconciliationMatch**(C), **GSTAudit**(E), **GSTHSNDashboard**(E), **TDSDashboard**(E), **ImportCosting**(E), **UnbookedReceipts**(B).
- Read-only portals: **CADashboard**(E — per-firm GST filing summary + file downloads), **LawyerDashboard**(B — legal-marked cases), **ImporterPortal**(D/E — supplier payment + customs + reconciliation), **FinanceAgent/Inbox/Watch**(C).

### Sales, quotations, leads, incentives
- **SalesOrders**(B), **LeadsPage**(B), **CallsDashboard**(A).
- Quotations/PI: **QuotationList**(B), **QuotationForm**(D), **PIPendingAction**(B), **PublicQuotationView**(H/read-only), **CustomerQuotations**(B).
- Incentives: **AdminIncentives**(E), **MyIncentives**(E), **MyAttendance**(B), **MyWarranties**(B).

### Inventory & operations
- **SerialNumbersManagement**(B), **AmazonOrders**(B), **CourierShipping**(B), **CourierTracking**(A/B — unified Bigship+Shiprocket+Delhivery board).

### Dealer portal (external — clean, self-serve; still Iron Console)
- **DealerDashboard**(A), **DealerCatalogue**(B/H), **DealerProducts**(B), **DealerPlaceOrder**(D), **DealerOrders**(B), **DealerDispatches**(B), **DealerLedger**(C), **DealerDeposit**(D), **DealerSpareParts**(B), **DealerSpareOrders**(B), **DealerCustomers**(B), **DealerTickets**(B), **DealerWarrantyClaims**(B), **DealerWarrantyRegistration**(D), **DealerReorderSuggestions**(B), **DealerTargets**(E), **DealerPerformance**(E), **DealerPromotions**(B), **DealerAnnouncements**(B), **DealerDocuments**(B), **DealerCertificate**(read-only doc), **DealerTerms**(D), **DealerProfile**(C).

### Customer portal (external — simplest, friendliest)
- **CustomerDashboard**(A), **CreateTicket**(D), **CustomerTickets**(B), **CustomerAppointments**(B), **MyWarranties**(B), **WarrantyRegistration**(D). Also **Customer 360**(C) — the internal single-customer view (products in/out of warranty, ticket history, replacement dispatches, activity timeline); a reference "Iron Console" example already exists.

### Public / marketing (pattern H — brighter sub-theme, same brand)
- **CatalogueHome**, **CategoryListing**, **BatteryShowcase**, **StabilizerShowcase**, **ServoShowcase**, **SolarPanelShowcase**, **AccessoriesListing**, **PublicDatasheetView**, **VerifyDealer**.

### Chat
- **ChatPage**(C) — internal Slack-style team chat (dock + full page, realtime).

---

## 7. Responsive & platform notes

- **Desktop-first** for all internal ops (dense tables). Provide a sensible collapse: sidebar → icon rail or drawer under ~1024px; tables → horizontal scroll or stacked cards.
- **Mobile-critical screens (pattern G):** Gate mobile (OTP kiosk), Dispatcher TV mode (read-at-distance, huge type), customer & dealer flows (used on phones). Design these mobile-first with large tap targets.
- Keep all numeric/status semantics identical across breakpoints.

---

## 8. Do / Don't

**Do:** honor the exact tokens; mono for every number/ID/₹; 5-category status pills; one hairline + one soft shadow; uppercase micro-labels; calm dense tables; orange used sparingly as the single hero color; voltage-yellow only for urgent/warning.

**Don't:** introduce new fonts or a second bright color; use gradients/glows on surfaces; stack shadows; center-align data tables; use pastel "friendly SaaS" styling; make marketing-style hero blocks inside internal ops screens; drop information density to look minimal.

---

## 9. Deliverables requested from the design tool

1. A **design-token sheet** (colors, type scale, spacing, radii, shadows) matching §3.
2. A **component library** (all of §4) as reusable components.
3. **High-fidelity screens** for the archetypes first (one excellent example per pattern A–H), then the full page list in §6.
4. Both **light desktop** and the **mobile/kiosk** variants for pattern-G screens.
5. Consistent **empty, loading, and error** states.

**Priority order for rollout:** (1) Auth + app shell, (2) the pattern-A dashboards, (3) the pattern-B/C ticket & order & dealer flows, (4) accountant/finance reports (E), (5) forms/wizards (D), (6) public showcase (H).

---

*Reference build already shipped in this system for calibration: the **Supervisor dashboard** (pattern A) and **Customer 360** (pattern C) are live in the Iron Console style — mirror their density, tokens, and component usage.*
