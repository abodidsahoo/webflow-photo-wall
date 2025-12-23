(() => {
  "use strict";

  /* ===========================
     CONFIG
  ============================ */
  const SUPABASE_URL = "https://vbzgchrnobnxkxdcupes.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiemdjaHJub2JueGt4ZGN1cGVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMzQ0NDIsImV4cCI6MjA4MTYxMDQ0Mn0.nLdQW8f-nJwCFWUkURcr2ZPA694fAKlseYO__MOPGa8";

  const TABLE = "photo_feedback";
  const IMAGE_JSON_URL = "https://vbzgchrnobnxkxdcupes.supabase.co/functions/v1/webflow-images";

  const FALLBACK_IMAGES = [
    "https://cdn.prod.website-files.com/67eba6a507dbd0003182ea6e/687eab1ba5d574191f21dfca_S07B0239-2.jpg",
    "https://cdn.prod.website-files.com/67eba6a507dbd0003182ea6e/687eab341449702b2e9bde66_S07B0295.jpg",
    "https://cdn.prod.website-files.com/67eba6a507dbd0003182ea6e/687eab3e7f71b6eb405e68f7_S07B0319.jpg"
  ];

  /* ===========================
     SAFETY: SINGLETONS
  ============================ */
  if (!window.UNTRAINABLE) window.UNTRAINABLE = {};
  const STORE = window.UNTRAINABLE;

  function getSupaClient() {
    if (STORE._supa) return STORE._supa;
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      throw new Error("Supabase library not loaded (window.supabase.createClient missing).");
    }
    STORE._supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return STORE._supa;
  }

  async function fetchImagesOnce() {
    if (Array.isArray(STORE.images) && STORE.images.length) return STORE.images;
    if (STORE.imagesPromise) return STORE.imagesPromise;

    STORE.imagesPromise = (async () => {
      try {
        const res = await fetch(IMAGE_JSON_URL, { cache: "no-store" });
        if (!res.ok) throw new Error("Image endpoint HTTP " + res.status);
        const data = await res.json();
        STORE.images = Array.isArray(data) ? data : [];
        if (!STORE.images.length) throw new Error("Image endpoint returned empty list.");
        return STORE.images;
      } catch (e) {
        console.warn("[Images] Using fallback due to:", e);
        STORE.images = FALLBACK_IMAGES.slice();
        return STORE.images;
      }
    })();

    return STORE.imagesPromise;
  }

  function imageIdFromUrl(url) {
    try {
      const u = new URL(url);
      const last = u.pathname.split("/").filter(Boolean).pop() || "";
      return decodeURIComponent(last);
    } catch {
      const parts = String(url).split("/");
      return decodeURIComponent(parts[parts.length - 1] || "");
    }
  }

  /* ===========================
     THEME
  ============================ */
  function applyThemeFromStorage() {
    const saved = (() => {
      try { return localStorage.getItem("theme"); } catch { return null; }
    })();
    const isDark = saved === "dark";
    document.body.classList.toggle("dark-mode", isDark);
    return isDark;
  }

  function setTheme(isDark) {
    document.body.classList.toggle("dark-mode", isDark);
    try { localStorage.setItem("theme", isDark ? "dark" : "light"); } catch {}
  }

  function setupThemeToggle(btnId, lightSel, darkSel) {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    const lightOpt = btn.querySelector(lightSel);
    const darkOpt = btn.querySelector(darkSel);

    const sync = () => {
      const isDark = document.body.classList.contains("dark-mode");
      if (darkOpt) darkOpt.classList.toggle("active", isDark);
      if (lightOpt) lightOpt.classList.toggle("active", !isDark);
    };

    sync();

    btn.addEventListener("click", () => {
      const next = !document.body.classList.contains("dark-mode");
      setTheme(next);
      sync();
      // sync other toggles too
      syncAllThemeButtons();
    });

    return { sync };
  }

  let themeSyncers = [];
  function syncAllThemeButtons() {
    themeSyncers.forEach(s => s && s.sync && s.sync());
  }

  /* ===========================
     TABS
  ============================ */
  function setupTabs() {
    const root = document.getElementById("um-root");
    if (!root) return;

    const tabs = Array.from(root.querySelectorAll(".um-tab"));
    const panels = Array.from(root.querySelectorAll(".um-panel"));

    function activate(tabId) {
      tabs.forEach(t => {
        const on = t.dataset.tab === tabId;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });

      panels.forEach(p => {
        const on = p.dataset.panel === tabId;
        p.classList.toggle("is-active", on);
      });

      try { localStorage.setItem("um-active-tab", tabId); } catch {}

      if (tabId === "t1") initTab1Once();
      if (tabId === "t2") initTab2Once();
      if (tabId === "t3") initTab3Once();
      if (tabId === "t4") initTab4Once(); // kept
    }

    tabs.forEach(t => t.addEventListener("click", () => activate(t.dataset.tab)));

    let start = "t1";
    try { start = localStorage.getItem("um-active-tab") || "t1"; } catch {}
    activate(start);
  }

  /* ===========================
     PHOTO WALL (Shared Engine)
  ============================ */
  const LAYOUTS = [
    { cls: "wf-split", need: 2, weight: 32 },
    { cls: "wf-23",   need: 2, weight: 24 },
    { cls: "wf-32",   need: 2, weight: 24 },
    { cls: "wf-3up",  need: 3, weight: 18 },
    { cls: "wf-4up",  need: 4, weight: 2 }
  ];

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

  function createPhotoWallController(opts) {
    const {
      wallInnerId,
      loadingId,
      sentinelId,
      loadMoreId,
      goTopId,
      withCommentButton,
      onComment
    } = opts;

    const wall = document.getElementById(wallInnerId);
    const loading = document.getElementById(loadingId);
    const sentinel = document.getElementById(sentinelId);
    const loadMoreBtn = document.getElementById(loadMoreId);
    const goTopBtn = document.getElementById(goTopId);

    if (!wall || !loading || !sentinel) {
      console.warn("[PhotoWall] Missing elements:", { wallInnerId, loadingId, sentinelId });
      return null;
    }

    const INITIAL_IMAGES_TO_SHOW = 18;
    const BATCH_IMAGES_TO_APPEND = 6;
    const MAX_TOTAL_BLOCKS = 9999;

    let picked = [];
    let cursor = 0;
    let blocksMade = 0;
    let isAppending = false;
    let io = null;

    function setLoading(on) {
      loading.classList.toggle("is-on", !!on);
      loading.setAttribute("aria-busy", on ? "true" : "false");
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
          btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            onComment && onComment(urls[i]);
          });
          frame.appendChild(btn);
        }

        section.appendChild(frame);
      }

      wall.appendChild(section);
    }

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
      ensureObserver();
    }

    if (goTopBtn) {
      goTopBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    }

    if (loadMoreBtn) {
      loadMoreBtn.addEventListener("click", () => {
        const targetImages = Math.min(cursor + 20, picked.length);
        fillUntilImageCount(targetImages);

        if (cursor >= picked.length && picked.length) {
          resetGridWith(picked); // loop
        }

        setTimeout(() => window.scrollBy({ top: 400, behavior: "smooth" }), 80);
      });
    }

    return { setLoading, resetGridWith };
  }

  /* ===========================
     TAB 2 MODAL
  ============================ */
  function setupTab2Modal() {
    const modal = document.getElementById("t2-wf-modal");
    const modalBackdrop = document.getElementById("t2-wf-modal-backdrop");
    const modalClose = document.getElementById("t2-wf-modal-close");
    const modalImg = document.getElementById("t2-wf-modal-img");

    const form = document.getElementById("t2-wf-modal-form");
    const nameEl = document.getElementById("t2-wf-name");
    const feelEl = document.getElementById("t2-wf-feel");
    const submitBtn = document.getElementById("t2-wf-submit");
    const statusEl = document.getElementById("t2-wf-status");

    if (!modal || !form) return null;

    let currentImageUrl = null;

    function open(url) {
      currentImageUrl = url;
      modalImg.src = url;
      statusEl.textContent = "";
      nameEl.value = "";
      feelEl.value = "";
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      setTimeout(() => feelEl.focus(), 0);
    }

    function close() {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      currentImageUrl = null;
    }

    modalBackdrop.addEventListener("click", close);
    modalClose.addEventListener("click", close);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("is-open")) close();
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

      submitBtn.disabled = true;
      statusEl.textContent = "Saving…";

      try {
        const supa = getSupaClient();
        const payload = {
          image_url: currentImageUrl,
          image_id: imageIdFromUrl(currentImageUrl),
          name: name || null,
          feeling_text: feeling,
          feeling_tag: null,
          page_url: window.location.href,
          user_agent: navigator.userAgent
        };

        const { error } = await supa.from(TABLE).insert([payload]);
        if (error) throw error;

        statusEl.textContent = "Saved. Thank you!";
        setTimeout(close, 650);
      } catch (err) {
        console.warn("Supabase insert failed:", err);
        statusEl.textContent = "Could not save right now. Please try again.";
      } finally {
        submitBtn.disabled = false;
      }
    });

    return { open, close };
  }




  /* ===== TAB 2: FORCE ADD "Share your feeling" ON EVERY IMAGE (guaranteed) ===== */
