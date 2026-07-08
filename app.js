/* ==========================================================================
   MAGANTi — JavaScript Logic & State Management
   ========================================================================== */

// ==========================================================================
// SUPABASE CONFIG
// ==========================================================================
const SUPABASE_URL     = "https://kfflzhlpgnsozvufsmtt.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmZmx6aGxwZ25zb3p2dWZzbXR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MDc1MDIsImV4cCI6MjA5NzI4MzUwMn0.mNknwuJ9VoV6Ok4FHjlsN7k_P9o28GpmxgAzuFC8CIA";

// ==========================================================================
// STATE
// ==========================================================================
let WATCHES_DATA = [];

let cart = [];
try { cart = JSON.parse(localStorage.getItem("maganti_cart")) || []; } catch(e) { cart = []; }

let activeFilters = {
  search:   "",
  brands:   [],
  maxPrice: 5000,
  category: "all"
};
let currentSort = "featured";
let heroCanvasAnimId = null;

// Auto-slide state
let autoSlideInterval  = null;
let currentSlideIndex  = 0;
let currentWatchSlides = [];
const AUTO_SLIDE_DELAY = 4000;

// Lightbox state
let lightboxSlides = [];
let lightboxIndex  = 0;

// DOM refs
let mainHomeSection, mainStoreSection, mainDetailsSection, productsGrid,
    resultsCount, searchInput, priceSlider, priceVal, sortSelect,
    cartOverlay, cartItemsList, cartTotalVal, cartSubtotalVal,
    headerCartCounts, clearFiltersBtn, checkoutModal, successModal,
    toastContainer, lightbox, lightboxImg, lightboxVideo,
    lightboxCurrent, lightboxTotal;

/* ==========================================================================
   SUPABASE — Watches
   ========================================================================== */
async function loadWatchesFromSupabase() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/watches?select=*&order=created_at.asc`,
      {
        headers: {
          "apikey":        SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type":  "application/json"
        }
      }
    );
    if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
    const rows = await res.json();

    WATCHES_DATA = rows.map(r => ({
      id:              r.id,
      name:            r.name,
      brand:           r.brand,
      price:           r.price,
      category:        r.category,
      movement:        r.movement,
      caseMaterial:    r.case_material,
      waterResistance: r.water_resistance,
      powerReserve:    r.power_reserve,
      diameter:        r.diameter,
      inStock:         r.in_stock,
      badge:           r.badge,
      description:     r.description || "",
      images:          r.images || [],
      videoUrl:        r.video_url
    }));
  } catch (err) {
    console.error("Watches load error:", err);
    WATCHES_DATA = [];
    showToast("Erreur de chargement des données.");
  }
}

/* ==========================================================================
   SUPABASE — Agent Location
   ========================================================================== */
async function loadAgentLocation() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/localisation?id=eq.1&select=localisation`,
      {
        headers: {
          "apikey":        SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type":  "application/json"
        }
      }
    );
    if (!res.ok) throw new Error();
    const rows = await res.json();
    const city = rows[0]?.localisation || "—";

    const el1 = document.getElementById("location-city");
    const el2 = document.getElementById("location-city-2");
    if (el1) el1.textContent = city;
    if (el2) el2.textContent = city;
  } catch {
    const el1 = document.getElementById("location-city");
    const el2 = document.getElementById("location-city-2");
    if (el1) el1.textContent = "—";
    if (el2) el2.textContent = "—";
  }
}

/* ==========================================================================
   ROUTING
   ========================================================================== */
function handleRouting() {
  const hash = window.location.hash || "#/home";
  document.querySelectorAll("nav ul li").forEach(li => li.classList.remove("active"));

  if (hash === "#/home") {
    showSection(mainHomeSection);
    document.querySelector('nav ul li a[href="#/home"]')?.parentElement.classList.add("active");
    window.scrollTo({ top: 0, behavior: "instant" });

  } else if (hash === "#/store") {
    showSection(mainStoreSection);
    document.querySelector('nav ul li a[href="#/store"]')?.parentElement.classList.add("active");
    renderStore();
    window.scrollTo({ top: 0, behavior: "instant" });

  } else if (hash.startsWith("#/watch/")) {
    const watchId = hash.split("/")[2];
    const watch   = WATCHES_DATA.find(w => w.id === watchId);
    if (watch) {
      showSection(mainDetailsSection);
      renderDetails(watch);
    } else {
      window.location.hash = "#/store";
    }
    window.scrollTo({ top: 0, behavior: "instant" });

  } else if (hash === "#/contact") {
    showSection(mainHomeSection);
    document.querySelector('nav ul li a[href="#/contact"]')?.parentElement.classList.add("active");
    // Scroll to contact anchor after section is shown
    setTimeout(() => {
      const anchor = document.getElementById("contact-anchor");
      if (anchor) anchor.scrollIntoView({ behavior: "smooth" });
    }, 150);

  } else {
    window.location.hash = "#/home";
    window.scrollTo({ top: 0, behavior: "instant" });
  }
}

