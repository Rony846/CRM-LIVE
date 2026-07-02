# MuscleGrid CRM — Full Redesign PRODUCTION ORDER (Iron Console / 1a)

**Read this together with `CRM_Redesign_Brief_IronConsole.md` (the binding system spec) and `tokens/colors_and_type.css`.** This document is the *work order*: it enumerates **every page and every popup** in the CRM and directs you to design **each one as its own high-fidelity screen** in the Iron Console system. The earlier brief gave you the system + archetypes; this tells you the full list to actually produce.

---

## 0. THE DIRECTIVE (read first)

You are redesigning the **entire** MuscleGrid CRM in the **Iron Console** visual system (brand orange `#F58220` + iron greys, light "paper" content, dark `#161616` sidebar, JetBrains Mono for all numbers). Two hard rules:

1. **Produce ONE high-fidelity artifact for EVERY item in §5 (pages) and §6 (popups).** Do **not** collapse them into "archetypes" or "representative examples." There are **~180 pages** and **~70 popups/modals** — the deliverable is that many screens, each with real layout and the copy/fields listed. Archetypes A–H in the prototype are the *pattern to apply*, not the stopping point.
2. **The store is OUT OF SCOPE.** Do not touch `/store/` (public storefront). Everything else is in scope.

If the tool has a screen cap per run, **work in batches by section** (§5/§6 are grouped) and produce every batch until the whole list is covered. State which items remain after each batch. Never silently stop at a subset.

---

## 1. NON-NEGOTIABLES

- **Every page** gets: the full page (desktop 1440), plus its **empty**, **loading (skeleton)**, and **error** states.
- **Every popup** gets: the modal at rest (its real fields/sections), plus its **validation-error** and **submitting/loading** states. Confirmation/destructive dialogs get a distinct danger treatment.
- **Mobile/kiosk variants** for the pattern-G screens in §5 (Gate mobile, Dispatcher TV, customer/dealer flows).
- Reuse the **exact tokens, type scale, spacing, radii, and the 6-category status-pill map** from the brief. No new colors or fonts. One hairline + one soft shadow. Mono for every number/ID/₹/date-as-data.
- Copy is **spec-first, service-formal, India-direct**, ALL-CAPS micro-labels, no emoji. Money in ₹ (lakh/crore); Indian financial year ("2526" = FY 2025-26); ticket IDs `MG-R-YYYYMMDD-XXXXX`.

---

## 2. SYSTEM (condensed — full detail in the brief + tokens CSS)

- **Color:** orange `#F58220` (deep `#D96A0A`, soft `#FFF1E3`); iron text `#1A1A1A` / `#6B6B6B` / `#9A9A9A`; hairline `#E6E6E6`; alt fill `#F2F2F1`; paper `#FAFAF8`; white `#FFFFFF`; sidebar `#161616`; login-dark `#141414`. Accents: voltage `#F4C518`(tint `#FBF3D9`, text `#8A6D00`) urgent/warranty; blue `#0B6FB8`(tint `#E8F1F8`) info; green `#1F8A4C`(tint `#E9F4EE`) success.
- **Status pills** (bg/text/border): New `#FFF1E3/#C25E05/#F6D8BA` · Assigned `#E8F1F8/#0B6FB8/#CBE0F0` · Dispatched `#FBF3D9/#8A6D00/#EDDFA6` · Parts/In-Repair `#F2F2F1/#4A4A4A/#E0E0DE` · Escalated `#FFF1E3/#D96A0A/#F6D8BA` · Resolved `#E9F4EE/#1F8A4C/#CBE5D6`.
- **Type:** Saira Condensed 800 (wordmark/display), Inter Tight 600–800 (headlines/UI + ALL-CAPS micro-labels .06–.24em), Inter 400–600 (body/table), JetBrains Mono 500–700 tabular (numbers/IDs/₹, KPI 25–27px).
- **Geometry:** 4px spacing scale; radii cards/buttons 8px, inputs 6px, pills 999px, modals **14px**; cards white + hairline + `0 1px 2px rgba(15,15,15,.06)`, elevated `0 6px 16px rgba(15,15,15,.08)`. No colored left-border cards, no glass/blur.

