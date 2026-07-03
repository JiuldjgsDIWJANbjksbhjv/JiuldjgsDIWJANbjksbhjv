/* ==========================================================================
MAGANTi - LUXURY WATCHES STORE
JavaScript Logic & State Management
========================================================================== */

// Watch Database
// ==========================================================================
// SUPABASE CONFIG
// Remplace ces deux valeurs par les tiennes :
//   Supabase Dashboard > Project Settings > API
// ==========================================================================
const SUPABASE_URL = "https://kfflzhlpgnsozvufsmtt.supabase.co";        // ex: https://xxxx.supabase.co
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmZmx6aGxwZ25zb3p2dWZzbXR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MDc1MDIsImV4cCI6MjA5NzI4MzUwMn0.mNknwuJ9VoV6Ok4FHjlsN7k_P9o28GpmxgAzuFC8CIA"; // clé publique anon

// Cache local des montres (rempli au chargement)
let WATCHES_DATA = [];
// App State
let cart = [];
try { cart = JSON.parse(localStorage.getItem("maganti_cart")) || []; } catch(e) { cart = []; }

let activeFilters = {
  search: "",
  brands: [],
  maxPrice: 250000,
  category: "all"
};
let currentSort = "featured";
let heroCanvasAnimId = null;

// Auto-slide state
let autoSlideInterval = null;
let currentSlideIndex = 0;
let currentWatchSlides = [];
const AUTO_SLIDE_DELAY = 4000; // 4 secondes

// Lightbox state
let lightboxSlides = [];
let lightboxIndex = 0;

// DOM Selectors
let mainHomeSection, mainStoreSection, mainDetailsSection, productsGrid,
    resultsCount, searchInput, priceSlider, priceVal, sortSelect,
    cartOverlay, cartItemsList, cartTotalVal, cartSubtotalVal,
    headerCartCounts, clearFiltersBtn, checkoutModal, successModal, toastContainer,
    lightbox, lightboxImg, lightboxVideo, lightboxCurrent, lightboxTotal;

/* ==========================================================================
ROUTING
========================================================================== */
function handleRouting() {
  const hash = window.location.hash || "#/home";
  document.querySelectorAll("nav ul li").forEach(li => li.classList.remove("active"));

  if (hash === "#/home") {
    showSection(mainHomeSection);
    document.querySelector('nav ul li a[href="#/home"]')?.parentElement.classList.add("active");
  } else if (hash === "#/store") {
    showSection(mainStoreSection);
    document.querySelector('nav ul li a[href="#/store"]')?.parentElement.classList.add("active");
    renderStore();
  } else if (hash.startsWith("#/watch/")) {
    const watchId = hash.split("/")[2];
    const watch = WATCHES_DATA.find(w => w.id === watchId);
    if (watch) {
      showSection(mainDetailsSection);
      renderDetails(watch);
    } else {
      window.location.hash = "#/store";
    }
  } else {
    window.location.hash = "#/home";
  }
  window.scrollTo({ top: 0, behavior: "instant" });
}

function showSection(activeSection) {
  document.querySelectorAll(".page-section").forEach(sec => sec.classList.remove("active"));
  if (activeSection) activeSection.classList.add("active");
  // Stop auto-slide si on quitte la page détails
  if (activeSection !== mainDetailsSection) {
    stopAutoSlide();
  }
}

