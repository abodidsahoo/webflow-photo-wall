(() => {
  /* =========================================================
     UNTRAINABLE — SINGLE FINAL JS BLOCK (Tabs 1–4)
     Paste this ONE block before </body>

     ✅ Keeps your URLs + anon keys as-is
     ✅ Loads supabase-js only if missing
     ✅ Initializes each tab ONLY when that tab is opened (no double init)
     ✅ Shares Tab 1/2 theme via body.dark-mode + localStorage('theme')
     ✅ Tab 3 theme is kept working AND also syncs with body.dark-mode
  ========================================================= */

  /* -------------------------
     Ensure supabase-js exists
  ------------------------- */
  function ensureSupabase() {
    if (window.supabase && typeof window.supabase.createClient === "function") return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  /* -------------------------
     Shared memory store
  ------------------------- */
  if (!window.UNTRAINABLE) window.UNTRAINABLE = {};
  if (!window.UNTRAINABLE.imagesPromise) window.UNTRAINABLE.imagesPromise = null;
  if (!window.UNTRAINABLE.images) window.UNTRAINABLE.images = null;

  async function fetchImagesOnce(JSON_URL) {
    if (Array.isArray(window.UNTRAINABLE.images) && window.UNTRAINABLE.images.length) return window.UNTRAINABLE.images;
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

  /* -------------------------
     Theme helper (Tab 1/2)
  ------------------------- */
  function applySavedThemeDarkMode() {
    try {
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme === "dark") document.body.classList.add("dark-mode");
      else document.body.classList.remove("dark-mode");
    } catch (e) {}
  }
  applySavedThemeDarkMode();

  /* =========================================================
     TAB 1 — Photographs (init once)
     IDs expected:
     #theme-toggle .wf-light-opt .wf-dark-opt
     #wf-wall-inner #wf-loading #wf-sentinel
     #load-more #go-to-top
  ========================================================= */
  let __TAB1_INITED__ = false;

  window.__initPhotoGridOnce = function () {
    if (__TAB1_INITED__) return;
    __TAB1_INITED__ = true;

    // Theme toggle (Tab 1)
    const themeToggle = document.getElementById("theme-toggle");
    const lightOpt = document.querySelector(".wf-light-opt");
    const darkOpt = document.querySelector(".wf-dark-opt");
    const body = document.body;

    const syncThemeUI = () => {
      const isDark = body.classList.contains("dark-mode");
      if (darkOpt && lightOpt) {
        darkOpt.classList.toggle("active", isDark);
        lightOpt.classList.toggle("active", !isDark);
      }
    };

    applySavedThemeDarkMode();
    syncThemeUI();

    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        body.classList.toggle("dark-mode");
        const isDark = body.classList.contains("dark-mode");
        try { localStorage.setItem("theme", isDark ? "dark" : "light"); } catch (e) {}
        syncThemeUI();
      });
    }

    const JSON_URL = "https://vbzgchrnobnxkxdcupes.supabase.co/functions/v1/webflow-images";

    const FALLBACK_IMAGES = [
      "https://cdn.prod.website-files.com/67eba6a507dbd0003182ea6e/687eab1ba5d574191f21dfca_S07B0239-2.jpg",
      "https://cdn.prod.website-files.com/67eba6a507dbd0003182ea6e/687eab341449702b2e9bde66_S07B0295.jpg",
      "https://cdn.prod.website-files.com/67eba6a507dbd0003182ea6e/687eab3e7f71b6eb405e68f7_S07B0319.jpg"
    ];

    const PICK_RANDOM_N = 99999;
    const INITIAL_IMAGES_TO_SHOW = 18;
    const BATCH_IMAGES_TO_APPEND = 6;
    const MAX_TOTAL_BLOCKS = 9999;

    const LAYOUTS = [
      { cls: "wf-split", need: 2, weight: 32 },
      { cls: "wf-23", need: 2, weight: 24 },
      { cls: "wf-32", need: 2, weight: 24 },
      { cls: "wf-3up", need: 3, weight: 18 },
      { cls: "wf-4up", need: 4, weight: 2 }
    ];

    const wall = document.getElementById("wf-wall-inner");
    const loading = document.getElementById("wf-loading");
    const sentinel = document.getElementById("wf-sentinel");
    if (!wall || !loading || !sentinel) return;

    function shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    function pickRandomN(all, n) {
      const copy = all.slice();
      shuffle(copy);
      return copy.slice(0, Math.min(n, copy.length));
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
        section.appendChild(frame);
      }
      wall.appendChild(section);
    }

    let picked = [];
    let cursor = 0;
    let blocksMade = 0;
    let allImages = [];
    let io = null;
    let isAppending = false;

    function consume(n) {
      const out = picked.slice(cursor, cursor + n);
      cursor += out.length;
      return out;
    }

    function fillUntilImageCount(targetCount) {
      let shown = cursor;
      while (shown < targetCount && cursor < picked.length && blocksMade < MAX_TOTAL_BLOCKS) {
        if (blocksMade > 0 && blocksMade % Math.floor(6 + Math.random() * 5) === 0) {
          if (cursor < picked.length) {
            addBlock("wf-hero", consume(1), { hero: false });
            blocksMade++;
            shown = cursor;
            continue;
          }
        }
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
      const minMs = 420;

      const doAppend = () => {
        const before = cursor;
        const target = Math.min(picked.length, before + BATCH_IMAGES_TO_APPEND);

        while (cursor < target && cursor < picked.length && blocksMade < MAX_TOTAL_BLOCKS) {
          if (blocksMade > 0 && blocksMade % Math.floor(6 + Math.random() * 5) === 0) {
            if (cursor < picked.length) {
              addBlock("wf-hero", consume(1), { hero: false });
              blocksMade++;
              continue;
            }
          }

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

    function initializeGrid(images) {
      allImages = images;
      picked = pickRandomN(images, PICK_RANDOM_N);
      shuffle(picked);
      cursor = 0;
      blocksMade = 0;

      wall.innerHTML = "";

      addBlock("wf-hero", consume(1), { hero: true });
      blocksMade++;
      fillUntilImageCount(INITIAL_IMAGES_TO_SHOW);

      if (io) io.disconnect();
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) if (e.isIntersecting) appendBatch();
        },
        { root: null, rootMargin: "900px 0px 900px 0px", threshold: 0.01 }
      );

      io.observe(sentinel);
    }

    function loadMorePhotos() {
      if (cursor >= picked.length) {
        const newBatch = pickRandomN(allImages, 100);
        picked = picked.concat(newBatch);
        shuffle(picked);
      }
      const targetImages = Math.min(cursor + 20, picked.length);
      fillUntilImageCount(targetImages);
      setTimeout(() => window.scrollBy({ top: 400, behavior: "smooth" }), 100);
    }

    function goToTop() {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    const loadMoreBtn = document.getElementById("load-more");
    const goToTopBtn = document.getElementById("go-to-top");
    if (loadMoreBtn) loadMoreBtn.addEventListener("click", loadMorePhotos);
    if (goToTopBtn) goToTopBtn.addEventListener("click", goToTop);

    (async function loadImages() {
      setLoading(true);
      try {
        const data = await fetchImagesOnce(JSON_URL);
        if (Array.isArray(data) && data.length > 0) {
          setLoading(false);
          initializeGrid(data);
          return;
        }
      } catch (err) {
        console.warn("Tab 1: endpoint failed, using fallback:", err);
      }

      window.UNTRAINABLE.images = FALLBACK_IMAGES.slice();
      setLoading(false);
      initializeGrid(FALLBACK_IMAGES);
    })();
  };

  /* =========================================================
     TAB 2 — Add Responses (init once)
     FIXES:
       ✅ Allows either full Tab2 HTML OR a simple mount point (#t2-root)
       ✅ Ensures .wf-comment-btn positions correctly (frame is relative)
  ========================================================= */
  let __TAB2_INITED__ = false;

  window.__initTab2Once = async function () {
    if (__TAB2_INITED__) return;
    __TAB2_INITED__ = true;

    applySavedThemeDarkMode();
    await ensureSupabase();

    // ---- Where should Tab2 render? ----
    // If you already have full Tab2 HTML with #t2-wf-wall-inner, use it.
    // Otherwise, we will auto-build the Tab2 wall inside #t2-root.
    let wall = document.getElementById("t2-wf-wall-inner");
    let rootMount = document.getElementById("t2-root");

    const hasFullTab2HTML = !!wall;

    if (!hasFullTab2HTML) {
      if (!rootMount) return; // No Tab2 mount point at all
      // Build Tab2 shell inside #t2-root (no changes to Tab1/Tab4)
      rootMount.innerHTML = `
        <div id="t2-wf-photo-wall" class="wf-wall">
          <div class="wf-theme-toggle-wrapper">
            <button id="t2-theme-toggle" class="wf-theme-btn" aria-label="Toggle theme" type="button">
              <span class="wf-theme-option t2-wf-light-opt active">Light</span>
              <span class="wf-theme-option t2-wf-dark-opt">Dark</span>
            </button>
          </div>

          <div class="wf-bottom-controls">
            <button id="t2-go-to-top" class="wf-goto-btn" aria-label="Go to top" type="button">
              <span class="wf-goto-text">Go to top</span>
            </button>
            <button id="t2-load-more" class="wf-loadmore-btn" aria-label="Load more photos" type="button">
              <span class="wf-loadmore-text">I'm loving them! Load more photos!</span>
            </button>
          </div>

          <div class="wf-wall-inner" id="t2-wf-wall-inner"></div>

          <div class="wf-loading" id="t2-wf-loading" aria-live="polite" aria-busy="false">
            <div class="wf-loading-pill">
              <span class="wf-loading-dot"></span>
              <span>Photographs loading</span>
            </div>
          </div>

          <div id="t2-wf-sentinel" class="wf-sentinel"></div>
        </div>

        <div class="wf-modal" id="t2-wf-modal" aria-hidden="true">
          <div class="wf-modal-backdrop" id="t2-wf-modal-backdrop"></div>
          <div class="wf-modal-card" role="dialog" aria-modal="true" aria-labelledby="t2-wf-modal-title">
            <button class="wf-modal-close" id="t2-wf-modal-close" type="button" aria-label="Close">✕</button>

            <div class="wf-modal-head">
              <div class="wf-modal-title" id="t2-wf-modal-title">What does this photograph make you feel?</div>
              <div class="wf-modal-sub">Your response will be saved with this photograph’s URL for research.</div>
            </div>

            <div class="wf-modal-preview">
              <img id="t2-wf-modal-img" alt="" />
            </div>

            <form class="wf-modal-form" id="t2-wf-modal-form">
              <label class="wf-field">
                <span class="wf-label">Name (optional)</span>
                <input id="t2-wf-name" type="text" class="wf-input" placeholder="Your name" maxlength="80" />
              </label>

              <label class="wf-field">
                <span class="wf-label">What do you feel?</span>
                <textarea id="t2-wf-feel" class="wf-textarea" placeholder="Write in a few words…" maxlength="500" required></textarea>
              </label>

              <div class="wf-actions">
                <button id="t2-wf-submit" type="submit" class="wf-submit">Submit</button>
                <div class="wf-status" id="t2-wf-status" aria-live="polite"></div>
              </div>
            </form>
          </div>
        </div>
      `;
      wall = document.getElementById("t2-wf-wall-inner");
    }

    if (!wall) return;

    // Theme toggle (Tab 2)
    const themeToggle = document.getElementById("t2-theme-toggle");
    const lightOpt = document.querySelector(".t2-wf-light-opt");
    const darkOpt = document.querySelector(".t2-wf-dark-opt");
    const body = document.body;

    const syncThemeUI = () => {
      const isDark = body.classList.contains("dark-mode");
      if (darkOpt && lightOpt) {
        darkOpt.classList.toggle("active", isDark);
        lightOpt.classList.toggle("active", !isDark);
      }
    };
    syncThemeUI();

    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        body.classList.toggle("dark-mode");
        const isDark = body.classList.contains("dark-mode");
        try { localStorage.setItem("theme", isDark ? "dark" : "light"); } catch (e) {}
        syncThemeUI();
      });
    }

    // Supabase (Tab 2 insert)
    const SUPABASE_URL = "https://vbzgchrnobnxkxdcupes.supabase.co";
    const SUPABASE_ANON_KEY =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiemdjaHJub2JueGt4ZGN1cGVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMzQ0NDIsImV4cCI6MjA4MTYxMDQ0Mn0.nLdQW8f-nJwCFWUkURcr2ZPA694fAKlseYO__MOPGa8";

    const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const TABLE = "photo_feedback";

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

    // Modal (Tab 2)
    const modal = document.getElementById("t2-wf-modal");
    const modalBackdrop = document.getElementById("t2-wf-modal-backdrop");
    const modalClose = document.getElementById("t2-wf-modal-close");
    const modalImg = document.getElementById("t2-wf-modal-img");
    const form = document.getElementById("t2-wf-modal-form");
    const nameEl = document.getElementById("t2-wf-name");
    const feelEl = document.getElementById("t2-wf-feel");
    const submitBtn = document.getElementById("t2-wf-submit");
    const statusEl = document.getElementById("t2-wf-status");

    let currentImageUrl = null;

    function openModalFor(url) {
      currentImageUrl = url;
      if (modalImg) { modalImg.src = url; modalImg.alt = ""; }
      if (statusEl) statusEl.textContent = "";
      if (nameEl) nameEl.value = "";
      if (feelEl) feelEl.value = "";
      if (modal) {
        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
      }
      setTimeout(() => feelEl && feelEl.focus(), 0);
    }

    function closeModal() {
      if (modal) {
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
      }
      currentImageUrl = null;
    }

    if (modalBackdrop) modalBackdrop.addEventListener("click", closeModal);
    if (modalClose) modalClose.addEventListener("click", closeModal);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal && modal.classList.contains("is-open")) closeModal();
    });

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!currentImageUrl) return;

        const feeling = (feelEl?.value || "").trim();
        const name = (nameEl?.value || "").trim();

        if (!feeling) {
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

        try {
          const { error } = await supa.from(TABLE).insert([payload]);
          if (error) throw error;
          if (statusEl) statusEl.textContent = "Saved. Thank you!";
          setTimeout(closeModal, 650);
        } catch (err) {
          console.warn("Tab 2: Supabase insert failed:", err);
          if (statusEl) statusEl.textContent = "Could not save right now. Please try again.";
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }

    // Photo Grid (Tab 2)
    const JSON_URL = "https://vbzgchrnobnxkxdcupes.supabase.co/functions/v1/webflow-images";
    const FALLBACK_IMAGES = [
      "https://cdn.prod.website-files.com/67eba6a507dbd0003182ea6e/687eab1ba5d574191f21dfca_S07B0239-2.jpg",
      "https://cdn.prod.website-files.com/67eba6a507dbd0003182ea6e/687eab341449702b2e9bde66_S07B0295.jpg",
      "https://cdn.prod.website-files.com/67eba6a507dbd0003182ea6e/687eab3e7f71b6eb405e68f7_S07B0319.jpg"
    ];

    const INITIAL_IMAGES_TO_SHOW = 18;
    const BATCH_IMAGES_TO_APPEND = 6;
    const MAX_TOTAL_BLOCKS = 9999;

    const LAYOUTS = [
      { cls: "wf-split", need: 2, weight: 32 },
      { cls: "wf-23", need: 2, weight: 24 },
      { cls: "wf-32", need: 2, weight: 24 },
      { cls: "wf-3up", need: 3, weight: 18 },
      { cls: "wf-4up", need: 4, weight: 2 }
    ];

    const loading = document.getElementById("t2-wf-loading");
    const sentinel = document.getElementById("t2-wf-sentinel");
    const loadMoreBtn = document.getElementById("t2-load-more");
    const goToTopBtn = document.getElementById("t2-go-to-top");

    function setLoading(on) {
      if (!loading) return;
      loading.classList.toggle("is-on", !!on);
      loading.setAttribute("aria-busy", on ? "true" : "false");
    }

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

    function addBlock(blockClass, urls, { hero = false } = {}) {
      const section = document.createElement("section");
      section.className = `wf-block ${blockClass}${hero ? " wf-hero" : ""}`;

      for (let i = 0; i < urls.length; i++) {
        const frame = document.createElement("div");
        frame.className = "wf-frame";

        // ✅ CRITICAL FIX: the overlay button is absolute; the frame must be positioned.
        frame.style.position = "relative";

        const eager = hero && i === 0;
        frame.appendChild(makeImg(urls[i], { eager }));

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "wf-comment-btn";
        btn.textContent = "💭 Share your feeling";
        btn.addEventListener("click", () => openModalFor(urls[i]));
        frame.appendChild(btn);

        section.appendChild(frame);
      }

      wall.appendChild(section);
    }

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
      if (!sentinel) return;
      if (io) io.disconnect();

      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) if (e.isIntersecting) appendBatch();
        },
        { root: null, rootMargin: "900px 0px 900px 0px", threshold: 0.01 }
      );

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

    if (goToTopBtn) goToTopBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

    if (loadMoreBtn) {
      loadMoreBtn.addEventListener("click", () => {
        const targetImages = Math.min(cursor + 20, picked.length);
        fillUntilImageCount(targetImages);
        setTimeout(() => window.scrollBy({ top: 400, behavior: "smooth" }), 80);
      });
    }

    (async function loadImages() {
      setLoading(true);

      if (Array.isArray(window.UNTRAINABLE.images) && window.UNTRAINABLE.images.length) {
        setLoading(false);
        resetGridWith(window.UNTRAINABLE.images);
        ensureObserver();
        return;
      }

      try {
        const data = await fetchImagesOnce(JSON_URL);
        if (Array.isArray(data) && data.length > 0) {
          setLoading(false);
          resetGridWith(data);
          ensureObserver();
          return;
        }
        throw new Error("JSON not an array");
      } catch (err) {
        console.warn("Tab 2: Failed to load endpoint, using fallback:", err);
        window.UNTRAINABLE.images = FALLBACK_IMAGES.slice();
        setLoading(false);
        resetGridWith(FALLBACK_IMAGES);
        ensureObserver();
      }
    })();
  };

  /* =========================================================
     TAB 3 — Research Responses
     FIXES:
       ✅ IDs now match your HTML:
          #rp3-root #rp3-theme-btn #rp3-status #rp3-feed
          #rp3-wf-modal ... (all rp3-wf-* ids)
  ========================================================= */
  let __TAB3_INITED__ = false;

  window.__initRp3Once = async function () {
    if (__TAB3_INITED__) return;
    __TAB3_INITED__ = true;

    const root = document.getElementById("rp-root");
    if (!root) return;

    await ensureSupabase();

    /* =========================
       THEME (kept working)
       + sync with body.dark-mode
    ========================= */
    const themeBtn = document.getElementById("rp-theme-btn");
    if (!themeBtn) return;

    const lightOpt = themeBtn.querySelector(".rp-theme-light");
    const darkOpt  = themeBtn.querySelector(".rp-theme-dark");

    function setTheme(mode){
      document.body.classList.remove("rp-theme-light","rp-theme-dark");
      document.body.classList.add(mode === "dark" ? "rp-theme-dark" : "rp-theme-light");

      document.body.classList.toggle("dark-mode", mode === "dark");
      try { localStorage.setItem("theme", mode === "dark" ? "dark" : "light"); } catch(e){}

      if (darkOpt && lightOpt){
        darkOpt.classList.toggle("active", mode === "dark");
        lightOpt.classList.toggle("active", mode !== "dark");
      }
      try { localStorage.setItem("rp-theme", mode); } catch(e){}
    }

    const boot = (function(){
      try {
        const shared = localStorage.getItem("theme");
        if (shared === "dark") return "dark";
        if (shared === "light") return "light";
      } catch(e){}
      try { return localStorage.getItem("rp-theme") || "light"; } catch(e){}
      return "light";
    })();

    setTheme(boot);

    themeBtn.addEventListener("click", () => {
      const isDark = document.body.classList.contains("rp-theme-dark");
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

    const feed = document.getElementById("rp-feed");
    const status = document.getElementById("rp-status");

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
       MODAL LOGIC (Tab 3 ids)
    ========================= */
    const modal = document.getElementById("wf-modal");
const modalBackdrop = document.getElementById("wf-modal-backdrop");
const modalClose = document.getElementById("wf-modal-close");
const modalImg = document.getElementById("wf-modal-img");
const form = document.getElementById("wf-modal-form");
const nameEl = document.getElementById("wf-name");
const feelEl = document.getElementById("wf-feel");
const submitBtn = document.getElementById("wf-submit");
const statusEl = document.getElementById("wf-status");

    (function setupKeyboardSafeModal(){
      if (!window.visualViewport || !modal) return;

      function update(){
        if (!modal.classList.contains("is-open")) return;
        const vv = window.visualViewport;
        const lost = window.innerHeight - vv.height - vv.offsetTop;
        const shift = lost > 0 ? Math.min(220, Math.round(lost * 0.85)) : 0;
        document.documentElement.style.setProperty("--kbdShift", shift ? `-${shift}px` : "0px");
      }
      function reset(){ document.documentElement.style.setProperty("--kbdShift", "0px"); }

      window.__wfApplyKeyboardShift = update;
      window.__wfClearKeyboardShift = reset;

      window.visualViewport.addEventListener("resize", update);
      window.visualViewport.addEventListener("scroll", update);
      window.addEventListener("resize", update);
    })();

    let currentImageUrl = null;

    function openModalFor(url){
      if (!modal || !modalImg || !statusEl || !nameEl || !feelEl) return;
      currentImageUrl = url;
      modalImg.src = url;
      modalImg.alt = "";
      statusEl.textContent = "";
      nameEl.value = "";
      feelEl.value = "";
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      setTimeout(() => feelEl.focus(), 0);
      window.__wfApplyKeyboardShift?.();
    }

    function closeModal(){
      if (!modal) return;
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      currentImageUrl = null;
      window.__wfClearKeyboardShift?.();
    }

    if (modalBackdrop) modalBackdrop.addEventListener("click", closeModal);
    if (modalClose) modalClose.addEventListener("click", closeModal);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal && modal.classList.contains("is-open")) closeModal();
    });

    if (form){
      form.addEventListener("submit", async (e) => {
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
          console.warn("Supabase insert failed:", err);
          if (statusEl) statusEl.textContent = "Could not save right now. Please try again.";
        } finally{
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }

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

    function setPortraitPanelHeight(section){
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

    async function load(){
      if (status) status.textContent = "Loading responses…";
      if (feed) feed.innerHTML = "";

      const { data, error } = await supa
        .from("photo_feedback")
        .select("image_url,name,feeling_text,created_at")
        .order("created_at", { ascending: false })
        .limit(5000);

      if (error){
        console.warn(error);
        if (status) status.textContent = "Failed to load data.";
        return;
      }

      const groups = groupByImage(data || []);
      if (status) status.textContent = `Loaded ${(data||[]).length} responses across ${groups.length} photographs.`;

      groups.forEach(([url, items]) => {
        if (feed) feed.appendChild(renderGroup(url, items));
      });
    }

    load();
  };

  /* =========================================================
     TAB 4 — Visualization (init once)
     IDs expected: #um-stage #um-notes
  ========================================================= */
  let __TAB4_INITED__ = false;

  window.__initUM4Once = async function () {
    if (__TAB4_INITED__) return;
    __TAB4_INITED__ = true;

    const stage = document.getElementById("um-stage");
    const notesLayer = document.getElementById("um-notes");
    if (!stage || !notesLayer) return;

    await ensureSupabase();

    // ---- your working Tab 4 code (same keys/URL) ----
    const SUPABASE_URL = "https://vbzgchrnobnxkxdcupes.supabase.co";
    const SUPABASE_ANON_KEY =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiemdjaHJub2JueGt4ZGN1cGVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMzQ0NDIsImV4cCI6MjA4MTYxMDQ0Mn0.nLdQW8f-nJwCFWUkURcr2ZPA694fAKlseYO__MOPGa8";

    const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data, error } = await supa
      .from("photo_feedback")
      .select("image_url,feeling_text,name,created_at")
      .order("created_at", { ascending: false })
      .limit(6000);

    if (error) { console.warn(error); return; }

    const map = new Map();
    for (const r of (data || [])){
      if (!r.image_url) continue;
      const k = String(r.image_url).trim();
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    }

    const TOP_N = 12;
    const items = [...map.entries()]
      .map(([url, rows]) => ({ url, rows, count: rows.length }))
      .sort((a,b) => b.count - a.count)
      .slice(0, TOP_N);

    if (!items.length) return;

    const rand = (min,max)=> min + Math.random()*(max-min);
    const maxCount = Math.max(...items.map(x => x.count));
    const pad = 12;

    function keyFromUrl(url){
      try{ return btoa(unescape(encodeURIComponent(String(url)))); }
      catch(e){ return String(url).replace(/[^a-z0-9]/gi,"_"); }
    }

    function radiusForRank(rank, count){
      const r = (count / maxCount);
      if (rank === 0) return Math.round(170 + r * 80);
      if (rank <= 2)  return Math.round(130 + r * 55);
      if (rank <= 6)  return Math.round(105 + r * 45);
      return Math.round(88 + r * 35);
    }

    function wrapAndClampWords(text, perLine = 7, maxLines = 4){
      const words = String(text || "").trim().split(/\s+/).filter(Boolean);
      const maxWords = perLine * maxLines;
      const trimmed = words.slice(0, maxWords);

      const lines = [];
      for (let i = 0; i < trimmed.length; i += perLine){
        lines.push(trimmed.slice(i, i + perLine).join(" "));
      }
      if (words.length > maxWords && lines.length){
        lines[lines.length - 1] = lines[lines.length - 1].replace(/\s+$/, "") + "…";
      }
      return lines.join("\n");
    }

    function noteDimsFromWords(text){
      const words = String(text || "").trim().split(/\s+/).filter(Boolean);
      const wc = words.length;

      let w = 170;
      if (wc <= 6) w = 160;
      else if (wc <= 12) w = 190;
      else if (wc <= 20) w = 230;
      else w = 260;

      const lines = Math.max(1, Math.ceil(Math.min(wc, 28) / 7));
      let h = 86 + (lines - 1) * 22;
      h = Math.min(h, 150);

      return { w, h };
    }

    function seedTargetY(rank){
      const H = stage.clientHeight;
      const t = rank / Math.max(1, (items.length - 1));
      const base = 0.12 + t * 0.76;
      const jitter = (rank === 0) ? 0.05 : 0.09;
      return (base + rand(-jitter, jitter)) * H;
    }

    function seedNonOverlappingCenters(sizes){
      const W = stage.clientWidth;
      const H = stage.clientHeight;
      const edge = 18;

      const centers = [];
      for (let i = 0; i < sizes.length; i++){
        const size = sizes[i];
        const r = size / 2;

        let ax = rand(edge + r, W - edge - r);
        let ay = seedTargetY(i);

        let placed = false;
        for (let t = 0; t < 520; t++){
          const x = ax + rand(-80, 80);
          const y = ay + rand(-60, 60);

          if (x < edge + r || x > W - edge - r) continue;
          if (y < edge + r || y > H - edge - r) continue;

          let ok = true;
          for (let j = 0; j < centers.length; j++){
            const c = centers[j];
            const rr = (sizes[j]/2) + r;
            const minDist = rr * 0.98;
            const d = Math.hypot(x - c.x, y - c.y);
            if (d < minDist){ ok = false; break; }
          }
          if (ok){
            centers.push({ x, y });
            placed = true;
            break;
          }
        }

        if (!placed) centers.push({ x: ax, y: ay });
      }
      return centers;
    }

    const states = [];
    let activeState = null;

    function setActive(s){
      activeState = s;
      for (const st of states){
        st.el.style.zIndex = (st === activeState) ? "220" : "10";
      }
    }

    function clearNotesForKey(k){
      notesLayer.querySelectorAll(`[data-for="${k}"]`).forEach(n => n.remove());
    }

    function updateActiveNotesPosition(s){
      if (!s) return;
      const cx = s.x + s.size/2;
      const cy = s.y + s.size/2;

      const els = notesLayer.querySelectorAll(`[data-for="${s.key}"]`);
      els.forEach((note) => {
        const ox = parseFloat(note.dataset.ox || "0");
        const oy = parseFloat(note.dataset.oy || "0");
        note.style.left = Math.round(cx + ox) + "px";
        note.style.top  = Math.round(cy + oy) + "px";
      });
    }

    function renderNotesOnce(s){
      clearNotesForKey(s.key);

      const rows = s.item.rows || [];
      const cap = (rows.length <= 15) ? rows.length : 15;
      const sample = rows.slice(0, cap);

      const W = stage.clientWidth, H = stage.clientHeight;
      const cx = s.x + s.size/2;
      const cy = s.y + s.size/2;
      const imgR = s.size/2;

      const placed = [];
      const edge = 18;

      function rectsOverlap(a, b, gap=10){
        return (
          a.x < b.x + b.w + gap &&
          a.x + a.w + gap > b.x &&
          a.y < b.y + b.h + gap &&
          a.y + a.h + gap > b.y
        );
      }

      function outsideImageCircle(rx, ry, w, h, padCircle){
        const mx = rx + w/2;
        const my = ry + h/2;
        const dx = mx - cx;
        const dy = my - cy;
        const dist = Math.hypot(dx, dy);
        const halfDiag = Math.hypot(w, h) / 2;
        return dist >= (imgR + halfDiag + padCircle);
      }

      function fits(rx, ry, w, h){
        if (rx < edge || ry < edge) return false;
        if (rx + w > W - edge) return false;
        if (ry + h > H - edge) return false;
        if (!outsideImageCircle(rx, ry, w, h, 14)) return false;
        for (const p of placed){
          if (rectsOverlap({x:rx,y:ry,w,h}, p, 12)) return false;
        }
        return true;
      }

      const angleBase = rand(0, Math.PI * 2);
      const angleStep = (Math.PI * 2) / Math.max(1, sample.length);

      sample.forEach((r, i) => {
        const raw = (r.feeling_text || "").trim();
        if (!raw) return;

        const dims = noteDimsFromWords(raw);
        const textWrapped = wrapAndClampWords(raw, 7, 4);

        const note = document.createElement("div");
        note.className = "um-note";
        note.setAttribute("data-for", s.key);
        note.style.width = dims.w + "px";
        note.style.minHeight = dims.h + "px";

        const t = document.createElement("div");
        t.className = "t";
        t.textContent = textWrapped;

        const n = document.createElement("div");
        n.className = "n";
        n.textContent = r.name || "Anonymous";

        note.appendChild(t);
        note.appendChild(n);
        notesLayer.appendChild(note);

        const a0 = angleBase + i * angleStep + rand(-0.22, 0.22);
        const baseRing = imgR + (Math.hypot(dims.w, dims.h) / 2) + 22;

        let placedOk = false;
        for (let k = 0; k < 260; k++){
          const rr = baseRing + (k * 10) + rand(-6, 6);
          const aa = a0 + rand(-0.10, 0.10);

          const rx = Math.round(cx + Math.cos(aa) * rr - dims.w/2);
          const ry = Math.round(cy + Math.sin(aa) * rr - dims.h/2);

          if (fits(rx, ry, dims.w, dims.h)){
            note.style.left = rx + "px";
            note.style.top  = ry + "px";
            note.dataset.ox = String(rx - cx);
            note.dataset.oy = String(ry - cy);
            placed.push({ x: rx, y: ry, w: dims.w, h: dims.h });
            placedOk = true;
            break;
          }
        }
        if (!placedOk){ note.remove(); return; }
        setTimeout(() => note.classList.add("is-on"), 60 + i * 85);
      });
    }

    function createNode(item, rank, seededCenter){
      const node = document.createElement("div");
      node.className = "um-node";

      const rad = radiusForRank(rank, item.count);
      const size = rad * 2;
      node.style.width = size + "px";
      node.style.height = size + "px";

      const img = document.createElement("img");
      img.src = item.url;
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      node.appendChild(img);

      const badge = document.createElement("div");
      badge.className = "um-badge";
      badge.textContent = `${item.count} responses`;
      node.appendChild(badge);

      stage.appendChild(node);

      const W = stage.clientWidth, H = stage.clientHeight;
      const maxX = W - size - pad;
      const maxY = H - size - 64;

      let ax = seededCenter.x;
      let ay = seededCenter.y;

      let x = Math.max(pad, Math.min(maxX, ax - size/2));
      let y = Math.max(pad, Math.min(maxY, ay - size/2));

      const speedBias = (rank === 0) ? 0.35 : (rank <= 2 ? 0.55 : 0.85);
      const personality = rand(0.85, 1.25);

      const s = {
        el: node, item, rank, size, key: keyFromUrl(item.url),
        x, y, ax, ay, vx: 0, vy: 0,
        phx: rand(0, Math.PI * 2),
        phy: rand(0, Math.PI * 2),
        ph2: rand(0, Math.PI * 2),
        amp: (rank === 0) ? rand(18, 34) : rand(22, 56),
        amp2: rand(10, 26),
        wSpeed: (0.00055 + 0.00035 * speedBias) * personality,
        k: (0.010 + 0.006 * speedBias) * personality,
        d: (0.86 - 0.08 * speedBias),
        showing: false
      };

      const showNotes = () => { s.showing = true; setActive(s); renderNotesOnce(s); };
      const hideNotes = () => { s.showing = false; clearNotesForKey(s.key); };

      node.addEventListener("mouseenter", showNotes);
      node.addEventListener("mouseleave", hideNotes);
      node.addEventListener("click", (e) => { e.stopPropagation(); showNotes(); });

      return s;
    }

    const sizes = items.map((it, idx) => radiusForRank(idx, it.count) * 2);
    const centers = seedNonOverlappingCenters(sizes);
    items.forEach((it, idx) => states.push(createNode(it, idx, centers[idx])));

    for (const s of states){ s.el.style.left = s.x + "px"; s.el.style.top = s.y + "px"; }

    document.addEventListener("click", () => {
      for (const s of states){
        if (s.showing){ s.showing = false; clearNotesForKey(s.key); }
      }
    });

    function solveCollisions(dtScale){
      const n = states.length;
      for (let i = 0; i < n; i++){
        for (let j = i + 1; j < n; j++){
          const a = states[i], b = states[j];
          const ax = a.x + a.size/2, ay = a.y + a.size/2;
          const bx = b.x + b.size/2, by = b.y + b.size/2;
          const dx = bx - ax, dy = by - ay;
          const dist = Math.hypot(dx, dy) || 0.0001;

          const minDist = ((a.size/2) + (b.size/2)) * 0.985;
          if (dist >= minDist) continue;

          const overlap = (minDist - dist);
          const nx = dx / dist, ny = dy / dist;

          const wa = 1 / Math.max(1, a.size);
          const wb = 1 / Math.max(1, b.size);
          const sum = wa + wb;

          const pushA = (overlap * (wa / sum)) * 0.62;
          const pushB = (overlap * (wb / sum)) * 0.62;

          a.x -= nx * pushA; a.y -= ny * pushA;
          b.x += nx * pushB; b.y += ny * pushB;

          a.vx -= nx * 0.35 * dtScale; a.vy -= ny * 0.35 * dtScale;
          b.vx += nx * 0.35 * dtScale; b.vy += ny * 0.35 * dtScale;
        }
      }
    }

    let last = performance.now();
    function tick(now){
      const dt = Math.min(34, now - last);
      last = now;

      const W = stage.clientWidth;
      const H = stage.clientHeight;

      for (const s of states){
        const maxX = W - s.size - pad;
        const maxY = H - s.size - 64;

        const t = now;
        const wx =
          Math.sin(s.phx + t * s.wSpeed) * s.amp +
          Math.sin(s.ph2 + t * (s.wSpeed * 0.63)) * s.amp2;

        const wy =
          Math.cos(s.phy + t * (s.wSpeed * 0.92)) * (s.amp * 0.78) +
          Math.sin(s.ph2 + t * (s.wSpeed * 0.71)) * (s.amp2 * 0.9);

        const tx = s.ax + wx;
        const ty = s.ay + wy;

        const targetX = Math.max(pad, Math.min(maxX, tx - s.size/2));
        const targetY = Math.max(pad, Math.min(maxY, ty - s.size/2));

        const fx = (targetX - s.x) * s.k;
        const fy = (targetY - s.y) * s.k;

        const scale = dt / 16.67;
        s.vx = (s.vx + fx * scale) * s.d;
        s.vy = (s.vy + fy * scale) * s.d;

        s.x += s.vx * scale;
        s.y += s.vy * scale;

        s.x = Math.max(pad, Math.min(maxX, s.x));
        s.y = Math.max(pad, Math.min(maxY, s.y));
      }

      solveCollisions(dt / 16.67);

      for (const s of states){
        s.el.style.left = s.x + "px";
        s.el.style.top  = s.y + "px";
      }

      if (activeState && activeState.showing){
        updateActiveNotesPosition(activeState);
      }

      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    let rto = null;
    window.addEventListener("resize", () => {
      clearTimeout(rto);
      rto = setTimeout(() => {
        const sizes2 = items.map((it, idx) => radiusForRank(idx, it.count) * 2);
        const centers2 = seedNonOverlappingCenters(sizes2);
        for (let i=0; i<states.length; i++){
          states[i].ax = centers2[i].x;
          states[i].ay = centers2[i].y;
        }
        if (activeState && activeState.showing) renderNotesOnce(activeState);
      }, 140);
    });
  };

  /* =========================================================
     Tabs controller
     Expects:
       #um-root
       .um-tab[data-tab="t1|t2|t3|t4"]
       .um-panel[data-panel="t1|t2|t3|t4"]
  ========================================================= */
  function initTabs() {
    const root = document.getElementById("um-root");
    if (!root) {
      window.__initPhotoGridOnce?.();
      window.__initTab2Once?.();
      window.__initRp3Once?.();
      window.__initUM4Once?.();
      return;
    }

    const tabs = root.querySelectorAll(".um-tab");
    const panels = root.querySelectorAll(".um-panel");

    function activate(tabId) {
      tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.tab === tabId));
      panels.forEach((p) => (p.style.display = p.dataset.panel === tabId ? "block" : "none"));

      try { localStorage.setItem("um-active-tab", tabId); } catch (e) {}

      if (tabId === "t1") window.__initPhotoGridOnce?.();
      if (tabId === "t2") window.__initTab2Once?.();
      if (tabId === "t3") window.__initRp3Once?.();
      if (tabId === "t4") window.__initUM4Once?.();
    }

    tabs.forEach((t) => t.addEventListener("click", () => activate(t.dataset.tab)));

    let start = "t1";
    try { start = localStorage.getItem("um-active-tab") || "t1"; } catch (e) {}
    activate(start);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTabs, { once: true });
  } else {
    initTabs();
  }
})();