---

## 3. COMPONENT LIBRARY (design once, reuse) — **incl. the MODAL spec**

Reuse §4 of the brief (shell sidebar, top bar, KPI card, data table, filter chips, buttons, forms, right-rail widgets, timeline, empty states, tabs, toasts, status pills). **Plus the popup/modal system, specified here because the whole of §6 depends on it:**

**Modal / dialog (light Iron Console — NOT dark):**
- Scrim `rgba(15,15,15,.45)`, 180ms fade. Panel: white, **14px radius**, `0 12px 40px rgba(15,15,15,.18)`, 220ms scale .965→1. Widths: sm 420 / md 520 / lg 640 / xl 860.
- **Header:** left icon (Lucide, tone by purpose) + title in Inter Tight 700; the record's **ID/number in mono** beside the title (e.g. "Take Action — MG-R-20260401-77733"); close ✕ top-right.
- **Body:** grouped sections; each field has an ALL-CAPS micro-label over the control; read-only "spec rows" for detail dialogs (label left muted, value right); a muted context strip (customer + issue) where the action needs it; inline note/escalation blocks tinted by their accent.
- **Footer:** right-aligned — ghost **Cancel** + primary orange action; destructive actions use the red/deep-orange danger button; show a spinner + disabled state while submitting; enforce and show validation (e.g. "notes min 15 chars", live char count).
- **Tabbed detail modal** variant (e.g. Ticket Details): underline tab bar (orange active) with Info / Warranties / History / Audit Trail.
- **Wizard/confirm** variants: multi-step forms use a stepper; confirmations restate the affected record + consequence.
- States to draw for each popup: **at-rest**, **invalid (field errors)**, **submitting**. Detail/read-only popups: **loaded** + **empty/not-found**.

---

## 4. LAYOUT PATTERNS (apply per page — full detail in brief §5)
A Dashboard · B List/Queue · C List→Detail (master-detail) · D Record/Form/Wizard · E Report/Analytics · F Auth · G Kiosk/Mobile · H Public showcase (reference only; store excluded).

---

## 5. COMPLETE PAGE INVENTORY — **one hi-fi artifact each** (~180)

*(pattern in parentheses; group = left-nav workspace. The nav itself must show ALL of these grouped items — nothing dropped.)*

### Auth & shell
Login / role login (Agent·Dealer·Admin toggle) **(F)**; Dealer login; Dealer register; Customer/Warranty registration **(F/D)**. The **app shell** (dark grouped sidebar + light top bar with ⌘K search) is its own deliverable.

### Admin
AdminDashboard(A), AdminAnalytics(E), ComplianceDashboard(E), AdminActivityLogs(B), CronRuns(B); AdminUsers(B), AdminEmployees(B), AdminAttendance(B), AdminPayroll(E), AdminFirms(B); AdminTickets(B), AdminTicketDetail(C), AdminRepairs(B), AdminWarranties(B), AdminWarrantyClaims(B), AZClaims(B), KnowledgeBase(C); AdminMasterSKU(B), AdminSKUManagement(B), AdminSpareParts(B), AdminSpareOrders(B), SkuWeights(B), UnmappedAmazonSkus(B), ProductDatasheets(B), StockReports(E); AdminOrders(B), AdminOnlineOrders(B), OrdersFoldersPage(B), AmazonSettings(D), AmazonRefunds(B), AmazonRefundLosses(E), AdminOmnidimCalls(B); DealerManagement(B), DealerProfile(C), AdminDealerApplications(B), AdminDealerTerms(D); AdminCustomers(B), PartyMaster(B), AdminDataManagement(B), ClaudeFiles(B); AdminCampaigns(B), AdminWhatsAppAgent(C), AdminWhatsAppChats(C), EmailAgent(C), SmartfloAgents(B), AdminReviewRescue(B), ReviewRewards(B), MissedLeads(B), AdminZohoForms(B), AdminZohoTickets(B), AdminSolarSamrat(A), AdminSupervisorProduction(E), LegalCases(B), ImporterReconciliation(E), browser-agent(C), whatsapp(C).