function showSection(activeSection) {
  document.querySelectorAll(".page-section").forEach(sec => sec.classList.remove("active"));
  if (activeSection) activeSection.classList.add("active");
  if (activeSection !== mainDetailsSection) stopAutoSlide();
}

/* ==========================================================================
   INIT
   ========================================================================== */
window.addEventListener("DOMContentLoaded", async () => {
  mainHomeSection    = document.getElementById("home-section");
  mainStoreSection   = document.getElementById("store-section");
  mainDetailsSection = document.getElementById("details-section");
  productsGrid       = document.getElementById("products-grid");
  resultsCount       = document.getElementById("results-count");
  searchInput        = document.getElementById("search-input");
  priceSlider        = document.getElementById("price-slider");
  priceVal           = document.getElementById("price-val");
  sortSelect         = document.getElementById("sort-select");
  cartOverlay        = document.getElementById("cart-overlay");
  cartItemsList      = document.getElementById("cart-items-list");
  cartTotalVal       = document.getElementById("cart-total-val");
  cartSubtotalVal    = document.getElementById("cart-subtotal-val");
  headerCartCounts   = document.querySelectorAll(".cart-count");
  clearFiltersBtn    = document.getElementById("clear-filters-btn");
  checkoutModal      = document.getElementById("checkout-modal");
  successModal       = document.getElementById("success-modal");
  toastContainer     = document.getElementById("toast-container");
  lightbox           = document.getElementById("lightbox");
  lightboxImg        = document.getElementById("lightbox-img");
  lightboxVideo      = document.getElementById("lightbox-video");
  lightboxCurrent    = document.getElementById("lightbox-current");
  lightboxTotal      = document.getElementById("lightbox-total");

  initHeroCanvas();
  setupEventListeners();
  setupLightbox();
  updateCartUI();

  // Load data from Supabase
  await loadWatchesFromSupabase();
  loadAgentLocation();

  handleRouting();
});

window.addEventListener("hashchange", handleRouting);

window.addEventListener("scroll", () => {
  const header = document.querySelector("header");
  if (header) header.classList.toggle("scrolled", window.scrollY > 50);
});

/* ==========================================================================
   EVENT LISTENERS
   ========================================================================== */
