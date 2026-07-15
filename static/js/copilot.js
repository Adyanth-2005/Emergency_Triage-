/* =====================================================================
   Advisory AI copilot — right-side drawer, Ollama-backed Hybrid RAG.
   Self-contained: injects its own trigger + panel, talks to /api/ai/*.
   Advisory only, grounded + cited, degrades gracefully when Ollama is off.
   ===================================================================== */
(() => {
  "use strict";
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g,
    c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const SPARK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.4L12 15l-1.9-4.6L5.5 9l4.6-1.4z"/><path d="M19 15l.7 1.8L21.5 18l-1.8.7L19 21l-.7-1.8L16.5 18l1.8-.7z"/></svg>';

  const SUGGEST = [
    "For a road-accident MLC, what must happen before discharge?",
    "Explain the triage override policy.",
    "What is door-to-doctor and why does it matter?",
    "How does the audit chain stay tamper-evident?",
  ];

  let history = [];
  let busy = false;

  // ---- trigger button in the topbar (re-injected after shell re-renders) ----
  function ensureTrigger() {
    const tb = $(".topbar");
    if (!tb || $("#copilotBtn")) return;
    const b = document.createElement("button");
    b.id = "copilotBtn"; b.className = "icon-btn cp-trigger";
    b.title = "Advisory AI copilot"; b.setAttribute("aria-label", "Open AI copilot");
    b.innerHTML = SPARK;
    b.onclick = open;
    const anchor = tb.querySelector(".env-badge") || tb.querySelector('[id="refreshBtn"]') || null;
    tb.insertBefore(b, anchor);
  }

  // ---- panel (built once) ----
  function build() {
    if ($("#copilot")) return;
    const el = document.createElement("div");
    el.id = "copilot"; el.className = "cp"; el.hidden = true;
    el.innerHTML = `
      <div class="cp-scrim" data-close></div>
      <aside class="cp-panel" role="dialog" aria-label="Advisory AI copilot" aria-modal="false">
        <header class="cp-hd">
          <span class="cp-spark">${SPARK}</span>
          <div class="cp-hz"><div class="cp-title">Advisory copilot</div>
            <div class="cp-status" id="cpStatus"><span class="cp-dot"></span><span id="cpStatusT">checking…</span></div></div>
          <button class="icon-btn cp-x" data-close aria-label="Close">✕</button>
        </header>
        <div class="cp-body" id="cpBody"></div>
        <form class="cp-input" id="cpForm">
          <textarea id="cpText" rows="1" placeholder="Ask about policy, workflow, or this screen…" aria-label="Ask the copilot"></textarea>
          <button class="cp-send" id="cpSend" aria-label="Send">${SPARK}</button>
        </form>
        <div class="cp-foot">Advisory only · grounded &amp; cited · local Ollama <span id="cpModel" class="mono"></span></div>
      </aside>`;
    document.body.appendChild(el);
    el.querySelectorAll("[data-close]").forEach(x => x.onclick = close);
    $("#cpForm").addEventListener("submit", e => { e.preventDefault(); send($("#cpText").value); });
    const ta = $("#cpText");
    ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(120, ta.scrollHeight) + "px"; });
    ta.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(ta.value); } });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#copilot").hidden) close(); });
    renderBody();
  }

  function renderBody() {
    const b = $("#cpBody");
    let html = "";
    if (!history.length) {
      html += `<div class="cp-intro">
        <div class="cp-intro-t">Ask about the department’s policy, workflow, or the current screen. Answers are grounded in the policy corpus and cite their sources.</div>
        <div class="cp-sugs">${SUGGEST.map(s => `<button class="cp-sug" data-q="${esc(s)}">${esc(s)}</button>`).join("")}</div>
        <div class="cp-adv">${SPARK}<span>Advisory only — the copilot never changes a record or assigns a triage level. You decide; the action is audited.</span></div>
      </div>`;
    }
    history.forEach((m, i) => {
      if (m.role === "user") { html += `<div class="cp-msg cp-user">${esc(m.text)}</div>`; return; }
      html += renderAnswer(m, i);
    });
    if (busy) html += `<div class="cp-msg cp-ai cp-load"><span class="cp-typing"><i></i><i></i><i></i></span> retrieving &amp; reasoning…</div>`;
    b.innerHTML = html;
    b.querySelectorAll(".cp-sug").forEach(x => x.onclick = () => send(x.dataset.q));
    b.querySelectorAll("[data-copy]").forEach(x => x.onclick = () => {
      navigator.clipboard && navigator.clipboard.writeText(history[+x.dataset.copy].text || "");
      x.classList.add("done"); setTimeout(() => x.classList.remove("done"), 1200);
    });
    b.querySelectorAll("[data-regen]").forEach(x => x.onclick = () => regen(+x.dataset.regen));
    b.querySelectorAll("[data-src]").forEach(x => x.onclick = () => x.closest(".cp-src").classList.toggle("open"));
    b.scrollTop = b.scrollHeight;
  }

  function confPill(c) {
    const cl = { High: "hi", Medium: "md", Low: "lo" }[c] || "lo";
    return `<span class="cp-conf ${cl}" title="${esc(c)} evidence confidence">${esc(c)} evidence</span>`;
  }
  function linkCites(text) {
    return esc(text).replace(/\[S?(\d+)\]/g, '<span class="cp-cite">$1</span>');
  }
  function renderAnswer(m, i) {
    const d = m.data || {};
    const cites = d.citations || [];
    const deg = d.degraded ? `<span class="cp-off">Ollama offline</span>` : "";
    const qp = d.query_processing;
    const advTag = qp && qp.classification ? `<span class="cp-adv-tag" title="Adaptive RAG path">${esc((qp.classification||"").replace(/_/g," ").toLowerCase())}${qp.decomposed?` · ${qp.subquery_count} sub-queries`:""}</span>` : "";
    const srcs = cites;
    return `<div class="cp-msg cp-ai">
      <div class="cp-atext">${linkCites(m.text)}</div>
      <div class="cp-meta">${confPill(d.confidence || "Low")}${advTag}${deg}
        <span class="cp-mret">${d.latency_ms ? Math.round(d.latency_ms/1000)+"s" : ""}${(d.retrieval&&d.retrieval.best_cos!=null)?` · match ${d.retrieval.best_cos}`:""}</span></div>
      ${d.confidence_why ? `<div class="cp-why">${esc(d.confidence_why)}</div>` : ""}
      ${srcs.length ? `<div class="cp-src"><button class="cp-src-h" data-src>${SPARK} ${srcs.length} source${srcs.length>1?"s":""}<span class="cp-chev">▾</span></button>
        <div class="cp-src-list">${srcs.map(s => `<div class="cp-src-i"><span class="cp-cite">${s.n}</span><div><div class="cp-src-t">${esc(s.title)}</div><div class="cp-src-s">${esc(s.section||"")}</div><div class="cp-src-x">${esc((s.snippet||"").slice(0,180))}…</div></div></div>`).join("")}</div></div>` : ""}
      <div class="cp-acts"><button class="cp-act" data-copy="${i}">Copy</button><button class="cp-act" data-regen="${i}">Regenerate</button></div>
    </div>`;
  }

  function context() {
    const h1 = $(".view h1, .page-head h1, .reg-head h1, .dash h1");
    return `Current screen: ${h1 ? h1.textContent.trim() : "console"} (route ${location.hash || "#/"})`;
  }

  async function send(q) {
    q = (q || "").trim();
    if (!q || busy) return;
    $("#cpText").value = ""; $("#cpText").style.height = "auto";
    history.push({ role: "user", text: q });
    busy = true; renderBody();
    try {
      const r = await fetch("/api/ai/ask", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, context: context() }) });
      const d = await r.json().catch(() => ({}));
      history.push({ role: "ai", text: d.answer || "No response.", data: d });
    } catch (e) {
      history.push({ role: "ai", text: "Cannot reach the AI service.", data: { confidence: "Low", degraded: true } });
    }
    busy = false; renderBody();
  }
  function regen(i) {
    // find the user query preceding answer i
    for (let j = i - 1; j >= 0; j--) if (history[j].role === "user") {
      const q = history[j].text; history = history.slice(0, i); busy = false; return send(q);
    }
  }

  async function health() {
    const t = $("#cpStatusT"), dot = $(".cp-dot"), model = $("#cpModel");
    try {
      const h = await (await fetch("/api/ai/health")).json();
      if (h.available && h.gen_ready) { t.textContent = "online"; dot.className = "cp-dot ok"; model.textContent = h.gen_model || ""; }
      else if (h.available) { t.textContent = "model not pulled"; dot.className = "cp-dot warn"; model.textContent = h.gen_model || ""; }
      else { t.textContent = "Ollama offline"; dot.className = "cp-dot off"; }
    } catch (e) { t.textContent = "offline"; dot.className = "cp-dot off"; }
  }

  function open() {
    build();
    const el = $("#copilot"); el.hidden = false;
    requestAnimationFrame(() => el.classList.add("show"));
    health(); setTimeout(() => $("#cpText") && $("#cpText").focus(), 120);
  }
  function close() {
    const el = $("#copilot"); if (!el) return;
    el.classList.remove("show"); setTimeout(() => { el.hidden = true; }, 240);
  }

  // keep the trigger present across shell re-renders
  const mo = new MutationObserver(ensureTrigger);
  function start() {
    ensureTrigger();
    const app = document.getElementById("app") || document.body;
    mo.observe(app, { childList: true, subtree: true });
    // Alt+A opens the copilot (Ctrl/⌘-K stays the command palette)
    document.addEventListener("keydown", e => {
      if (e.altKey && (e.key === "a" || e.key === "A")) { e.preventDefault(); open(); }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
  window.__copilot = { open, close };
})();