(() => {
  const WALL_SELECTOR = '#t2-wf-wall-inner, [data-panel="t2"] .wf-wall-inner';
  const BTN_TEXT = "💭 Share your feeling";

  function getModalEls() {
    const modal = document.getElementById("t2-wf-modal");
    if (!modal) return null;

    return {
      modal,
      backdrop: document.getElementById("t2-wf-modal-backdrop"),
      closeBtn: document.getElementById("t2-wf-modal-close"),
      img: document.getElementById("t2-wf-modal-img"),
      status: document.getElementById("t2-wf-status"),
      name: document.getElementById("t2-wf-name"),
      feel: document.getElementById("t2-wf-feel"),
    };
  }

  function openModal(url) {
    const els = getModalEls();
    if (!els) {
      console.warn("Tab2 modal not found (t2-wf-modal).");
      return;
    }
    els.img.src = url;
    els.img.alt = "";
    if (els.status) els.status.textContent = "";
    if (els.name) els.name.value = "";
    if (els.feel) els.feel.value = "";

    els.modal.classList.add("is-open");
    els.modal.setAttribute("aria-hidden", "false");
    setTimeout(() => els.feel && els.feel.focus(), 0);
  }

  function closeModal() {
    const els = getModalEls();
    if (!els) return;
    els.modal.classList.remove("is-open");
    els.modal.setAttribute("aria-hidden", "true");
  }

  function bindModalCloseOnce() {
    const els = getModalEls();
    if (!els || els.modal.dataset.bound === "1") return;
    els.modal.dataset.bound = "1";

    els.backdrop && els.backdrop.addEventListener("click", closeModal);
    els.closeBtn && els.closeBtn.addEventListener("click", closeModal);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
  }

  function ensureButtons() {
    const wall = document.querySelector(WALL_SELECTOR);
    if (!wall) return false;

    bindModalCloseOnce();

    const frames = wall.querySelectorAll(".wf-frame");
    if (!frames.length) return false;

    frames.forEach((frame) => {
      // Make sure positioning works even if CSS got overridden
      frame.style.position = "relative";

      // If already exists, hard-force it visible (in case CSS hid it)
      let btn = frame.querySelector(".wf-comment-btn");
      if (btn) {
        btn.style.opacity = "1";
        btn.style.transform = "none";
        btn.style.pointerEvents = "auto";
        btn.style.zIndex = "99999";
        return;
      }

      // Find the image URL inside the frame
      const img = frame.querySelector("img");
      if (!img) return;
      const url = img.currentSrc || img.src;
      if (!url) return;

      // Create the button
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wf-comment-btn";
      btn.textContent = BTN_TEXT;

      // ✅ INLINE STYLES = cannot be hidden by your stylesheet
      btn.style.position = "absolute";
      btn.style.left = "10px";
      btn.style.bottom = "10px";
      btn.style.zIndex = "99999";
      btn.style.opacity = "1";
      btn.style.transform = "none";
      btn.style.pointerEvents = "auto";
      btn.style.borderRadius = "999px";
      btn.style.padding = "8px 10px";
      btn.style.border = "1px solid rgba(0,0,0,0.12)";
      btn.style.background = "rgba(255,255,255,0.82)";
      btn.style.backdropFilter = "blur(12px)";
      btn.style.webkitBackdropFilter = "blur(12px)";
      btn.style.font = '600 12px/1 system-ui, -apple-system, "Segoe UI", sans-serif';

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openModal(url);
      });

      frame.appendChild(btn);
    });

    return true;
  }

  // Run now, and keep forcing it (handles infinite scroll + tab switching)
  const run = () => ensureButtons();

  // Try immediately
  run();

  // Keep trying briefly for late renders
  let tries = 0;
  const timer = setInterval(() => {
    run();
    tries += 1;
    if (tries >= 30) clearInterval(timer); // ~9s max
  }, 300);

  // Mutation observer for new blocks appended
  const wall = document.querySelector(WALL_SELECTOR);
  if (wall) {
    const mo = new MutationObserver(run);
    mo.observe(wall, { childList: true, subtree: true });
  }

  // Also retry whenever Tab2 is clicked/shown
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.closest && t.closest('[data-tab="t2"]')) run();
  });
})();




  
  /* ===========================
     TAB 3 (Responses)
  ============================ */
  function initResponsesTab() {
    const root = document.getElementById("rp3-root");
    if (!root) return;

    const feed = document.getElementById("rp3-feed");
    const status = document.getElementById("rp3-status");

    if (!feed || !status) return;

    // Theme toggle
    const themeBtn = document.getElementById("rp3-theme-btn");
    const lightOpt = themeBtn?.querySelector(".rp-theme-light");
    const darkOpt = themeBtn?.querySelector(".rp-theme-dark");

    const syncThemeUI = () => {
      const isDark = document.body.classList.contains("dark-mode");
      darkOpt?.classList.toggle("active", isDark);
      lightOpt?.classList.toggle("active", !isDark);
    };
    syncThemeUI();

    themeBtn?.addEventListener("click", () => {
      const next = !document.body.classList.contains("dark-mode");
      setTheme(next);
      syncThemeUI();
      syncAllThemeButtons();
    });

    // Modal
    const modal = document.getElementById("rp3-wf-modal");
    const modalBackdrop = document.getElementById("rp3-wf-modal-backdrop");
    const modalClose = document.getElementById("rp3-wf-modal-close");
    const modalImg = document.getElementById("rp3-wf-modal-img");

    const form = document.getElementById("rp3-wf-modal-form");
    const nameEl = document.getElementById("rp3-wf-name");
    const feelEl = document.getElementById("rp3-wf-feel");
    const submitBtn = document.getElementById("rp3-wf-submit");
    const statusEl = document.getElementById("rp3-wf-status");

    let currentImageUrl = null;

    function openModalFor(url) {
      currentImageUrl = url;
      modalImg.src = url;
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

    modalBackdrop.addEventListener("click", closeModal);
    modalClose.addEventListener("click", closeModal);
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

      submitBtn.disabled = true;
      statusEl.textContent = "Saving…";

      try {
        const supa = getSupaClient();
        const payload = {
          image_url: currentImageUrl,
          image_id: imageIdFromUrl(currentImageUrl),
          name: name || null,
          feeling_text: feeling,
          feeling_tag: null,
          page_url: window.location.href,
          user_agent: navigator.userAgent
        };

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

    // Data + render
    const PASTELS = ["#f7f2ea","#f3f0ea","#f2f4ff","#f4f7f2","#f8f1f6","#f6f3ff","#f5f6f7","#f3efe8"];
    const rand = (min,max)=> min + Math.random()*(max-min);

    function groupByImage(rows) {
      const m = new Map();
      rows.forEach(r => {
        if (!r.image_url) return;
        const key = String(r.image_url).trim();
        if (!m.has(key)) m.set(key, []);
        m.get(key).push(r);
      });
      return [...m.entries()];
    }

    function setPortraitPanelHeight(section) {
      const img = section.querySelector(".rp-photo img");
      if (!img) return;
      const apply = () => {
        const h = img.getBoundingClientRect().height;
        if (h > 140) section.style.setProperty("--panelH", `${Math.round(h)}px`);
      };
      if (img.complete) apply();
      img.addEventListener("load", apply, { once:true });
      window.addEventListener("resize", apply);
    }

    function classifyOrientation(img, section) {
      const isLandscape = img.naturalWidth > img.naturalHeight;
      section.classList.toggle("rp-landscape", isLandscape);
      section.classList.toggle("rp-portrait", !isLandscape);
    }

    function scatterPortrait(section) {
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
          for (let t = 0; t < 240; t++){
            const a = (t * 0.62) + rand(-0.25, 0.25);
            const r = 8 + (t * 2.8);
            const px = cx + Math.cos(a) * r;
            const py = cy + Math.sin(a) * r;

            const tmp = makeRect(card, 0, 0);
            const x = px - tmp.w / 2;
            const y = py - tmp.h / 2;
            const rect = makeRect(card, x, y);

            if (!insideBounds(rect)) continue;
            if (collides(rect, SEP_SOFT)) continue;

            card.style.left = x + "px";
            card.style.top  = y + "px";
            placed.push(rect);
            done = true;
            break;
          }
        }

        if (!done){
          hidden++;
          card.style.display = "none";
        }
      });

      return { hidden };
    }

    function enableShowMoreForPortrait(section){
      if (!section.classList.contains("rp-portrait")) return;
      if (window.matchMedia("(max-width: 900px)").matches) return;

      const btn = section.querySelector(".rp-more");
      const canvas = section.querySelector(".rp-canvas");
      const grid = section.querySelector(".rp-grid");
      const panel = section.querySelector(".rp-panel");
      const inner = section.querySelector(".rp-panel-inner");

      if (!btn || !canvas || !grid || !panel || !inner) return;

      btn.onclick = () => {
        panel.style.height = "auto";
        panel.style.overflow = "visible";
        inner.style.height = "auto";
        inner.style.overflow = "visible";

        canvas.style.display = "none";
        grid.style.display = "flex";

        grid.querySelectorAll(".rp-card").forEach(c => c.style.display = "");
        btn.style.display = "none";
      };
    }

    function renderGroup(url, items) {
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
        text.textContent = String(i.feeling_text || "").trim();

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

      const more = document.createElement("button");
      more.type = "button";
      more.className = "rp-more";
      more.textContent = "Show more responses";

      inner.appendChild(canvas);
      inner.appendChild(grid);
      panel.appendChild(inner);
      panel.appendChild(more);

      section.appendChild(left);
      section.appendChild(panel);

      const onReady = () => {
        classifyOrientation(img, section);

        const isMobile = window.matchMedia("(max-width: 900px)").matches;
        if (isMobile){
          canvas.style.display = "none";
          grid.style.display = "flex";
          more.style.display = "none";
          return;
        }

        if (section.classList.contains("rp-portrait")) {
          setPortraitPanelHeight(section);

          requestAnimationFrame(() => {
            const res = scatterPortrait(section);
            if (res.hidden > 0) {
              more.style.display = "inline-flex";
              enableShowMoreForPortrait(section);
            } else {
              more.style.display = "none";
            }
          });
        } else {
          canvas.style.display = "none";
          grid.style.display = "flex";
          more.style.display = "none";
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

      window.addEventListener("resize", () => {
        if (!section.classList.contains("rp-portrait")) return;
        if (window.matchMedia("(max-width: 900px)").matches) return;
        requestAnimationFrame(() => {
          canvas.querySelectorAll(".rp-card").forEach(c => c.style.display = "");
          scatterPortrait(section);
        });
      });

      return section;
    }

    async function load() {
      status.textContent = "Loading responses…";
      feed.innerHTML = "";

      try {
        const supa = getSupaClient();
        const { data, error } = await supa
          .from(TABLE)
          .select("image_url,name,feeling_text,created_at")
          .order("created_at", { ascending: false })
          .limit(5000);

        if (error) throw error;

        const groups = groupByImage(data || []);
        status.textContent = `Loaded ${(data || []).length} responses across ${groups.length} photographs.`;

        groups.forEach(([url, items]) => feed.appendChild(renderGroup(url, items)));
      } catch (e) {
        console.warn("[Tab3] load failed:", e);
        status.textContent = "Failed to load data.";
      }
    }

    load();
  }

  /* ===========================
     TAB INIT (ONCE)
  ============================ */
  let didT1 = false;
  let didT2 = false;
  let didT3 = false;
  let didT4 = false;

  function initTab1Once() {
    if (didT1) return;
    didT1 = true;

    const isDark = applyThemeFromStorage();
    themeSyncers = themeSyncers.filter(Boolean);
    themeSyncers.push(setupThemeToggle("t1-theme-toggle", ".wf-light-opt", ".wf-dark-opt"));
    if (isDark) syncAllThemeButtons();

    const wall = createPhotoWallController({
      wallInnerId: "t1-wf-wall-inner",
      loadingId: "t1-wf-loading",
      sentinelId: "t1-wf-sentinel",
      loadMoreId: "t1-load-more",
      goTopId: "t1-go-to-top",
      withCommentButton: false
    });
    if (!wall) return;

    (async () => {
      wall.setLoading(true);
      const images = await fetchImagesOnce();
      wall.setLoading(false);
      wall.resetGridWith(images);
    })();
  }




  
  function initTab2Once() {
  if (didT2) return;
  didT2 = true;

  // Apply saved theme
  applyThemeFromStorage();

  // --- HARD BIND theme toggle for Tab 2 (prevents interlink issues) ---
  (function bindTab2Theme() {
    const btn = document.getElementById("t2-theme-toggle");
    if (!btn) return;
    if (btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";

    const lightOpt = btn.querySelector(".t2-wf-light-opt");
    const darkOpt  = btn.querySelector(".t2-wf-dark-opt");

    const sync = () => {
      const isDark = document.body.classList.contains("dark-mode");
      darkOpt && darkOpt.classList.toggle("active", isDark);
      lightOpt && lightOpt.classList.toggle("active", !isDark);
    };
    sync();

    btn.addEventListener("click", () => {
      const next = !document.body.classList.contains("dark-mode");
      setTheme(next);
      sync();
      syncAllThemeButtons(); // keeps other tabs in sync too
    });

    // also keep it in the global sync list
    themeSyncers = themeSyncers.filter(Boolean);
    themeSyncers.push({ sync });
  })();

  // Modal
  const modal = setupTab2Modal();

  // Create wall (same engine as Tab 1)
  const wall = createPhotoWallController({
    wallInnerId: "t2-wf-wall-inner",
    loadingId: "t2-wf-loading",
    sentinelId: "t2-wf-sentinel",
    loadMoreId: "t2-load-more",
    goTopId: "t2-go-to-top",
    withCommentButton: true,
    onComment: (url) => modal && modal.open(url)
  });
  if (!wall) return;

  // --- REPAIR: ensure the "Share your feeling" button exists on every frame ---
  function ensureTab2CommentButtons() {
    const wallInner = document.getElementById("t2-wf-wall-inner");
    if (!wallInner) return;

    wallInner.querySelectorAll(".wf-frame").forEach((frame) => {
      if (frame.querySelector(".wf-comment-btn")) return;

      const img = frame.querySelector("img.wf-img");
      if (!img) return;

      const url = img.currentSrc || img.src;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wf-comment-btn";
      btn.textContent = "💭 Share your feeling";
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        modal && modal.open(url);
      });

      frame.appendChild(btn);
    });
  }

  // Observe new blocks appended by infinite scroll / load more
  const mo = new MutationObserver(() => ensureTab2CommentButtons());
  mo.observe(document.getElementById("t2-wf-wall-inner"), { childList: true, subtree: true });

  (async () => {
    wall.setLoading(true);
    const images = await fetchImagesOnce();
    wall.setLoading(false);
    wall.resetGridWith(images);

    // Run once after initial render
    ensureTab2CommentButtons();
  })();
}




  
  function initTab3Once() {
    if (didT3) return;
    didT3 = true;

    applyThemeFromStorage();
    themeSyncers = themeSyncers.filter(Boolean);
    themeSyncers.push({
      sync: () => {
        const btn = document.getElementById("rp3-theme-btn");
        if (!btn) return;
        const isDark = document.body.classList.contains("dark-mode");
        btn.querySelector(".rp-theme-dark")?.classList.toggle("active", isDark);
        btn.querySelector(".rp-theme-light")?.classList.toggle("active", !isDark);
      }
    });
    syncAllThemeButtons();

    initResponsesTab();
  }

  /* ===========================
     TAB 4 (kept simple / compatible)
     If you already have Tab4 elsewhere and it works, you can remove this,
     but this block is compatible with your working viz IDs.
  ============================ */
  function initTab4Once() {
    if (didT4) return;
    didT4 = true;

    const stage = document.getElementById("um-stage");
    const notesLayer = document.getElementById("um-notes");
    if (!stage || !notesLayer) return;

    // If you want: keep your full working visualization here.
    // Since you said Tab 4 is already working perfectly, we do nothing extra.
  }



  