/* ==========================================================================
INIT
========================================================================== */
/* ==========================================================================
SUPABASE — Chargement des montres
========================================================================== */
async function loadWatchesFromSupabase() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/watches?select=*&order=created_at.asc`,
      {
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
    const rows = await res.json();

    // Normaliser les champs snake_case → camelCase pour compatibilité avec le reste du code
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
    console.error("Impossible de charger les montres depuis Supabase :", err);
    // Fallback : tableau vide, l'UI affiche "No results"
    WATCHES_DATA = [];
    showToast("Erreur de chargement des données.");
  }
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

  // Charger les montres AVANT de router
  await loadWatchesFromSupabase();
  handleRouting();
});

window.addEventListener("hashchange", handleRouting);

// Header scroll effect
window.addEventListener("scroll", () => {
  const header = document.querySelector("header");
  if (!header) return;
  header.classList.toggle("scrolled", window.scrollY > 50);
});

/* ==========================================================================
EVENT LISTENERS
========================================================================== */
function setupEventListeners() {
  searchInput?.addEventListener("input", (e) => {
    activeFilters.search = e.target.value.trim().toLowerCase();
    renderStore();
  });

  document.querySelectorAll(".brand-filter-cb").forEach(cb => {
    cb.addEventListener("change", (e) => {
      const brand = e.target.value;
      if (e.target.checked) {
        if (!activeFilters.brands.includes(brand)) activeFilters.brands.push(brand);
      } else {
        activeFilters.brands = activeFilters.brands.filter(b => b !== brand);
      }
      renderStore();
    });
  });

  priceSlider?.addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
    activeFilters.maxPrice = val;
    if (priceVal) priceVal.textContent = `${val.toLocaleString()} MAD`;
    renderStore();
  });

  sortSelect?.addEventListener("change", (e) => {
    currentSort = e.target.value;
    renderStore();
  });

  document.querySelectorAll(".cat-filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".cat-filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeFilters.category = btn.getAttribute("data-category");
      renderStore();
    });
  });

clearFiltersBtn?.addEventListener("click", () => {
  activeFilters.search = "";
  activeFilters.brands = [];
  activeFilters.maxPrice = 5000;
  activeFilters.category = "all";
  if (searchInput) searchInput.value = " ";
  if (priceSlider) priceSlider.value = 5000;
  if (priceVal) priceVal.textContent = "5000 MAD";
  document.querySelectorAll(".brand-filter-cb").forEach(cb => cb.checked = false);
  document.querySelectorAll(".cat-filter-btn").forEach(b => {
    b.classList.toggle("active", b.getAttribute("data-category") === "all");
  });
  renderStore();
});

  document.querySelectorAll(".cart-trigger").forEach(el => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      cartOverlay.classList.add("open");
    });
  });

  document.querySelector(".cart-close-btn")?.addEventListener("click", () => {
    cartOverlay.classList.remove("open");
  });

  cartOverlay?.addEventListener("click", (e) => {
    if (e.target === cartOverlay) cartOverlay.classList.remove("open");
  });

  document.querySelector(".cart-checkout-btn")?.addEventListener("click", () => {
    if (cart.length === 0) { showToast("Your selection is empty"); return; }
    cartOverlay.classList.remove("open");
    checkoutModal.classList.add("open");
  });

  document.querySelectorAll(".modal-close-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      checkoutModal.classList.remove("open");
      successModal.classList.remove("open");
    });
  });

  document.querySelector(".modal-close-btn-static")?.addEventListener("click", () => {
    successModal.classList.remove("open");
  });

  [checkoutModal, successModal].forEach(modal => {
    modal?.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.remove("open");
    });
  });

  document.getElementById("checkout-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    checkoutModal.classList.remove("open");
    successModal.classList.add("open");
    cart = [];
    saveCart();
    updateCartUI();
  });
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
      watch.description.toLowerCase().includes(activeFilters.search);
    const matchesBrand = activeFilters.brands.length === 0 || activeFilters.brands.includes(watch.brand);
    const matchesPrice = watch.price <= activeFilters.maxPrice;
    const matchesCat = activeFilters.category === "all" ||
      watch.category.toLowerCase() === activeFilters.category.toLowerCase();
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
      ${watch.badge ? `<span class="watch-card-badge">${watch.badge}</span>` : ''}
      <span class="stock-badge ${watch.inStock ? 'in-stock' : 'out-of-stock'}">${watch.inStock ? 'En Stock' : 'Rupture'}</span>
      <a href="#/watch/${watch.id}" class="watch-card-img-link">
        <img src="${watch.images[0]}" alt="${watch.brand} ${watch.name}" loading="lazy">
      </a>
      <div class="watch-card-info">
        <span class="watch-card-brand">${watch.brand}</span>
        <h3 class="watch-card-title" onclick="window.location.hash='#/watch/${watch.id}'">${watch.name}</h3>
        <div class="watch-card-meta">
          <span class="watch-card-price">${watch.price.toLocaleString()} MAD</span>
          <button class="watch-card-btn" onclick="addToCart('${watch.id}')">+ INQUIRE</button>
        </div>
      </div>
    </div>
  `).join('');
}