function setupEventListeners() {

  // Search
  searchInput?.addEventListener("input", e => {
    activeFilters.search = e.target.value.trim().toLowerCase();
    renderStore();
  });

  // Brand checkboxes
  document.querySelectorAll(".brand-filter-cb").forEach(cb => {
    cb.addEventListener("change", e => {
      const brand = e.target.value;
      if (e.target.checked) {
        if (!activeFilters.brands.includes(brand)) activeFilters.brands.push(brand);
      } else {
        activeFilters.brands = activeFilters.brands.filter(b => b !== brand);
      }
      renderStore();
    });
  });

  // Price slider
  priceSlider?.addEventListener("input", e => {
    const val = parseInt(e.target.value);
    activeFilters.maxPrice = val;
    if (priceVal) priceVal.textContent = `${val.toLocaleString()} MAD`;
    renderStore();
  });

  // Sort
  sortSelect?.addEventListener("change", e => {
    currentSort = e.target.value;
    renderStore();
  });

  // Category buttons
  document.querySelectorAll(".cat-filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".cat-filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeFilters.category = btn.getAttribute("data-category");
      renderStore();
    });
  });

  // Clear filters
  clearFiltersBtn?.addEventListener("click", () => {
    activeFilters.search   = "";
    activeFilters.brands   = [];
    activeFilters.maxPrice = 5000;
    activeFilters.category = "all";
    if (searchInput) searchInput.value = "";
    if (priceSlider) priceSlider.value = 5000;
    if (priceVal)    priceVal.textContent = "5 000 MAD";
    document.querySelectorAll(".brand-filter-cb").forEach(cb => cb.checked = false);
    document.querySelectorAll(".cat-filter-btn").forEach(b => {
      b.classList.toggle("active", b.getAttribute("data-category") === "all");
    });
    renderStore();
  });

  // Cart open
  document.querySelectorAll(".cart-trigger").forEach(el => {
    el.addEventListener("click", e => {
      e.preventDefault();
      cartOverlay.classList.add("open");
    });
  });

  // Cart close
  document.querySelector(".cart-close-btn")?.addEventListener("click", () => {
    cartOverlay.classList.remove("open");
  });
  cartOverlay?.addEventListener("click", e => {
    if (e.target === cartOverlay) cartOverlay.classList.remove("open");
  });

  // Cart checkout → open modal
  document.querySelector(".cart-checkout-btn")?.addEventListener("click", () => {
    if (cart.length === 0) { showToast("Your selection is empty"); return; }
    cartOverlay.classList.remove("open");
    if (checkoutModal) {
      delete checkoutModal.dataset.watchName;
      delete checkoutModal.dataset.mode;
      checkoutModal.classList.add("open");
    }
    setFormMode("order");
  });

  // Modal close buttons
  document.querySelectorAll(".modal-close-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      checkoutModal?.classList.remove("open");
      successModal?.classList.remove("open");
    });
  });
  document.querySelector(".modal-close-btn-static")?.addEventListener("click", () => {
    successModal?.classList.remove("open");
  });
  [checkoutModal, successModal].forEach(modal => {
    modal?.addEventListener("click", e => {
      if (e.target === modal) modal.classList.remove("open");
    });
  });

  // Form submit — WhatsApp
  document.getElementById("checkout-form")?.addEventListener("submit", e => {
    e.preventDefault();

    const nameVal    = document.getElementById("form-name")?.value.trim()    || "";
    const messageVal = document.getElementById("form-message")?.value.trim() || "";
    const watchName  = checkoutModal?.dataset.watchName || "";
    const mode       = checkoutModal?.dataset.mode || (watchName ? "inquiry" : "order");

    let msg;

    if (mode === "reserve") {
      // MODE RESERVE — montre en rupture de stock, réservation automatique
      msg = encodeURIComponent(
        `========= RESERVATION ========= \n\nHello Dear MAGANTi,\n\nI'm *${nameVal.toUpperCase()}* and I would like to *RESERVE* the following piece, currently out of stock : \n\n - *${watchName}* \n\nPlease *confirm my reservation* and notify me automatically once it's back in stock — no need for me to follow up.${messageVal ? `\n\nNote: *${messageVal}*` : ""}`
      );
    } else if (mode === "inquiry") {
      // MODE INQUIRY — depuis la page détail d'une montre (nom + message)
      msg = encodeURIComponent(
        `========= INQUIRY ========= \n\nHello Dear MAGANTi,\n\nI'm *${nameVal.toUpperCase()}* and asking for the : \n\n - *${watchName}* \n\n and my question is: *${messageVal}*`
      );
    } else {
      // MODE CART — confirmation de commande (nom + adresse)
      const watchList = cart.map(item =>
        `• ${item.brand} ${item.name} (x${item.quantity}) — ${(item.price * item.quantity).toLocaleString()} MAD`
      ).join("\n");
      msg = encodeURIComponent(
        `=========  ORDER  ========= \n\nHello Dear MAGANTi,\n\nI'm interested in :\n\n${watchList}\n\nCan we confirm the order ?\n\n- Name: *${nameVal.toUpperCase()}*\n- Address : *${messageVal.toUpperCase()}*`
      );
    }

    window.open(`https://wa.me/212666981560?text=${msg}`, "_blank");

    if (checkoutModal) { delete checkoutModal.dataset.watchName; delete checkoutModal.dataset.mode; }
    checkoutModal?.classList.remove("open");
    successModal?.classList.add("open");
    document.getElementById("checkout-form")?.reset();

    if (mode === "order") {
      cart = [];
      saveCart();
      updateCartUI();
    }
  });
}

/* ==========================================================================
   FORM MODE — adapte le libellé du 2e champ (Message / Adresse / Note)
   selon qu'il s'agit d'une inquiry, d'une commande ou d'une réservation
   ========================================================================== */
function setFormMode(mode) {
  const label = document.getElementById("form-message-label");
  const input = document.getElementById("form-message");
  const title = document.getElementById("modal-title-text");
  if (!label || !input) return;

  if (mode === "inquiry") {
    label.textContent = "Your Message";
    input.placeholder = "Type your question here...";
    input.required = true;
    if (title) title.textContent = "Send an Inquiry";
  } else if (mode === "reserve") {
    label.textContent = "Note (optional)";
    input.placeholder = "Any additional note...";
    input.required = false;
    if (title) title.textContent = "Reserve This Piece";
  } else {
    label.textContent = "Address";
    input.placeholder = "Please Fill Your Delivery Address...";
    input.required = true;
    if (title) title.textContent = "Secure Acquisition";
  }
}

