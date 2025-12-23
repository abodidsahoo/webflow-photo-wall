(() => {
  /* =========================================================
     CONFIG
  ========================================================= */
  const SUPABASE_URL = "https://vbzgchrnobnxkxdcupes.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiemdjaHJub2JueGt4ZGN1cGVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMzQ0NDIsImV4cCI6MjA4MTYxMDQ0Mn0.nLdQW8f-nJwCFWUkURcr2ZPA694fAKlseYO__MOPGa8";
  const TABLE = "photo_feedback";

  const JSON_URL = "https://vbzgchrnobnxkxdcupes.supabase.co/functions/v1/webflow-images";
  const FALLBACK_IMAGES = [
    "https://cdn.prod.website-files.com/67eba6a507dbd0003182ea6e/687eab1ba5d574191f21dfca_S07B0239-2.jpg",
    "https://cdn.prod.website-files.com/67eba6a507dbd0003182ea6e/687eab341449702b2e9bde66_S07B0295.jpg",
    "https://cdn.prod.website-files.com/67eba6a507dbd0003182ea6e/687eab3e7f71b6eb405e68f7_S07B0319.jpg"
  ];

  const LAYOUTS = [
    { cls: "wf-split", need: 2, weight: 32 },
    { cls: "wf-23",   need: 2, weight: 24 },
    { cls: "wf-32",   need: 2, weight: 24 },
    { cls: "wf-3up",  need: 3, weight: 18 },
    { cls: "wf-4up",  need: 4, weight: 2 }
  ];

  /* =========================================================
     HELPERS
  ========================================================= */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const nextFrame = () => new Promise(r => requestAnimationFrame(r));
  const isVisible = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));

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

  function ensureSharedStore(){
    if (!window.UNTRAINABLE) window.UNTRAINABLE = {};
    if (!window.UNTRAINABLE.imagesPromise) window.UNTRAINABLE.imagesPromise = null;
    if (!window.UNTRAINABLE.images) window.UNTRAINABLE.images = null;
    if (!window.UNTRAINABLE.needsRefreshT3) window.UNTRAINABLE.needsRefreshT3 = false;
  }

  async function fetchImagesOnce(url){
    ensureSharedStore();

    if (Array.isArray(window.UNTRAINABLE.images) && window.UNTRAINABLE.images.length) {
      return window.UNTRAINABLE.images;
    }
    if (window.UNTRAINABLE.imagesPromise) return window.UNTRAINABLE.imagesPromise;

    window.UNTRAINABLE.imagesPromise = (async () => {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Image endpoint failed: " + res.status);
      const data = await res.json();
      window.UNTRAINABLE.images = Array.isArray(data) ? data : [];
      return window.UNTRAINABLE.images;
    })();

    return window.UNTRAINABLE.imagesPromise;
  }

  function getSupa(){
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      console.warn("Supabase not loaded yet. Make sure the CDN script is included before this file.");
      return null;
    }
    if (!window.__UM_SUPA__) {
      window.__UM_SUPA__ = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return window.__UM_SUPA__;
  }

  /* =========================================================
     THEME (shared across tabs)
  ========================================================= */
  function applyThemeFromStorage(){
    const savedTheme = (() => {
      try { return localStorage.getItem("theme"); } catch(e){ return null; }
    })();
    const isDark = savedTheme === "dark";
    document.body.classList.toggle("dark-mode", isDark);
    syncThemeButtons();
  }

  function setTheme(isDark){
    document.body.classList.toggle("dark-mode", !!isDark);
    try { localStorage.setItem("theme", isDark ? "dark" : "light"); } catch(e){}
    syncThemeButtons();
  }

  function syncThemeButtons(){
    const isDark = document.body.classList.contains("dark-mode");

    // Tab 1
    const t1Light = $(".wf-light-opt");
    const t1Dark  = $(".wf-dark-opt");
    if (t1Light && t1Dark){
      t1Dark.classList.toggle("active", isDark);
      t1Light.classList.toggle("active", !isDark);
    }

    // Tab 2
    const t2Light = $(".t2-wf-light-opt");
    const t2Dark  = $(".t2-wf-dark-opt");
    if (t2Light && t2Dark){
      t2Dark.classList.toggle("active", isDark);
      t2Light.classList.toggle("active", !isDark);
    }

    // Tab 3
    const rpBtn = $("#rp3-theme-btn");
    if (rpBtn){
      const rpLight = rpBtn.querySelector(".rp-theme-light");
      const rpDark  = rpBtn.querySelector(".rp-theme-dark");
      if (rpLight && rpDark){
        rpDark.classList.toggle("active", isDark);
        rpLight.classList.toggle("active", !isDark);
      }
    }
  }

  /* =========================================================
     PHOTO WALL (shared engine for Tab1 + Tab2)
  ========================================================= */
  class PhotoWall {
    constructor(opts){
      this.wall = opts.wall;
      this.loading = opts.loading;
      this.sentinel = opts.sentinel;
      this.loadMoreBtn = opts.loadMoreBtn;
      this.goTopBtn = opts.goTopBtn;

      this.layouts = opts.layouts || LAYOUTS;
      this.initialCount = opts.initialCount ?? 18;
      this.batchAppend = opts.batchAppend ?? 6;
      this.maxBlocks = opts.maxBlocks ?? 9999;

      this.enableComment = !!opts.enableComment;
      this.onCommentClick = opts.onCommentClick || null;
      this.commentText = opts.commentText || "💭 Share your feeling";
      this.loopWhenExhausted = !!opts.loopWhenExhausted;

      this.picked = [];
      this.cursor = 0;
      this.blocksMade = 0;
      this.isAppending = false;
      this.io = null;
    }

    setLoading(on){
      if (!this.loading) return;
      this.loading.classList.toggle("is-on", !!on);
      this.loading.setAttribute("aria-busy", on ? "true" : "false");
    }

    shuffle(arr){
      for (let i = arr.length - 1; i > 0; i--){
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    weightedPick(){
      const total = this.layouts.reduce((s, x) => s + x.weight, 0);
      let r = Math.random() * total;
      for (const x of this.layouts){
        r -= x.weight;
        if (r <= 0) return x;
      }
      return this.layouts[0];
    }

    makeImg(url, { eager = false } = {}){
      const img = document.createElement("img");
      img.className = "wf-img";
      img.src = url;
      img.alt = "";
      img.decoding = "async";
      img.loading = eager ? "eager" : "lazy";
      if (eager) img.fetchPriority = "high";
      return img;
    }

    addBlock(blockClass, urls, { hero = false } = {}){
      const section = document.createElement("section");
      section.className = `wf-block ${blockClass}${hero ? " wf-hero" : ""}`;

      for (let i = 0; i < urls.length; i++){
        const frame = document.createElement("div");
        frame.className = "wf-frame";

        const eager = hero && i === 0;
        frame.appendChild(this.makeImg(urls[i], { eager }));

        if (this.enableComment && typeof this.onCommentClick === "function"){
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "wf-comment-btn";
          btn.textContent = this.commentText;
          btn.addEventListener("click", () => this.onCommentClick(urls[i]));
          frame.appendChild(btn);
        }

        section.appendChild(frame);
      }

      this.wall.appendChild(section);
    }

    consume(n){
      const out = this.picked.slice(this.cursor, this.cursor + n);
      this.cursor += out.length;
      return out;
    }

    maybeAddHeroSometimes(){
      if (this.blocksMade > 0 && this.blocksMade % Math.floor(6 + Math.random() * 5) === 0) {
        if (this.cursor < this.picked.length) {
          this.addBlock("wf-hero", this.consume(1), { hero: false });
          this.blocksMade++;
          return true;
        }
      }
      return false;
    }

    fillUntilImageCount(targetCount){
      let shown = this.cursor;
      while (shown < targetCount && this.cursor < this.picked.length && this.blocksMade < this.maxBlocks){
        if (this.maybeAddHeroSometimes()) { shown = this.cursor; continue; }
        const next = this.weightedPick();
        if (this.cursor + next.need > this.picked.length) break;
        this.addBlock(next.cls, this.consume(next.need));
        this.blocksMade++;
        shown = this.cursor;
      }
    }

    ensureObserver(){
      if (!this.sentinel) return;
      if (this.io) this.io.disconnect();
      this.io = new IntersectionObserver((entries) => {
        for (const e of entries) if (e.isIntersecting) this.appendBatch();
      }, { root: null, rootMargin: "900px 0px 900px 0px", threshold: 0.01 });
      this.io.observe(this.sentinel);
    }

    resetWith(images){
      if (!this.wall) return;
      this.wall.innerHTML = "";
      this.cursor = 0;
      this.blocksMade = 0;
      this.picked = this.shuffle(images.slice());

      // first hero eager
      this.addBlock("wf-hero", this.consume(1), { hero: true });
      this.blocksMade++;

      this.fillUntilImageCount(this.initialCount);
      this.ensureObserver();
    }

    appendBatch(){
      if (this.isAppending) return;
      if (this.cursor >= this.picked.length) return;

      this.isAppending = true;
      this.setLoading(true);

      const start = performance.now();
      const minMs = 320;

      const doAppend = () => {
        const before = this.cursor;
        const target = Math.min(this.picked.length, before + this.batchAppend);

        while (this.cursor < target && this.cursor < this.picked.length && this.blocksMade < this.maxBlocks){
          if (this.maybeAddHeroSometimes()) continue;
          const next = this.weightedPick();
          if (this.cursor + next.need > this.picked.length) break;
          if (this.cursor + next.need > target && (target - this.cursor) >= 2) break;
          this.addBlock(next.cls, this.consume(next.need));
          this.blocksMade++;
        }

        if (this.cursor === before && this.cursor < this.picked.length){
          const remaining = this.picked.length - this.cursor;
          if (remaining >= 2) this.addBlock("wf-split", this.consume(2));
          else this.addBlock("wf-hero", this.consume(1));
          this.blocksMade++;
        }

        this.setLoading(false);
        this.isAppending = false;
      };

      const elapsed = performance.now() - start;
      setTimeout(doAppend, Math.max(0, minMs - elapsed));
    }

    bindControls(){
      if (this.goTopBtn){
        this.goTopBtn.addEventListener("click", () => {
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      }

      if (this.loadMoreBtn){
        this.loadMoreBtn.addEventListener("click", () => {
          const targetImages = Math.min(this.cursor + 20, this.picked.length);
          this.fillUntilImageCount(targetImages);

          if (this.loopWhenExhausted && this.cursor >= this.picked.length && this.picked.length) {
            this.resetWith(this.picked);
          }

          setTimeout(() => window.scrollBy({ top: 400, behavior: "smooth" }), 80);
        });
      }
    }
  }

  /* =========================================================
     TAB 2 MODAL (insert feedback)
  ========================================================= */
  function makeFeedbackModal(prefix){
    const modal = $(`#${prefix}-wf-modal`);
    const modalBackdrop = $(`#${prefix}-wf-modal-backdrop`);
    const modalClose = $(`#${prefix}-wf-modal-close`);
    const modalImg = $(`#${prefix}-wf-modal-img`);
    const form = $(`#${prefix}-wf-modal-form`);
    const nameEl = $(`#${prefix}-wf-name`);
    const feelEl = $(`#${prefix}-wf-feel`);
    const submitBtn = $(`#${prefix}-wf-submit`);
    const statusEl = $(`#${prefix}-wf-status`);

    let currentImageUrl = null;

    function openModalFor(url){
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

    function closeModal(){
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      currentImageUrl = null;
      document.documentElement.style.setProperty("--kbdShift", "0px");
    }

    // keyboard safe modal (mobile)
    (function setupKeyboardSafeModal(){
      if (!window.visualViewport) return;
      function update(){
        if (!modal.classList.contains("is-open")) return;
        const vv = window.visualViewport;
        const lost = window.innerHeight - vv.height - vv.offsetTop;
        const shift = lost > 0 ? Math.min(220, Math.round(lost * 0.85)) : 0;
        document.documentElement.style.setProperty("--kbdShift", shift ? `-${shift}px` : "0px");
      }
      window.visualViewport.addEventListener("resize", update);
      window.visualViewport.addEventListener("scroll", update);
      window.addEventListener("resize", update);
    })();

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

      if (!feeling){
        statusEl.textContent = "Please write a few words.";
        return;
      }

      const supa = getSupa();
      if (!supa){
        statusEl.textContent = "Supabase not ready.";
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

      try{
        const { error } = await supa.from(TABLE).insert([payload]);
        if (error) throw error;
        statusEl.textContent = "Saved. Thank you!";
        ensureSharedStore();
        window.UNTRAINABLE.needsRefreshT3 = true;
        setTimeout(closeModal, 650);
      } catch(err){
        console.warn("Supabase insert failed:", err);
        statusEl.textContent = "Could not save right now. Please try again.";
      } finally{
        submitBtn.disabled = false;
      }
    });

    return { openModalFor, closeModal };
  }

  /* =========================================================
     TAB 1 MODULE
  ========================================================= */
  const Tab1 = (() => {
    let inited = false;

    async function init(){
      if (inited) return;
      inited = true;

      // theme
      const btn = $("#theme-toggle");
      if (btn) btn.addEventListener("click", () => setTheme(!document.body.classList.contains("dark-mode")));

      // photo wall
      const wall = $("#wf-wall-inner");
      const loading = $("#wf-loading");
      const sentinel = $("#wf-sentinel");
      const loadMoreBtn = $("#load-more");
      const goTopBtn = $("#go-to-top");

      if (!wall) return;

      const grid = new PhotoWall({
        wall, loading, sentinel, loadMoreBtn, goTopBtn,
        layouts: LAYOUTS,
        initialCount: 18,
        batchAppend: 6,
        loopWhenExhausted: true,
        enableComment: false
      });
      grid.bindControls();

      grid.setLoading(true);
      try{
        const images = await fetchImagesOnce(JSON_URL);
        grid.setLoading(false);
        grid.resetWith(images.length ? images : FALLBACK_IMAGES);
      } catch (e) {
        console.warn("Tab1 images failed; fallback:", e);
        grid.setLoading(false);
        grid.resetWith(FALLBACK_IMAGES);
      }
    }

    return { init };
  })();

  /* =========================================================
     TAB 2 MODULE
  ========================================================= */
  const Tab2 = (() => {
    let inited = false;
    let modalApi = null;

    async function init(){
      if (inited) return;
      inited = true;

      const btn = $("#t2-theme-toggle");
      if (btn) btn.addEventListener("click", () => setTheme(!document.body.classList.contains("dark-mode")));

      modalApi = makeFeedbackModal("t2");

      const wall = $("#t2-wf-wall-inner");
      const loading = $("#t2-wf-loading");
      const sentinel = $("#t2-wf-sentinel");
      const loadMoreBtn = $("#t2-load-more");
      const goTopBtn = $("#t2-go-to-top");

      if (!wall) return;

      const grid = new PhotoWall({
        wall, loading, sentinel, loadMoreBtn, goTopBtn,
        layouts: LAYOUTS,
        initialCount: 18,
        batchAppend: 6,
        loopWhenExhausted: true,
        enableComment: true,
        onCommentClick: (url) => modalApi.openModalFor(url),
        commentText: "💭 Share your feeling"
      });
      grid.bindControls();

      grid.setLoading(true);

      // reuse shared images first
      try{
        const images = await fetchImagesOnce(JSON_URL);
        grid.setLoading(false);
        grid.resetWith(images.length ? images : FALLBACK_IMAGES);
      } catch (e) {
        console.warn("Tab2 images failed; fallback:", e);
        ensureSharedStore();
        window.UNTRAINABLE.images = FALLBACK_IMAGES;
        grid.setLoading(false);
        grid.resetWith(FALLBACK_IMAGES);
      }
    }

    return { init };
  })();

  /* =========================================================
     TAB 3 MODULE (load on activation; listeners once)
  ========================================================= */
  const Tab3 = (() => {
    let inited = false;

    const PASTELS = ["#f7f2ea","#f3f0ea","#f2f4ff","#f4f7f2","#f8f1f6","#f6f3ff","#f5f6f7","#f3efe8"];
    const rand = (min,max)=> min + Math.random()*(max-min);

    let feed, status;

    // Modal refs
    let modal, modalBackdrop, modalClose, modalImg, form, nameEl, feelEl, submitBtn, statusEl;
    let currentImageUrl = null;

    function openModalFor(url){
      currentImageUrl = url;
      modalImg.src = url;
      statusEl.textContent = "";
      nameEl.value = "";
      feelEl.value = "";
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      setTimeout(() => feelEl.focus(), 0);
    }

    function closeModal(){
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      currentImageUrl = null;
      document.documentElement.style.setProperty("--kbdShift", "0px");
    }

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

    async function load(){
      if (!feed || !status) return;

      const supa = getSupa();
      if (!supa){
        status.textContent = "Supabase not ready.";
        return;
      }

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

      const groups = groupByImage(data);
      status.textContent = `Loaded ${data.length} responses across ${groups.length} photographs.`;

      groups.forEach(([url, items]) => feed.appendChild(renderGroup(url, items)));

      ensureSharedStore();
      window.UNTRAINABLE.needsRefreshT3 = false;
    }

    async function init(){
      if (inited) return;
      inited = true;

      // theme
      const themeBtn = $("#rp3-theme-btn");
      if (themeBtn) themeBtn.addEventListener("click", () => setTheme(!document.body.classList.contains("dark-mode")));

      feed = $("#rp3-feed");
      status = $("#rp3-status");

      // modal refs
      modal = $("#rp3-wf-modal");
      modalBackdrop = $("#rp3-wf-modal-backdrop");
      modalClose = $("#rp3-wf-modal-close");
      modalImg = $("#rp3-wf-modal-img");
      form = $("#rp3-wf-modal-form");
      nameEl = $("#rp3-wf-name");
      feelEl = $("#rp3-wf-feel");
      submitBtn = $("#rp3-wf-submit");
      statusEl = $("#rp3-wf-status");

      modalBackdrop.addEventListener("click", closeModal);
      modalClose.addEventListener("click", closeModal);
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
      });

      // keyboard safe modal
      if (window.visualViewport){
        const update = () => {
          if (!modal.classList.contains("is-open")) return;
          const vv = window.visualViewport;
          const lost = window.innerHeight - vv.height - vv.offsetTop;
          const shift = lost > 0 ? Math.min(220, Math.round(lost * 0.85)) : 0;
          document.documentElement.style.setProperty("--kbdShift", shift ? `-${shift}px` : "0px");
        };
        window.visualViewport.addEventListener("resize", update);
        window.visualViewport.addEventListener("scroll", update);
        window.addEventListener("resize", update);
      }

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!currentImageUrl) return;

        const feeling = (feelEl.value || "").trim();
        const name = (nameEl.value || "").trim();

        if (!feeling){
          statusEl.textContent = "Please write a few words.";
          return;
        }

        const supa = getSupa();
        if (!supa){
          statusEl.textContent = "Supabase not ready.";
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

        try{
          const { error } = await supa.from(TABLE).insert([payload]);
          if (error) throw error;
          statusEl.textContent = "Saved. Thank you!";
          ensureSharedStore();
          window.UNTRAINABLE.needsRefreshT3 = true;
          setTimeout(closeModal, 650);
        } catch(err){
          console.warn("Supabase insert failed:", err);
          statusEl.textContent = "Could not save right now. Please try again.";
        } finally{
          submitBtn.disabled = false;
        }
      });
    }

    async function refresh(){
      await init();
      await load();
    }

    return { init, refresh };
  })();

  /* =========================================================
     TAB 4 MODULE (your working visualization, scoped + lazy init)
  ========================================================= */
  const Tab4 = (() => {
    let inited = false;

    function keyFromUrl(url){
      try{ return btoa(unescape(encodeURIComponent(String(url)))); }
      catch(e){ return String(url).replace(/[^a-z0-9]/gi,"_"); }
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

    async function init(){
      if (inited) return;

      const panel = $('#um-root .um-panel[data-panel="t4"]');
      const ROOT = $("#um4-root");
      const stage = $("#um4-stage");
      const notesLayer = $("#um4-notes");

      if (!panel || !ROOT || !stage || !notesLayer) return;
      if (!panel.classList.contains("is-active")) return;
      if (!isVisible(ROOT)) return;

      // Wait a couple frames so layout is real (Webflow tab reveal)
      await nextFrame();
      await nextFrame();

      if (stage.clientWidth < 50 || stage.clientHeight < 50) return;

      inited = true;

      const supa = getSupa();
      if (!supa) return;

      const { data, error } = await supa
        .from(TABLE)
        .select("image_url,feeling_text,name,created_at")
        .order("created_at", { ascending: false })
        .limit(6000);

      if (error) { console.warn(error); return; }

      // group by image
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

      function radiusForRank(rank, count){
        const r = (count / maxCount);
        if (rank === 0) return Math.round(170 + r * 80);
        if (rank <= 2)  return Math.round(130 + r * 55);
        if (rank <= 6)  return Math.round(105 + r * 45);
        return Math.round(88 + r * 35);
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
              note.style.top = ry + "px";
              note.dataset.ox = String(rx - cx);
              note.dataset.oy = String(ry - cy);

              placed.push({ x: rx, y: ry, w: dims.w, h: dims.h });
              placedOk = true;
              break;
            }
          }

          if (!placedOk){
            note.remove();
            return;
          }

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
          el: node,
          item,
          rank,
          size,
          key: keyFromUrl(item.url),

          x, y,
          ax, ay,
          vx: 0,
          vy: 0,

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

        const showNotes = () => {
          s.showing = true;
          setActive(s);
          renderNotesOnce(s);
        };
        const hideNotes = () => {
          s.showing = false;
          clearNotesForKey(s.key);
        };

        node.addEventListener("mouseenter", showNotes);
        node.addEventListener("mouseleave", hideNotes);
        node.addEventListener("click", (e) => { e.stopPropagation(); showNotes(); });

        return s;
      }

      const sizes = items.map((it, idx) => radiusForRank(idx, it.count) * 2);
      const centers = seedNonOverlappingCenters(sizes);

      items.forEach((it, idx) => states.push(createNode(it, idx, centers[idx])));

      for (const s of states){
        s.el.style.left = s.x + "px";
        s.el.style.top = s.y + "px";
      }

      document.addEventListener("click", () => {
        for (const s of states){
          if (s.showing){
            s.showing = false;
            clearNotesForKey(s.key);
          }
        }
      });

      function solveCollisions(dtScale){
        const n = states.length;
        for (let i = 0; i < n; i++){
          for (let j = i + 1; j < n; j++){
            const a = states[i], b = states[j];

            const ax = a.x + a.size/2, ay = a.y + a.size/2;
            const bx = b.x + b.size/2, by = b.y + b.size/2;

            const dx = bx - ax;
            const dy = by - ay;
            const dist = Math.hypot(dx, dy) || 0.0001;

            const minDist = ((a.size/2) + (b.size/2)) * 0.985;
            if (dist >= minDist) continue;

            const overlap = (minDist - dist);
            const nx = dx / dist;
            const ny = dy / dist;

            const wa = 1 / Math.max(1, a.size);
            const wb = 1 / Math.max(1, b.size);
            const sum = wa + wb;

            const pushA = (overlap * (wa / sum)) * 0.62;
            const pushB = (overlap * (wb / sum)) * 0.62;

            a.x -= nx * pushA;
            a.y -= ny * pushA;
            b.x += nx * pushB;
            b.y += ny * pushB;

            a.vx -= nx * 0.35 * dtScale;
            a.vy -= ny * 0.35 * dtScale;
            b.vx += nx * 0.35 * dtScale;
            b.vy += ny * 0.35 * dtScale;
          }
        }
      }

      let last = performance.now();
      function tick(now){
        const dt = Math.min(34, now - last);
        last = now;

        // If tab got hidden or stage is 0x0, don't update positions (prevents breakage)
        if (!panel.classList.contains("is-active") || stage.clientWidth < 50 || stage.clientHeight < 50){
          requestAnimationFrame(tick);
          return;
        }

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

          const scale = (dt / 16.67);
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
          s.el.style.top = s.y + "px";
        }

        if (activeState && activeState.showing){
          updateActiveNotesPosition(activeState);
        }

        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);

      let rto = null;
      window.addEventListener("resize", () => {
        if (!panel.classList.contains("is-active")) return;
        clearTimeout(rto);
        rto = setTimeout(() => {
          if (stage.clientWidth < 50 || stage.clientHeight < 50) return;

          const sizes2 = items.map((it, idx) => radiusForRank(idx, it.count) * 2);
          const centers2 = seedNonOverlappingCenters(sizes2);

          for (let i = 0; i < states.length; i++){
            const s = states[i];
            s.ax = centers2[i].x;
            s.ay = centers2[i].y;
          }

          if (activeState && activeState.showing){
            renderNotesOnce(activeState);
          }
        }, 140);
      });
    }

    return { init };
  })();

  /* =========================================================
     TAB SWITCHING (calls modules in correct sequence)
  ========================================================= */
  function setupTabs(){
    const root = $("#um-root");
    if (!root) return;

    const tabs = $$(".um-tab", root);
    const panels = $$(".um-panel", root);

    function activate(tabId){
      tabs.forEach(t => {
        const on = t.dataset.tab === tabId;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });

      panels.forEach(p => p.classList.toggle("is-active", p.dataset.panel === tabId));

      try { localStorage.setItem("um-active-tab", tabId); } catch(e){}

      // init / refresh logic
      if (tabId === "t1") Tab1.init();
      if (tabId === "t2") Tab2.init();
      if (tabId === "t3") {
        // refresh if needed (e.g. after a new insert)
        ensureSharedStore();
        if (!Tab3) return;
        Tab3.refresh();
      }
      if (tabId === "t4") Tab4.init();
    }

    tabs.forEach(t => t.addEventListener("click", () => activate(t.dataset.tab)));

    let start = "t1";
    try { start = localStorage.getItem("um-active-tab") || "t1"; } catch(e){}
    activate(start);
  }

  /* =========================================================
     BOOT
  ========================================================= */
  ensureSharedStore();
  applyThemeFromStorage();
  setupTabs();

  // Also keep theme buttons synced if tab changes while dark-mode exists
  const mo = new MutationObserver(() => syncThemeButtons());
  mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
})();
