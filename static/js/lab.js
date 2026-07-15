/* =====================================================================
   THE LIVING WARD — "Vitals Field" engine v3 (cinematic depth upgrade)

   The department as a single bioluminescent organism, now inside a deep
   perspective environment (hand-rolled 3D projection on 2D canvas — no
   WebGL, no libraries, offline NFR intact):

   · THE EVIDENCE STRAND — the signature structure. The tamper-evident
     audit chain rendered as a MASSIVE luminous helical spine running
     diagonally through depth, extending beyond the viewport. It twirls
     with layered organic motion (slow rotation + travelling wave), reacts
     to scroll velocity and route, and is foregrounded on the Audit route
     (severed visibly at the exact break point if the chain is broken).
   · ENCOUNTER CELLS — live patients (screen-anchored so they stay aligned
     with the clinical UI): acuity = colour + pulse rate, untriaged = bone
     shimmer, MLC = brick halo, breach = flare. Cells connect with faint
     synapses — one organism.
   · DATA DUST + FOG + VIGNETTE — atmospheric depth, always subordinate.

   Motion contract unchanged (§12): nucleation / stabilization / breach
   flare / halo / spine forge / release — every motion carries clinical
   meaning. Camera: slow per-route drift + pointer parallax; Recruiter-
   grade restraint everywhere; `prefers-reduced-motion` → static frames.
   Budget: DPR≤1.5 (1 small), ≤90 strand nodes + ≤90 dust (30/40 small),
   zero per-frame allocation hot paths, rAF paused on tab-hide, ~10fps
   after 60s idle. The field never intercepts input or harms legibility
   (content-zone dim). Canvas is aria-hidden.
   ===================================================================== */