/* ==========================================================================
   STORE RENDER
   ========================================================================== */
function renderStore() {
  if (!productsGrid) return;

  let filtered = WATCHES_DATA.filter(watch => {
    const matchesSearch = !activeFilters.search ||
      watch.name.toLowerCase().includes(activeFilters.search) ||
      watch.brand.toLowerCase().includes(activeFilters.search) ||
      (watch.description || "").toLowerCase().includes(activeFilters.search);
    const matchesBrand  = activeFilters.brands.length === 0 || activeFilters.brands.includes(watch.brand);
    const matchesPrice  = activeFilters.maxPrice === 5000 || watch.price <= activeFilters.maxPrice;
    const matchesCat    = activeFilters.category === "all" ||
      (watch.category || "").toLowerCase() === activeFilters.category.toLowerCase();
    return matchesSearch && matchesBrand && matchesPrice && matchesCat;
  });

  if (currentSort === "price-low")  filtered.sort((a, b) => a.price - b.price);
  else if (currentSort === "price-high") filtered.sort((a, b) => b.price - a.price);
  else if (currentSort === "brand-az")   filtered.sort((a, b) => a.brand.localeCompare(b.brand));
  else filtered.sort((a, b) => b.price - a.price);

  if (resultsCount) resultsCount.textContent = `${filtered.length} watch${filtered.length !== 1 ? "es" : ""} found`;

  if (filtered.length === 0) {
    productsGrid.innerHTML = `<div class="no-results">
      <i class="fas fa-search"></i>
      <p>No luxury pieces match your current selection.</p>
    </div>`;
    return;
  }

  productsGrid.innerHTML = filtered.map(watch => `
    <div class="watch-card">
      ${watch.badge ? `<span class="watch-card-badge">${watch.badge}</span>` : ""}
      <span class="stock-badge ${watch.inStock ? "in-stock" : "out-of-stock"}">${watch.inStock ? "En Stock" : "Rupture"}</span>
      <a href="#/watch/${watch.id}" class="watch-card-img-link">
        <img src="${watch.images[0]}" alt="${watch.brand} ${watch.name}" loading="lazy">
      </a>
      <div class="watch-card-info">
        <span class="watch-card-brand">${watch.brand}</span>
        <h3 class="watch-card-title" onclick="window.location.hash='#/watch/${watch.id}'">${watch.name}</h3>
        <div class="watch-card-meta">
          <span class="watch-card-price">${watch.price.toLocaleString()} MAD</span>
          ${watch.inStock
            ? `<button class="watch-card-btn" onclick="addToCart('${watch.id}')">+ INQUIRE</button>`
            : `<button class="watch-card-btn watch-card-btn-reserve" onclick="openReserveModal('${watch.id}')"><i class="fas fa-clock"></i> RESERVE</button>`
          }
        </div>
      </div>
    </div>
  `).join("");
}

/* ==========================================================================
   DETAILS PAGE — Carousel
   ========================================================================== */