/* ===== TAB 2: HARD-INJECT "Share your feeling" onto every image frame ===== */
(() => {
  
  const TAB2_PANEL_SEL = '.um-panel[data-panel="t2"]';
  const BTN_CLASS = 't2-force-share-btn';

  function getTab2ModalEls() {
    const modal = document.getElementById("t2-wf-modal");
    if (!modal) return null;
    return {
      modal,
      backdrop: document.getElementById("t2-wf-modal-backdrop"),
      closeBtn: document.getElementById("t2-wf-modal-close"),
      img: document.getElementById("t2-wf-modal-img"),
      feel: document.getElementById("t2-wf-feel"),
      name: document.getElementById("t2-wf-name"),
      status: document.getElementById("t2-wf-status"),
    };
  }

  function openTab2Modal(url) {
    const els = getTab2ModalEls();
    if (!els) {
      console.warn("TAB2: Modal not found. Expected #t2-wf-modal etc.");
      return;
    }
    els.img.src = url;
    els.img.alt = "";
    if (els.status) els.status.textContent = "";
    if (els.name) els.name.value = "";
    if (els.feel) els.feel.value = "";

    els.modal.classList.add("is-open");
    els.modal.setAttribute("aria-hidden", "false");
    setTimeout(() => els.feel && els.feel.focus(), 0);
  }

  function bindModalCloseOnce() {
    const els = getTab2ModalEls();
    if (!els) return;
    if (els.modal.dataset.bound === "1") return;
    els.modal.dataset.bound = "1";

    const close = () => {
      els.modal.classList.remove("is-open");
      els.modal.setAttribute("aria-hidden", "true");
    };

    els.backdrop && els.backdrop.addEventListener("click", close);
    els.closeBtn && els.closeBtn.addEventListener("click", close);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }

  function injectButtons() {
    const panel = document.querySelector(TAB2_PANEL_SEL);
    if (!panel) return;

    bindModalCloseOnce();

    // Prefer frames; fallback to images if frames are not present
    const frames = panel.querySelectorAll(".wf-frame");
    const targets = frames.length
      ? Array.from(frames)
      : Array.from(panel.querySelectorAll("img.wf-img")).map(img => img.closest("div") || img.parentElement);

    if (!targets.length) return;

    targets.forEach((frameOrDiv) => {
      if (!frameOrDiv) return;

      // Find image URL
      const img = frameOrDiv.querySelector("img");
      if (!img) return;
      const url = img.currentSrc || img.src;
      if (!url) return;

      // Ensure positioning context
      frameOrDiv.style.position = "relative";

      // If already exists, force it to behave
      let btn = frameOrDiv.querySelector("." + BTN_CLASS);
      if (btn) return;

      // Create button
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = `wf-comment-btn ${BTN_CLASS}`;
      btn.textContent = "💭 Share your feeling";

      // ✅ INLINE STYLES = cannot be overridden/hid by your CSS
      btn.style.position = "absolute";
      btn.style.left = "10px";
      btn.style.bottom = "10px";
      btn.style.zIndex = "999999";
      btn.style.borderRadius = "999px";
      btn.style.padding = "8px 10px";
      btn.style.border = "1px solid rgba(0,0,0,0.12)";
      btn.style.background = "rgba(255,255,255,0.82)";
      btn.style.backdropFilter = "blur(12px)";
      btn.style.webkitBackdropFilter = "blur(12px)";
      btn.style.font = '600 12px/1 system-ui, -apple-system, "Segoe UI", sans-serif';
      btn.style.cursor = "pointer";
      btn.style.pointerEvents = "auto";

      // ✅ Hover-only behavior (desktop)
      btn.style.opacity = "0";
      btn.style.transform = "translateY(6px)";
      btn.style.transition = "opacity 180ms ease, transform 180ms ease";

      frameOrDiv.addEventListener("mouseenter", () => {
        btn.style.opacity = "1";
        btn.style.transform = "translateY(0)";
      });
      frameOrDiv.addEventListener("mouseleave", () => {
        btn.style.opacity = "0";
        btn.style.transform = "translateY(6px)";
      });

      // ✅ Mobile: always visible (no hover)
      if (window.matchMedia("(hover: none)").matches) {
        btn.style.opacity = "1";
        btn.style.transform = "translateY(0)";
      }

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openTab2Modal(url);
      });

      frameOrDiv.appendChild(btn);
    });
  }

  // Run repeatedly to catch late renders / infinite scroll / tab switching
  const run = () => injectButtons();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }

  // Watch for new images being appended in Tab 2
  const mo = new MutationObserver(run);
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // Extra safety polling (Webflow tab visibility delays)
  let tries = 0;
  const t = setInterval(() => {
    run();
    tries += 1;
    if (tries > 40) clearInterval(t); // ~12s
  }, 300);
})();





  
  /* ===========================
     BOOT
  ============================ */
  function boot() {
    applyThemeFromStorage();

    // register theme toggles (they'll sync once tabs init)
    themeSyncers = themeSyncers.filter(Boolean);

    setupTabs();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
