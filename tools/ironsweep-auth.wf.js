export const meta = {
  name: 'iron-console-auth-sweep',
  description: 'Convert auth/login screens to a centered Iron Console theme (no sidebar), preserving all auth logic',
  phases: [
    { title: 'Convert', detail: 'one agent per auth page: centered dark Iron card, IronKit tokens, NO IronShell' },
    { title: 'Verify', detail: 'adversarial check that every auth endpoint + form + token/redirect is preserved' },
  ],
}

const _A = typeof args === 'string' ? JSON.parse(args) : args
const PAGES = Array.isArray(_A) ? _A : (_A && _A.pages) || []

const KIT = `
IRON CONSOLE AUTH KIT — these are LOGGED-OUT screens, so DO NOT use IronShell/DashboardLayout (no sidebar).
- Import tokens only: import { T, Fonts } from '@/components/iron/IronKit'
    T.orange '#F58220', T.orangeDeep '#D96A0A', T.iron900 (near-black text/bg), T.iron700, T.iron500, T.iron400,
    T.iron200 hairline, T.iron100, T.iron50, T.white; fonts T.headline, T.body, T.mono, T.display.
- Render <Fonts /> once, then a FULL-SCREEN dark canvas (minHeight:100vh, background: a dark Iron gradient e.g.
  'radial-gradient(1200px 600px at 50% -10%, #23262B, #141517)') with a CENTERED card:
    card = { width:'min(420px,100%)', background:T.white, borderRadius:14, padding:'32px 30px',
             boxShadow:'0 30px 80px rgba(0,0,0,.45)', border:'1px solid '+T.iron200 }.
- Brand: show the MuscleGrid monogram/logo at the top of the card (reuse any existing <img src="/redesign/mg-monogram.png"> or logo the ORIGINAL used; else a bold "MuscleGrid" wordmark in T.display/T.headline with an orange accent).
- Inputs: { width:'100%', border:'1px solid '+T.iron200, borderRadius:8, padding:'11px 13px', fontSize:14, color:T.iron900, background:T.white, outline:'none' } with a small uppercase label (T.mono/headline, T.iron400) above each.
- Primary button: { width:'100%', border:'none', background:T.orange, color:'#fff', borderRadius:9, padding:'12px 0', fontFamily:T.headline, fontWeight:700, fontSize:14.5, cursor:'pointer' }. Secondary links in T.orange.
- Errors/toasts: keep the ORIGINAL's error surface (inline text in a red tone or the same toast lib import). Keep any loading spinner.
REFERENCE: read /var/www/crm/frontend/src/components/iron/IronKit.jsx for the exact tokens.
`

const CONVERT_SCHEMA = { type: 'object', properties: {
  name: { type: 'string' }, newFile: { type: 'string' }, ok: { type: 'boolean' },
  endpoints: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' },
}, required: ['name', 'newFile', 'ok', 'endpoints', 'notes'] }
const VERIFY_SCHEMA = { type: 'object', properties: {
  ok: { type: 'boolean' }, missingEndpoints: { type: 'array', items: { type: 'string' } }, issues: { type: 'array', items: { type: 'string' } },
}, required: ['ok', 'missingEndpoints', 'issues'] }

const convertPrompt = (pg) => `Restyle an existing MuscleGrid auth/login screen to a centered "Iron Console" theme, preserving 100% of its auth behaviour. This is a LOGGED-OUT screen — NO sidebar.

TARGET: ${pg.file}  (default export: function ${pg.name})

1. Read ${pg.file} in FULL. Catalogue EVERY: axios/fetch call (exact URL + method + body + headers), every form field, validation rule, error/toast surface, loading state, localStorage/token write, navigate()/redirect + role-based routing, OTP flow, "remember me", links (forgot/register), and any query-param handling.
2. Write NEW file: ${pg.file.replace(/\.jsx$/, 'Iron.jsx')}
   - MUST be \`export default function ${pg.name}(...)\` — SAME name + same props (drop-in; import re-pointed).
   - PRESERVE EXACTLY every endpoint (URL/method/body/headers), token/localStorage writes, navigation targets, role routing, validation, error handling, OTP/multi-step logic. Do NOT drop or rename ANY of it.
   - Restyle to the centered Iron auth look per KIT below. NO IronShell / NO DashboardLayout. Remove framer-motion. Valid JS (balanced JSX, single root, no python-isms). Keep the same toast/router imports the original used.
3. Create ONLY that one new file. Do NOT touch App.js or shared files.
4. If too complex to convert faithfully + build-safe, set ok:false + reason in notes; do NOT write a broken file.
Return schema JSON listing every endpoint preserved.
${KIT}`

const verifyPrompt = (pg, conv) => `Adversarially verify a converted Iron auth screen is a faithful, build-safe drop-in. Default ok:false if unsure.
ORIGINAL: ${pg.file}
NEW:      ${conv.newFile}
Read BOTH. Confirm ALL: (1) NEW default export is function ${pg.name}; (2) NEW does NOT import IronShell/DashboardLayout (auth screens have no sidebar); (3) every axios/fetch endpoint (URL+method+body) in ORIGINAL appears in NEW; (4) token/localStorage writes + navigate()/redirect targets + role routing + OTP/multi-step logic + validation + error surface are all preserved; (5) no build-breakers (unbalanced JSX, undefined imports, duplicate identifiers, multiple roots). Return ok:true only if all hold — a broken login locks everyone out, so be strict.`

phase('Convert')
const results = await pipeline(
  PAGES,
  (pg) => agent(convertPrompt(pg), { label: `auth-convert:${pg.name}`, phase: 'Convert', schema: CONVERT_SCHEMA }),
  (conv, pg) => {
    if (!conv || !conv.ok) return { page: pg.name, ok: false, convert: conv, verify: null }
    return agent(verifyPrompt(pg, conv), { label: `auth-verify:${pg.name}`, phase: 'Verify', schema: VERIFY_SCHEMA })
      .then((v) => ({ page: pg.name, newFile: conv.newFile, ok: !!(v && v.ok), convert: conv, verify: v }))
  }
)
const good = results.filter((r) => r && r.ok)
const bad = results.filter((r) => !r || !r.ok)
log(`OK ${good.length}/${PAGES.length}. Needs attention: ${bad.map((b) => b && b.page).join(', ') || 'none'}`)
return { good: good.map((g) => ({ page: g.page, newFile: g.newFile })), bad: bad.map((b) => ({ page: b && b.page, reason: (b && b.convert && !b.convert.ok && b.convert.notes) || (b && b.verify && [].concat(b.verify.issues || [], b.verify.missingEndpoints || [])) })) }