function renderDetails(watch) {
  const detailsContainer = document.getElementById("details-container");
  if (!detailsContainer) return;

  stopAutoSlide();

  currentWatchSlides = [
    ...watch.images.map(img => ({ type: "image", src: img })),
    ...(watch.videoUrl ? [{ type: "video", src: watch.videoUrl, poster: watch.images[0] }] : [])
  ];
  currentSlideIndex = 0;

  const slidesHTML = currentWatchSlides.map((slide, idx) => {
    if (slide.type === "image") {
      return `<div class="slide ${idx === 0 ? "active" : ""}" data-index="${idx}" data-type="image">
        <img src="${slide.src}" alt="${watch.brand} ${watch.name}" />
      </div>`;
    } else {
      return `<div class="slide ${idx === 0 ? "active" : ""}" data-index="${idx}" data-type="video">
        <video src="${slide.src}" poster="${slide.poster}" loop muted playsinline></video>
        <div class="video-play-overlay">
          <div class="play-circle"><i class="fas fa-play"></i></div>
        </div>
      </div>`;
    }
  }).join("");

  const thumbsHTML = currentWatchSlides.map((slide, idx) => {
    if (slide.type === "image") {
      return `<div class="thumb-item active-indicator ${idx === 0 ? "active" : ""}" data-index="${idx}">
        <img src="${slide.src}" alt="Angle ${idx + 1}">
      </div>`;
    } else {
      return `<div class="thumb-item active-indicator" data-index="${idx}">
        <img src="${slide.poster}" alt="Video" style="filter:brightness(0.4);">
        <div class="thumb-video-icon"><i class="fas fa-play"></i></div>
      </div>`;
    }
  }).join("");

  detailsContainer.innerHTML = `
    <a href="#/store" class="back-to-store" onclick="stopAutoSlide()">
      <i class="fas fa-arrow-left"></i> Back to Showroom
    </a>
    <div class="details-grid">
      <div class="details-showcase">
        <div class="media-stage" id="media-stage">
          ${watch.badge ? `<span class="watch-card-badge">${watch.badge}</span>` : ""}
          ${slidesHTML}
          <div class="slide-counter">
            <span id="slide-current">1</span> / <span id="slide-total">${currentWatchSlides.length}</span>
          </div>
          <button class="slide-nav slide-prev" aria-label="Previous"><i class="fas fa-chevron-left"></i></button>
          <button class="slide-nav slide-next" aria-label="Next"><i class="fas fa-chevron-right"></i></button>
        </div>
        <div class="media-thumbnails">${thumbsHTML}</div>
      </div>
      <div class="details-info">
        <span class="details-brand">${watch.brand}</span>
        <h1 class="details-title">${watch.name}</h1>
        <div class="details-price">
          ${watch.price.toLocaleString()} MAD
          <span class="details-status ${watch.inStock ? "in-stock-detail" : "out-of-stock-detail"}">
            ${watch.inStock ? "En Stock" : "Rupture de stock"}
          </span>
        </div>
        <p class="details-desc">${watch.description}</p>
        <div class="details-actions">
          ${watch.inStock
            ? `<button class="btn-primary" onclick="addToCart('${watch.id}')">ADD TO SELECTION</button>`
            : `<button class="btn-primary btn-reserve" onclick="openReserveModal('${watch.id}')"><i class="fas fa-clock"></i> RESERVE</button>`
          }
          <button class="btn-outline" onclick="openContactModal('${watch.brand} ${watch.name}')">REQUEST INQUIRY</button>
        </div>
        <h3 class="specs-title">Technical Specifications</h3>
        <div class="specs-table">
          <div class="specs-row"><span class="specs-label">Reference</span><span class="specs-value">${watch.id.toUpperCase().substring(0,10)}</span></div>
          <div class="specs-row"><span class="specs-label">Brand</span><span class="specs-value">${watch.brand}</span></div>
          <div class="specs-row"><span class="specs-label">Collection</span><span class="specs-value">${watch.category} Collection</span></div>
          <div class="specs-row"><span class="specs-label">Movement</span><span class="specs-value">${watch.movement || "—"}</span></div>
          <div class="specs-row"><span class="specs-label">Case Material</span><span class="specs-value">${watch.caseMaterial || "—"}</span></div>
          <div class="specs-row"><span class="specs-label">Water Resistance</span><span class="specs-value">${watch.waterResistance || "—"}</span></div>
          <div class="specs-row"><span class="specs-label">Power Reserve</span><span class="specs-value">${watch.powerReserve || "—"}</span></div>
        </div>
      </div>
    </div>
  `;

  initCarouselEvents(watch);
  startAutoSlide();
}

/* ==========================================================================
   CAROUSEL
   ========================================================================== */
function initCarouselEvents(watch) {
  const stage = document.getElementById("media-stage");
  if (!stage) return;

  stage.addEventListener("click", e => {
    if (e.target.closest(".slide-nav")) return;
    const slide = e.target.closest(".slide");
    if (!slide) return;
    if (slide.dataset.type === "video" && !stage.classList.contains("playing")) return;
    openLightbox(currentWatchSlides, currentSlideIndex);
  });

  document.querySelectorAll(".thumb-item").forEach(thumb => {
    thumb.addEventListener("click", () => {
      goToSlide(parseInt(thumb.dataset.index));
      resetAutoSlide();
    });
  });

  stage.querySelector(".slide-prev")?.addEventListener("click", e => {
    e.stopPropagation(); prevSlide(); resetAutoSlide();
  });
  stage.querySelector(".slide-next")?.addEventListener("click", e => {
    e.stopPropagation(); nextSlide(); resetAutoSlide();
  });

  stage.addEventListener("mouseenter", stopAutoSlide);
  stage.addEventListener("mouseleave", () => {
    if (document.getElementById("media-stage")) startAutoSlide();
  });

  const videoOverlay = stage.querySelector(".video-play-overlay");
  const video = stage.querySelector("video");

  if (videoOverlay) {
    videoOverlay.addEventListener("click", e => {
      e.stopPropagation();
      if (video) {
        video.play().then(() => {
          stage.classList.add("playing");
          videoOverlay.style.display = "none";
        }).catch(() => {});
      }
    });
  }

  if (video) {
    video.addEventListener("click", e => {
      e.stopPropagation();
      video.pause();
      stage.classList.remove("playing");
      if (videoOverlay) videoOverlay.style.display = "flex";
    });
  }
}