/* ==========================================================================
PRODUCT DETAILS — avec carrousel auto + bouton Back
========================================================================== */
function renderDetails(watch) {
  const detailsContainer = document.getElementById("details-container");
  if (!detailsContainer) return;

  // Stop auto-slide précédent s'il existe
  stopAutoSlide();

  // Construire la liste des slides : images + vidéo
  currentWatchSlides = [
    ...watch.images.map(img => ({ type: 'image', src: img })),
    { type: 'video', src: watch.videoUrl, poster: watch.images[0] }
  ];
  currentSlideIndex = 0;

  // Générer les slides HTML
  const slidesHTML = currentWatchSlides.map((slide, idx) => {
    if (slide.type === 'image') {
      return `<div class="slide ${idx === 0 ? 'active' : ''}" data-index="${idx}" data-type="image">
        <img src="${slide.src}" alt="${watch.brand} ${watch.name}" />
      </div>`;
    } else {
      return `<div class="slide ${idx === 0 ? 'active' : ''}" data-index="${idx}" data-type="video">
        <video src="${slide.src}" poster="${slide.poster}" loop muted playsinline></video>
        <div class="video-play-overlay">
          <div class="play-circle">
            <i class="fas fa-play"></i>
          </div>
        </div>
      </div>`;
    }
  }).join('');

  // Générer les dots
  const dotsHTML = currentWatchSlides.map((_, idx) =>
    `<button class="slide-dot ${idx === 0 ? 'active' : ''}" data-index="${idx}" aria-label="Slide ${idx + 1}"></button>`
  ).join('');

  // Générer les thumbnails
  const thumbsHTML = currentWatchSlides.map((slide, idx) => {
    if (slide.type === 'image') {
      return `<div class="thumb-item active-indicator ${idx === 0 ? 'active' : ''}" data-index="${idx}">
        <img src="${slide.src}" alt="Angle ${idx + 1}">
      </div>`;
    } else {
      return `<div class="thumb-item active-indicator ${idx === 0 ? 'active' : ''}" data-index="${idx}">
        <img src="${slide.poster}" alt="Watch Video" style="filter:brightness(0.4);">
        <div class="thumb-video-icon"><i class="fas fa-play"></i></div>
      </div>`;
    }
  }).join('');

  detailsContainer.innerHTML = `
    <a href="#/store" class="back-to-store" onclick="stopAutoSlide()">
      <i class="fas fa-arrow-left"></i>
      Back to Showroom
    </a>

    <div class="details-grid">
      <div class="details-showcase">
        <div class="media-stage" id="media-stage">
          ${slidesHTML}
          <div class="slide-counter">
            <span id="slide-current">1</span> / <span id="slide-total">${currentWatchSlides.length}</span>
          </div>
          <button class="slide-nav slide-prev" aria-label="Previous"><i class="fas fa-chevron-left"></i></button>
          <button class="slide-nav slide-next" aria-label="Next"><i class="fas fa-chevron-right"></i></button>
        </div>
        <div class="media-thumbnails">
          ${thumbsHTML}
        </div>
      </div>

      <div class="details-info">
        <span class="details-brand">${watch.brand}</span>
        <h1 class="details-title">${watch.name}</h1>
        <div class="details-price">
          ${watch.price.toLocaleString()} MAD
          <span class="details-status ${watch.inStock ? 'in-stock-detail' : 'out-of-stock-detail'}">${watch.inStock ? 'En Stock' : 'Rupture de stock'}</span>
        </div>
        <p class="details-desc">${watch.description}</p>
        <div class="details-actions">
          <button class="btn-primary" onclick="addToCart('${watch.id}')">ADD TO SELECTION</button>
          <button class="btn-outline" onclick="openContactModal('${watch.brand} ${watch.name}')">REQUEST INQUIRY</button>
        </div>
        <h3 class="specs-title">Technical Specifications</h3>
        <div class="specs-table">
          <div class="specs-row"><span class="specs-label">Reference</span><span class="specs-value">${watch.id.toUpperCase().substring(0,10)}</span></div>
          <div class="specs-row"><span class="specs-label">Brand</span><span class="specs-value">${watch.brand}</span></div>
          <div class="specs-row"><span class="specs-label">Collection</span><span class="specs-value">${watch.category} Collection</span></div>
          <div class="specs-row"><span class="specs-label">Movement</span><span class="specs-value">${watch.movement}</span></div>
          <div class="specs-row"><span class="specs-label">Case Material</span><span class="specs-value">${watch.caseMaterial}</span></div>
          <div class="specs-row"><span class="specs-label">Water Resistance</span><span class="specs-value">${watch.waterResistance}</span></div>
          <div class="specs-row"><span class="specs-label">Power Reserve</span><span class="specs-value">${watch.powerReserve}</span></div>
        </div>
      </div>
    </div>
  `;

  // Initialiser les événements du carrousel
  initCarouselEvents(watch);

  // Démarrer l'auto-slide
  startAutoSlide();
}