(() => {
  "use strict";
  const canvas = document.getElementById("lab");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SMALL = () => window.innerWidth <= 760;

  /* ---- palette (lab-theme.css tokens) ---- */
  const BONE = [245, 246, 241];
  const LIME = [206, 247, 158];
  const BRICK = [215, 107, 82];
  const PLANKTON = [180, 182, 160];
  const LVL = { 1: [217, 68, 54], 2: [224, 122, 60], 3: [217, 178, 63], 4: [120, 192, 122], 5: [90, 160, 196] };
  const PULSE_S = { 1: 1.1, 2: 1.9, 3: 3.0, 4: 4.6, 5: 6.4 };
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  function mulberry(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---- state ---- */
  let W = 0, H = 0, DPR = 1, raf = 0, frame = 0;
  let cells = [], dust = [], flashes = [];
  let route = "/", focusId = null, spotId = null;
  let deathHold = 0, audit = null;
  let lastInput = performance.now();
  let sbRight = 0, topBot = 56;
  let vignette = null;
  let scrollVel = 0, lastScrollT = 0;
  const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
  /* camera: eases toward per-route pose; pointer adds micro-parallax */
  const cam = { yaw: 0, pitch: 0, z: 0, tyaw: 0, tpitch: 0, tz: 0 };

  /* =============== 3D projection (hand-rolled, no deps) =============== */
  const FOV = 760;
  function project(p, out) { // p:[x,y,z] world; camera at origin looking +z
    const cy = Math.cos(cam.yaw + (pointer.x - 0.5) * 0.05), sy = Math.sin(cam.yaw + (pointer.x - 0.5) * 0.05);
    const cp = Math.cos(cam.pitch + (pointer.y - 0.5) * 0.04), sp = Math.sin(cam.pitch + (pointer.y - 0.5) * 0.04);
    let x = p[0], y = p[1], z = p[2] - cam.z;
    let x1 = x * cy + z * sy, z1 = -x * sy + z * cy;      // yaw
    let y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;     // pitch
    if (z2 < 90) return false;
    const s = FOV / z2;
    out.x = W / 2 + x1 * s; out.y = H / 2 + y1 * s; out.s = s;
    out.fog = clamp(1 - (z2 - 300) / 1850, 0.06, 1);
    return true;
  }

  /* =============== THE EVIDENCE STRAND (signature structure) =============== */
  const strand = { nodes: [], N: 0, A: [0, 0, 0], B: [0, 0, 0], u: [0, 0, 0], v: [0, 0, 0], alpha: 0.5, talpha: 0.5, rot: 0, hot: -1 };
  function buildStrand() {
    strand.N = SMALL() ? 44 : 88;
    // a massive diagonal axis: enters bottom-left near, exits top-right far — beyond the viewport
    strand.A = [-1250, 950, 780];
    strand.B = [1450, -1150, 2100];
    const d = [strand.B[0] - strand.A[0], strand.B[1] - strand.A[1], strand.B[2] - strand.A[2]];
    const dl = Math.hypot(d[0], d[1], d[2]); d[0] /= dl; d[1] /= dl; d[2] /= dl;
    let u = [d[1], -d[0], 0]; const ul = Math.hypot(u[0], u[1], u[2]) || 1; u = [u[0] / ul, u[1] / ul, u[2] / ul];
    const v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
    strand.u = u; strand.v = v;
    const P0 = () => ({ x: 0, y: 0, s: 0, fog: 0, ok: false });
    strand.P1 = new Array(strand.N).fill(0).map(P0);
    strand.P2 = new Array(strand.N).fill(0).map(P0);
    const sr = mulberry(913); // pre-seeded data-particle offsets (zero per-frame alloc)
    strand.sat = new Array(strand.N).fill(0).map(() => ({ a: (sr() - 0.5) * 34, b: (sr() - 0.5) * 34, c: (sr() - 0.5) * 34, d: (sr() - 0.5) * 34, sp: 0.6 + sr() }));
  }
  function strandAlphaFor(r) {
    if (r === "/audit") return 1;
    if (r === "/") return 0.38;
    if (r === "/board") return 0.35;
    if (r === "/register" || r === "/mlc" || r.startsWith("/mlc/")) return 0.45;
    return 0.3;
  }
  function drawStrand(t, still) {
    const a0 = strand.alpha; if (a0 <= 0.01) return;
    const N = strand.N;
    const R = 165, twist = 0.62;
    const rot = strand.rot;
    const wob = still ? 0 : t * 0.00045;
    const boost = route === "/audit" ? 1.35 : 1;
    const brokenNode = audit && !audit.intact ? clamp(Math.round((audit.broken / Math.max(1, audit.count)) * N), 2, N - 2) : -1;
    const P1 = strand.P1, P2 = strand.P2;

    // project BOTH helical strands (phase offset π — a true double helix)
    for (let i = 0; i < N; i++) {
      const f = i / (N - 1);
      const th = i * twist + rot;
      const rr = R * (1 + (still ? 0 : 0.1 * Math.sin(f * 9 - wob * 6)));      // travelling wave
      const cxw = strand.A[0] + (strand.B[0] - strand.A[0]) * f;
      const cyw = strand.A[1] + (strand.B[1] - strand.A[1]) * f;
      const czw = strand.A[2] + (strand.B[2] - strand.A[2]) * f;
      const oc = Math.cos(th) * rr, os = Math.sin(th) * rr;
      const ox = strand.u[0] * oc + strand.v[0] * os, oy = strand.u[1] * oc + strand.v[1] * os, oz = strand.u[2] * oc + strand.v[2] * os;
      P1[i].ok = project([cxw + ox, cyw + oy, czw + oz], P1[i]);
      P2[i].ok = project([cxw - ox, cyw - oy, czw - oz], P2[i]);
    }
    const laOf = P => a0 * boost * P.fog * ((P.x > sbRight + 14 && P.y > topBot + 8 && route !== "/audit") ? 0.65 : 1);

    // base-pair rungs between the strands (skipped across the break gap)
    for (let i = 1; i < N; i += 2) {
      const A = P1[i], B = P2[i]; if (!A.ok || !B.ok) continue;
      if (brokenNode >= 0 && Math.abs(i - brokenNode) < 3) continue;
      const bad = brokenNode >= 0 && i >= brokenNode;
      const col = bad ? BRICK : LIME;
      const la = Math.min(laOf(A), laOf(B));
      ctx.strokeStyle = rgba(col, la * 0.20); ctx.lineWidth = Math.max(0.5, A.s * 0.9);
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
      ctx.fillStyle = rgba(col, la * 0.55);
      ctx.beginPath(); ctx.arc((A.x + B.x) / 2, (A.y + B.y) / 2, Math.max(0.5, A.s * 0.9), 0, Math.PI * 2); ctx.fill();
    }

    // two luminous backbones + link nodes + data particles + glints
    for (let sIx = 0; sIx < 2; sIx++) {
      const P = sIx ? P2 : P1;
      let prevOK = false, px = 0, py = 0;
      for (let i = 0; i < N; i++) {
        const Q = P[i];
        if (!Q.ok) { prevOK = false; continue; }
        const hotB = strand.hot >= 0 && Math.abs(i - strand.hot) < 2; // audit row ↔ its link on the helix
        const la = hotB ? Math.min(1, laOf(Q) * 2) : laOf(Q);
        const bad = brokenNode >= 0 && i >= brokenNode;
        if (prevOK) {
          if (i === brokenNode) { // the severed strand — the exact break point
            ctx.strokeStyle = rgba(BRICK, Math.min(1, la * 2.2)); ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo((px + Q.x) / 2 - 6 * Q.s, (py + Q.y) / 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo((px + Q.x) / 2 + 6 * Q.s, (py + Q.y) / 2 + 3); ctx.lineTo(Q.x, Q.y); ctx.stroke();
          } else {
            ctx.strokeStyle = rgba(bad ? BRICK : LIME, la * 0.5); ctx.lineWidth = Math.max(0.7, Q.s * 1.4);
            ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(Q.x, Q.y); ctx.stroke();
          }
        }
        const vert = i % 2 === 0; // vertebra: an inspectable audit link (dense)
        const glim = sIx === 0 && !still && Math.floor(t / 300) % N === i;
        const col = bad ? BRICK : LIME;
        const r2 = (vert ? 3.0 : 1.4) * Q.s * (glim || hotB ? 1.9 : 1);
        if (vert || glim || hotB || i === brokenNode) { // rationed glow — only the links breathe
          const g = ctx.createRadialGradient(Q.x, Q.y, 0, Q.x, Q.y, r2 * 5);
          g.addColorStop(0, rgba(col, la * (glim ? 0.7 : 0.4)));
          g.addColorStop(1, rgba(col, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(Q.x, Q.y, r2 * 5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = rgba(col, Math.min(1, la * (vert ? 1.9 : 1.2)));
        ctx.beginPath(); ctx.arc(Q.x, Q.y, r2, 0, Math.PI * 2); ctx.fill();
        if (vert && !bad) { // scattered data particles, twinkling around the links
          const S2 = strand.sat[i];
          const ox1 = sIx ? S2.c : S2.a, oy1 = sIx ? S2.d : S2.b;
          const tw = still ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.0016 * S2.sp + i * 1.7 + sIx * 9);
          ctx.fillStyle = rgba(LIME, la * 0.55 * tw);
          ctx.beginPath(); ctx.arc(Q.x + ox1 * Q.s, Q.y + oy1 * Q.s, Math.max(0.4, 0.9 * Q.s), 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = rgba(BONE, la * 0.35 * (1 - tw));
          ctx.beginPath(); ctx.arc(Q.x - oy1 * Q.s * 0.7, Q.y + ox1 * Q.s * 0.7, Math.max(0.35, 0.6 * Q.s), 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = rgba(LIME, la * 0.4 * (0.3 + 0.7 * (1 - tw)));
          ctx.beginPath(); ctx.arc(Q.x + oy1 * Q.s * 1.3, Q.y - ox1 * Q.s * 1.3, Math.max(0.3, 0.5 * Q.s), 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = rgba(BONE, la * 0.3 * tw);
          ctx.beginPath(); ctx.arc(Q.x - ox1 * Q.s * 1.6, Q.y - oy1 * Q.s * 1.6, Math.max(0.3, 0.45 * Q.s), 0, Math.PI * 2); ctx.fill();
          const tw2 = still ? 0 : Math.sin(t * 0.0011 + i * 2.3 + sIx * 4);
          if (tw2 > 0.96) { // an occasional 4-point glint, like light catching a link
            const gl = (tw2 - 0.96) / 0.04, L = 10 * Q.s * gl;
            ctx.strokeStyle = rgba(BONE, la * 0.85 * gl); ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(Q.x - L, Q.y); ctx.lineTo(Q.x + L, Q.y);
            ctx.moveTo(Q.x, Q.y - L); ctx.lineTo(Q.x, Q.y + L); ctx.stroke();
          }
        }
        prevOK = true; px = Q.x; py = Q.y;
      }
    }
  }

  /* =============== layout / chrome =============== */
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, SMALL() ? 1 : 1.5);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildStrand(); seedDust(); makeVignette(); measureChrome(); retarget(true);
  }
  function measureChrome() {
    const sb = document.querySelector(".sidebar");
    const tb = document.querySelector(".topbar");
    sbRight = sb && !SMALL() ? sb.getBoundingClientRect().right : 0;
    topBot = tb ? tb.getBoundingClientRect().bottom : 56;
  }
  function makeVignette() {
    vignette = document.createElement("canvas");
    vignette.width = Math.max(2, Math.floor(W / 4)); vignette.height = Math.max(2, Math.floor(H / 4));
    const vc = vignette.getContext("2d");
    const g = vc.createRadialGradient(vignette.width / 2, vignette.height / 2, Math.min(vignette.width, vignette.height) * 0.32, vignette.width / 2, vignette.height / 2, Math.max(vignette.width, vignette.height) * 0.72);
    g.addColorStop(0, "rgba(28,27,23,0)"); g.addColorStop(1, "rgba(23,21,17,0.6)");
    vc.fillStyle = g; vc.fillRect(0, 0, vignette.width, vignette.height);
  }
  function seedDust() {
    const cap = SMALL() ? 40 : Math.max(48, Math.min(150, Math.round((W * H) / 15000)));
    const r = mulberry(1337);
    dust = new Array(cap).fill(0).map(() => ({
      x: (r() - 0.5) * 2600, y: (r() - 0.5) * 2000, z: 300 + r() * 2100,
      vz: -(0.25 + r() * 0.5), ph: r() * Math.PI * 2, r: 0.7 + r() * 1.5,
    }));
  }

  /* =============== encounter cells (screen-anchored, UI-aligned) =============== */
  function targetFor(c) {
    const rnd = mulberry(c.id * 7919 + 17); const r1 = rnd(), r2 = rnd(), r3 = rnd();
    const cx = sbRight + (W - sbRight) / 2, m = 70;
    if (c.id === focusId && (route.startsWith("/triage/") || route.startsWith("/encounter/"))) {
      // keep the focus cell CLEAR of the display headline (§7: never under text).
      // Measure the h1 and park the cell to its right; if no room, tuck above it.
      let hx = 0, hy = topBot + 24;
      const h1 = document.querySelector(".page-head h1");
      if (h1) {
        const r = h1.getBoundingClientRect();
        if (r.width) {
          if (r.right + 60 < W - 40) { hx = r.right + 46; hy = r.top + Math.min(r.height, 40) / 2 + 8; }
          else { hx = Math.min(W - 60, r.left + r.width * 0.75); hy = Math.max(24, r.top - 26); }
        }
      }
      if (!hx) { hx = Math.min(W - 90, sbRight + (W - sbRight) * 0.72); hy = topBot + 24; }
      return { x: hx, y: hy, s: route.startsWith("/triage/") ? 2.0 : 2.3 };
    }
    if (route === "/board") {
      const band = c.level ? c.level : 0;
      const y0 = topBot + 40, bh = Math.max(56, (H - y0 - 60) / 6);
      return { x: sbRight + m + r1 * (W - sbRight - m * 2), y: y0 + band * bh + r2 * bh * 0.6, s: 1 };
    }
    if (route === "/register") {
      const a = r1 * Math.PI * 2, rr = Math.min(W - sbRight, H) * (0.34 + r2 * 0.1);
      return { x: cx + Math.cos(a) * rr, y: H * 0.52 + Math.sin(a) * rr * 0.8, s: 1 };
    }
    if (route === "/mlc" || route.startsWith("/mlc/")) {
      if (c.mlc) return { x: sbRight + m + r1 * (W - sbRight - m * 2), y: H * (0.3 + r2 * 0.35), s: 1.3 };
      return { x: r1 < 0.5 ? sbRight + 30 : W - 30, y: 60 + r2 * (H - 120), s: 0.7 };
    }
    if (route === "/audit") return { x: sbRight + 24 + r1 * 90, y: 80 + r2 * (H - 160), s: 0.7 };
    if (route.startsWith("/triage/") || route.startsWith("/encounter/")) {
      return { x: r1 < 0.5 ? sbRight + 24 + r2 * 60 : W - 24 - r2 * 60, y: 60 + r3 * (H - 120), s: 0.75 };
    }
    const a = r1 * Math.PI * 2, rr = Math.pow(r2, 0.6) * Math.min(W - sbRight, H) * 0.46;
    return { x: cx + Math.cos(a) * rr * 1.1, y: H * 0.5 + Math.sin(a) * rr * 0.85, s: 1 };
  }
  function retarget(snap) {
    for (const c of cells) {
      const t = targetFor(c); c.tx = t.x; c.ty = t.y; c.ts = t.s;
      if (snap || RM) { c.x = t.x; c.y = t.y; c.s = t.s; }
    }
  }

  /* =============== data sync (mirrors the real department) =============== */
  let syncTimer = 0;
  async function sync() {
    try {
      const r = await fetch("/api/board"); if (!r.ok) return;
      const rows = await r.json(); if (!Array.isArray(rows)) return;
      const seen = new Set();
      for (const row of rows) {
        seen.add(row.encounter_id);
        let c = cells.find(x => x.id === row.encounter_id);
        if (!c) {
          const rnd = mulberry(row.encounter_id * 31 + 7);
          c = { id: row.encounter_id, x: W / 2, y: H / 2, s: 0.01, tx: W / 2, ty: H / 2, ts: 1,
                r: 2.4 + rnd() * 2.2, z: 0.5 + rnd() * 0.5, ph: rnd() * Math.PI * 2, born: performance.now(), dying: 0, lean: 0, flare: 0 };
          cells.push(c);
        }
        c.level = row.level || 0; c.mlc = !!row.is_mlc; c.breach = !!row.is_breached; c.status = row.status;
      }
      for (const c of cells) if (!seen.has(c.id) && !c.dying) c.dying = performance.now();
      retarget(false);
      if (RM) drawFrame(performance.now());
    } catch (e) { /* decorative — never interfere with care */ }
  }
  function scheduleSync() { clearInterval(syncTimer); syncTimer = setInterval(() => { if (!document.hidden) sync(); }, 45000); }
  async function syncAudit() {
    try {
      const r = await fetch("/api/audit"); if (!r.ok) return;
      const d = await r.json();
      audit = { intact: !!d.chain_intact, broken: d.first_broken_row || 0, count: (d.entries || []).length };
      if (RM) drawFrame(performance.now());
    } catch (e) {}
  }

  /* =============== route awareness → camera + strand pose =============== */
  function readRoute() {
    route = (location.hash || "#/").replace(/^#/, "") || "/";
    const m = route.match(/^\/(?:triage|encounter)\/(\d+)/);
    focusId = m ? +m[1] : null;
    if (route === "/audit") { audit = null; syncAudit(); }
    strand.talpha = strandAlphaFor(route);
    if (route === "/audit") { cam.tyaw = 0.10; cam.tpitch = -0.03; cam.tz = 260; }
    else if (route === "/") { cam.tyaw = 0; cam.tpitch = 0; cam.tz = 0; }
    else if (route === "/board") { cam.tyaw = -0.05; cam.tpitch = 0.03; cam.tz = 60; }
    else if (route.startsWith("/triage/") || route.startsWith("/encounter/")) { cam.tyaw = -0.09; cam.tpitch = -0.02; cam.tz = -120; }
    else { cam.tyaw = 0.05; cam.tpitch = 0.02; cam.tz = -40; }
    measureChrome(); retarget(false); sync();
  }
  window.addEventListener("hashchange", readRoute);

  /* =============== clinical events (identical contract to v2) =============== */
  function stripTarget() {
    const el = document.getElementById("spineStrip") || document.getElementById("chainPill");
    if (el) { const r = el.getBoundingClientRect(); if (r.width) return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    return { x: 60, y: H - 40 };
  }
  function forge(from) {
    const to = stripTarget();
    flashes.push({ kind: "forge", x0: from.x, y0: from.y, x1: to.x, y1: to.y, t0: performance.now(), dur: RM ? 1 : 700 });
    const strip = document.getElementById("spineStrip");
    if (strip) { strip.classList.add("forge"); setTimeout(() => strip.classList.remove("forge"), 950); }
  }
  function ring(x, y, color, rMax) {
    flashes.push({ kind: "ring", x, y, color, rMax: rMax || 46, t0: performance.now(), dur: RM ? 1 : 620 });
  }
  const contentCentre = () => ({ x: sbRight + (W - sbRight) / 2, y: H * 0.42 });
  const cellPos = id => { const c = cells.find(x => x.id === id); return c ? { x: c.x, y: c.y } : contentCentre(); };

  window.addEventListener("lw:event", e => {
    const d = (e && e.detail) || {}; const now = performance.now();
    switch (d.type) {
      case "nucleate": { const p = contentCentre(); ring(p.x, p.y, BONE, 54); setTimeout(sync, 350); break; }
      case "lean": { const c = cells.find(x => x.id === +d.encounter); if (c) c.lean = d.level || 0; break; }
      case "stabilize": {
        const c = cells.find(x => x.id === +d.encounter);
        if (c) { c.level = d.level; c.lean = 0; ring(c.x, c.y, LVL[d.level] || LIME, 60); }
        setTimeout(() => forge(cellPos(+d.encounter)), 240); setTimeout(sync, 500); break;
      }
      case "mlc": { const c = cells.find(x => x.id === +d.encounter); if (c) c.mlc = true; forge(cellPos(+d.encounter)); break; }
      case "forge": forge(d.encounter ? cellPos(+d.encounter) : contentCentre()); break;
      case "release": {
        const c = cells.find(x => x.id === +d.encounter);
        if (c) { c.dying = now; c.deathFade = !!d.death; }
        if (d.death) deathHold = now + 2100;
        forge(cellPos(+d.encounter)); setTimeout(sync, 900); break;
      }
      case "flare": {
        for (const c of cells) if ((d.kind === "mlc" && c.mlc) || (d.kind === "breach" && c.breach)) c.flare = now;
        break;
      }
    }
    if (RM) drawFrame(performance.now());
  });

  /* DOM ↔ field spotlight */
  function spot(el) {
    const hit = el && el.closest && el.closest("[data-enc],[data-enc-go],[data-act][data-id]");
    spotId = hit ? +(hit.getAttribute("data-enc") || hit.getAttribute("data-enc-go") || hit.getAttribute("data-id")) : null;
  }
  document.addEventListener("mouseover", e => { spot(e.target); const tr = e.target.closest && e.target.closest("#auditTbl tbody tr"); strand.hot = tr ? Math.max(0, strand.N - 1 - tr.sectionRowIndex) : -1; const k = e.target.closest && e.target.closest("[data-lw]"); if (k) window.dispatchEvent(new CustomEvent("lw:event", { detail: { type: "flare", kind: k.getAttribute("data-lw") } })); }, { passive: true });
  document.addEventListener("focusin", e => spot(e.target));
  document.addEventListener("mouseout", () => { spotId = null; strand.hot = -1; }, { passive: true });

  /* magnetic primary CTA */
  if (!RM) {
    document.addEventListener("pointermove", e => {
      const b = e.target.closest && e.target.closest(".btn.primary");
      if (!b) return;
      const r = b.getBoundingClientRect();
      const dx = Math.max(-6, Math.min(6, (e.clientX - r.left - r.width / 2) * 0.14));
      const dy = Math.max(-6, Math.min(6, (e.clientY - r.top - r.height / 2) * 0.22));
      b.style.transform = `translate(${dx}px,${dy}px)`;
      if (!b.__lwMag) { b.__lwMag = 1; b.addEventListener("pointerleave", () => { b.style.transform = ""; }); }
    }, { passive: true });
  }

  /* scroll velocity stirs the organism (never moves content) */
  window.addEventListener("scroll", () => {
    const now = performance.now();
    scrollVel = Math.min(1, scrollVel + 0.25); lastScrollT = now; lastInput = now;
  }, { passive: true, capture: true });

  /* =============== drawing =============== */
  function breachAmp(t, ph) {
    const p = ((t / 1000) + ph) % 3.4;
    const pulse = s => (p > s && p < s + 0.3) ? Math.sin(((p - s) / 0.3) * Math.PI) : 0;
    return Math.max(pulse(0), pulse(0.44), 0.25);
  }
  const inContent = (x, y) => x > sbRight + 14 && x < W - 14 && y > topBot + 8;

  function drawCell(c, t, still) {
    const age = Math.min(1, (t - c.born) / 500);
    let fade = 1;
    if (c.dying) {
      fade = Math.max(0, 1 - (t - c.dying) / (c.deathFade ? 1600 : 700));
      if (!c.deathFade && !RM) c.x += 0.9;
      if (fade <= 0) return false;
    }
    const scale = c.s * age;
    const rr = c.r * (0.8 + scale);
    const lvl = c.level;
    const spotted = spotId === c.id || focusId === c.id;
    const flared = c.flare && t - c.flare < 900 ? 1 - (t - c.flare) / 900 : 0;

    let col = lvl ? LVL[lvl] : (c.lean ? mix(BONE, LVL[c.lean] || BONE, 0.4) : BONE);
    if (c.deathFade) col = mix(col, BONE, Math.min(1, (t - c.dying) / 700));

    let amp;
    if (still) amp = 0.5;
    else if (c.breach && !c.dying) amp = breachAmp(t, c.ph);
    else if (lvl) amp = 0.5 + 0.38 * Math.sin((t / (PULSE_S[lvl] * 1000)) * Math.PI * 2 + c.ph);
    else amp = 0.4 + 0.24 * Math.sin(t * 0.0042 + c.ph) * Math.sin(t * 0.0017 + c.ph * 2);

    // depth-band parallax (cells stay near their UI anchors)
    const px = (pointer.x - 0.5) * 10 * c.z, py = (pointer.y - 0.5) * 10 * c.z;
    let x = c.x + px, y = c.y + py;
    if (!lvl && !still && !c.dying) { x += Math.sin(t * 0.004 + c.ph) * 2; y += Math.cos(t * 0.0031 + c.ph) * 2; }

    let alpha = (lvl ? 0.4 + amp * 0.35 : 0.3 + amp * 0.3) * fade;
    if (inContent(x, y) && !spotted) alpha *= 0.4; // boxes are gone — the dim alone protects text now
    if (spotted) alpha = Math.min(1, alpha * 1.7);
    alpha = Math.min(1, alpha + flared * 0.5);

    const R = rr * (1 + amp * 0.25 + flared * 0.5) * (spotted ? 1.3 : 1);

    const g = ctx.createRadialGradient(x, y, 0, x, y, R * 3.2);
    g.addColorStop(0, rgba(col, alpha * 0.5));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rgba(col, Math.min(1, alpha + 0.25));
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();

    if (c.mlc) {
      ctx.strokeStyle = rgba(BRICK, (0.5 + flared * 0.4) * fade * (inContent(x, y) && !spotted ? 0.5 : 1));
      ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, R + 4, 0, Math.PI * 2); ctx.stroke();
    }
    if (c.breach && !c.dying) {
      ctx.strokeStyle = rgba(col, Math.min(1, 0.3 + amp * 0.7) * fade);
      ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, R + 7, 0, Math.PI * 2); ctx.stroke();
    }
    if (focusId === c.id && (route.startsWith("/encounter/") || route.startsWith("/triage/"))) {
      ctx.strokeStyle = rgba(col, 0.35 * fade); ctx.setLineDash([2, 5]);
      ctx.beginPath(); ctx.arc(x, y, R + 14, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      const a = still ? 0.8 : t * 0.0008;
      ctx.fillStyle = rgba(LIME, 0.85 * fade);
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * (R + 14), y + Math.sin(a) * (R + 14), 1.6, 0, Math.PI * 2); ctx.fill();
    }
    c.sx = x; c.sy = y; // for synapses
    return true;
  }

  function drawSynapses() { // the ward is ONE organism — cells connect
    if (!(route === "/" || route === "/board") || SMALL()) return;
    const R2 = 190 * 190;
    ctx.lineWidth = 1;
    for (let i = 0; i < cells.length; i++) {
      const a = cells[i]; if (a.dying || a.sx == null) continue;
      for (let j = i + 1; j < cells.length; j++) {
        const b = cells[j]; if (b.dying || b.sx == null) continue;
        const dx = a.sx - b.sx, dy = a.sy - b.sy, d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          const o = (1 - d2 / R2) * 0.12 * ((inContent(a.sx, a.sy) || inContent(b.sx, b.sy)) ? 0.45 : 1);
          ctx.strokeStyle = rgba(PLANKTON, o);
          ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
        }
      }
    }
  }

  const DP = { x: 0, y: 0, s: 0, fog: 0 };
  function drawDust(t, still) {
    for (const d of dust) {
      if (!still) { d.z += d.vz; if (d.z < 260) d.z = 2400; }
      if (!project([d.x, d.y, d.z], DP)) continue;
      const breathe = still ? 0.5 : 0.5 + 0.5 * Math.sin(t / 6000 * Math.PI * 2 + d.ph);
      let al = DP.fog * (0.16 + breathe * 0.12);
      if (inContent(DP.x, DP.y)) al *= 0.45;
      ctx.fillStyle = rgba(PLANKTON, al);
      ctx.beginPath(); ctx.arc(DP.x, DP.y, Math.max(0.6, d.r * DP.s * 2.4), 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawFlashes(t) {
    flashes = flashes.filter(f => t - f.t0 < f.dur + 60);
    for (const f of flashes) {
      const p = Math.min(1, (t - f.t0) / f.dur);
      if (f.kind === "ring") {
        ctx.strokeStyle = rgba(f.color, (1 - p) * 0.7); ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(f.x, f.y, 4 + p * f.rMax, 0, Math.PI * 2); ctx.stroke();
      } else if (f.kind === "forge") {
        const ease = 1 - Math.pow(1 - p, 3);
        const x = f.x0 + (f.x1 - f.x0) * ease, y = f.y0 + (f.y1 - f.y0) * ease;
        ctx.strokeStyle = rgba(LIME, (1 - p) * 0.35); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(x, y); ctx.stroke();
        ctx.fillStyle = rgba(LIME, 0.95);
        ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawFrame(t) {
    ctx.clearRect(0, 0, W, H);
    const still = RM || t < deathHold;

    // camera easing + pointer + scroll-velocity stir
    pointer.x += (pointer.tx - pointer.x) * 0.05; pointer.y += (pointer.ty - pointer.y) * 0.05;
    if (!RM) {
      cam.yaw += (cam.tyaw - cam.yaw) * 0.03;
      cam.pitch += (cam.tpitch - cam.pitch) * 0.03;
      cam.z += (cam.tz - cam.z) * 0.03;
      scrollVel *= 0.94;
      strand.rot += (0.000025 + scrollVel * 0.0005) * 16;  // very slow twirl, stirred by scroll
      strand.alpha += (strand.talpha - strand.alpha) * 0.05;
    } else { cam.yaw = cam.tyaw; cam.pitch = cam.tpitch; cam.z = cam.tz; strand.alpha = strand.talpha; }

    drawDust(t, still);
    drawStrand(t, still);
    drawSynapses();
    cells = cells.filter(c => {
      if (!still && !RM) { c.x += (c.tx - c.x) * 0.06; c.y += (c.ty - c.y) * 0.06; c.s += (c.ts - c.s) * 0.08; }
      else if (RM) { c.x = c.tx; c.y = c.ty; c.s = c.ts; }
      return drawCell(c, t, still);
    });
    drawFlashes(t);
    if (vignette) ctx.drawImage(vignette, 0, 0, W, H);
  }

  function loop(t) {
    frame++;
    if (frame % 90 === 0) { measureChrome(); retarget(false); } // re-anchor once async views (h1) exist
    const idle = t - lastInput > 60000 && !flashes.length;
    if (!idle || frame % 6 === 0) drawFrame(t);
    raf = requestAnimationFrame(loop);
  }

  /* =============== boot line =============== */
  function boot() {
    if (RM || sessionStorage.getItem("lw_boot")) return;
    try { sessionStorage.setItem("lw_boot", "1"); } catch (e) {}
    const el = document.createElement("div");
    el.id = "lw-boot"; el.setAttribute("aria-hidden", "true");
    el.style.cssText = "position:fixed;left:268px;bottom:16px;z-index:5;pointer-events:none;font:12px/1.9 'Roboto Mono',ui-monospace,monospace;color:#7d8883;letter-spacing:.06em;white-space:pre;";
    document.body.appendChild(el);
    const lines = ["SYNCING VITALS FIELD ····· OK", "VERIFYING EVIDENCE CHAIN ·· OK", "WARD ONLINE"];
    let li = 0, ci = 0, done = false;
    const finish = () => { if (done) return; done = true; clearInterval(tick); el.style.transition = "opacity .5s"; el.style.opacity = "0"; setTimeout(() => el.remove(), 600); };
    window.addEventListener("keydown", finish, { once: true });
    window.addEventListener("pointerdown", finish, { once: true });
    const tick = setInterval(() => {
      if (li >= lines.length) { clearInterval(tick); setTimeout(finish, 1100); return; }
      ci += 3;
      const doneLines = lines.slice(0, li).join("\n");
      const cur = lines[li].slice(0, ci);
      el.innerHTML = (doneLines ? doneLines + "\n" : "") + (li === lines.length - 1 ? `<span style="color:#cef79e">${cur}</span>` : cur);
      if (ci >= lines[li].length) { li++; ci = 0; }
    }, 24);
  }

  /* =============== wiring =============== */
  window.addEventListener("resize", () => { resize(); if (RM) drawFrame(performance.now()); }, { passive: true });
  window.addEventListener("pointermove", e => { pointer.tx = e.clientX / W; pointer.ty = e.clientY / H; lastInput = performance.now(); }, { passive: true });
  window.addEventListener("keydown", () => { lastInput = performance.now(); }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else if (!RM) { lastInput = performance.now(); raf = requestAnimationFrame(loop); }
  });

  document.documentElement.style.background = "#1c2220";
  resize(); readRoute(); scheduleSync(); boot();
  if (RM) { drawFrame(performance.now()); setInterval(() => drawFrame(performance.now()), 5000); }
  else raf = requestAnimationFrame(loop);
})();