function goToSlide(index) {
  const stage = document.getElementById("media-stage");
  if (!stage) return;

  const currentVideo = stage.querySelector("video");
  if (currentVideo) { currentVideo.pause(); currentVideo.currentTime = 0; }
  stage.classList.remove("playing");
  const overlay = stage.querySelector(".video-play-overlay");
  if (overlay) overlay.style.display = "flex";

  stage.querySelectorAll(".slide").forEach((s, i) => s.classList.toggle("active", i === index));
  document.querySelectorAll(".thumb-item").forEach((t, i) => t.classList.toggle("active", i === index));

  const counter = document.getElementById("slide-current");
  if (counter) counter.textContent = index + 1;
  currentSlideIndex = index;
}

function nextSlide() { goToSlide((currentSlideIndex + 1) % currentWatchSlides.length); }
function prevSlide() { goToSlide((currentSlideIndex - 1 + currentWatchSlides.length) % currentWatchSlides.length); }

function startAutoSlide() {
  stopAutoSlide();
  autoSlideInterval = setInterval(nextSlide, AUTO_SLIDE_DELAY);
}
function stopAutoSlide() {
  if (autoSlideInterval) { clearInterval(autoSlideInterval); autoSlideInterval = null; }
}
function resetAutoSlide() { stopAutoSlide(); startAutoSlide(); }

window.stopAutoSlide = stopAutoSlide;

/* ==========================================================================
   LIGHTBOX
   ========================================================================== */
function setupLightbox() {
  if (!lightbox) return;

  lightbox.querySelector(".lightbox-close")?.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", e => { if (e.target === lightbox) closeLightbox(); });
  lightbox.querySelector(".lightbox-prev")?.addEventListener("click", e => { e.stopPropagation(); lightboxPrev(); });
  lightbox.querySelector(".lightbox-next")?.addEventListener("click", e => { e.stopPropagation(); lightboxNext(); });

  document.addEventListener("keydown", e => {
    if (!lightbox.classList.contains("open")) return;
    if (e.key === "Escape")      closeLightbox();
    if (e.key === "ArrowLeft")   lightboxPrev();
    if (e.key === "ArrowRight")  lightboxNext();
  });

  let touchStartX = 0;
  lightbox.addEventListener("touchstart", e => { touchStartX = e.touches[0].clientX; });
  lightbox.addEventListener("touchend",   e => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) { if (diff > 0) lightboxNext(); else lightboxPrev(); }
  });
}

function openLightbox(slides, startIndex = 0) {
  lightboxSlides = slides;
  lightboxIndex  = startIndex;
  if (lightboxTotal) lightboxTotal.textContent = slides.length;
  updateLightboxContent();
  lightbox.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  if (!lightbox) return;
  lightbox.classList.remove("open");
  document.body.style.overflow = "";
  if (lightboxVideo) { lightboxVideo.pause(); lightboxVideo.src = ""; }
}

function lightboxNext() { lightboxIndex = (lightboxIndex + 1) % lightboxSlides.length; updateLightboxContent(); }
function lightboxPrev() { lightboxIndex = (lightboxIndex - 1 + lightboxSlides.length) % lightboxSlides.length; updateLightboxContent(); }

function updateLightboxContent() {
  if (!lightboxImg || !lightboxVideo || !lightboxCurrent) return;
  const slide = lightboxSlides[lightboxIndex];
  lightboxCurrent.textContent = lightboxIndex + 1;
  if (slide.type === "image") {
    lightboxImg.src = slide.src;
    lightboxImg.style.display = "block";
    lightboxVideo.style.display = "none";
    lightboxVideo.pause(); lightboxVideo.src = "";
  } else {
    lightboxImg.style.display = "none";
    lightboxVideo.style.display = "block";
    lightboxVideo.src = slide.src;
    lightboxVideo.play().catch(() => {});
  }
}

/* ==========================================================================
   CONTACT MODAL (REQUEST INQUIRY)
   ========================================================================== */
window.openContactModal = function(pieceName) {
  const modalText = document.getElementById("modal-subtitle");
  if (modalText) modalText.textContent = `Inquiry for: ${pieceName}`;
  if (checkoutModal) {
    checkoutModal.dataset.watchName = pieceName;
    checkoutModal.dataset.mode = "inquiry";
    checkoutModal.classList.add("open");
  }
  setFormMode("inquiry");
};

