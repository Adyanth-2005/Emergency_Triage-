# Visual Skin — "Integrated Biosciences" (bioluminescent laboratory at midnight)

The P5 ED Triage & Medico-Legal **product is unchanged**. This document records the
re-skin that maps the console onto the DESIGN.md visual language, applied as a
non-destructive theme layer (`static/css/lab-theme.css`, loaded after `console.css`) plus
one signature system (`static/js/lab.js`). No backend, route, workflow, test, or business
rule was touched — `test_e2e.py` 25/25 and `test_m3.py` 26/26 still pass.

## Concept — "Midnight Vitals Lab"

The emergency department rendered as a darkroom laboratory bench at midnight: a near-black
Abyssal-Ink canvas with a cool green undertone, flat lab-poster surfaces delineated by
hairlines, single-weight editorial type for human statements, Roboto-Mono for every
instrument reading (serials, timestamps, hashes, level codes, statuses), and one
bioluminescent-lime signal that only ever lights **interactive micro-surfaces**.

## Palette extracted from DESIGN.md → tokens

| DESIGN.md role | Value | Used for |
|---|---|---|
| Abyssal Ink | `#222f30` | primary card surface / nav / ink canvas |
| (midnight base) | `#192224` | page base for depth under the field |
| Bone / Paper | `#f5f6f1` / `#fff` | text, paper-fill primary buttons |
| Graphite / Lichen | `#7d8883` / `#a9b2ac` | secondary + muted text |
| Hairline | `#34433f` | all borders/dividers (1px, no shadows) |
| **Bioluminescent Lime** | `#cef79e` | active nav pill, logo mark, focus ring, live/chain dot, arrow/CTA affordances, evidence-confidence bars |

Full token set (surfaces, text, radii 8/12/16/20, flat elevation) in `lab-theme.css :root`.

## Discipline honoured

- **Single-weight type** — Aspekta substitute (system-ui, offline) at 400; hierarchy by size + negative tracking (display headlines `clamp(30px,4.6vw,54px)`, `-0.03em`). Roboto-Mono (offline substitute) for all technical labels, nav, counters, metadata.
- **Flat** — no box-shadows, no gradients on surfaces; depth from colour contrast + 1px hairlines only. Glass blur removed.
- **Rationed accent** — lime never fills a large surface; primary CTAs use paper-on-ink fills, exactly per DESIGN.md's "Filled Action Button."

## Documented reconciliations (product safety overrides pure brand)

- **Five acuity colours (L1→L5)** are functional clinical data-encoding, not decoration, so they are retained (tuned to read on Abyssal Ink). Every *non-acuity* surface is monochrome ink + the single lime signal.
- **MLC** keeps a restrained warm-brick signal (dot + hairline + mono label, never a large fill) because medico-legal status is a legal-severity signal, not ornament.

## Signature system — "Midnight Vitals Field" (`lab.js`)

A dependency-free, offline canvas: soft cells drift across the ink and connect with
hairline synapses; a few pulse with the lime signal — the department as a living organism,
sitting behind the flat UI as calm depth (never competing with content). DPR-capped at 1.5,
node count scales with viewport, pauses on tab-hide, and renders a **single static frame**
under `prefers-reduced-motion`. This is where the "3D/motion ambition" lives — the UI chrome
itself stays deliberately flat, per the brand.

## Files

- **Created:** `static/css/lab-theme.css`, `static/js/lab.js`, `docs/DESIGN_SKIN.md`.
- **Modified:** `templates/index.html` (link theme + mount canvas), `static/favicon.svg` (lime-on-ink mark).
- **Untouched:** all Python, `schema.sql`, `seed.py`, tests, `console.css` (base preserved).

---

## Addendum — THE LIVING WARD (creative-direction upgrade, approved)