### Supervisor
SupervisorDashboard(A), SupervisorTeam(A), SupervisorProduction(E), SupervisorWarranties(B), SupervisorCalendar(calendar), QAScorecards(E).

### Call support / service
CallSupportDashboard(A), CallSupportInbox(C), EmailTicketInbox(C), ServiceAgentDashboard(A).

### Technician
TechnicianDashboard(A), TechnicianProduction(E).

### Dispatcher / gate / dispatch
DispatcherDashboard(A), DispatcherTVMode(G), DispatchTasks(B), ViewDispatchQueue(B), GateDashboard(A), GateDashboardMobile(G — Return-OTP kiosk).

### Accountant
AccountantDashboard(A), SalesRegister(B), PurchaseRegister(B), Payments(B), CreditNotes(B), PartyLedger(C), ExpensesDashboard(E), AccountingReports(E), ReconciliationReports(E), ProductionRequests(B), IncomingInventoryQueue(B), PendingFulfillment(B), AccountantInventory(B), ViewPendingFulfillment(B).

### Finance
FinanceDashboard(A), FinanceAnalytics(E), BankReconciliation(E), EcommerceReconciliation(E), ReconciliationMatch(C), GSTAudit(E), GSTHSNDashboard(E), TDSDashboard(E), ImportCosting(E), UnbookedReceipts(B). Read-only portals: CADashboard(E), LawyerDashboard(B), ImporterPortal(D), FinanceAgent/Inbox/Watch(C).

### Sales / quotations / leads / incentives
SalesOrders(B), LeadsPage(B), CallsDashboard(A); QuotationList(B), QuotationForm(D), PIPendingAction(B), PublicQuotationView(read-only), CustomerQuotations(B); AdminIncentives(E), MyIncentives(E), MyAttendance(B), MyWarranties(B).

### Inventory / operations
SerialNumbersManagement(B), AmazonOrders(B), CourierShipping(B), CourierTracking(A).

### Dealer portal
DealerDashboard(A), DealerCatalogue(B), DealerProducts(B), DealerPlaceOrder(D), DealerOrders(B), DealerDispatches(B), DealerLedger(C), DealerDeposit(D), DealerSpareParts(B), DealerSpareOrders(B), DealerCustomers(B), DealerTickets(B), DealerWarrantyClaims(B), DealerWarrantyRegistration(D), DealerReorderSuggestions(B), DealerTargets(E), DealerPerformance(E), DealerPromotions(B), DealerAnnouncements(B), DealerDocuments(B), DealerCertificate(doc), DealerTerms(D), DealerProfile(C).

### Customer portal
CustomerDashboard(A), CreateTicket(D), CustomerTickets(B), CustomerAppointments(B), MyWarranties(B), WarrantyRegistration(D), Customer 360(C).

### Chat
ChatPage(C) — internal team chat.

### Public (pattern H — brighter sub-theme; **store itself excluded**)
CatalogueHome, CategoryListing, BatteryShowcase, StabilizerShowcase, ServoShowcase, SolarPanelShowcase, AccessoriesListing, PublicDatasheetView, VerifyDealer.

---

## 6. COMPLETE POPUP / DIALOG INVENTORY — **one hi-fi artifact each** (~70)

Every one of these is a real modal in the app. Design each with the §3 modal system (at-rest + validation + submitting; detail dialogs get loaded + empty). Grouped by area:

