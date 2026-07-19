export const meta = {
  name: 'iron-console-page-sweep',
  description: 'Convert a batch of CRM pages to the Iron Console theme, preserving all functionality',
  phases: [
    { title: 'Convert', detail: 'one agent per page: rebuild on IronShell/IronKit, write <Name>Iron.jsx' },
    { title: 'Verify', detail: 'adversarial check that every endpoint + action + modal is preserved' },
  ],
}

const _A = typeof args === 'string' ? JSON.parse(args) : args
const PAGES = Array.isArray(_A) ? _A : (_A && _A.pages) || []

const KIT = `
IRON CONSOLE KIT (already built — import, do not recreate):
- Shell:  import IronShell from '@/components/iron/IronShell'
    <IronShell title="Page Title" subtitle="MONO SUBTITLE" onRefresh={fetchFn} headerRight={<...buttons>}>{content}</IronShell>
    IronShell renders a dark grouped sidebar + light top bar (⌘K PowerSearch) + main. It AUTO-SELECTS the correct
    sidebar for the logged-in role — do NOT pass a nav prop and do NOT use DashboardLayout.
    IronShell's root already forces native <input>/<select> light; style form controls with plain inline styles.
- Primitives: import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle, ticketPill, fmtDateTime } from '@/components/iron/IronKit'
    T tokens: T.orange '#F58220', T.orangeDeep '#D96A0A', T.iron900 text, T.iron700, T.iron500, T.iron400 muted, T.iron200 hairline, T.iron100, T.iron50 alt, T.white, T.green, T.blue, T.voltageText; fonts T.headline, T.body, T.mono, T.display.
    <Caps size={9} color={T.iron400}>UPPERCASE</Caps>. <IronCard pad={0|14}>. mono={fontFamily:T.mono,fontVariantNumeric:'tabular-nums'} for IDs/₹/counts/dates. thCell/tdCell. badgeStyle(tone) tone 'ok'|'info'|'warn'|'bad'|'violet'|'slate'. ticketPill(status). fmtDateTime(d).
- Table: <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr style={{borderBottom:'1px solid '+T.iron200,background:T.iron50}}>{H.map(h=><th style={thCell}><Caps size={8.5}>{h}</Caps></th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.id} className="iron-row" style={{borderBottom:'1px solid '+T.iron200}}>...tdCell; mono numbers; badgeStyle pills...</tr>)}</tbody></table>
- Buttons: primary {border:'none',background:T.orange,color:'#fff',borderRadius:6,padding:'8px 14px',fontFamily:T.headline,fontWeight:700,fontSize:12,cursor:'pointer'}; outline {border:'1px solid '+T.iron200,background:T.white,color:T.iron700}.
- Input/select: {border:'1px solid '+T.iron200,borderRadius:6,padding:'7px 10px',fontSize:12.5,color:T.iron900,background:T.white,outline:'none'}. Money ₹ Indian format. Recharts: keep, recolor orange line + T.iron200 grid + mono axis + light tooltip.
REFERENCE (READ the matching one):
  /var/www/crm/frontend/src/pages/admin/AdminTickets1a.jsx      (list + filters + Iron table + pagination + CSV)
  /var/www/crm/frontend/src/pages/admin/AdminOrdersIron.jsx     (list + KPI tiles + tabs + view/edit/delete dialogs)
  /var/www/crm/frontend/src/pages/admin/AdminDashboard1a.jsx    (dashboard: KPI cards + recharts area chart, all light)
  /var/www/crm/frontend/src/pages/support/CustomerThreeSixty.jsx (detail/tabs)
  /var/www/crm/frontend/src/components/iron/IronKit.jsx  and  IronShell.jsx
`