The field was upgraded from decorative plankton to a **data-driven organism**: `lab.js`
now mirrors real active encounters via `/api/board` (cells keyed by encounter id,
deterministic seeded layout), encodes acuity as colour + pulse rate (L1 0.7s → L5 5.2s),
keeps untriaged cells as colourless bone shimmer (acuity exists only after human
confirmation), gives MLC cells a warm-brick halo, flares NABH breaches, and reorganizes
per route (board = acuity strata; triage/encounter = one focused cell with orbit ring;
audit = field recedes and the **Evidence Strand** is foregrounded). v3 adds cinematic
depth to the reference quality bar: a hand-rolled 3D projection (no WebGL) renders the
strand as a massive helical audit-chain spine running diagonally beyond the viewport —
slow twirl + travelling wave, scroll-velocity stir, per-route camera drift, data-dust
fog and vignette — severed visibly at the exact break row when `/api/audit` reports a
broken chain.

- **Motion contract (§12):** only six motions exist — nucleation, stabilization, breach
  flare, halo, spine forge, release (Death: cell fades to bone; the field holds one still
  breath). App code dispatches them via `lwEvent(type, detail)` → `lw:event` CustomEvents;
  the field never blocks or delays a clinical action (all fetches try/catch, canvas is
  `aria-hidden`, pointer-events none, content-zone dim keeps legibility).
- **New chrome:** sidebar **Evidence Spine strip** (`#spineStrip`, verified/broken state +
  forge sweep on every audited save), lime `:focus-visible` rings, magnetic primary CTA
  (≤6px, pointer only), board **Wall display** mode (`body.wallboard`, Esc exits), mobile
  bottom **tab bar** ≤760px, once-per-session skippable boot line (`WARD ONLINE`).
- **v4 glass (reference-bar):** a disciplined 3-level glass system over the field —
  L1 ambient (cards/KPIs/tables, 14px blur), L2 floating chrome (sidebar/topbar/tab bar,
  18px), L3 focus (modals/palette/toasts/AI card, 26px) — translucent ink + blur keeps
  AA contrast while the organism shows through; cheaper blur ≤760px; `@supports`-gated
  with the flat skin as fallback. Hovering an audit row lights that row's link on the
  helix (`strand.hot`). Documented reconciliation: DESIGN.md's "no glass" is superseded
  for surfaces only by the approved Living Ward v4 direction; hairlines, single-weight
  type, and the lime ration are unchanged.
- **Budget honoured:** DPR ≤1.5 (1 on mobile), ambient count scales with area (≤56),
  synapses desktop-only, rAF paused on tab-hide, ~10fps after 60s idle,
  `prefers-reduced-motion` → static equally-usable frames, no WebGL/frameworks (D-7).
- **v5 — seamless (structure without boxes):** the card-first surface language is
  dissolved. `.card`/`.kpi`/`.tbl-wrap` lose backgrounds, borders, radii and blur;
  hierarchy now comes from typography (display h1 clamp 40–84px, 62px KPI numerals,
  mono uppercase card headings), whitespace, and half-strength hairlines
  (`rgba(52,67,63,.55)`: card top-rules, KPI left-rules — coral/amber when alerting —
  table head rules, fieldset rules). Forms are bottom-border fields (lime focus
  underline). Glass remains ONLY where separation is functional: chrome
  (sidebar/topbar/tab bar), overlays (modal/palette/menu/toast), the AI advisory
  card, and statutory warn banners. Content-zone dim deepened (cells ×0.4,
  strand ×0.65 under content) since text now sits directly on the field. All
  changes are CSS-only in `lab-theme.css`; DESIGN.md's hairline/typography ethos
  is thereby restored as the primary structure system, with v4 glass demoted to
  functional-separation duty.
- **Files:** rewritten `static/js/lab.js`; appended layer in `static/css/lab-theme.css`;
  additive hooks in `static/js/app.js` (event dispatches, strip, tab bar, wall button);
  **`preview.html`** — a stubbed-API design-review harness at repo root (not served by
  Flask; the real product remains `python app.py`). Backend, schema, seed, tests untouched.