/* ==========================================================================
CAROUSEL — Auto-slide + interactions
========================================================================== */
function initCarouselEvents(watch) {
  const stage = document.getElementById("media-stage");
  if (!stage) return;

  // Clic sur un slide → ouvre le lightbox
  stage.addEventListener("click", (e) => {
    // Ne pas ouvrir si on clique sur les boutons de navigation
    if (e.target.closest(".slide-nav") || e.target.closest(".slide-dot")) return;

    const slide = e.target.closest(".slide");
    if (!slide) return;

    // Si c'est une vidéo et qu'elle n'est pas en cours de lecture, on la joue d'abord
    if (slide.dataset.type === 'video' && !stage.classList.contains('playing')) {
      return; // Laisse le overlay gérer le play
    }

    // Ouvrir le lightbox
    openLightbox(currentWatchSlides, currentSlideIndex);
  });

  // Clic sur thumbnails
  document.querySelectorAll(".thumb-item").forEach(thumb => {
    thumb.addEventListener("click", () => {
      const idx = parseInt(thumb.dataset.index);
      goToSlide(idx);
      resetAutoSlide();
    });
  });

  // Boutons prev/next
  stage.querySelector(".slide-prev")?.addEventListener("click", (e) => {
    e.stopPropagation();
    prevSlide();
    resetAutoSlide();
  });

  stage.querySelector(".slide-next")?.addEventListener("click", (e) => {
    e.stopPropagation();
    nextSlide();
    resetAutoSlide();
  });

  // Pause au hover
  stage.addEventListener("mouseenter", stopAutoSlide);
  stage.addEventListener("mouseleave", () => {
    if (document.getElementById("media-stage")) startAutoSlide();
  });

  // Overlay vidéo
  const videoOverlay = stage.querySelector(".video-play-overlay");
  if (videoOverlay) {
    videoOverlay.addEventListener("click", (e) => {
      e.stopPropagation();
      const video = stage.querySelector("video");
      if (video) {
        video.play().then(() => {
          stage.classList.add("playing");
          videoOverlay.style.display = "none";
        }).catch(() => {});
      }
    });
  }

  // Clic sur vidéo en cours → pause
  const video = stage.querySelector("video");
  if (video) {
    video.addEventListener("click", (e) => {
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

  const slides = stage.querySelectorAll(".slide");
  const dots = stage.querySelectorAll(".slide-dot");
  const thumbs = document.querySelectorAll(".thumb-item");

  // Arrêter toute vidéo en cours
  const currentVideo = stage.querySelector("video");
  if (currentVideo) {
    currentVideo.pause();
    currentVideo.currentTime = 0;
  }
  stage.classList.remove("playing");
  const overlay = stage.querySelector(".video-play-overlay");
  if (overlay) overlay.style.display = "flex";

  // Mettre à jour les slides
  slides.forEach((s, i) => s.classList.toggle("active", i === index));
  dots.forEach((d, i) => d.classList.toggle("active", i === index));
  thumbs.forEach((t, i) => t.classList.toggle("active", i === index));

  // Mettre à jour le compteur
  const counter = document.getElementById("slide-current");
  if (counter) counter.textContent = index + 1;

  currentSlideIndex = index;
}

function nextSlide() {
  const next = (currentSlideIndex + 1) % currentWatchSlides.length;
  goToSlide(next);
}

function prevSlide() {
  const prev = (currentSlideIndex - 1 + currentWatchSlides.length) % currentWatchSlides.length;
  goToSlide(prev);
}

function startAutoSlide() {
  stopAutoSlide();
  autoSlideInterval = setInterval(() => {
    nextSlide();
  }, AUTO_SLIDE_DELAY);
}

function stopAutoSlide() {
  if (autoSlideInterval) {
    clearInterval(autoSlideInterval);
    autoSlideInterval = null;
  }
}

function resetAutoSlide() {
  stopAutoSlide();
  startAutoSlide();
}

/* ==========================================================================
LIGHTBOX — Plein écran avec navigation manuelle
========================================================================== */
function setupLightbox() {
  if (!lightbox) return;

  // Fermer
  lightbox.querySelector(".lightbox-close")?.addEventListener("click", closeLightbox);

  // Clic sur fond
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  // Prev / Next
  lightbox.querySelector(".lightbox-prev")?.addEventListener("click", (e) => {
    e.stopPropagation();
    lightboxPrev();
  });
  lightbox.querySelector(".lightbox-next")?.addEventListener("click", (e) => {
    e.stopPropagation();
    lightboxNext();
  });

  // Clavier
  document.addEventListener("keydown", (e) => {
    if (!lightbox.classList.contains("open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") lightboxPrev();
    if (e.key === "ArrowRight") lightboxNext();
  });

  // Swipe mobile
  let touchStartX = 0;
  lightbox.addEventListener("touchstart", (e) => {
    touchStartX = e.touches[0].clientX;
  });
  lightbox.addEventListener("touchend", (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) lightboxNext();
      else lightboxPrev();
    }
  });
}

function openLightbox(slides, startIndex = 0) {
  lightboxSlides = slides;
  lightboxIndex = startIndex;

  if (lightboxTotal) lightboxTotal.textContent = slides.length;
  updateLightboxContent();

  lightbox.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  if (!lightbox) return;
  lightbox.classList.remove("open");
  document.body.style.overflow = "";

  // Arrêter la vidéo du lightbox
  if (lightboxVideo) {
    lightboxVideo.pause();
    lightboxVideo.src = "";
  }
}

function lightboxNext() {
  lightboxIndex = (lightboxIndex + 1) % lightboxSlides.length;
  updateLightboxContent();
}

function lightboxPrev() {
  lightboxIndex = (lightboxIndex - 1 + lightboxSlides.length) % lightboxSlides.length;
  updateLightboxContent();
}

function updateLightboxContent() {
  if (!lightboxImg || !lightboxVideo || !lightboxCurrent) return;

  const slide = lightboxSlides[lightboxIndex];
  lightboxCurrent.textContent = lightboxIndex + 1;

  if (slide.type === 'image') {
    lightboxImg.src = slide.src;
    lightboxImg.style.display = "block";
    lightboxVideo.style.display = "none";
    lightboxVideo.pause();
    lightboxVideo.src = "";
  } else {
    lightboxImg.style.display = "none";
    lightboxVideo.style.display = "block";
    lightboxVideo.src = slide.src;
    lightboxVideo.play().catch(() => {});
  }
}

/* ==========================================================================
CONTACT MODAL
========================================================================== */
window.openContactModal = function(pieceName) {
  const modalText = document.getElementById("modal-subtitle");
  if (modalText) modalText.textContent = `Submit your luxury acquisition inquiry for: ${pieceName}`;
  if (checkoutModal) checkoutModal.classList.add("open");
};

// Exposer stopAutoSlide globalement pour le lien Back
window.stopAutoSlide = stopAutoSlide;

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
    if (cartTotalVal) cartTotalVal.textContent = "0 MAD";
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
  `).join('');

  const subtotal = cart.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
  if (cartSubtotalVal) cartSubtotalVal.textContent = `${subtotal.toLocaleString()} MAD`;
  if (cartTotalVal) cartTotalVal.textContent = `${subtotal.toLocaleString()} MAD`;
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
    ctx.fillStyle = gear.color;
    ctx.strokeStyle = "rgba(197,168,128,0.12)";
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.arc(0, 0, gear.radius - 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const spokes = 5;
    for (let i = 0; i < spokes; i++) {
      ctx.rotate((Math.PI * 2) / spokes);
      ctx.beginPath();
      ctx.rect(-8, 0, 16, gear.radius - 15);
      ctx.fill();
      ctx.stroke();
    }

    ctx.beginPath();
    for (let i = 0; i < gear.teeth; i++) {
      const ta = (Math.PI * 2) / gear.teeth * i;
      ctx.moveTo(Math.cos(ta) * (gear.radius - 12), Math.sin(ta) * (gear.radius - 12));
      ctx.lineTo(Math.cos(ta - 0.05) * gear.radius, Math.sin(ta - 0.05) * gear.radius);
      ctx.lineTo(Math.cos(ta + 0.05) * gear.radius, Math.sin(ta + 0.05) * gear.radius);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(5,5,5,1)";
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function loop() {
    ctx.clearRect(0, 0, width, height);
    angle += 0.005;
    const gears = getGears();
    gears.forEach(gear => drawGear(gear, angle * gear.speed * 10 * gear.dir));
    heroCanvasAnimId = requestAnimationFrame(loop);
  }
  loop();
}

/* ==========================================================================
HAMBURGER MENU — MOBILE
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
    if (hash === "#/home") mobileNav.querySelector("li:first-child")?.classList.add("active");
    else if (hash === "#/store") mobileNav.querySelector("li:last-child")?.classList.add("active");
  });
})();

/* ==========================================================================
MOBILE FILTER PANEL — TOGGLE
========================================================================== */
(function() {
  const toggleBtn  = document.getElementById("mobile-filter-toggle");
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
    filtersBody.addEventListener(evt, () => {
      setTimeout(updateFilterBadge, 50);
    });
  });
})();

/* ==========================================================================
HERO SECTION — FIX HAUTEUR MOBILE (100dvh fallback)
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
  window.addEventListener("resize", fixHeroHeight);
  window.addEventListener("hashchange", () => setTimeout(fixHeroHeight, 50));
})();