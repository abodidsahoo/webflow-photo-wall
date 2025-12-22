/* =========================
UNTRAINABLE MEANINGS — JS EMBED
Paste into an Embed (before </body>) *after* the HTML.
This is designed to be moved into GitHub later (same code).
========================= */

(() => {
  // ---------- 0) DOM ready guard ----------
  const onReady = (fn) => {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  };

  onReady(() => {
    // ---------- 1) Constants ----------
    const ROOT_ID = "um-root";
    const THEME_KEY = "um-theme";

    const JSON_URL = "https://vbzgchrnobnxkxdcupes.supabase.co/functions/v1/webflow-images";

    const FALLBACK_IMAGES = [
      "https://cdn.prod.website-files.com/67eba6a507dbd0003182ea6e/687eab1ba5d574191f21dfca_S07B0239-2.jpg",
      "https://cdn.prod.website-files.com/67eba6a507dbd0003182ea6e/687eab341449702b2e9bde66_S07B0295.jpg",
      "https://cdn.prod.website-files.com/67eba6a507dbd0003182ea6e/687eab3e7f71b6eb405e68f7_S07B0319.jpg"
    ];

    // Supabase (Tab2 submit + Tab3 read/submit). Keep anon key here if you want single-file.
    const SUPABASE_URL = "https://vbzgchrnobnxkxdcupes.supabase.co";
    const SUPABASE_ANON_KEY = "PASTE_YOUR_ANON_KEY_HERE";
    const TABLE = "photo_feedback";

    // ---------- 2) Shared memory store (images fetched once) ----------
    window.UNTRAINABLE = window.UNTRAINABLE || {};
    window.UNTRAINABLE.imagesPromise = window.UNTRAINABLE.imagesPromise || null;
    window.UNTRAINABLE.images = window.UNTRAINABLE.images || null;

    async function fetchImagesOnce() {
      if (Array.isArray(window.UNTRAINABLE.images) && window.UNTRAINABLE.images.length) {
        return window.UNTRAINABLE.images;
      }
      if (window.UNTRAINABLE.imagesPromise) return window.UNTRAINABLE.imagesPromise;

      window.UNTRAINABLE.imagesPromise = (async () => {
        const res = await fetch(JSON_URL, { cache: "no-store" });
        if (!res.ok) throw new Error("Image endpoint failed: " + res.status);
        const data = await res.json();
        window.UNTRAINABLE.images = Array.isArray(data) ? data : [];
        return window.UNTRAINABLE.images;
      })();

      return window.UNTRAINABLE.imagesPromise;
    }

    // ---------- 3) Helpers ----------
    function shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    function weightedPick(layouts) {
      const total = layouts.reduce((s, x) => s + x.weight, 0);
      let r = Math.random() * total;
      for (const x of layouts) {
        r -= x.weight;
        if (r <= 0) return x;
      }
      return layouts[0];
    }

    function makeImg(url, { eager = false } = {}) {
      const img = document.createElement("img");
      img.className = "wf-img";
      img.src = url;
      img.alt = "";
      img.decoding = "async";
      img.loading = eager ? "eager" : "lazy";
      if (eager) img.fetchPriority = "high";
      return img;
    }

    function imageIdFromUrl(url) {
      try {
        const u = new URL(url);
        const last = u.pathname.split("/").filter(Boolean).pop() || "";
        return decodeURIComponent(last);
      } catch (e) {
        const parts = String(url).split("/");
        return decodeURIComponent(parts[parts.length - 1] || "");
      }
    }

    function panelIsActive(tabId) {
      const root = document.getElementById(ROOT_ID);
      const panel = root?.querySelector(`.um-panel[data-panel="${tabId}"]`);
      return !!panel && panel.style.display !== "none";
    }

    // ---------- 4) Theme (shared across tabs, applied to #um-root only) ----------
    function setTheme(root, mode) {
      const isDark = mode === "dark";
      root.classList.toggle("um-dark", isDark);
      try { localStorage.setItem(THEME_KEY, isDark ? "dark" : "light"); } catch(e) {}
    }

    function getSavedTheme() {
      try { return localStorage.getItem(THEME_KEY) || "light"; } catch(e) { return "light"; }
    }

    function wireThemeToggle(root, toggleBtnId, lightSel, darkSel) {
      const btn = document.getElementById(toggleBtnId);
      const lightOpt = document.querySelector(lightSel);
      const darkOpt = document.querySelector(darkSel);
      if (!btn || !lightOpt || !darkOpt) return;

      const initial = getSavedTheme();
      setTheme(root, initial);
      if (initial === "dark") { darkOpt.classList.add("active"); lightOpt.classList.remove("active"); }
      else { lightOpt.classList.add("active"); darkOpt.classList.remove("active"); }

      btn.addEventListener("click", () => {
        const isDark = root.classList.toggle("um-dark");
        if (isDark) { darkOpt.classList.add("active"); lightOpt.classList.remove("active"); }
        else { lightOpt.classList.add("active"); darkOpt.classList.remove("active"); }
        try { localStorage.setItem(THEME_KEY, isDark ? "dark" : "light"); } catch(e) {}
      });
    }

    // ---------- 5) Photo grid factory (reused by Tab 1 and Tab 2) ----------
    function createPhotoGrid({
      tabId,
      wallId,
      loadingId,
      sentinelId,
      loadMoreBtnId,
      goToTopBtnId,
      withCommentButton,
      onComment
    }) {
      const LAYOUTS = [
        { cls: "wf-split", need: 2, weight: 32 },
        { cls: "wf-23",   need: 2, weight: 24 },
        { cls: "wf-32",   need: 2, weight: 24 },
        { cls: "wf-3up",  need: 3, weight: 18 },
        { cls: "wf-4up",  need: 4, weight: 2 }
      ];

      const INITIAL_IMAGES_TO_SHOW = 18;
      const BATCH_IMAGES_TO_APPEND = 6;
      const MAX_TOTAL_BLOCKS = 9999;

      const wall = document.getElementById(wallId);
      const loading = document.getElementById(loadingId);
      const sentinel = document.getElementById(sentinelId);
      const loadMoreBtn = document.getElementById(loadMoreBtnId);
      const goToTopBtn = document.getElementById(goToTopBtnId);

      if (!wall || !loading || !sentinel || !loadMoreBtn || !goToTopBtn) {
        console.warn(`[${tabId}] Missing required elements. Check IDs.`);
        return { init: async () => {} };
      }

      function setLoading(on) {
        loading.classList.toggle("is-on", !!on);
        loading.setAttribute("aria-busy", on ? "true" : "false");
      }

      function addBlock(blockClass, urls, { hero = false } = {}) {
        const section = document.createElement("section");
        section.className = `wf-block ${blockClass}${hero ? " wf-hero" : ""}`;

        for (let i = 0; i < urls.length; i++) {
          const frame = document.createElement("div");
          frame.className = "wf-frame";

          const eager = hero && i === 0;
          frame.appendChild(makeImg(urls[i], { eager }));

          if (withCommentButton) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "wf-comment-btn";
            btn.textContent = "💭 Share your feeling";
            btn.addEventListener("click", () => onComment && onComment(urls[i]));
            frame.appendChild(btn);
          }

          section.appendChild(frame);
        }

        wall.appendChild(section);
      }

      // state
      let picked = [];
      let cursor = 0;
      let blocksMade = 0;
      let isAppending = false;
      let io = null;

      function consume(n) {
        const out = picked.slice(cursor, cursor + n);
        cursor += out.length;
        return out;
      }

      function maybeAddHeroSometimes() {
        if (blocksMade > 0 && blocksMade % Math.floor(6 + Math.random() * 5) === 0) {
          if (cursor < picked.length) {
            addBlock("wf-hero", consume(1), { hero: false });
            blocksMade++;
            return true;
          }
        }
        return false;
      }

      function fillUntilImageCount(targetCount) {
        let shown = cursor;
        while (shown < targetCount && cursor < picked.length && blocksMade < MAX_TOTAL_BLOCKS) {
          if (maybeAddHeroSometimes()) { shown = cursor; continue; }
          const next = weightedPick(LAYOUTS);
          if (cursor + next.need > picked.length) break;
          addBlock(next.cls, consume(next.need));
          blocksMade++;
          shown = cursor;
        }
      }

      function appendBatch() {
        if (!panelIsActive(tabId)) return; // important when tab hidden
        if (isAppending) return;
        if (cursor >= picked.length) return;

        isAppending = true;
        setLoading(true);

        const start = performance.now();
        const minMs = 320;

        const doAppend = () => {
          const before = cursor;
          const target = Math.min(picked.length, before + BATCH_IMAGES_TO_APPEND);

          while (cursor < target && cursor < picked.length && blocksMade < MAX_TOTAL_BLOCKS) {
            if (maybeAddHeroSometimes()) continue;
            const next = weightedPick(LAYOUTS);
            if (cursor + next.need > picked.length) break;
            if (cursor + next.need > target && (target - cursor) >= 2) break;
            addBlock(next.cls, consume(next.need));
            blocksMade++;
          }

          if (cursor === before && cursor < picked.length) {
            const remaining = picked.length - cursor;
            if (remaining >= 2) addBlock("wf-split", consume(2));
            else addBlock("wf-hero", consume(1));
            blocksMade++;
          }

          setLoading(false);
          isAppending = false;
        };

        const elapsed = performance.now() - start;
        setTimeout(doAppend, Math.max(0, minMs - elapsed));
      }

      function ensureObserver() {
        if (io) io.disconnect();
        io = new IntersectionObserver((entries) => {
          for (const e of entries) if (e.isIntersecting) appendBatch();
        }, { root: null, rootMargin: "900px 0px 900px 0px", threshold: 0.01 });

        io.observe(sentinel);
      }

      function resetGridWith(images) {
        wall.innerHTML = "";
        cursor = 0;
        blocksMade = 0;
        picked = shuffle(images.slice());

        addBlock("wf-hero", consume(1), { hero: true });
        blocksMade++;
        fillUntilImageCount(INITIAL_IMAGES_TO_SHOW);
      }

      loadMoreBtn.addEventListener("click", () => {
        const targetImages = Math.min(cursor + 20, picked.length);
        fillUntilImageCount(targetImages);

        if (cursor >= picked.length && picked.length) {
          resetGridWith(picked);
          ensureObserver();
        }

        setTimeout(() => window.scrollBy({ top: 400, behavior: "smooth" }), 80);
      });

      goToTopBtn.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });

      return {
        init: async () => {
          setLoading(true);
          try {
            const data = await fetchImagesOnce();
            if (Array.isArray(data) && data.length) {
              setLoading(false);
              resetGridWith(data);
              ensureObserver();
              return;
            }
            throw new Error("No images returned");
          } catch (err) {
            console.warn(`[${tabId}] Using fallback images:`, err);
            window.UNTRAINABLE.images = FALLBACK_IMAGES;
            setLoading(false);
            resetGridWith(FALLBACK_IMAGES);
            ensureObserver();
          }
        }
      };
    }

    // ---------- 6) Tab 2 Modal + Supabase insert ----------
    function createSupabaseClient() {
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes("PASTE_")) {
        console.warn("Supabase anon key missing. Tab 2 submit will not work until you paste it.");
        return null;
      }
      if (!window.supabase) {
        console.warn("Supabase library not loaded. Ensure the CDN script is included.");
        return null;
      }
      return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    function wireTab2ModalAndSubmit() {
      const supa = createSupabaseClient();

      const modal = document.getElementById("t2-wf-modal");
      const modalBackdrop = document.getElementById("t2-wf-modal-backdrop");
      const modalClose = document.getElementById("t2-wf-modal-close");
      const modalImg = document.getElementById("t2-wf-modal-img");

      const form = document.getElementById("t2-wf-modal-form");
      const nameEl = document.getElementById("t2-wf-name");
      const feelEl = document.getElementById("t2-wf-feel");
      const submitBtn = document.getElementById("t2-wf-submit");
      const statusEl = document.getElementById("t2-wf-status");

      if (!modal || !form || !feelEl || !submitBtn || !statusEl) {
        console.warn("[t2] Modal elements missing. Check IDs.");
        return { openModalFor: () => {} };
      }

      let currentImageUrl = null;

      function openModalFor(url) {
        currentImageUrl = url;
        modalImg.src = url;
        modalImg.alt = "";
        statusEl.textContent = "";
        nameEl.value = "";
        feelEl.value = "";
        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
        setTimeout(() => feelEl.focus(), 0);
      }

      function closeModal() {
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        currentImageUrl = null;
      }

      modalBackdrop?.addEventListener("click", closeModal);
      modalClose?.addEventListener("click", closeModal);
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
      });

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!currentImageUrl) return;

        const feeling = (feelEl.value || "").trim();
        const name = (nameEl.value || "").trim();

        if (!feeling) {
          statusEl.textContent = "Please write a few words.";
          return;
        }

        if (!supa) {
          statusEl.textContent = "Saving is not configured yet (missing Supabase key).";
          return;
        }

        submitBtn.disabled = true;
        statusEl.textContent = "Saving…";

        const payload = {
          image_url: currentImageUrl,
          image_id: imageIdFromUrl(currentImageUrl),
          name: name || null,
          feeling_text: feeling,
          feeling_tag: null,
          page_url: window.location.href,
          user_agent: navigator.userAgent
        };

        try {
          const { error } = await supa.from(TABLE).insert([payload]);
          if (error) throw error;

          statusEl.textContent = "Saved. Thank you!";
          setTimeout(closeModal, 650);
        } catch (err) {
          console.warn("Supabase insert failed:", err);
          statusEl.textContent = "Could not save right now. Please try again.";
        } finally {
          submitBtn.disabled = false;
        }
      });

      return { openModalFor };
    }

    // ---------- 7) Tab switching (gated init) ----------
    const root = document.getElementById(ROOT_ID);
    if (!root) return;

    const tabs = root.querySelectorAll(".um-tab");
    const panels = root.querySelectorAll(".um-panel");

    function activate(tabId) {
      tabs.forEach((t) => {
        const active = t.dataset.tab === tabId;
        t.classList.toggle("is-active", active);
        t.setAttribute("aria-selected", active ? "true" : "false");
      });

      panels.forEach((p) => {
        p.style.display = (p.dataset.panel === tabId) ? "block" : "none";
      });

      try { localStorage.setItem("um-active-tab", tabId); } catch(e) {}

      // gate init per tab
      if (tabId === "t1") window.__initT1Once && window.__initT1Once();
      if (tabId === "t2") window.__initT2Once && window.__initT2Once();
      if (tabId === "t3") window.__initT3Once && window.__initT3Once();
      if (tabId === "t4") window.__initT4Once && window.__initT4Once();
    }

    tabs.forEach((t) => t.addEventListener("click", () => activate(t.dataset.tab)));

    // ---------- 8) Inits (run once each) ----------
    let didT1 = false;
    let didT2 = false;
    let didT3 = false;
    let didT4 = false;

    // shared theme wiring (both toggles point at same theme state)
    wireThemeToggle(root, "t1-theme-toggle", ".t1-wf-light-opt", ".t1-wf-dark-opt");
    wireThemeToggle(root, "t2-theme-toggle", ".t2-wf-light-opt", ".t2-wf-dark-opt");
    // apply saved theme immediately even if toggles not touched
    setTheme(root, getSavedTheme());

    // Tab 1
    window.__initT1Once = async function() {
      if (didT1) return;
      didT1 = true;

      const grid = createPhotoGrid({
        tabId: "t1",
        wallId: "t1-wf-wall-inner",
        loadingId: "t1-wf-loading",
        sentinelId: "t1-wf-sentinel",
        loadMoreBtnId: "t1-load-more",
        goToTopBtnId: "t1-go-to-top",
        withCommentButton: false
      });

      await grid.init();
    };

    // Tab 2
    window.__initT2Once = async function() {
      if (didT2) return;
      didT2 = true;

      const modalCtl = wireTab2ModalAndSubmit();

      const grid = createPhotoGrid({
        tabId: "t2",
        wallId: "t2-wf-wall-inner",
        loadingId: "t2-wf-loading",
        sentinelId: "t2-wf-sentinel",
        loadMoreBtnId: "t2-load-more",
        goToTopBtnId: "t2-go-to-top",
        withCommentButton: true,
        onComment: (url) => modalCtl.openModalFor(url)
      });

      await grid.init();
    };





    /* =========================================================
   TAB 3 — Research Responses (init once)
   FIXES:
     ✅ Uses rp3-* IDs that match your HTML
     ✅ Modal wiring uses rp3-wf-* IDs (NOT wf-*)
     ✅ Cards render into #rp3-feed
========================================================= */
let __TAB3_INITED__ = false;