/* ==========================================================================
   RESERVE MODAL — montre en rupture de stock
   Envoie automatiquement un message de réservation au client par WhatsApp ;
   le client n'a pas besoin de revérifier le stock, il sera recontacté une
   fois la pièce confirmée disponible.
   ========================================================================== */
window.openReserveModal = function(watchId) {
  const watch = WATCHES_DATA.find(w => w.id === watchId);
  if (!watch) return;
  const pieceName = `${watch.brand} ${watch.name}`;
  const modalText = document.getElementById("modal-subtitle");
  if (modalText) modalText.textContent = `Reservation for: ${pieceName}`;
  if (checkoutModal) {
    checkoutModal.dataset.watchName = pieceName;
    checkoutModal.dataset.mode = "reserve";
    checkoutModal.classList.add("open");
  }
  setFormMode("reserve");
};

/* ==========================================================================
   CART
   ========================================================================== */
window.addToCart = function(watchId) {
  const watch = WATCHES_DATA.find(w => w.id === watchId);
  if (!watch) return;
  const existing = cart.find(item => item.id === watchId);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ id: watch.id, brand: watch.brand, name: watch.name, price: watch.price, image: watch.images[0], quantity: 1 });
  }
  saveCart();
  updateCartUI();
  showToast(`${watch.brand} ${watch.name} added to selection`);
  if (cartOverlay) cartOverlay.classList.add("open");
};

window.removeFromCart = function(watchId) {
  cart = cart.filter(item => item.id !== watchId);
  saveCart();
  updateCartUI();
};

window.updateQuantity = function(watchId, delta) {
  const item = cart.find(item => item.id === watchId);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) window.removeFromCart(watchId);
  else { saveCart(); updateCartUI(); }
};

function saveCart() {
  try { localStorage.setItem("maganti_cart", JSON.stringify(cart)); } catch(e) {}
}

