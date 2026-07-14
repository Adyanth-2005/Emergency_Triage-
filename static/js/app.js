/* =====================================================================
   ED Triage Console — single-page app (vanilla JS, no build, offline).
   P5 Emergency Department Triage & Medico-Legal Workflow (PRD-05).

   Talks only to the frozen M2 API + the additive M3 read models. Every
   AI/engine output is ADVISORY: the human owns every clinical number and
   every statutory action. Nothing here writes a record the server did not
   validate server-side.
   ===================================================================== */
(() => {
"use strict";

/* ---------------- reduced motion ---------------- */
const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------- icons (Lucide-style) ---------------- */
const P = {
  dashboard: '<path d="M3 3h8v8H3zM13 3h8v5h-8zM13 12h8v9h-8zM3 15h8v6H3z"/>',
  board: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12"/>',
  userplus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  shieldcheck: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  chevronR: '<path d="m9 18 6-6-6-6"/>',
  chevronD: '<path d="m6 9 6 6 6-6"/>',
  chevronL: '<path d="m15 18-6-6 6-6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  sparkles: '<path d="M12 3l1.9 4.6L18.5 9l-4.6 1.4L12 15l-1.9-4.6L5.5 9l4.6-1.4z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9zM5 15l.7 1.6L7.3 17l-1.6.7L5 19l-.7-1.6L2.7 17l1.6-.7z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  arrowDown: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  minus: '<path d="M5 12h14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>',
  steth: '<path d="M4 3v6a5 5 0 0 0 10 0V3"/><path d="M4 3H2M14 3h2M9 18a4 4 0 0 0 8 0v-3"/><circle cx="20" cy="12" r="2"/>',
  siren: '<path d="M7 18v-6a5 5 0 0 1 10 0v6"/><path d="M5 21h14M12 2v2M4.2 6.2 5.6 7.6M18.4 7.6l1.4-1.4"/>',
  pulse: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  scale: '<path d="M12 3v18M8 21h8M4 7h16M6 7l-3 6a4 4 0 0 0 6 0zM18 7l-3 6a4 4 0 0 0 6 0z"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  bed: '<path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2"/>',
  zap: '<path d="M13 2 3 14h7l-1 8 10-12h-7z"/>',
  hash: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
  gavel: '<path d="m14 13-7.8 7.8a2 2 0 0 1-2.8-2.8L11.2 10M16 16l6-6M8 8l6-6M9 7l4 4M17 15l4 4M14 5l5 5"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
};
function icon(n, cls) {
  return `<svg class="${cls||''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]||''}</svg>`;
}

/* ---------------- roles / RBAC (advisory, UI-level) ---------------- */
const ROLES = {
  nurse:     { name: "N. Priya",     role: "Triage Nurse", init: "NP" },
  physician: { name: "Dr. A. Verma", role: "Physician",    init: "AV" },
  cmo:       { name: "Dr. S. Menon", role: "CMO",          init: "SM" },
  admin:     { name: "System Admin", role: "Admin",        init: "SA" },
};
const PERMS = {
  nurse:     new Set(["register","triage"]),
  physician: new Set(["register","triage","attend","dispose","mlc","intimation"]),
  cmo:       new Set(["register","mlc","intimation"]),
  admin:     new Set(["register","triage","attend","dispose","mlc","intimation"]),
};
const state = {
  roleKey: localStorage.getItem("ed_role") || "physician",
  scale: [], counts: {}, collapsed: localStorage.getItem("ed_collapsed") === "1",
  boardTimer: null,
};
function actor() { const r = ROLES[state.roleKey]; return `${r.name} (${r.role})`; }
function can(a) { return (PERMS[state.roleKey] || new Set()).has(a); }

/* ---------------- API ---------------- */
const api = {
  async req(method, path, body) {
    try {
      const opt = { method, headers: {} };
      if (body !== undefined) { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
      const r = await fetch(path, opt);
      let data = null; try { data = await r.json(); } catch (e) {}
      return { ok: r.ok, status: r.status, data };
    } catch (e) { return { ok: false, status: 0, data: null, offline: true }; }
  },
  get(p) { return this.req("GET", p); },
  post(p, b) { return this.req("POST", p, b || {}); },
};

/* ---------------- utilities ---------------- */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }
function pretty(k) { return String(k || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }
function levelClass(l) { return l ? `lvl-${l}` : "lvl-none"; }
function spine(l) { return l ? `spine-${l}` : "spine-none"; }

function fmtTs(iso) {
  if (!iso) return "—";
  const d = new Date(iso); if (isNaN(d)) return iso;
  return d.toLocaleString(undefined, { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit", hour12:false });
}
function fmtTime(iso) {
  if (!iso) return "—"; const d = new Date(iso); if (isNaN(d)) return iso;
  return d.toLocaleTimeString(undefined, { hour:"2-digit", minute:"2-digit", hour12:false });
}
function fmtWait(m) {
  if (m == null) return "—"; m = Math.max(0, Math.round(m));
  if (m < 60) return m + "m"; const h = Math.floor(m/60); return h + "h" + (m%60 ? " " + (m%60) + "m" : "");
}
function greeting() { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; }

/* ---------------- toasts ---------------- */
function toast(type, title, msg) {
  const wrap = $("#toasts");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  const ic = { ok:"check", err:"alert", warn:"alert", info:"info" }[type] || "info";
  el.innerHTML = `<span class="ti">${icon(ic)}</span><div><div class="tt">${esc(title)}</div>${msg?`<div class="tm">${esc(msg)}</div>`:""}</div>`;
  el.setAttribute("role", type === "err" ? "alert" : "status");
  wrap.appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 300); }, type === "err" ? 6000 : 3800);
}

/* ---------------- Living Ward field events (decorative; never block care) ---------------- */
function lwEvent(type, detail) {
  try { window.dispatchEvent(new CustomEvent("lw:event", { detail: Object.assign({ type }, detail || {}) })); } catch (e) {}
}

/* ---------------- overlays (modal / palette / menu) ---------------- */
function closeOverlay() {
  const root = $("#overlay-root"); root.innerHTML = ""; document.removeEventListener("keydown", overlayKey);
}
function overlayKey(e) { if (e.key === "Escape") closeOverlay(); }
function openModal({ title, icon: ic, body, footer, wide }) {
  const root = $("#overlay-root");
  root.innerHTML = `<div class="scrim"><div class="modal ${wide?"wide":""}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="m-hd">${ic?`<span class="card-title-icn">${icon(ic)}</span>`:""}<h2>${esc(title)}</h2>
      <button class="icon-btn close" aria-label="Close">${icon("x")}</button></div>
    <div class="m-bd">${body}</div>
    ${footer?`<div class="m-ft">${footer}</div>`:""}</div></div>`;
  const scrim = $(".scrim", root);
  scrim.addEventListener("mousedown", e => { if (e.target === scrim) closeOverlay(); });
  $(".close", root).addEventListener("click", closeOverlay);
  document.addEventListener("keydown", overlayKey);
  const f = $("input,select,textarea,button.primary", root); if (f) setTimeout(() => f.focus(), 60);
  return root;
}

/* ---------------- 3D tilt ---------------- */
function bindTilt(scope) {
  if (RM) return;
  $$(".kpi", scope).forEach(card => {
    card.addEventListener("pointermove", e => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      card.style.transform = `perspective(700px) rotateY(${(px-.5)*8}deg) rotateX(${(.5-py)*8}deg) translateZ(0)`;
      card.style.setProperty("--mx", (px*100)+"%"); card.style.setProperty("--my", (py*100)+"%");
    });
    card.addEventListener("pointerleave", () => { card.style.transform = ""; });
  });
}

/* ---------------- SVG charts ---------------- */
function donut(segs, opts) {
  opts = opts || {}; const size = opts.size || 132, sw = opts.stroke || 16, r = (size - sw)/2, c = 2*Math.PI*r;
  const total = segs.reduce((a,s)=>a+s.value,0) || 1; let off = 0;
  let arcs = segs.filter(s=>s.value>0).map(s => {
    const len = s.value/total*c; const el = `<circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${sw}" stroke-dasharray="${len} ${c-len}" stroke-dashoffset="${-off}" transform="rotate(-90 ${size/2} ${size/2})" stroke-linecap="butt"/>`;
    off += len; return el;
  }).join("");
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(opts.label||'distribution')}">
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="#ffffff10" stroke-width="${sw}"/>${arcs}
    <text x="50%" y="47%" text-anchor="middle" fill="#e7eff6" font-size="26" font-weight="700" font-family="ui-monospace,monospace">${opts.center!=null?opts.center:total}</text>
    <text x="50%" y="62%" text-anchor="middle" fill="#7f95a6" font-size="10.5" letter-spacing="1">${esc(opts.sub||"")}</text></svg>`;
}
function hbars(rows) {
  const max = Math.max(1, ...rows.map(r=>r.value));
  return `<div style="display:grid;gap:10px">${rows.map(r=>`
    <div class="flex" style="gap:12px">
      <span class="lvl ${r.badgeClass||''}" style="flex:0 0 auto">${esc(r.badge)}</span>
      <div style="flex:1"><div class="bar-track" style="background:#ffffff0d;border-radius:7px;overflow:hidden;height:22px">
        <div style="height:100%;width:${r.value/max*100}%;background:${r.color};border-radius:7px;min-width:${r.value?'8px':'0'};transition:width .5s cubic-bezier(.16,1,.3,1)"></div></div></div>
      <span class="mono" style="flex:0 0 34px;text-align:right;color:var(--text-2)">${r.value}</span>
    </div>`).join("")}</div>`;
}
const LVL_COLORS = { 1:"#d21f2c",2:"#e4602e",3:"#e0a30b",4:"#2fa36b",5:"#2a86c4" };

/* ---------------- shell ---------------- */
const NAV = [
  { grp:"Operations", items:[
    { href:"#/", label:"Dashboard", icon:"dashboard" },
    { href:"#/board", label:"Tracking board", icon:"board", count:"active" },
  ]},
  { grp:"Patient flow", items:[
    { href:"#/register", label:"Quick registration", icon:"userplus" },
    { href:"#/patients", label:"ED register", icon:"users" },
  ]},
  { grp:"Medico-legal", items:[
    { href:"#/mlc", label:"MLC register", icon:"gavel", mlc:true, count:"mlc" },
  ]},
  { grp:"Governance", items:[
    { href:"#/audit", label:"Audit trail", icon:"shieldcheck" },
    { href:"#/overrides", label:"Override report", icon:"flag" },
  ]},
];
function renderShell() {
  const app = $("#app");
  app.classList.toggle("collapsed", state.collapsed);
  const r = ROLES[state.roleKey];
  app.innerHTML = `
    <aside class="sidebar">
      <div class="brand">
        <span class="logo">${icon("pulse")}</span>
        <span class="word"><div class="t">ED Triage Console</div><div class="s">PRD-05 · P5</div></span>
      </div>
      <nav class="nav" aria-label="Primary">
        ${NAV.map(g => `<div class="group-label">${g.grp}</div>` + g.items.map(it => `
          <a href="${it.href}" data-nav class="${it.mlc?'mlc-link':''}">
            ${icon(it.icon)}<span class="lbl">${it.label}</span>
            ${it.count?`<span class="count" data-count="${it.count}"></span>`:""}
          </a>`).join("")).join("")}
      </nav>
      <div class="side-foot">
        <div class="spine-strip" id="spineStrip" title="Every confirmed action forges a link on the tamper-evident audit chain">
          <span class="ss-dot" aria-hidden="true"></span><span class="ss-txt mono">EVIDENCE SPINE</span><span class="ss-state mono" id="ssState">·····</span>
        </div>
        <button class="role-chip" id="roleBtn" aria-haspopup="menu">
          <span class="av">${r.init}</span>
          <span class="who"><div class="n">${esc(r.name)}</div><div class="r">${esc(r.role)}</div></span>
          <span class="cv" style="margin-left:auto;color:var(--muted)">${icon("chevronD")}</span>
        </button>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <button class="icon-btn mobile-only" id="mobileNav" aria-label="Menu">${icon("menu")}</button>
        <button class="icon-btn" id="collapseBtn" aria-label="Toggle sidebar">${icon("menu")}</button>
        <div class="crumbs" id="crumbs"></div>
        <button class="search-btn" id="searchBtn" aria-label="Search (Ctrl K)">
          ${icon("search")}<span class="stext">Search or jump to…</span><kbd>Ctrl K</kbd>
        </button>
        <span class="chain-pill" id="chainPill" title="Audit hash-chain status"><span class="dot"></span><span class="ct">chain</span></span>
        <span class="env-badge" title="Deterministic demo environment">Demo</span>
        <button class="icon-btn" id="refreshBtn" aria-label="Refresh">${icon("refresh")}</button>
      </header>
      <main class="view" id="view" tabindex="-1"></main>
    </div>
    <nav class="tabbar" aria-label="Quick navigation">
      <a href="#/" data-nav>${icon("dashboard")}<span>Ops</span></a>
      <a href="#/board" data-nav>${icon("board")}<span>Board</span></a>
      <a href="#/register" data-nav>${icon("plus")}<span>Register</span></a>
      <a href="#/mlc" data-nav>${icon("gavel")}<span>MLC</span></a>
      <a href="#/audit" data-nav>${icon("shieldcheck")}<span>Audit</span></a>
    </nav>`;

  $("#collapseBtn").onclick = () => { state.collapsed = !state.collapsed; localStorage.setItem("ed_collapsed", state.collapsed?"1":"0"); app.classList.toggle("collapsed", state.collapsed); };
  $("#mobileNav").onclick = () => app.classList.toggle("nav-open");
  $("#searchBtn").onclick = openPalette;
  $("#refreshBtn").onclick = () => { toast("info","Refreshing…"); router(); refreshCounts(); };
  $("#roleBtn").onclick = openRoleMenu;
  $$("[data-nav]").forEach(a => a.addEventListener("click", () => app.classList.remove("nav-open")));
  updateChainPill();
  paintCounts();
}
function paintCounts() {
  $$("[data-count]").forEach(el => {
    const k = el.getAttribute("data-count");
    const v = k === "active" ? state.counts.active_encounters : k === "mlc" ? state.counts.mlc_active : null;
    if (v == null) { el.style.display = "none"; } else { el.style.display=""; el.textContent = v; }
  });
}
function updateChainPill() {
  const pill = $("#chainPill"); if (!pill) return;
  const ok = state.counts.audit_chain_intact !== false;
  pill.classList.toggle("broken", !ok);
  $(".ct", pill).textContent = ok ? "Chain intact" : "Chain BROKEN";
  const strip = $("#spineStrip");
  if (strip) { strip.classList.toggle("broken", !ok); const s = $("#ssState"); if (s) s.textContent = ok ? "VERIFIED" : "BROKEN"; }
}
async function refreshCounts() {
  const r = await api.get("/api/dashboard");
  if (r.ok) { state.counts = r.data; paintCounts(); updateChainPill(); }
}
function setCrumbs(items) {
  const c = $("#crumbs"); if (!c) return;
  c.innerHTML = items.map((it,i) => (i?icon("chevronR"):"") + `<span class="${i===items.length-1?'cur':''}">${esc(it)}</span>`).join("");
}

/* ---------------- role menu ---------------- */
function openRoleMenu() {
  const btn = $("#roleBtn"); const rect = btn.getBoundingClientRect();
  const root = $("#overlay-root");
  root.innerHTML = `<div class="scrim" style="background:transparent;backdrop-filter:none">
    <div class="menu" style="position:fixed;left:${rect.left}px;bottom:${window.innerHeight-rect.top+8}px" role="menu">
      <div class="p-sec">Sign in as</div>
      ${Object.entries(ROLES).map(([k,v])=>`<div class="mi ${k===state.roleKey?'on':''}" data-role="${k}" role="menuitem">
        <span class="av">${v.init}</span><div><div style="font-weight:600">${esc(v.name)}</div><div class="muted" style="font-size:11px">${esc(v.role)}</div></div>
        ${k===state.roleKey?`<span style="margin-left:auto;color:var(--teal-2)">${icon("check")}</span>`:""}</div>`).join("")}
      <div class="sep"></div>
      <div class="mi" data-reset="1" role="menuitem">${icon("db")}<span>Reset demo data</span></div>
    </div></div>`;
  const scrim = $(".scrim", root);
  scrim.addEventListener("mousedown", e => { if (e.target === scrim) closeOverlay(); });
  document.addEventListener("keydown", overlayKey);
  $$(".mi[data-role]", root).forEach(mi => mi.onclick = () => {
    state.roleKey = mi.getAttribute("data-role"); localStorage.setItem("ed_role", state.roleKey);
    closeOverlay(); renderShell(); router(); toast("ok","Signed in", `${ROLES[state.roleKey].name} · ${ROLES[state.roleKey].role}`);
  });
  $(".mi[data-reset]", root).onclick = async () => {
    closeOverlay();
    if (!confirm("Rebuild the deterministic demo database? This resets all encounters to the seeded state.")) return;
    toast("info","Resetting demo…");
    const r = await api.post("/api/demo/reset");
    if (r.ok) { toast("ok","Demo reset","Seeded data reloaded."); await refreshCounts(); router(); }
    else toast("err","Reset failed", (r.data&&r.data.detail)||"Only available in demo/debug mode.");
  };
}

/* ---------------- command palette ---------------- */
function openPalette() {
  const cmds = [
    { s:"Go to", label:"Dashboard", icon:"dashboard", go:"#/" },
    { s:"Go to", label:"Tracking board", icon:"board", go:"#/board" },
    { s:"Go to", label:"Quick registration", icon:"userplus", go:"#/register" },
    { s:"Go to", label:"ED register", icon:"users", go:"#/patients" },
    { s:"Go to", label:"MLC register", icon:"gavel", go:"#/mlc" },
    { s:"Go to", label:"Audit trail", icon:"shieldcheck", go:"#/audit" },
    { s:"Go to", label:"Override report", icon:"flag", go:"#/overrides" },
    { s:"Action", label:"Register unknown patient (treat-first)", icon:"zap", act:"quickUnknown" },
    ...Object.entries(ROLES).map(([k,v])=>({ s:"Switch role", label:`${v.name} · ${v.role}`, icon:"users", role:k })),
  ];
  const root = $("#overlay-root");
  root.innerHTML = `<div class="scrim" style="align-items:flex-start"><div class="palette" role="dialog" aria-label="Command palette">
    <div class="p-inp">${icon("search")}<input id="palInp" placeholder="Search screens & actions…" autocomplete="off" aria-label="Command search"></div>
    <div class="p-list" id="palList"></div></div></div>`;
  const scrim = $(".scrim", root); scrim.addEventListener("mousedown", e => { if (e.target === scrim) closeOverlay(); });
  const inp = $("#palInp"), list = $("#palList"); let sel = 0, filtered = cmds;
  function draw() {
    const q = inp.value.trim().toLowerCase();
    filtered = cmds.filter(c => (c.label+ " " +c.s).toLowerCase().includes(q));
    let last = ""; list.innerHTML = filtered.map((c,i) => {
      const sec = c.s !== last ? `<div class="p-sec">${c.s}</div>` : ""; last = c.s;
      return sec + `<div class="p-item ${i===sel?'on':''}" data-i="${i}">${icon(c.icon)}<span>${esc(c.label)}</span></div>`;
    }).join("") || `<div class="empty" style="padding:24px">No matches</div>`;
  }
  function run(c) { closeOverlay(); if (!c) return;
    if (c.go) location.hash = c.go;
    else if (c.role) { state.roleKey=c.role; localStorage.setItem("ed_role",c.role); renderShell(); router(); }
    else if (c.act === "quickUnknown") quickRegUnknown();
  }
  inp.addEventListener("input", () => { sel=0; draw(); });
  inp.addEventListener("keydown", e => {
    if (e.key==="ArrowDown"){e.preventDefault();sel=Math.min(sel+1,filtered.length-1);draw();}
    else if (e.key==="ArrowUp"){e.preventDefault();sel=Math.max(sel-1,0);draw();}
    else if (e.key==="Enter"){e.preventDefault();run(filtered[sel]);}
  });
  list.addEventListener("click", e => { const it=e.target.closest(".p-item"); if(it) run(filtered[+it.dataset.i]); });
  document.addEventListener("keydown", overlayKey); draw(); setTimeout(()=>inp.focus(),50);
}

/* ---------------- loaders ---------------- */
function viewEl() { return $("#view"); }
function skeleton() {
  return `<div class="view-inner"><div class="kpi-grid mb4">${Array(4).fill('<div class="skel skel-kpi"></div>').join("")}</div>
    ${Array(5).fill('<div class="skel skel-row"></div>').join("")}</div>`;
}
function offlineState(retry) {
  return `<div class="view-inner"><div class="empty"><span>${icon("alert")}</span><h3>Backend unavailable</h3>
    <p class="muted">The console runs advisory-only and degrades gracefully. Start the API with <span class="mono">python app.py</span> and retry.</p>
    <button class="btn primary mt3" onclick="location.reload()">Retry</button></div></div>`;
}

/* ---------------- AI advisory: evidence confidence ---------------- */
function evidenceConfidence(sugg) {
  // Deterministic, transparent, rule-based. Labelled Evidence Confidence,
  // never presented as a calibrated probability.
  const reasons = sugg.reasons || [];
  const flagHits = reasons.filter(r => /red flag/i.test(r)).length;
  const vitalHits = reasons.filter(r => /=/.test(r)).length;
  const missing = (sugg.vitals_missing || []).length;
  const defaulted = reasons.some(r => /no rule matched/i.test(r));
  let level, why;
  if (defaulted) { level = "low"; why = "No rule matched — safe-default applied. Clinician judgement should lead."; }
  else if ((flagHits >= 1 && sugg.suggested_level <= 2) || (flagHits + vitalHits >= 3)) {
    level = "high"; why = `${flagHits} red-flag and ${vitalHits} vital criteria converge on this level.`;
  } else if (missing >= 4) { level = "medium"; why = `Converging evidence, but ${missing} vitals are missing — confirm on assessment.`; }
  else { level = "medium"; why = `${flagHits+vitalHits} criteria support this level; corroborate clinically.`; }
  return { level, why };
}
function confBars(level) {
  return `<span class="conf ${level}"><span class="bars"><i></i><i></i><i></i></span>${pretty(level)} evidence</span>`;
}

/* =====================================================================
   VIEWS
   ===================================================================== */

/* ---- Dashboard ---- */
async function viewDashboard() {
  const v = viewEl(); v.innerHTML = skeleton(); setCrumbs(["Operations","Dashboard"]);
  const r = await api.get("/api/dashboard");
  if (!r.ok) { v.innerHTML = offlineState(); return; }
  const d = r.data; state.counts = d; paintCounts(); updateChainPill();

  const levelRows = [1,2,3,4,5].map(l => ({ badge:"L"+l, badgeClass:levelClass(l), color:LVL_COLORS[l], value:d.level_mix[String(l)]||0 }));
  const dispEntries = Object.entries(d.disposition_mix||{});
  const dispColors = { ADMIT:"#2dd4bf", DISCHARGE:"#2fa36b", REFER_OUT:"#3b9ede", LAMA:"#e0a30b", DEATH:"#d21f2c", BROUGHT_DEAD:"#8a4bd6" };
  const dispSegs = dispEntries.map(([k,val]) => ({ label:pretty(k), value:val, color:dispColors[k]||"#5f7484" }));

  const d2d = d.door_to_doctor_median_min;
  const kpis = [
    { ic:"users", label:"Active encounters", val:d.active_encounters, foot:`${d.awaiting_triage} awaiting triage · ${d.awaiting_physician} awaiting physician` },
    { ic:"alert", label:"NABH breaches", val:d.breaches, cls:d.breaches?"alert":"", foot:"Past target wait time", trend:d.breaches?"down":"flat", lw:"breach" },
    { ic:"clock", label:"Door-to-doctor", val:d2d==null?"—":d2d, unit:d2d==null?"":"min", foot:"Median, attended patients", cls:"" },
    { ic:"gavel", label:"Active MLC cases", val:d.mlc_active, foot:`${d.intimation_pending} intimation pending`, cls:d.intimation_pending?"warnk":"", lw:"mlc" },
    { ic:"steth", label:"In treatment", val:d.in_treatment, foot:"Physician attending" },
    { ic:"flag", label:"Triage overrides", val:d.overrides, foot:"Reported monthly (PRD-05 §11)" },
  ];

  // rule-based operational insight (advisory, deterministic)
  const insights = [];
  if (d.breaches > 0) insights.push(`${d.breaches} of ${d.active_encounters} active patients are past their NABH wait target${d.awaiting_physician?` — ${d.awaiting_physician} are triaged and awaiting a physician`:""}.`);
  if (d.intimation_pending > 0) insights.push(`${d.intimation_pending} MLC case has no police intimation logged — disposition will warn (BNSS §194-196) until it is recorded or justified.`);
  if (d.unknown_active > 0) insights.push(`${d.unknown_active} unidentified patient(s) are in the department on a temporary ID (treat-first, Art. 21).`);
  if (!insights.length) insights.push("Department is within all NABH time-norm targets and statutory obligations are current.");

  v.innerHTML = `<div class="view-inner view-anim">
    <div class="page-head">
      <div class="h"><div class="greet">${greeting()}, ${esc(ROLES[state.roleKey].name)}</div>
        <h1>Emergency Department — live operations</h1>
        <div class="sub">Deterministic demo · ${esc(fmtTs(d.generated_at))} · ${d.total_encounters} encounters, ${d.total_patients} patients on record</div></div>
      <div class="actions">
        <a class="btn" href="#/board">${icon("board")} Tracking board</a>
        <a class="btn primary" href="#/register">${icon("plus")} Register patient</a>
      </div>
    </div>

    <div class="kpi-grid mb4">${kpis.map(k=>`
      <article class="kpi ${k.cls||''}" ${k.lw?`data-lw="${k.lw}"`:""}><span class="sheen"></span>
        <div class="k-top"><span class="ic">${icon(k.ic)}</span>${esc(k.label)}</div>
        <div class="k-val">${k.val}${k.unit?`<small>${k.unit}</small>`:""}</div>
        <div class="k-foot">${k.trend?`<span class="trend ${k.trend}">${icon(k.trend==="down"?"arrowDown":k.trend==="up"?"arrowUp":"minus")}</span>`:""}${esc(k.foot)}</div>
      </article>`).join("")}</div>

    <div class="grid cols-3 mb4">
      <div class="card span-2"><div class="hd"><span class="card-title-icn">${icon("activity")}</span><h3>Acuity mix — waiting</h3><span class="sub">active encounters by confirmed level</span></div>
        <div class="bd">${levelRows.every(r=>!r.value)?emptyInline("No patients currently waiting"):hbars(levelRows)}
          <div class="chart-legend">${[1,2,3,4,5].map(l=>`<span class="li"><span class="sw" style="background:${LVL_COLORS[l]}"></span>L${l} ${esc(state.scale.find(s=>s.level===l)?.label||"")}</span>`).join("")}</div>
        </div></div>
      <div class="card"><div class="hd"><span class="card-title-icn">${icon("file")}</span><h3>Dispositions</h3></div>
        <div class="bd" style="display:flex;flex-direction:column;align-items:center;gap:12px">
          ${dispSegs.length?donut(dispSegs,{center:dispSegs.reduce((a,s)=>a+s.value,0),sub:"CLOSED"}):emptyInline("No dispositions yet")}
          <div class="chart-legend" style="justify-content:center">${dispSegs.map(s=>`<span class="li"><span class="sw" style="background:${s.color}"></span>${esc(s.label)} ${s.value}</span>`).join("")}</div>
        </div></div>
    </div>

    <div class="grid cols-3">
      <div class="ai-card span-2"><div class="ai-hd"><span class="spark">${icon("sparkles")}</span><span class="t">Operational insight</span><span class="adv">Advisory · rule-based</span></div>
        <div class="ai-bd"><ul class="reasons">${insights.map(t=>`<li>${icon("chevronR")}<span>${esc(t)}</span></li>`).join("")}</ul>
        <div class="muted mt3" style="font-size:11.5px">Derived deterministically from live KPIs. No autonomous action is taken — every clinical and statutory decision remains with the human operator.</div></div></div>
      <div class="card"><div class="hd"><span class="card-title-icn">${icon("shieldcheck")}</span><h3>Governance</h3></div>
        <div class="bd"><dl class="dl">
          <dt>Audit chain</dt><dd>${d.audit_chain_intact?`<span class="badge ok">${icon("check")} Intact</span>`:`<span class="badge" style="color:var(--coral-2)">${icon("alert")} Broken @ row ${d.audit_first_broken_row}</span>`}</dd>
          <dt>Overrides</dt><dd class="mono">${d.overrides}</dd>
          <dt>MLC pending</dt><dd class="mono">${d.intimation_pending}</dd>
          <dt>Data mode</dt><dd>Synthetic · deterministic</dd>
        </dl><a class="btn sm mt3" href="#/audit">${icon("eye")} Inspect audit trail</a></div></div>
    </div>
  </div>`;
  bindTilt(v);
}
function emptyInline(msg) { return `<div class="empty" style="padding:24px 8px"><h3 style="font-size:13px;color:var(--muted)">${esc(msg)}</h3></div>`; }

/* ---- Tracking board ---- */
async function viewBoard() {
  const v = viewEl(); v.innerHTML = skeleton(); setCrumbs(["Operations","Tracking board"]);
  const r = await api.get("/api/board");
  if (!r.ok) { v.innerHTML = offlineState(); return; }
  const rows = r.data;
  const breaches = rows.filter(x=>x.is_breached).length;
  const untriaged = rows.filter(x=>x.status==="ARRIVED").length;

  v.innerHTML = `<div class="view-inner view-anim">
    <div class="page-head"><div class="h"><h1>ED tracking board</h1>
      <div class="sub">${rows.length} active · <span class="${breaches?'breach':''}">${breaches} breach${breaches===1?"":"es"}</span> · ${untriaged} awaiting triage · auto-refresh 30s</div></div>
      <div class="actions"><button class="btn" id="wallBtn" title="Wall display — hides chrome for the department TV (Esc exits)">${icon("eye")} Wall display</button><a class="btn primary" href="#/register">${icon("plus")} Register</a></div>
    </div>
    ${rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr>
      <th>Patient</th><th>Complaint</th><th>Level</th><th>Arrived</th><th>Wait</th><th>Status</th><th>MLC</th><th class="right">Action</th>
    </tr></thead><tbody>${rows.map(boardRow).join("")}</tbody></table></div>
    <div class="chart-legend mt3">${[1,2,3,4,5].map(l=>`<span class="li"><span class="sw" style="background:${LVL_COLORS[l]}"></span>L${l}</span>`).join("")}
      <span class="li" style="margin-left:auto">${icon("clock")} Colour spine = acuity · pulsing = past NABH target</span></div>`
    : `<div class="empty"><span>${icon("board")}</span><h3>Board is clear</h3><p class="muted">No active encounters. Register a patient to begin.</p></div>`}
  </div>`;
  v.querySelectorAll("[data-enc]").forEach(el => el.addEventListener("click", e => {
    if (e.target.closest("[data-act]")) return; location.hash = "#/encounter/" + el.getAttribute("data-enc");
  }));
  wireRowActions(v);
  const wb = $("#wallBtn"); if (wb) wb.onclick = () => document.body.classList.toggle("wallboard");
  clearTimeout(state.boardTimer);
  state.boardTimer = setTimeout(() => { if (location.hash.replace(/^#/,"") === "/board") viewBoard(); }, 30000);
}
function boardRow(x) {
  const lvl = x.level; const breach = x.is_breached && x.status!=="CLOSED";
  const act = x.status==="ARRIVED" ? `<button class="btn sm primary" data-act="triage" data-id="${x.encounter_id}">${icon("steth")} Triage</button>`
    : x.status==="TRIAGED" ? (can("attend")?`<button class="btn sm" data-act="attend" data-id="${x.encounter_id}">${icon("pulse")} Attend</button>`:`<button class="btn sm" data-enc-go="${x.encounter_id}">View</button>`)
    : `<button class="btn sm" data-enc-go="${x.encounter_id}">${icon("eye")} View</button>`;
  return `<tr class="clickable row-spine ${spine(lvl)} ${breach?'breach-pulse':''}" data-enc="${x.encounter_id}">
    <td><div class="cell-name">${esc(x.display_name)}</div><div class="cell-sub mono">${esc(x.identifier)}${x.age_years?` · ${x.age_years}${esc(x.sex||"")}`:""}</div></td>
    <td class="cell-sub">${esc(x.chief_complaint||"—")}</td>
    <td><span class="lvl ${levelClass(lvl)}">${lvl?("L"+lvl):"—"}</span></td>
    <td class="mono cell-sub">${fmtTime(x.arrival_ts)}</td>
    <td class="mono ${breach?'breach':''}">${fmtWait(x.elapsed_minutes)}${breach?" ⚠":""}</td>
    <td>${statusBadge(x.status)}</td>
    <td>${x.is_mlc?`<span class="badge mlc">${icon("gavel")} ${esc(x.mlc_serial||"MLC")}</span>`:'<span class="muted">—</span>'}</td>
    <td class="right">${act}</td></tr>`;
}
function statusBadge(s) {
  const m = { ARRIVED:["warn","Awaiting triage"], TRIAGED:["","Awaiting physician"], IN_TREATMENT:["ok","In treatment"], CLOSED:["","Closed"] };
  const [cls,lbl] = m[s]||["",s]; return `<span class="badge status ${cls}">${esc(lbl)}</span>`;
}
function wireRowActions(scope) {
  scope.querySelectorAll("[data-enc-go]").forEach(b => b.onclick = () => location.hash = "#/encounter/"+b.getAttribute("data-enc-go"));
  scope.querySelectorAll('[data-act="triage"]').forEach(b => b.onclick = () => location.hash = "#/triage/"+b.getAttribute("data-id"));
  scope.querySelectorAll('[data-act="attend"]').forEach(b => b.onclick = () => doAttend(b.getAttribute("data-id"), true));
}
async function doAttend(id, back) {
  const r = await api.post(`/api/encounters/${id}/attend`, { attended_by: actor() });
  if (r.ok) { toast("ok","Physician attending", `Door-to-doctor stamped ${fmtTime(r.data.first_physician_at)}`); lwEvent("forge", { encounter: +id }); refreshCounts();
    if (back) router(); else viewEncounter(id); }
  else toast("err","Could not attend", (r.data&&r.data.error)||("HTTP "+r.status));
}

/* ---- Quick registration ---- */
async function quickRegUnknown() {
  const r = await api.post("/api/quick-reg", { actor: actor(), arrival_mode: "GOOD_SAMARITAN" });
  if (r.ok) { toast("ok","Unknown patient registered", `Temp ID ${r.data.temp_id} · go to triage`); lwEvent("nucleate"); refreshCounts(); location.hash = "#/triage/"+r.data.encounter_id; }
  else toast("err","Registration failed","Unexpected error.");
}
function viewRegister() {
  const v = viewEl(); setCrumbs(["Patient flow","Quick registration"]);
  const modes = ["WALK_IN","AMBULANCE_108","AMBULANCE_PRIVATE","POLICE","GOOD_SAMARITAN","REFERRED"];
  v.innerHTML = `<div class="view-inner view-anim" style="max-width:820px">
    <div class="page-head"><div class="h"><h1>Quick registration</h1>
      <div class="sub">Treat-first. Nothing on this screen blocks care — Art. 21 / Parmanand Katara (SC 1989).</div></div></div>

    <div class="card mb4" style="border-color:rgba(255,106,90,.35)">
      <div class="bd" style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">
        <div style="flex:1;min-width:220px"><div class="flex" style="gap:8px;color:var(--coral-2);font-weight:700">${icon("siren")} UNKNOWN / UNCONSCIOUS PATIENT</div>
          <div class="muted mt3" style="font-size:12.5px">One click issues a temporary ID and a triage slot. Paperwork reconciles later — or never.</div></div>
        <button class="btn coral xl" id="qUnknown">${icon("zap")} Register instantly</button>
      </div>
    </div>

    <div class="card"><div class="hd"><span class="card-title-icn">${icon("userplus")}</span><h3>Identified patient</h3><span class="sub">every field optional</span></div>
      <div class="bd"><form id="regForm">
        <div class="grid-fields">
          <div class="field" style="grid-column:span 2"><label>Full name</label><input class="inp" name="name" autocomplete="off" placeholder="e.g. Ramesh Kumar"></div>
          <div class="field"><label>Age</label><input class="inp" name="age_years" type="number" min="0" max="130" inputmode="numeric"></div>
          <div class="field"><label>Sex</label><select class="sel" name="sex"><option value="">—</option><option>M</option><option>F</option><option>O</option><option value="UNKNOWN">Unknown</option></select></div>
        </div>
        <div class="grid-fields">
          <div class="field"><label>Phone</label><input class="inp" name="phone" inputmode="tel" autocomplete="off"></div>
          <div class="field"><label>Arrival mode</label><select class="sel" name="arrival_mode">${modes.map(m=>`<option value="${m}">${pretty(m)}</option>`).join("")}</select></div>
          <div class="field" style="grid-column:span 2"><label>Brought by <span class="muted">(optional — Good Samaritan; may decline)</span></label><input class="inp" name="brought_by" autocomplete="off"></div>
        </div>
        <label class="chk" style="max-width:260px;margin-bottom:16px"><input type="checkbox" name="mlc"> <span>Suspected medico-legal case</span></label>
        <div class="btn-row"><button type="submit" class="btn primary">${icon("check")} Register & go to triage</button>
          <a class="btn ghost" href="#/board">Cancel</a></div>
        <div class="hint mt3">${icon("info")} Suggested triage level is computed on the next screen — advisory only; the nurse confirms.</div>
      </form></div></div>
  </div>`;
  $("#qUnknown").onclick = quickRegUnknown;
  $("#regForm").onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const body = { actor: actor(), name: f.get("name")||undefined, age_years: f.get("age_years")?+f.get("age_years"):undefined,
      sex: f.get("sex")||undefined, phone: f.get("phone")||undefined, arrival_mode: f.get("arrival_mode"), brought_by: f.get("brought_by")||undefined };
    const r = await api.post("/api/quick-reg", body);
    if (r.ok) {
      toast("ok","Patient registered", (r.data.temp_id?`Temp ID ${r.data.temp_id} · `:"") + "proceed to triage");
      if (f.get("mlc")) toast("warn","Suspected MLC","Open the MLC case from the encounter hub after triage.");
      lwEvent("nucleate"); refreshCounts(); location.hash = "#/triage/"+r.data.encounter_id;
    } else toast("err","Registration failed","Unexpected error.");
  };
}

/* ---- Triage form (≤60s, live suggestion, 3D level picker) ---- */
async function viewTriage(id) {
  const v = viewEl(); v.innerHTML = skeleton(); setCrumbs(["Patient flow","Triage"]);
  const [encR] = await Promise.all([api.get("/api/encounters/"+id)]);
  if (!encR.ok) { v.innerHTML = offlineState(); return; }
  const { encounter, patient } = encR.data;
  const flags = collectFlags();
  const vitals = { hr:"HR", rr:"RR", sbp:"SBP", dbp:"DBP", spo2:"SpO₂", temp_c:"Temp °C", gcs:"GCS" };
  const isRetri = (encR.data.triages||[]).length > 0;

  v.innerHTML = `<div class="view-inner view-anim">
    <div class="page-head"><div class="h">
      <div class="greet">${isRetri?"Re-triage":"Triage assessment"} · target ≤ 60s</div>
      <h1>${esc(patient?patient.name || "[UNKNOWN] "+(patient.temp_id||"") : "Encounter")}</h1>
      <div class="sub mono">${esc(patient?(patient.uhid||patient.temp_id):"")}${encounter.is_mlc?" · ":""}${encounter.is_mlc?'<span class="badge mlc" style="vertical-align:middle">'+icon("gavel")+' MLC</span>':""}</div>
    </div><div class="actions"><a class="btn ghost" href="#/encounter/${id}">Cancel</a></div></div>

    <div class="grid triage-cols" style="grid-template-columns:1.15fr .85fr;gap:16px;align-items:start">
      <div class="card"><div class="hd"><span class="card-title-icn">${icon("steth")}</span><h3>Assess</h3><span class="sub">keyboard-first</span></div>
        <div class="bd">
          <div class="field"><label>Chief complaint <span class="req">*</span></label><input class="inp" id="cc" placeholder="e.g. Crushing chest pain radiating to left arm" autocomplete="off"></div>
          <div class="field"><label>Additional symptoms / HPI</label><textarea class="inp" id="sym" rows="2" placeholder="Onset, duration, associated features…"></textarea></div>
          <fieldset><legend>Red flags</legend>
            <div class="chk-grid" id="flags">${flags.map(fl=>`<label class="chk ${fl.crit?'crit':''}" data-flag="${fl.key}"><input type="checkbox" value="${fl.key}"> <span>${esc(fl.label)}</span></label>`).join("")}</div>
          </fieldset>
          <div class="field"><label>AVPU responsiveness</label>
            <div class="seg" id="avpu">${["A","V","P","U"].map(a=>`<button type="button" data-avpu="${a}">${a}</button>`).join("")}</div>
            <div class="hint">Selecting <b>U</b> auto-flags “unresponsive”.</div></div>
          <fieldset><legend>Vitals <span style="color:var(--muted);text-transform:none;letter-spacing:0">— missing values degrade gracefully</span></legend>
            <div class="grid-fields">${Object.entries(vitals).map(([k,l])=>`<div class="field" style="margin-bottom:8px"><label>${l}</label><input class="inp mono vit" data-vit="${k}" type="number" step="${k==='temp_c'?'0.1':'1'}" inputmode="decimal"></div>`).join("")}</div>
          </fieldset>
        </div></div>

      <div style="display:flex;flex-direction:column;gap:16px;position:sticky;top:0">
        <div class="ai-card" id="suggestCard"><div class="ai-hd"><span class="spark">${icon("sparkles")}</span><span class="t">Suggested level</span><span class="adv">Advisory only</span></div>
          <div class="ai-bd" id="suggestBody"><div class="muted">Enter findings to compute a suggestion…</div></div></div>

        <div class="card"><div class="hd"><span class="card-title-icn">${icon("pulse")}</span><h3>Confirm final level</h3></div>
          <div class="bd">
            <div class="lvl-picker" id="picker">${[1,2,3,4,5].map(l=>{const s=state.scale.find(x=>x.level===l)||{};return`<button type="button" class="lvl-block b${l}" data-lvl="${l}"><span class="num">${l}</span><span class="nm">${esc(s.label||"")}</span><span class="wt">≤${s.max_wait_minutes??"?"}m</span></button>`}).join("")}</div>
            <div class="field mt4" id="overrideWrap" style="display:none"><label>Override reason <span class="req">*</span> <span class="muted">(final differs from suggested — min 10 chars, reported monthly)</span></label>
              <textarea class="inp" id="ovr" rows="2" placeholder="Clinical justification for departing from the suggested level…"></textarea></div>
            <button class="btn primary mt4" id="saveTriage" style="width:100%" ${can("triage")?"":"disabled title='Requires nurse/physician role'"}>${icon("check")} Save triage</button>
            ${can("triage")?"":`<div class="hint mt3">${icon("info")} Your role (${esc(ROLES[state.roleKey].role)}) cannot confirm triage. Switch to Nurse or Physician.</div>`}
          </div></div>
      </div>
    </div></div>`;

  // ---- state + live suggestion ----
  let suggested = null, finalLevel = null, avpu = null;
  const getBody = () => {
    const vit = {}; $$(".vit", v).forEach(i => { if (i.value!=="") vit[i.dataset.vit] = i.dataset.vit==="temp_c"?parseFloat(i.value):parseInt(i.value,10); });
    const rf = $$('#flags input:checked', v).map(i => i.value);
    return { vitals: vit, red_flags: rf };
  };
  let t; const debounce = () => { clearTimeout(t); t = setTimeout(refreshSuggest, 200); };
  async function refreshSuggest() {
    const r = await api.post("/api/triage/suggest", getBody());
    if (!r.ok) { $("#suggestBody").innerHTML = `<div class="muted">${icon("alert")} Suggestion engine unavailable — assign level clinically.</div>`; return; }
    suggested = r.data; renderSuggest(); markPicker();
  }
  function renderSuggest() {
    const s = suggested; const conf = evidenceConfidence(s);
    $("#suggestBody").innerHTML = `
      <div class="flex" style="justify-content:space-between"><div class="ai-rec"><span class="lvl ${levelClass(s.suggested_level)}" style="height:26px;font-size:14px">L${s.suggested_level}</span> ${esc(s.label)}</div></div>
      ${confBars(conf.level)}<div class="muted mt3" style="font-size:12px">${esc(conf.why)}</div>
      <ul class="reasons">${(s.reasons||[]).map(r=>`<li>${icon("check")}<span>${esc(r)}</span></li>`).join("")}</ul>
      ${s.vitals_missing&&s.vitals_missing.length?`<div class="hint mt3">${icon("info")} Missing vitals: ${s.vitals_missing.map(esc).join(", ")}</div>`:""}`;
    lwEvent("lean", { encounter: +id, level: s.suggested_level }); // the cell leans toward the suggestion — colour still awaits the human
  }
  function markPicker() {
    $$("#picker .lvl-block").forEach(b => {
      const l = +b.dataset.lvl;
      b.classList.toggle("suggested", suggested && l===suggested.suggested_level);
      b.classList.toggle("on", finalLevel===l);
    });
    const showOvr = suggested && finalLevel && finalLevel!==suggested.suggested_level;
    $("#overrideWrap").style.display = showOvr ? "" : "none";
  }
  // interactions
  $$(".vit", v).forEach(i => i.addEventListener("input", debounce));
  $$('#flags input', v).forEach(i => i.addEventListener("change", e => { e.target.closest(".chk").classList.toggle("on", e.target.checked); debounce(); }));
  $$("#avpu button", v).forEach(b => b.onclick = () => {
    avpu = b.dataset.avpu; $$("#avpu button").forEach(x=>x.classList.toggle("on", x===b));
    if (avpu==="U") { const u = $('[data-flag="unresponsive"] input', v); if (u && !u.checked) { u.checked=true; u.closest(".chk").classList.add("on"); } }
    debounce();
  });
  $$("#picker .lvl-block").forEach(b => b.onclick = () => { finalLevel = +b.dataset.lvl; markPicker(); if(finalLevel!==(suggested&&suggested.suggested_level)) setTimeout(()=>$("#ovr")?.focus(),120); });
  $("#saveTriage").onclick = async () => {
    const cc = $("#cc").value.trim();
    if (!cc) { $("#cc").classList.add("err"); $("#cc").focus(); toast("err","Chief complaint required"); return; }
    if (!suggested) await refreshSuggest();
    const fl = finalLevel || (suggested && suggested.suggested_level);
    const sym = $("#sym").value.trim();
    const body = { encounter_id:+id, chief_complaint: cc + (sym?` — ${sym}`:""), triaged_by: actor(),
      final_level: fl, ...getBody() };
    if (suggested && fl !== suggested.suggested_level) {
      const ovr = $("#ovr").value.trim();
      if (ovr.length < 10) { $("#ovr").classList.add("err"); $("#ovr").focus(); toast("err","Override reason required","Minimum 10 characters (reported monthly)."); return; }
      body.override_reason = ovr;
    }
    const btn = $("#saveTriage"); btn.disabled = true;
    const r = await api.post("/api/triage", body);
    btn.disabled = false;
    if (r.ok) { toast("ok","Triage saved", `Level ${r.data.final_level}${r.data.overridden?" (override recorded)":""}`); lwEvent("stabilize", { encounter: +id, level: r.data.final_level }); refreshCounts(); location.hash = "#/encounter/"+id; }
    else if (r.status===422) { toast("err","Override reason required", r.data.detail || ""); $("#overrideWrap").style.display=""; $("#ovr").focus(); }
    else toast("err","Save failed", (r.data&&r.data.error)||("HTTP "+r.status));
  };
  refreshSuggest();
}
function collectFlags() {
  const crit = new Set(); const all = new Map();
  state.scale.forEach(s => { (s.criteria?.red_flags||[]).forEach(f => { all.set(f, { key:f, label:pretty(f), crit:s.level<=2 }); if (s.level<=2) crit.add(f); }); });
  if (!all.size) ["cardiac_arrest","unresponsive","chest_pain_ischaemic","stroke_fast_positive","major_trauma","poisoning_ingestion","simple_laceration","minor_fracture"].forEach(f=>all.set(f,{key:f,label:pretty(f),crit:true}));
  return Array.from(all.values());
}

/* ---- ED register (patients) ---- */
let regSort = { key:"arrival_ts", dir:-1 };
async function viewPatients() {
  const v = viewEl(); v.innerHTML = skeleton(); setCrumbs(["Patient flow","ED register"]);
  const r = await api.get("/api/encounters");
  if (!r.ok) { v.innerHTML = offlineState(); return; }
  let rows = r.data;
  v.innerHTML = `<div class="view-inner view-anim">
    <div class="page-head"><div class="h"><h1>ED register</h1><div class="sub">${rows.length} encounters · click a row to open the hub</div></div>
      <div class="actions"><a class="btn primary" href="#/register">${icon("plus")} Register</a></div></div>
    <div class="filters">
      <div class="flex" style="position:relative"><span style="position:absolute;left:10px;color:var(--muted)">${icon("search")}</span>
        <input class="inp search" id="fq" placeholder="Search name, ID, complaint…" style="padding-left:34px"></div>
      <select class="sel" id="flvl"><option value="">All levels</option>${[1,2,3,4,5].map(l=>`<option value="${l}">Level ${l}</option>`).join("")}</select>
      <select class="sel" id="fst"><option value="">All statuses</option><option value="ARRIVED">Awaiting triage</option><option value="TRIAGED">Awaiting physician</option><option value="IN_TREATMENT">In treatment</option><option value="CLOSED">Closed</option></select>
      <button class="pill-toggle" id="fmlc">${icon("gavel")} MLC only</button>
    </div>
    <div id="regTbl"></div></div>`;

  let mlcOnly = false;
  const draw = () => {
    const q = $("#fq").value.trim().toLowerCase(), lvl = $("#flvl").value, st = $("#fst").value;
    let list = rows.filter(x => {
      if (q && !((x.display_name||"")+" "+(x.identifier||"")+" "+(x.chief_complaint||"")).toLowerCase().includes(q)) return false;
      if (lvl && String(x.level)!==lvl) return false;
      if (st && x.status!==st) return false;
      if (mlcOnly && !x.is_mlc) return false;
      return true;
    });
    list.sort((a,b) => {
      let av=a[regSort.key], bv=b[regSort.key]; av=av==null?"":av; bv=bv==null?"":bv;
      return (av>bv?1:av<bv?-1:0)*regSort.dir;
    });
    const cols = [["display_name","Patient"],["chief_complaint","Complaint"],["level","Lvl"],["arrival_ts","Arrived"],["status","Status"],["is_mlc","MLC"]];
    $("#regTbl").innerHTML = list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr>
      ${cols.map(([k,l])=>`<th class="sortable" data-sort="${k}">${l}${regSort.key===k?`<span class="sar">${regSort.dir>0?"▲":"▼"}</span>`:""}</th>`).join("")}<th></th></tr></thead>
      <tbody>${list.map(x=>`<tr class="clickable row-spine ${spine(x.level)}" data-enc="${x.encounter_id}">
        <td><div class="cell-name">${esc(x.display_name)}</div><div class="cell-sub mono">${esc(x.identifier)}</div></td>
        <td class="cell-sub">${esc(x.chief_complaint||"—")}</td>
        <td><span class="lvl ${levelClass(x.level)}">${x.level?("L"+x.level):"—"}</span></td>
        <td class="mono cell-sub">${fmtTs(x.arrival_ts)}</td>
        <td>${statusBadge(x.status)}</td>
        <td>${x.is_mlc?`<span class="badge mlc">${icon("gavel")}</span>`:'<span class="muted">—</span>'}</td>
        <td class="right">${icon("chevronR","")}</td></tr>`).join("")}</tbody></table></div>`
      : `<div class="empty"><span>${icon("users")}</span><h3>No matching encounters</h3></div>`;
    $$("#regTbl [data-enc]").forEach(el=>el.onclick=()=>location.hash="#/encounter/"+el.getAttribute("data-enc"));
    $$("#regTbl th[data-sort]").forEach(th=>th.onclick=()=>{ const k=th.dataset.sort; if(regSort.key===k)regSort.dir*=-1; else{regSort.key=k;regSort.dir=1;} draw(); });
  };
  ["fq","flvl","fst"].forEach(idv => $("#"+idv).addEventListener("input", draw));
  $("#fmlc").onclick = () => { mlcOnly=!mlcOnly; $("#fmlc").classList.toggle("on",mlcOnly); draw(); };
  draw();
}

/* ---- Encounter hub ---- */
async function viewEncounter(id) {
  const v = viewEl(); v.innerHTML = skeleton(); setCrumbs(["Patient flow","Encounter"]);
  const r = await api.get("/api/encounters/"+id);
  if (!r.ok) { v.innerHTML = r.status===404?notFound("Encounter not found"):offlineState(); return; }
  const D = r.data, e = D.encounter, p = D.patient;
  const latest = D.triages[0];
  const closed = e.status==="CLOSED";
  const name = p ? (p.name || "[UNKNOWN] "+(p.temp_id||"")) : "Encounter";

  const actions = [];
  if (!closed && e.status!=="ARRIVED" && !e.first_physician_at && can("attend")) actions.push(`<button class="btn" data-a="attend">${icon("pulse")} Attend (door-to-doctor)</button>`);
  if (!closed && can("triage")) actions.push(`<a class="btn" href="#/triage/${id}">${icon("steth")} ${D.triages.length?"Re-triage":"Triage"}</a>`);
  if (!e.is_mlc && can("mlc")) actions.push(`<button class="btn coral" data-a="mlc">${icon("gavel")} Open MLC</button>`);
  if (e.is_mlc && D.mlc && can("intimation")) actions.push(`<button class="btn" data-a="intim">${icon("phone")} Log intimation</button>`);
  if (!closed && can("dispose")) actions.push(`<button class="btn primary" data-a="disp">${icon("file")} Disposition</button>`);

  v.innerHTML = `<div class="view-inner view-anim">
    <div class="page-head"><div class="h"><div class="greet mono">ENC-${id} · ${statusText(e.status)}</div>
      <h1>${esc(name)} ${e.is_mlc?`<span class="badge mlc" style="vertical-align:middle;font-size:12px">${icon("gavel")} MLC</span>`:""}</h1>
      <div class="sub mono">${esc(p?(p.uhid||p.temp_id):"")} · arrived ${fmtTs(e.arrival_ts)} · ${pretty(e.arrival_mode||"—")}</div></div>
      <div class="actions">${actions.join("")||`<span class="muted" style="font-size:12px">${icon("info")} Your role has no actions on this encounter</span>`}</div></div>

    ${D.intimation_pending?`<div class="warn-banner">${icon("alert")}<div><div class="wt">MLC intimation pending</div>
      <div class="wm">This is an MLC encounter with no police intimation logged. Disposition will warn until it is recorded or justified.</div>
      <div class="stat">BNSS 2023 §194-196 · non-blocking (Art. 21)</div></div></div>`:""}

    <div class="grid cols-3" style="align-items:start">
      <div class="card"><div class="hd"><span class="card-title-icn">${icon("users")}</span><h3>Patient</h3></div><div class="bd">
        <dl class="dl">
          <dt>Identity</dt><dd>${p&&p.name?esc(p.name):`<span class="badge unknown">Unidentified</span>`}</dd>
          <dt>ID</dt><dd class="mono">${esc(p?(p.uhid||p.temp_id):"—")}</dd>
          <dt>Age / Sex</dt><dd>${p&&p.age_years!=null?p.age_years:"—"} · ${esc(p&&p.sex||"—")}</dd>
          <dt>Phone</dt><dd class="mono">${esc(p&&p.phone||"—")}</dd>
          <dt>Arrival</dt><dd>${pretty(e.arrival_mode||"—")}</dd>
          ${e.brought_by?`<dt>Brought by</dt><dd>${esc(e.brought_by)}</dd>`:""}
          <dt>Status</dt><dd>${statusBadge(e.status)}</dd>
          ${e.first_physician_at?`<dt>Door-to-doctor</dt><dd class="mono">${fmtTime(e.first_physician_at)}</dd>`:""}
          <dt>Current level</dt><dd><span class="lvl ${levelClass(e.current_level||latest&&latest.final_level)}">${(latest&&latest.final_level)?("L"+latest.final_level):"—"}</span></dd>
        </dl></div></div>

      <div class="card span-2"><div class="hd"><span class="card-title-icn">${icon("steth")}</span><h3>Triage history</h3><span class="sub">${D.triages.length} assessment(s)</span></div>
        <div class="bd">${D.triages.length?`<ul class="timeline">${D.triages.map(triageItem).join("")}</ul>`:emptyInline("Not yet triaged")}</div></div>
    </div>

    ${latest?aiTriageCard(latest):""}

    <div class="grid cols-2 mt4" style="align-items:start">
      ${e.is_mlc&&D.mlc?mlcCard(D.mlc, D.intimations, id):""}
      ${D.disposition?dispositionCard(D.disposition):""}
    </div>
  </div>`;

  const wire = (a, fn) => { const b = v.querySelector(`[data-a="${a}"]`); if (b) b.onclick = fn; };
  wire("attend", () => doAttend(id, false));
  wire("triage", () => location.hash = "#/triage/"+id);
  wire("mlc", () => openMlcModal(id));
  wire("intim", () => openIntimationModal(D.mlc.id, id));
  wire("disp", () => openDispositionModal(id, D.intimation_pending));
}
function statusText(s){return {ARRIVED:"Awaiting triage",TRIAGED:"Awaiting physician",IN_TREATMENT:"In treatment",CLOSED:"Closed"}[s]||s;}
function triageItem(t) {
  const ov = t.override_reason;
  return `<li class="${ov?"coral":""}"><div class="flex" style="justify-content:space-between">
    <div class="tl-t"><span class="lvl ${levelClass(t.final_level)}">L${t.final_level}</span> ${esc(state.scale.find(s=>s.level===t.final_level)?.label||"")}
      ${ov?`<span class="badge mlc" style="margin-left:6px">override</span>`:""}
      ${t.is_retriage?`<span class="badge">re-triage</span>`:""}</div>
    <div class="tl-m">${fmtTs(t.triaged_ts)}</div></div>
    <div class="cell-sub mt3">${esc(t.chief_complaint)}</div>
    <div class="muted" style="font-size:12px;margin-top:4px">Engine suggested L${t.suggested_level} · confirmed L${t.final_level} · by ${esc(t.triaged_by)}</div>
    ${ov?`<div class="stat" style="color:var(--coral-2);font-size:12px;margin-top:5px">${icon("info")} ${esc(ov)}</div>`:""}
    ${vitalsChips(t)}</li>`;
}
function vitalsChips(t) {
  const vs = [["HR",t.hr],["RR",t.rr],["SBP",t.sbp],["DBP",t.dbp],["SpO₂",t.spo2],["Temp",t.temp_c],["GCS",t.gcs]].filter(x=>x[1]!=null);
  const rf = (t.red_flags||[]);
  if (!vs.length && !rf.length) return "";
  return `<div class="flex flex-wrap mt3" style="gap:6px">${vs.map(([k,val])=>`<span class="badge mono">${k} ${val}</span>`).join("")}
    ${rf.map(f=>`<span class="badge" style="color:var(--warn)">${esc(pretty(f))}</span>`).join("")}</div>`;
}
function aiTriageCard(t) {
  const sugg = { suggested_level:t.suggested_level, reasons:(t.red_flags||[]).map(f=>"red flag: "+f).concat([t.hr!=null?`hr = ${t.hr}`:null,t.spo2!=null?`spo2 = ${t.spo2}`:null].filter(Boolean)), vitals_missing:[] };
  const conf = evidenceConfidence(sugg);
  const overridden = t.final_level !== t.suggested_level;
  return `<div class="ai-card mt4"><div class="ai-hd"><span class="spark">${icon("sparkles")}</span><span class="t">Triage decision — explainability</span><span class="adv">Advisory · human-confirmed</span></div>
    <div class="ai-bd">
      <div class="ai-rec">Engine suggested <span class="lvl ${levelClass(t.suggested_level)}">L${t.suggested_level}</span> · nurse confirmed <span class="lvl ${levelClass(t.final_level)}">L${t.final_level}</span> ${overridden?`<span class="badge mlc">override recorded</span>`:`<span class="badge ok">${icon("check")} accepted</span>`}</div>
      ${confBars(conf.level)}
      <ul class="evi">${sugg.reasons.map(r=>`<li>${esc(r)}</li>`).join("")||"<li>Safe-default applied</li>"}
        ${overridden?`<li style="color:var(--coral-2)"><b>Override:</b> ${esc(t.override_reason||"")}</li>`:""}</ul>
      <div class="muted mt3" style="font-size:11.5px">The engine never assigns the level — it was confirmed by a human (${esc(t.triaged_by)}) and recorded in the tamper-evident audit chain.</div>
    </div></div>`;
}
function mlcCard(m, intims, encId) {
  return `<div class="card" style="border-color:rgba(255,106,90,.28)"><div class="hd"><span class="card-title-icn" style="background:var(--coral-dim);color:var(--coral-2)">${icon("gavel")}</span>
    <h3>Medico-legal case</h3><a class="btn sm ghost" style="margin-left:auto" href="#/mlc/${m.id}">Open ${icon("chevronR")}</a></div>
    <div class="bd"><dl class="dl">
      <dt>Serial</dt><dd class="mono">${esc(m.mlc_serial)}</dd>
      <dt>Type</dt><dd>${pretty(m.mlc_type)} ${m.pocso_flag?`<span class="badge pocso">POCSO</span>`:""}</dd>
      <dt>Opened</dt><dd class="mono">${fmtTs(m.opened_ts)}</dd>
      <dt>By</dt><dd>${esc(m.opened_by)}</dd>
      <dt>Intimations</dt><dd>${intims.length?`<span class="badge ok">${intims.length} logged</span>`:`<span class="badge" style="color:var(--coral-2)">none — pending</span>`}</dd>
    </dl>${m.pocso_flag?`<div class="warn-banner mt3" style="margin-bottom:0">${icon("alert")}<div><div class="wt">POCSO mandatory reporting</div><div class="wm">§19-21 — reporting to SJPU/police is mandatory; non-reporting is punishable.</div></div></div>`:""}</div></div>`;
}
function dispositionCard(d) {
  return `<div class="card"><div class="hd"><span class="card-title-icn">${icon("file")}</span><h3>Disposition</h3><span class="badge status" style="margin-left:auto">${pretty(d.type)}</span></div>
    <div class="bd"><dl class="dl">
      <dt>Decided</dt><dd class="mono">${fmtTs(d.decided_ts)}</dd><dt>By</dt><dd>${esc(d.decided_by)}</dd>
      ${d.ward_requested?`<dt>Ward</dt><dd>${esc(d.ward_requested)}</dd>`:""}
      ${d.referral_facility?`<dt>Referral</dt><dd>${esc(d.referral_facility)} — ${esc(d.referral_reason||"")}</dd>`:""}
      ${d.discharge_instr?`<dt>Instructions</dt><dd>${esc(d.discharge_instr)}</dd>`:""}
      ${d.cause_of_death_icd10?`<dt>Cause (ICD-10)</dt><dd class="mono">${esc(d.cause_of_death_icd10)}</dd>`:""}
      ${d.mlc_warning_ack?`<dt>MLC ack</dt><dd style="color:var(--coral-2)">${esc(d.mlc_warning_reason||"acknowledged")}</dd>`:""}
    </dl></div></div>`;
}
function notFound(msg){return `<div class="view-inner"><div class="empty"><span>${icon("alert")}</span><h3>${esc(msg)}</h3><a class="btn mt3" href="#/board">Back to board</a></div></div>`;}

/* ---- MLC modals ---- */
function openMlcModal(encId) {
  const types = ["RTA","ASSAULT","POISONING","BURNS","SUSPECTED_FOUL_PLAY","SEXUAL_OFFENCE_POCSO","FIREARM","SUICIDE_ATTEMPT","INDUSTRIAL_ACCIDENT","UNNATURAL_DEATH","OTHER"];
  openModal({ title:"Open medico-legal case", icon:"gavel",
    body:`<form id="mlcForm">
      <div class="field"><label>Incident type <span class="req">*</span></label><select class="sel" name="mlc_type">${types.map(t=>`<option value="${t}">${pretty(t)}</option>`).join("")}</select>
        <div class="hint" id="pocsoHint" style="display:none;color:var(--coral-2)">${icon("alert")} POCSO — mandatory reporting notice will be embedded.</div></div>
      <div class="field"><label>Police station <span class="req">*</span></label><input class="inp" name="police_station" placeholder="e.g. Hebbal PS" autocomplete="off"></div>
      <div class="grid-fields"><div class="field"><label>Incident at</label><input class="inp" name="incident_at" type="datetime-local"></div>
        <div class="field"><label>Place</label><input class="inp" name="incident_place" autocomplete="off"></div></div>
      <div class="field"><label>Brought by</label><input class="inp" name="brought_by" autocomplete="off" placeholder="PCR van / bystander"></div>
      <div class="field"><label>Notes</label><textarea class="inp" name="notes" rows="2"></textarea></div>
      <div class="hint">${icon("info")} Allocates a gapless statutory serial (BNSS §194-196). Human-initiated; never automatic.</div>
    </form>`,
    footer:`<button class="btn ghost" data-close>Cancel</button><button class="btn coral" id="mlcSave">${icon("gavel")} Open case</button>` });
  const sel = $('[name="mlc_type"]'); sel.onchange = () => $("#pocsoHint").style.display = sel.value==="SEXUAL_OFFENCE_POCSO"?"":"none";
  $("[data-close]").onclick = closeOverlay;
  $("#mlcSave").onclick = async () => {
    const f = new FormData($("#mlcForm"));
    if (!f.get("police_station").trim()) { toast("err","Police station required"); return; }
    const body = { encounter_id:+encId, mlc_type:f.get("mlc_type"), opened_by:actor(),
      police_station:f.get("police_station"), incident_at:f.get("incident_at")||undefined,
      incident_place:f.get("incident_place")||undefined, brought_by:f.get("brought_by")||undefined, notes:f.get("notes")||undefined };
    const r = await api.post("/api/mlc", body);
    if (r.ok) { closeOverlay(); toast("ok","MLC opened", r.data.mlc_serial + (r.data.warning?" · POCSO":"")); lwEvent("mlc", { encounter: +encId }); refreshCounts(); viewEncounter(encId); }
    else toast("err","Could not open MLC", (r.data&&r.data.error)||("HTTP "+r.status));
  };
}
function openIntimationModal(mlcId, encId) {
  const modes = ["PHONE","WRITTEN","E_PORTAL","IN_PERSON"];
  openModal({ title:"Log police intimation", icon:"phone",
    body:`<form id="intForm">
      <div class="warn-banner" style="margin-bottom:16px">${icon("info")}<div><div class="wt" style="color:var(--teal-ink)">This IS the statutory evidence</div>
        <div class="wm">“We informed the police” is not a defence. Constable name + badge + time is.</div></div></div>
      <div class="grid-fields"><div class="field"><label>Method <span class="req">*</span></label><select class="sel" name="mode">${modes.map(m=>`<option value="${m}">${pretty(m)}</option>`).join("")}</select></div>
        <div class="field"><label>Police station <span class="req">*</span></label><input class="inp" name="police_station" autocomplete="off"></div></div>
      <div class="grid-fields"><div class="field"><label>Officer name <span class="req">*</span></label><input class="inp" name="constable_name" autocomplete="off"></div>
        <div class="field"><label>Badge no. <span class="req">*</span></label><input class="inp mono" name="constable_badge" autocomplete="off"></div></div>
      <div class="field"><label>Ack / diary ref <span class="muted">(portal only)</span></label><input class="inp mono" name="ack_ref" autocomplete="off"></div>
      <div class="field"><label>Notes</label><textarea class="inp" name="notes" rows="2"></textarea></div>
    </form>`,
    footer:`<button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="intSave">${icon("check")} Log intimation</button>` });
  $("[data-close]").onclick = closeOverlay;
  $("#intSave").onclick = async () => {
    const f = new FormData($("#intForm"));
    for (const k of ["police_station","constable_name","constable_badge"]) if (!f.get(k).trim()) { toast("err","Missing required field", pretty(k)); return; }
    const body = { mode:f.get("mode"), police_station:f.get("police_station"), constable_name:f.get("constable_name"),
      constable_badge:f.get("constable_badge"), ack_ref:f.get("ack_ref")||undefined, notes:f.get("notes")||undefined, logged_by:actor() };
    const r = await api.post(`/api/mlc/${mlcId}/intimation`, body);
    if (r.ok) { closeOverlay(); toast("ok","Intimation logged","Statutory duty evidenced."); lwEvent("forge", { encounter: encId ? +encId : undefined }); refreshCounts(); if(encId)viewEncounter(encId); else viewMlcDetail(mlcId); }
    else toast("err","Could not log", (r.data&&r.data.error)||("HTTP "+r.status));
  };
}

/* ---- Disposition modal (type-driven) ---- */
function openDispositionModal(encId, pending) {
  const types = ["ADMIT","REFER_OUT","DISCHARGE","LAMA","DEATH","BROUGHT_DEAD"];
  openModal({ title:"Disposition", icon:"file", wide:true,
    body:`<form id="dispForm">
      ${pending?`<div class="warn-banner">${icon("alert")}<div><div class="wt">MLC intimation not yet logged</div>
        <div class="wm">You may proceed (care is never delayed by police formalities), but the silence goes on the record with your name attached.</div>
        <div class="stat">BNSS 2023 §194-196 · Art. 21</div></div></div>`:""}
      <div class="field"><label>Disposition type <span class="req">*</span></label><select class="sel" name="type" id="dtype">${types.map(t=>`<option value="${t}">${pretty(t)}</option>`).join("")}</select></div>
      <div id="dfields"></div>
      ${pending?`<fieldset id="ackWrap"><legend style="color:var(--coral-2)">MLC acknowledgement</legend>
        <label class="chk" style="margin-bottom:10px"><input type="checkbox" id="ackChk"> <span>I acknowledge no intimation is logged and choose to proceed</span></label>
        <div class="field" style="margin:0"><label>Justification <span class="req">*</span> <span class="muted">(min 10 chars)</span></label><textarea class="inp" id="ackReason" rows="2" placeholder="e.g. Station phone unreachable; written intimation dispatched by hand."></textarea></div></fieldset>`:""}
    </form>`,
    footer:`<button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="dispSave">${icon("check")} Save disposition</button>` });
  $("[data-close]").onclick = closeOverlay;
  const dfields = $("#dfields");
  const render = () => { dfields.innerHTML = dispFields($("#dtype").value); };
  $("#dtype").onchange = render; render();
  $("#dispSave").onclick = async () => submitDisposition(encId, pending);
}
function dispFields(t) {
  const F = {
    ADMIT: `<div class="field"><label>Ward <span class="req">*</span></label><input class="inp" name="ward_requested" placeholder="e.g. Medicine"></div>
      <div class="hint">${icon("info")} Bed request is stubbed to PRD-02 (phone-based admission continues).</div>`,
    REFER_OUT: `<div class="grid-fields"><div class="field"><label>Facility <span class="req">*</span></label><input class="inp" name="referral_facility"></div>
      <div class="field"><label>Contact</label><input class="inp mono" name="referral_contact"></div></div>
      <div class="field"><label>Reason <span class="req">*</span></label><input class="inp" name="referral_reason"></div>`,
    DISCHARGE: `<div class="field"><label>Discharge instructions <span class="req">*</span></label><textarea class="inp" name="discharge_instr" rows="3"></textarea></div>`,
    LAMA: `<div class="field"><label>Counselled by <span class="req">*</span></label><input class="inp" name="lama_counselled_by"></div>
      <label class="chk" style="max-width:320px;margin-bottom:12px"><input type="checkbox" name="lama_risks_explained" checked> <span>Risks explained to patient/kin <span class="req">*</span></span></label>
      <div class="field"><label>Witness</label><input class="inp" name="lama_witness"></div>`,
    DEATH: deathFields(), BROUGHT_DEAD: deathFields(),
  };
  return F[t] || "";
}
function deathFields() {
  return `<div class="grid-fields"><div class="field"><label>Time of death <span class="req">*</span></label><input class="inp" name="death_ts" type="datetime-local"></div>
    <div class="field"><label>Cause ICD-10 <span class="req">*</span></label><input class="inp mono" name="cause_of_death_icd10" placeholder="e.g. I21.9"></div></div>
    <div class="field"><label>MCCD Form 4/4A ref</label><input class="inp mono" name="mccd_form4_ref"></div>
    <div class="hint">${icon("alert")} Unnatural death requires an MLC first (BNSS §194) — the server enforces this.</div>`;
}
async function submitDisposition(encId, pending) {
  const f = new FormData($("#dispForm")); const t = f.get("type");
  const req = { ADMIT:["ward_requested"], REFER_OUT:["referral_facility","referral_reason"], DISCHARGE:["discharge_instr"],
    LAMA:["lama_counselled_by"], DEATH:["death_ts","cause_of_death_icd10"], BROUGHT_DEAD:["death_ts","cause_of_death_icd10"] }[t]||[];
  for (const k of req) if (!(f.get(k)||"").trim()) { toast("err","Missing required field", pretty(k)); return; }
  const body = { encounter_id:+encId, type:t, decided_by:actor() };
  ["ward_requested","referral_facility","referral_contact","referral_reason","discharge_instr","lama_counselled_by","lama_witness","death_ts","cause_of_death_icd10","mccd_form4_ref"]
    .forEach(k => { const val=f.get(k); if (val) body[k]=val; });
  if (t==="LAMA") body.lama_risks_explained = f.get("lama_risks_explained")?1:0;
  if (pending) { const ack=$("#ackChk"), reason=$("#ackReason");
    if (ack&&ack.checked) { if ((reason.value||"").trim().length<10){toast("err","Justification required","Minimum 10 characters.");reason.focus();return;} body.mlc_warning_ack=true; body.mlc_warning_reason=reason.value.trim(); } }
  const r = await api.post("/api/disposition", body);
  if (r.ok) { closeOverlay(); toast("ok","Disposition saved", pretty(t)); lwEvent("release", { encounter: +encId, death: t==="DEATH"||t==="BROUGHT_DEAD" }); refreshCounts(); viewEncounter(encId); }
  else if (r.status===409) { // US-6 warning
    toast("warn","MLC intimation pending", r.data.detail||"");
    if (!$("#ackWrap")) { // inject ack UI
      const wrap = document.createElement("fieldset"); wrap.id="ackWrap";
      wrap.innerHTML = `<legend style="color:var(--coral-2)">MLC acknowledgement (BNSS §194-196)</legend>
        <label class="chk" style="margin-bottom:10px"><input type="checkbox" id="ackChk" checked> <span>Acknowledge & proceed</span></label>
        <div class="field" style="margin:0"><label>Justification <span class="req">*</span></label><textarea class="inp" id="ackReason" rows="2"></textarea></div>`;
      $("#dispForm").appendChild(wrap); $("#ackReason").focus();
    }
  }
  else toast("err","Disposition failed", (r.data&&r.data.error)||("HTTP "+r.status));
}

/* ---- MLC register ---- */
async function viewMlc() {
  const v = viewEl(); v.innerHTML = skeleton(); setCrumbs(["Medico-legal","MLC register"]);
  const r = await api.get("/api/mlc");
  if (!r.ok) { v.innerHTML = offlineState(); return; }
  const rows = r.data;
  v.innerHTML = `<div class="view-inner view-anim">
    <div class="page-head"><div class="h"><h1>MLC register</h1><div class="sub">${rows.length} case(s) · gapless statutory serials (BNSS §194-196)</div></div></div>
    ${rows.length?`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Serial</th><th>Patient</th><th>Type</th><th>Opened</th><th>Intimations</th><th></th></tr></thead>
      <tbody>${rows.map(m=>`<tr class="clickable" data-mlc="${m.id}">
        <td class="mono" style="color:var(--coral-2);font-weight:700">${esc(m.mlc_serial)}</td>
        <td><div class="cell-name">${esc(m.display_name)}</div><div class="cell-sub mono">${esc(m.identifier)}</div></td>
        <td>${pretty(m.mlc_type)} ${m.pocso_flag?'<span class="badge pocso">POCSO</span>':""}</td>
        <td class="mono cell-sub">${fmtTs(m.opened_ts)}</td>
        <td>${m.intimation_count?`<span class="badge ok">${m.intimation_count} logged</span>`:`<span class="badge" style="color:var(--coral-2)">pending</span>`}</td>
        <td class="right">${icon("chevronR")}</td></tr>`).join("")}</tbody></table></div>`
      :`<div class="empty"><span>${icon("gavel")}</span><h3>No MLC cases</h3></div>`}</div>`;
  $$("[data-mlc]").forEach(el=>el.onclick=()=>location.hash="#/mlc/"+el.getAttribute("data-mlc"));
}
async function viewMlcDetail(id) {
  const v = viewEl(); v.innerHTML = skeleton(); setCrumbs(["Medico-legal","MLC case"]);
  const r = await api.get("/api/mlc/"+id);
  if (!r.ok) { v.innerHTML = r.status===404?notFound("MLC case not found"):offlineState(); return; }
  const { mlc:m, encounter:e, patient:p, intimations } = r.data;
  const name = p?(p.name||"[UNKNOWN] "+(p.temp_id||"")):"—";
  v.innerHTML = `<div class="view-inner view-anim">
    <div class="page-head"><div class="h"><div class="greet mono" style="color:var(--coral-2)">${esc(m.mlc_serial)}</div>
      <h1>${pretty(m.mlc_type)} ${m.pocso_flag?'<span class="badge pocso" style="vertical-align:middle">POCSO</span>':""}</h1>
      <div class="sub">status ${esc(m.status||"REGISTERED")} · <a href="#/encounter/${e.id}" style="color:var(--teal-ink)">encounter ENC-${e.id}</a> · ${esc(name)}</div></div>
      <div class="actions">${can("intimation")?`<button class="btn coral" id="addIntim">${icon("phone")} Log intimation</button>`:""}</div></div>

    ${m.pocso_flag?`<div class="warn-banner">${icon("alert")}<div><div class="wt">POCSO mandatory reporting</div><div class="wm">§19-21 — reporting to SJPU/police is mandatory and non-reporting is itself a punishable offence.</div></div></div>`:""}

    <div class="grid cols-3" style="align-items:start">
      <div class="card"><div class="hd"><span class="card-title-icn" style="background:var(--coral-dim);color:var(--coral-2)">${icon("gavel")}</span><h3>Case</h3></div>
        <div class="bd"><dl class="dl">
          <dt>Serial</dt><dd class="mono">${esc(m.mlc_serial)}</dd>
          <dt>Type</dt><dd>${pretty(m.mlc_type)}</dd>
          <dt>Opened</dt><dd class="mono">${fmtTs(m.opened_ts)}</dd>
          <dt>By</dt><dd>${esc(m.opened_by)}</dd>
          <dt>Basis</dt><dd class="mono">BNSS §194-196</dd>
        </dl></div></div>
      <div class="card span-2"><div class="hd"><span class="card-title-icn">${icon("phone")}</span><h3>Police intimations</h3><span class="sub">the record of communication</span></div>
        <div class="bd">${intimations.length?`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>When</th><th>Method</th><th>Station</th><th>Officer</th><th>Badge</th><th>By</th></tr></thead>
          <tbody>${intimations.map(x=>`<tr><td class="mono cell-sub">${fmtTs(x.intimated_ts)}</td><td>${pretty(x.mode)}</td><td>${esc(x.police_station)}</td><td>${esc(x.constable_name)}</td><td class="mono">${esc(x.constable_badge)}</td><td class="cell-sub">${esc(x.logged_by)}</td></tr>`).join("")}</tbody></table></div>`
          :`<div class="warn-banner" style="margin:0">${icon("alert")}<div><div class="wt">No intimation logged</div><div class="wm">Disposition of this encounter will warn until an intimation is recorded.</div></div></div>`}</div></div>
    </div></div>`;
  const b = $("#addIntim"); if (b) b.onclick = () => openIntimationModal(id, null);
}

/* ---- Audit trail ---- */
async function viewAudit() {
  const v = viewEl(); v.innerHTML = skeleton(); setCrumbs(["Governance","Audit trail"]);
  const r = await api.get("/api/audit");
  if (!r.ok) { v.innerHTML = offlineState(); return; }
  const D = r.data; state.counts.audit_chain_intact = D.chain_intact; updateChainPill();
  const badge = D.chain_intact ? `<span class="badge ok">${icon("shieldcheck")} Hash chain verified · ${D.entries.length} rows</span>`
    : `<span class="badge" style="color:var(--coral-2)">${icon("alert")} Chain BROKEN at row ${D.first_broken_row}</span>`;
  v.innerHTML = `<div class="view-inner view-anim">
    <div class="page-head"><div class="h"><h1>Audit trail</h1><div class="sub">Append-only · SHA-256 hash-chained · tamper-evident (PRD-05 §7)</div></div>
      <div class="actions">${badge}</div></div>
    <div class="filters">
      <div class="flex" style="position:relative"><span style="position:absolute;left:10px;color:var(--muted)">${icon("search")}</span>
        <input class="inp search" id="aq" placeholder="Search actor, action, detail…" style="padding-left:34px"></div>
      <select class="sel" id="aaction"><option value="">All actions</option>${D.actions.map(a=>`<option value="${a}">${a}</option>`).join("")}</select>
    </div>
    <div id="auditTbl"></div></div>`;
  const draw = () => {
    const q=$("#aq").value.trim().toLowerCase(), act=$("#aaction").value;
    const list = D.entries.filter(e=>(!act||e.action===act)&&(!q||JSON.stringify(e).toLowerCase().includes(q)));
    $("#auditTbl").innerHTML = list.length?`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Detail</th><th>Hash</th></tr></thead>
      <tbody>${list.map(e=>`<tr><td class="mono cell-sub nowrap">${fmtTs(e.ts)}</td><td>${esc(e.actor)}</td>
        <td>${actionBadge(e.action)}</td><td class="cell-sub mono">${esc(e.entity)}#${e.entity_id??"—"}</td>
        <td class="cell-sub" style="max-width:280px">${esc(shortDetail(e.detail_json))}</td>
        <td class="mono cell-sub" title="${esc(e.row_hash)}">${esc((e.row_hash||"").slice(0,10))}…</td></tr>`).join("")}</tbody></table></div>`
      :`<div class="empty"><span>${icon("shieldcheck")}</span><h3>No matching entries</h3></div>`;
  };
  ["aq","aaction"].forEach(i=>$("#"+i).addEventListener("input",draw)); draw();
}
function actionBadge(a) {
  const coral = /MLC|INTIMATION|DISPOSITION/.test(a), warn=/OVERRIDE/.test(a);
  return `<span class="badge ${coral?'mlc':warn?'warn':''}">${esc(a)}</span>`;
}
function shortDetail(j){ try{ const o=JSON.parse(j); return Object.entries(o).map(([k,val])=>`${k}: ${val}`).join(" · ")||"—"; }catch(e){ return "—"; } }

/* ---- Override report ---- */
async function viewOverrides() {
  const v = viewEl(); v.innerHTML = skeleton(); setCrumbs(["Governance","Override report"]);
  const r = await api.get("/api/reports/overrides");
  if (!r.ok) { v.innerHTML = offlineState(); return; }
  const rows = r.data;
  v.innerHTML = `<div class="view-inner view-anim">
    <div class="page-head"><div class="h"><h1>Triage override report</h1><div class="sub">PRD-05 §11 — reported to the medical director monthly. Downgrades are the direction that should worry you.</div></div></div>
    ${rows.length?`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>When</th><th>Nurse</th><th>Patient</th><th>Suggested</th><th>Final</th><th>Direction</th><th>Reason</th></tr></thead>
      <tbody>${rows.map(o=>`<tr><td class="mono cell-sub nowrap">${fmtTs(o.triaged_ts)}</td><td>${esc(o.triaged_by)}</td><td class="mono">${esc(o.identifier)}</td>
        <td><span class="lvl ${levelClass(o.suggested_level)}">L${o.suggested_level}</span></td>
        <td><span class="lvl ${levelClass(o.final_level)}">L${o.final_level}</span></td>
        <td><span class="badge ${o.direction==='DOWNGRADED'?'':'ok'}" style="${o.direction==='DOWNGRADED'?'color:var(--coral-2)':''}">${o.direction==='DOWNGRADED'?icon('arrowDown'):icon('arrowUp')} ${esc(o.direction)}</span></td>
        <td class="cell-sub" style="max-width:320px">${esc(o.override_reason)}</td></tr>`).join("")}</tbody></table></div>`
      :`<div class="empty"><span>${icon("flag")}</span><h3>No overrides recorded</h3><p class="muted">Every triage matched the engine suggestion.</p></div>`}</div>`;
}

/* ---------------- router ---------------- */
const ROUTES = [
  [/^\/?$/, viewDashboard],
  [/^\/board$/, viewBoard],
  [/^\/register$/, viewRegister],
  [/^\/patients$/, viewPatients],
  [/^\/triage\/(\d+)$/, (m)=>viewTriage(m[1])],
  [/^\/encounter\/(\d+)$/, (m)=>viewEncounter(m[1])],
  [/^\/mlc$/, viewMlc],
  [/^\/mlc\/(\d+)$/, (m)=>viewMlcDetail(m[1])],
  [/^\/audit$/, viewAudit],
  [/^\/overrides$/, viewOverrides],
];
function router() {
  clearTimeout(state.boardTimer);
  const path = location.hash.replace(/^#/, "") || "/";
  $$("[data-nav]").forEach(a => {
    const h = a.getAttribute("href").replace(/^#/, "");
    a.classList.toggle("active", h===path || (h!=="/" && path.startsWith(h)) || (h==="/"&&path==="/"));
  });
  for (const [re, fn] of ROUTES) { const m = path.match(re); if (m) { fn(m); $("#view")?.focus?.({preventScroll:true}); return; } }
  viewEl().innerHTML = notFound("Page not found");
}

/* ---------------- init ---------------- */
async function init() {
  const s = await api.get("/api/scale"); if (s.ok) state.scale = s.data;
  await refreshCounts();
  renderShell();
  window.addEventListener("hashchange", router);
  window.addEventListener("keydown", e => {
    if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="k") { e.preventDefault(); openPalette(); }
    if (e.key === "Escape") document.body.classList.remove("wallboard");
  });
  router();
  $("#app").removeAttribute("aria-busy");
}
init();
})();