const CONVERT_SCHEMA = { type: 'object', properties: {
  name: { type: 'string' }, newFile: { type: 'string' }, ok: { type: 'boolean' },
  endpoints: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' },
}, required: ['name', 'newFile', 'ok', 'endpoints', 'notes'] }
const VERIFY_SCHEMA = { type: 'object', properties: {
  ok: { type: 'boolean' }, missingEndpoints: { type: 'array', items: { type: 'string' } }, issues: { type: 'array', items: { type: 'string' } },
}, required: ['ok', 'missingEndpoints', 'issues'] }

const convertPrompt = (pg) => `Convert an existing MuscleGrid CRM page to the "Iron Console" theme, preserving 100% of its behavior.

TARGET: ${pg.file}  (default export: function ${pg.name})

1. Read ${pg.file} in FULL. Catalogue EVERY: axios call (exact URL + method + params/body + Authorization Bearer header from the page's token source), state var, table column, filter/search, pagination, tab, action button, dialog/modal, file upload, CSV/print export, chart, empty/loading state, role logic.
2. Read the reference implementations + KIT below; mirror the matching one (list / dashboard / detail).
3. Write NEW file: ${pg.file.replace(/\.jsx$/, 'Iron.jsx')}
   - MUST be \`export default function ${pg.name}(...)\` — SAME name + same route props (a drop-in; the import is re-pointed to this file).
   - Wrap in <IronShell title="${pg.title}" ...> (do NOT pass nav). Remove DashboardLayout + framer-motion.
   - PRESERVE EXACTLY every axios endpoint (URL/method/params/body/headers), every action, every modal (keep existing shadcn Dialog/Select/etc; restyle triggers), pagination, filters, exports, toasts, charts, empty/loading. Do NOT drop/rename/simplify away ANY endpoint or feature.
   - Restyle to Iron Console. Valid JS (balanced JSX; NO python-isms like [:n] -> use .slice; single root return).
4. Create ONLY that one new file. Do NOT touch App.js or shared files.
5. If too complex to convert faithfully + build-safe, set ok:false + reason in notes; do NOT write a broken file.
Return schema JSON listing every endpoint preserved.
${KIT}`

const verifyPrompt = (pg, conv) => `Adversarially verify a converted Iron Console page is a faithful, build-safe drop-in. Default ok:false if unsure.
ORIGINAL: ${pg.file}
NEW:      ${conv.newFile}
Read BOTH. Confirm ALL: (1) NEW default export is function ${pg.name}; (2) NEW uses <IronShell> and does NOT import DashboardLayout; (3) every axios endpoint URL in ORIGINAL appears in NEW with same method + params/body (list missing/altered); (4) every action button + dialog/modal + export + pagination + filter + chart present; (5) no build-breakers (unbalanced braces/tags, python slices [:n], undefined imports, duplicate identifiers, multiple root elements). Return ok:true only if all hold.`

phase('Convert')
const results = await pipeline(
  PAGES,
  (pg) => agent(convertPrompt(pg), { label: `convert:${pg.name}`, phase: 'Convert', schema: CONVERT_SCHEMA }),
  (conv, pg) => {
    if (!conv || !conv.ok) return { page: pg.name, ok: false, convert: conv, verify: null }
    return agent(verifyPrompt(pg, conv), { label: `verify:${pg.name}`, phase: 'Verify', schema: VERIFY_SCHEMA })
      .then((v) => ({ page: pg.name, newFile: conv.newFile, ok: !!(v && v.ok), convert: conv, verify: v }))
  }
)
const good = results.filter((r) => r && r.ok)
const bad = results.filter((r) => !r || !r.ok)
log(`OK ${good.length}/${PAGES.length}. Needs attention: ${bad.map((b) => b && b.page).join(', ') || 'none'}`)
return { good: good.map((g) => ({ page: g.page, newFile: g.newFile })), bad: bad.map((b) => ({ page: b && b.page, reason: (b && b.convert && !b.convert.ok && b.convert.notes) || (b && b.verify && [].concat(b.verify.issues || [], b.verify.missingEndpoints || [])) })) }