function updateCartUI() {
  const totalItems = cart.reduce((acc, curr) => acc + curr.quantity, 0);
  headerCartCounts?.forEach(el => {
    el.textContent = totalItems;
    el.style.display = totalItems > 0 ? "flex" : "none";
  });

  if (!cartItemsList) return;

  if (cart.length === 0) {
    cartItemsList.innerHTML = `<div class="cart-empty-msg">
      <i class="fas fa-shopping-bag"></i>
      <p>No luxury pieces currently selected.</p>
    </div>`;
    if (cartSubtotalVal) cartSubtotalVal.textContent = "0 MAD";
    if (cartTotalVal)    cartTotalVal.textContent    = "0 MAD";
    return;
  }

  cartItemsList.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-img"><img src="${item.image}" alt="${item.name}"></div>
      <div class="cart-item-details">
        <span class="cart-item-brand">${item.brand}</span>
        <h4 class="cart-item-title">${item.name}</h4>
        <span class="cart-item-price">${(item.price * item.quantity).toLocaleString()} MAD</span>
        <div class="cart-item-actions">
          <div class="quantity-controller">
            <button class="quantity-btn" onclick="updateQuantity('${item.id}',-1)">−</button>
            <span class="quantity-val">${item.quantity}</span>
            <button class="quantity-btn" onclick="updateQuantity('${item.id}',1)">+</button>
          </div>
          <button class="remove-item-btn" onclick="removeFromCart('${item.id}')">Remove</button>
        </div>
      </div>
    </div>
  `).join("");

  const subtotal = cart.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
  if (cartSubtotalVal) cartSubtotalVal.textContent = `${subtotal.toLocaleString()} MAD`;
  if (cartTotalVal)    cartTotalVal.textContent    = `${subtotal.toLocaleString()} MAD`;
}

/* ==========================================================================
   TOAST
   ========================================================================== */
function showToast(message) {
  if (!toastContainer) return;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `
    <span class="toast-icon"><i class="fas fa-check"></i></span>
    <span class="toast-msg">${message}</span>
  `;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 50);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

/* ==========================================================================
   HERO CANVAS — MECHANICAL GEARS
   ========================================================================== */
function initHeroCanvas() {
  const heroCanvas = document.getElementById("hero-canvas");
  if (!heroCanvas) return;
  const ctx = heroCanvas.getContext("2d");
  let width  = heroCanvas.width  = window.innerWidth;
  let height = heroCanvas.height = window.innerHeight;

  window.addEventListener("resize", () => {
    width  = heroCanvas.width  = window.innerWidth;
    height = heroCanvas.height = window.innerHeight;
  });

  let angle = 0;

  function getGears() {
    return [
      { x: width * 0.5,       y: height * 0.5,      radius: 180, teeth: 32, speed: 0.002, dir:  1, color: "rgba(197,168,128,0.08)" },
      { x: width * 0.5 - 240, y: height * 0.5 + 80, radius:  90, teeth: 16, speed: 0.004, dir: -1, color: "rgba(255,255,255,0.03)" },
      { x: width * 0.5 + 240, y: height * 0.5 - 80, radius:  90, teeth: 16, speed: 0.004, dir: -1, color: "rgba(255,255,255,0.03)" }
    ];
  }

  function drawGear(gear, rotation) {
    ctx.save();
    ctx.translate(gear.x, gear.y);
    ctx.rotate(rotation);
    ctx.fillStyle   = gear.color;
    ctx.strokeStyle = "rgba(197,168,128,0.12)";
    ctx.lineWidth   = 1;

    ctx.beginPath();
    ctx.arc(0, 0, gear.radius - 12, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    for (let i = 0; i < 5; i++) {
      ctx.rotate((Math.PI * 2) / 5);
      ctx.beginPath();
      ctx.rect(-8, 0, 16, gear.radius - 15);
      ctx.fill(); ctx.stroke();
    }

    ctx.beginPath();
    for (let i = 0; i < gear.teeth; i++) {
      const ta = (Math.PI * 2) / gear.teeth * i;
      ctx.moveTo(Math.cos(ta) * (gear.radius - 12), Math.sin(ta) * (gear.radius - 12));
      ctx.lineTo(Math.cos(ta - 0.05) * gear.radius, Math.sin(ta - 0.05) * gear.radius);
      ctx.lineTo(Math.cos(ta + 0.05) * gear.radius, Math.sin(ta + 0.05) * gear.radius);
      ctx.closePath();
    }
    ctx.fill(); ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(5,5,5,1)";
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function loop() {
    ctx.clearRect(0, 0, width, height);
    angle += 0.005;
    getGears().forEach(gear => drawGear(gear, angle * gear.speed * 10 * gear.dir));
    heroCanvasAnimId = requestAnimationFrame(loop);
  }
  loop();
}

/* ==========================================================================
   HAMBURGER MENU
   ========================================================================== */
(function() {
  const hamburger = document.getElementById("hamburger-btn");
  const mobileNav = document.getElementById("mobile-nav");
  if (!hamburger || !mobileNav) return;

  hamburger.addEventListener("click", () => {
    hamburger.classList.toggle("open");
    mobileNav.classList.toggle("open");
  });

  mobileNav.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      hamburger.classList.remove("open");
      mobileNav.classList.remove("open");
    });
  });

  window.addEventListener("hashchange", () => {
    const hash = window.location.hash || "#/home";
    mobileNav.querySelectorAll("li").forEach(li => li.classList.remove("active"));
    if (hash === "#/home")    mobileNav.querySelectorAll("li")[0]?.classList.add("active");
    if (hash === "#/store")   mobileNav.querySelectorAll("li")[1]?.classList.add("active");
    if (hash === "#/contact") mobileNav.querySelectorAll("li")[2]?.classList.add("active");
  });
})();

/* ==========================================================================
   MOBILE FILTER TOGGLE
   ========================================================================== */
(function() {
  const toggleBtn   = document.getElementById("mobile-filter-toggle");
  const filtersBody = document.getElementById("filters-body");
  if (!toggleBtn || !filtersBody) return;

  toggleBtn.addEventListener("click", () => {
    const isOpen = filtersBody.classList.toggle("open");
    toggleBtn.classList.toggle("open", isOpen);
    toggleBtn.setAttribute("aria-expanded", isOpen);
  });

  function updateFilterBadge() {
    const badge = document.getElementById("filter-count-badge");
    if (!badge) return;
    const active =
      (activeFilters.search ? 1 : 0) +
      activeFilters.brands.length +
      (activeFilters.category !== "all" ? 1 : 0);
    if (active > 0) {
      badge.textContent = active;
      badge.classList.add("visible");
    } else {
      badge.classList.remove("visible");
    }
  }

  ["input", "change", "click"].forEach(evt => {
    filtersBody.addEventListener(evt, () => setTimeout(updateFilterBadge, 50));
  });
})();

/* ==========================================================================
   HERO HEIGHT FIX — Mobile 100dvh fallback
   ========================================================================== */
(function() {
  function fixHeroHeight() {
    const hero = document.querySelector(".hero");
    if (!hero) return;
    if (window.innerWidth <= 768) {
      hero.style.height = window.innerHeight + "px";
    } else {
      hero.style.height = "";
    }
  }
  fixHeroHeight();
  window.addEventListener("resize",     fixHeroHeight);
  window.addEventListener("hashchange", () => setTimeout(fixHeroHeight, 50));
})();