**Tickets & support:** Create New Ticket · Create Support Ticket · Create New Ticket for Repair Item · Register Walk-in Customer · Ticket Details (tabbed: Info/Warranties/History/Audit) · Update Ticket · Take Action (supervisor: in-process/resolve/send-spare/reverse-pickup/close, with SKU picker + notes-min) · Complete Feedback Call · Upload Shipping Label · Reject Quotation.

**Customers & parties:** Add New Customer · Edit Customer · Migrate Customers · Party Details · Register Walk-in Customer (shared).

**Dealers:** Add New Dealer · Edit Dealer · Review Application · Review Deposit · Upload Payment Proof · New Promo Request.

**SKU / inventory / production:** Add New SKU · Create Master SKU · Edit Master SKU · Master SKU Details · Edit SKU · Adjust Stock · Add Stock Entry · Add Raw Material (Global) · Edit Raw Material · Transfer Stock Between Firms · Classify Incoming Item · Confirm Receipt Into Inventory · Create Production Request · Production Request Details · Production Details · Complete Production — Enter Serial Numbers · Queue Entry Details · Map Amazon SKUs to Master SKUs.

**Orders & dispatch:** Edit Order · Order (details) · Create Outbound Dispatch · Create Spare Part Dispatch · Link Transaction to CRM Dispatch.

**Finance & accounting:** Create Sales Invoice · Invoice Details · Create Credit Note · Credit Note Details · Record Payment · Payment Details · Record a manual refund · Enter GST ITC Balance · Upload Payout Statement · Add data gap · Record legal notice sent.

**HR / payroll / incentives:** Add New User · Edit User · Add Salary Configuration · Edit Salary Configuration · Add Payroll Adjustment · Add Manual Incentive · Edit Incentive · Incentive Configuration.

**Firms / admin config:** Create New Firm · Edit Firm · Amazon SP-API Credentials.

**Warranty / appointments:** Warranty Details · Update Appointment.

**Global patterns (design as reusable):** confirm/destructive dialog, ⌘K global search palette, toast, bulk-edit sheet, file-upload dialog, image/PDF viewer.

*(If more dialogs surface during implementation, apply the same modal system — this list is the known set as of this order.)*

---

## 7. STATES CHECKLIST (per artifact)
- **List/table pages:** populated · filtered · empty · loading skeleton · error · pagination footer.
- **Dashboards:** live · zero-data · loading.
- **Forms/wizards:** empty · filled · field-error · submitting · success toast.
- **Detail pages:** loaded · not-found.
- **Popups:** as §3 (at-rest · invalid · submitting; detail: loaded · empty).

---

## 8. MOBILE / KIOSK
Gate mobile (OTP kiosk, big tap targets), Dispatcher TV (read-at-distance), customer & dealer flows (phone-first). High contrast, single column, large controls.

---

## 9. DELIVERABLE + SUGGESTED PROMPT

**Deliverable:** design-token sheet + component library (incl. the modal system) + **~180 page artifacts** + **~70 popup artifacts**, each with its states, desktop + mobile where noted. Calibrate against the shipped **Supervisor dashboard**, **Admin home**, **Ticket list/detail**, and **Customer 360** already live in Iron Console.

**Paste this to the design tool:**
> Read `CRM_Redesign_Brief_IronConsole.md`, `CRM_REDESIGN_PRODUCTION_ORDER.md`, and `tokens/colors_and_type.css` fully, and study the `data-screen-label` archetypes A–H in `Iron Console CRM.dc.html`. Then **produce one high-fidelity screen for every page in §5 and every popup in §6 of the production order** — not archetypes, the full list (~180 pages + ~70 popups), each with the states in §7, using the exact Iron Console tokens/components and the modal system in §3. Work in batches by section; after each batch, list what remains until the entire inventory is covered. Keep the left sidebar showing all grouped menu items. Do NOT redesign the public store.