window.__initRp3Once = async function () {
  if (__TAB3_INITED__) return;
  __TAB3_INITED__ = true;

  const root = document.getElementById("rp3-root");
  if (!root) return;

  await ensureSupabase();

  /* =========================
     THEME (Tab 3)
     - keep your rp3 theme toggle
     - also sync with body.dark-mode + localStorage('theme')
  ========================= */
  const themeBtn = document.getElementById("rp3-theme-btn");
  const lightOpt = themeBtn?.querySelector(".rp-theme-light");
  const darkOpt  = themeBtn?.querySelector(".rp-theme-dark");

  function setTheme(mode){
    // rp theme classes (if you use them in CSS)
    document.body.classList.toggle("rp-theme-dark", mode === "dark");
    document.body.classList.toggle("rp-theme-light", mode !== "dark");

    // shared site theme
    document.body.classList.toggle("dark-mode", mode === "dark");
    try { localStorage.setItem("theme", mode === "dark" ? "dark" : "light"); } catch(e){}
    try { localStorage.setItem("rp-theme", mode); } catch(e){}

    if (darkOpt && lightOpt){
      darkOpt.classList.toggle("active", mode === "dark");
      lightOpt.classList.toggle("active", mode !== "dark");
    }
  }

  // boot from shared theme first
  let boot = "light";
  try {
    const shared = localStorage.getItem("theme");
    if (shared === "dark") boot = "dark";
    else if (shared === "light") boot = "light";
    else boot = localStorage.getItem("rp-theme") || "light";
  } catch(e){}
  setTheme(boot);

  themeBtn?.addEventListener("click", () => {
    const isDark = document.body.classList.contains("dark-mode");
    setTheme(isDark ? "light" : "dark");
  });

  /* =========================
     SUPABASE
  ========================= */
  const SUPABASE_URL = "https://vbzgchrnobnxkxdcupes.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiemdjaHJub2JueGt4ZGN1cGVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMzQ0NDIsImV4cCI6MjA4MTYxMDQ0Mn0.nLdQW8f-nJwCFWUkURcr2ZPA694fAKlseYO__MOPGa8";

  const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const TABLE = "photo_feedback";

  const feed = document.getElementById("rp3-feed");
  const status = document.getElementById("rp3-status");
  if (!feed || !status) return;

  const PASTELS = ["#f7f2ea","#f3f0ea","#f2f4ff","#f4f7f2","#f8f1f6","#f6f3ff","#f5f6f7","#f3efe8"];
  const rand = (min,max)=> min + Math.random()*(max-min);

  function imageIdFromUrl(url){
    try{
      const u = new URL(url);
      const last = u.pathname.split("/").filter(Boolean).pop() || "";
      return decodeURIComponent(last);
    } catch(e){
      const parts = String(url).split("/");
      return decodeURIComponent(parts[parts.length - 1] || "");
    }
  }

  /* =========================
     MODAL (Tab 3) — uses rp3-wf-* IDs
  ========================= */
  const modal        = document.getElementById("rp3-wf-modal");
  const modalBackdrop= document.getElementById("rp3-wf-modal-backdrop");
  const modalClose   = document.getElementById("rp3-wf-modal-close");
  const modalImg     = document.getElementById("rp3-wf-modal-img");
  const form         = document.getElementById("rp3-wf-modal-form");
  const nameEl       = document.getElementById("rp3-wf-name");
  const feelEl       = document.getElementById("rp3-wf-feel");
  const submitBtn    = document.getElementById("rp3-wf-submit");
  const statusEl     = document.getElementById("rp3-wf-status");

  let currentImageUrl = null;

  function openModalFor(url){
    currentImageUrl = url;
    if (modalImg) { modalImg.src = url; modalImg.alt = ""; }
    if (statusEl) statusEl.textContent = "";
    if (nameEl) nameEl.value = "";
    if (feelEl) feelEl.value = "";

    if (modal){
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden","false");
    }
    setTimeout(() => feelEl && feelEl.focus(), 0);
  }

  function closeModal(){
    if (modal){
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden","true");
    }
    currentImageUrl = null;
  }

  modalBackdrop?.addEventListener("click", closeModal);
  modalClose?.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal?.classList.contains("is-open")) closeModal();
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentImageUrl) return;

    const feeling = (feelEl?.value || "").trim();
    const name = (nameEl?.value || "").trim();

    if (!feeling){
      if (statusEl) statusEl.textContent = "Please write a few words.";
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    if (statusEl) statusEl.textContent = "Saving…";

    const payload = {
      image_url: currentImageUrl,
      image_id: imageIdFromUrl(currentImageUrl),
      name: name || null,
      feeling_text: feeling,
      feeling_tag: null,
      page_url: window.location.href,
      user_agent: navigator.userAgent
    };

    try{
      const { error } = await supa.from(TABLE).insert([payload]);
      if (error) throw error;
      if (statusEl) statusEl.textContent = "Saved. Thank you!";
      setTimeout(closeModal, 650);
    } catch(err){
      console.warn("Tab 3 insert failed:", err);
      if (statusEl) statusEl.textContent = "Could not save right now. Please try again.";
    } finally{
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  /* =========================
     DATA + RENDER
  ========================= */
  function groupByImage(rows){
    const m = new Map();
    rows.forEach(r => {
      if (!r.image_url) return;
      const key = String(r.image_url).trim();
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(r);
    });
    return [...m.entries()];
  }

  function classifyOrientation(img, section){
    const isLandscape = img.naturalWidth > img.naturalHeight;
    section.classList.toggle("rp-landscape", isLandscape);
    section.classList.toggle("rp-portrait", !isLandscape);
  }

  function softWrapWords(s){ return String(s || "").trim(); }

  function scatterPortrait(section){
    const canvas = section.querySelector(".rp-canvas");
    if (!canvas) return { hidden: 0 };

    const cards = Array.from(canvas.querySelectorAll(".rp-card"));
    if (!cards.length) return { hidden: 0 };

    const W = canvas.clientWidth;
    const H = canvas.clientHeight;

    const EDGE = 18;
    const SEP_HARD = 18;
    const SEP_SOFT = 10;

    cards.forEach((c) => {
      const txt = (c.querySelector(".rp-text")?.textContent || "").trim();
      const wc = txt ? txt.split(/\s+/).length : 0;

      let w;
      if (wc <= 3) w = Math.min(180, Math.max(130, Math.floor(W * 0.30)));
      else if (wc <= 8) w = Math.min(220, Math.max(150, Math.floor(W * 0.36)));
      else w = Math.min(260, Math.max(170, Math.floor(W * 0.42)));

      c.style.width = w + "px";
      c.style.background = PASTELS[Math.floor(Math.random()*PASTELS.length)];

      const deg = Math.round(rand(-10, 12));
      c.dataset.rot = String(deg);
      c.style.transform = `rotate(${deg}deg)`;
    });

    canvas.offsetHeight;
    const placed = [];

    function rotatedBBox(w, h, deg){
      const a = Math.abs(deg) * Math.PI / 180;
      const cw = Math.abs(Math.cos(a));
      const sw = Math.abs(Math.sin(a));
      return { rw: w * cw + h * sw, rh: w * sw + h * cw };
    }

    function makeRect(card, x, y){
      const r = card.getBoundingClientRect();
      const deg = parseFloat(card.dataset.rot || "0");
      const { rw, rh } = rotatedBBox(r.width, r.height, deg);
      const pad = 8;
      return { x, y, w: rw + pad, h: rh + pad };
    }

    function insideBounds(rect){
      return (
        rect.x >= EDGE &&
        rect.y >= EDGE &&
        rect.x + rect.w <= W - EDGE &&
        rect.y + rect.h <= H - EDGE
      );
    }

    function collides(rect, sep){
      for (const p of placed){
        const overlap =
          rect.x < p.x + p.w + sep &&
          rect.x + rect.w + sep > p.x &&
          rect.y < p.y + p.h + sep &&
          rect.y + rect.h + sep > p.y;
        if (overlap) return true;
      }
      return false;
    }

    const cx = W / 2;
    const cy = H / 2;
    let hidden = 0;

    cards.forEach((card) => {
      let done = false;

      for (let t = 0; t < 380; t++){
        const a = t * 0.55;
        const r = 2 + (t * 2.35);
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;

        const tmp = makeRect(card, 0, 0);
        const x = px - tmp.w / 2;
        const y = py - tmp.h / 2;
        const rect = makeRect(card, x, y);

        if (!insideBounds(rect)) continue;
        if (collides(rect, SEP_HARD)) continue;

        card.style.left = x + "px";
        card.style.top  = y + "px";
        placed.push(rect);
        done = true;
        break;
      }

      if (!done){
        hidden++;
        card.style.display = "none";
      }
    });

    return { hidden };
  }

  function renderGroup(url, items){
    const section = document.createElement("section");
    section.className = "rp-section rp-portrait";

    const left = document.createElement("div");
    left.className = "rp-photo";

    const img = document.createElement("img");
    img.src = url;
    img.loading = "lazy";
    img.decoding = "async";
    left.appendChild(img);

    const commentBtn = document.createElement("button");
    commentBtn.type = "button";
    commentBtn.className = "rp-comment-btn";
    commentBtn.textContent = "💭 Share your feeling";
    commentBtn.addEventListener("click", () => openModalFor(url));
    left.appendChild(commentBtn);

    const panel = document.createElement("div");
    panel.className = "rp-panel";

    const inner = document.createElement("div");
    inner.className = "rp-panel-inner";

    const canvas = document.createElement("div");
    canvas.className = "rp-canvas";

    const grid = document.createElement("div");
    grid.className = "rp-grid";
    grid.style.display = "none";

    const makeCard = (i) => {
      const card = document.createElement("div");
      card.className = "rp-card";

      const text = document.createElement("div");
      text.className = "rp-text";
      text.textContent = softWrapWords(i.feeling_text || "");

      const name = document.createElement("div");
      name.className = "rp-name";
      name.textContent = i.name || "Anonymous";

      card.appendChild(text);
      card.appendChild(name);
      return card;
    };

    items.forEach(i => {
      canvas.appendChild(makeCard(i));
      grid.appendChild(makeCard(i));
    });

    inner.appendChild(canvas);
    inner.appendChild(grid);
    panel.appendChild(inner);

    section.appendChild(left);
    section.appendChild(panel);

    const onReady = () => {
      classifyOrientation(img, section);

      const isMobile = window.matchMedia("(max-width: 900px)").matches;
      if (isMobile){
        canvas.style.display = "none";
        grid.style.display = "flex";
        return;
      }

      if (section.classList.contains("rp-portrait")) {
        requestAnimationFrame(() => scatterPortrait(section));
      } else {
        canvas.style.display = "none";
        grid.style.display = "flex";
        requestAnimationFrame(() => {
          grid.querySelectorAll(".rp-card").forEach((card) => {
            const deg = Math.round(rand(-10, 10));
            card.style.transform = `rotate(${deg}deg)`;
          });
        });
      }
    };

    if (img.complete) onReady();
    else img.addEventListener("load", onReady, { once:true });

    return section;
  }

  async function load(){
    status.textContent = "Loading responses…";
    feed.innerHTML = "";

    const { data, error } = await supa
      .from(TABLE)
      .select("image_url,name,feeling_text,created_at")
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error){
      console.warn(error);
      status.textContent = "Failed to load data.";
      return;
    }

    const groups = groupByImage(data || []);
    status.textContent = `Loaded ${(data||[]).length} responses across ${groups.length} photographs.`;

    groups.forEach(([url, items]) => {
      feed.appendChild(renderGroup(url, items));
    });
  }

  load();
};




    

    // Tab 4 placeholder (wire later)
    window.__initT4Once = async function() {
      if (didT4) return;
      didT4 = true;
      const notes = document.getElementById("um-notes");
      if (notes) notes.textContent = "Tab 4 ready. (Hook up visualization next.)";
    };

    // ---------- 9) Boot: restore last tab ----------
    let start = "t1";
    try { start = localStorage.getItem("um-active-tab") || "t1"; } catch(e) {}
    activate(start);
  });
})();
