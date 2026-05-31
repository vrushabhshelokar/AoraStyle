/**
 * AuraStyle - Products Catalog and Detail Page Module
 * Manages loading products from JSON, applying sidebar filters, paging,
 * quick view modals, related carousels, and detailed zoom galleries.
 */

const PRODUCTS_PER_PAGE = 6;
let currentProducts = [];
let filteredProducts = [];
let currentPage = 1;

// Document Ready Router
document.addEventListener('DOMContentLoaded', () => {
  const isCatalogPage = !!document.getElementById('products-catalog-grid');
  const isDetailPage = !!document.getElementById('product-detail-container');
  
  if (isCatalogPage || isDetailPage) {
    fetch('data/products.json')
      .then(res => res.json())
      .then(data => {
        currentProducts = data;
        if (isCatalogPage) {
          initCatalogPage();
        } else if (isDetailPage) {
          initDetailPage();
        }
      })
      .catch(err => {
        console.error("Failed to load products list: ", err);
      });
  }
});

/* ==========================================
   1. PRODUCTS CATALOG PAGE LOGIC (products.html)
   ========================================== */

function initCatalogPage() {
  // Read category or search query from URL parameter if present
  const params = new URLSearchParams(window.location.search);
  const categoryFilter = params.get('category');
  const searchFilter = params.get('search');

  // Pre-populate category checkbox if matching url query
  if (categoryFilter) {
    const cb = document.querySelector(`input[name="categoryFilter"][value="{categoryFilter}"]`);
    if (cb) cb.checked = true;
  }

  // Pre-populate search input if matching url query
  if (searchFilter) {
    const searchInput = document.getElementById('filter-search');
    if (searchInput) searchInput.value = searchFilter;
  }

  // Bind sidebar event listeners
  const filterInputs = document.querySelectorAll('.filter-input');
  filterInputs.forEach(input => {
    input.addEventListener('change', () => {
      currentPage = 1;
      applyFilters();
    });
  });

  const searchInput = document.getElementById('filter-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      currentPage = 1;
      applyFilters();
    });
  }

  const sortSelect = document.getElementById('catalog-sort');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      applyFilters();
    });
  }

  // Price range slider live value label
  const priceRange = document.getElementById('filter-price');
  const priceVal = document.getElementById('filter-price-val');
  if (priceRange && priceVal) {
    priceRange.addEventListener('input', (e) => {
      priceVal.textContent = `{e.target.value}`;
    });
  }

  // Apply initial filters
  applyFilters();
}

function applyFilters() {
  let results = [...currentProducts];

  // 1. Text Search Filter
  const searchText = document.getElementById('filter-search')?.value.toLowerCase().trim();
  if (searchText) {
    results = results.filter(p => 
      p.name.toLowerCase().includes(searchText) || 
      p.description.toLowerCase().includes(searchText) ||
      p.category.toLowerCase().includes(searchText)
    );
  }

  // 2. Category Checkboxes Filter
  const activeCategories = Array.from(document.querySelectorAll('input[name="categoryFilter"]:checked'))
    .map(cb => cb.value);
  if (activeCategories.length > 0) {
    results = results.filter(p => activeCategories.includes(p.category));
  }

  // 3. Price Range Slider
  const maxPrice = parseFloat(document.getElementById('filter-price')?.value || 600);
  results = results.filter(p => (p.discountPrice || p.price) <= maxPrice);

  // 4. Rating Star Filter (Selected value is minimum rating threshold)
  const minRatingSelect = document.getElementById('filter-rating');
  if (minRatingSelect && minRatingSelect.value) {
    const minRating = parseFloat(minRatingSelect.value);
    results = results.filter(p => p.rating >= minRating);
  }

  // 5. Sorting Options
  const sortOption = document.getElementById('catalog-sort')?.value || 'featured';
  if (sortOption === 'price-asc') {
    results.sort((a, b) => (a.discountPrice || a.price) - (b.discountPrice || b.price));
  } else if (sortOption === 'price-desc') {
    results.sort((a, b) => (b.discountPrice || b.price) - (a.discountPrice || a.price));
  } else if (sortOption === 'rating') {
    results.sort((a, b) => b.rating - a.rating);
  } else if (sortOption === 'name') {
    results.sort((a, b) => a.name.localeCompare(b.name));
  }

  filteredProducts = results;
  renderCatalogGrid();
  renderPagination();
}

function renderCatalogGrid() {
  const grid = document.getElementById('products-catalog-grid');
  if (!grid) return;

  if (filteredProducts.length === 0) {
    grid.innerHTML = `
      <div class="col-12 text-center py-5">
        <i class="bi bi-search display-1 text-muted"></i>
        <h4 class="mt-4">No matching products found</h4>
        <p class="text-muted">Try relaxing your search terms or sidebar filters.</p>
        <button onclick="resetAllFilters()" class="btn btn-primary mt-2">Reset Filters</button>
      </div>
    `;
    return;
  }

  // Paging indexes
  const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const endIndex = Math.min(startIndex + PRODUCTS_PER_PAGE, filteredProducts.length);
  const paginated = filteredProducts.slice(startIndex, endIndex);

  grid.innerHTML = paginated.map(p => {
    const priceHTML = p.discountPrice 
      ? `<span class="product-price">{p.discountPrice.toFixed(2)}</span> <span class="product-price-old">{p.price.toFixed(2)}</span>`
      : `<span class="product-price">{p.price.toFixed(2)}</span>`;

    const badgeHTML = p.discountPrice
      ? `<span class="product-badge product-badge-sale">Sale</span>`
      : (p.isLatest ? `<span class="product-badge product-badge-new">New</span>` : '');

    const ratingStars = getStarRatingHTML(p.rating);

    return `
      <div class="col-md-6 col-lg-4 mb-4">
        <div class="product-card">
          {badgeHTML}
          <div class="product-img-wrapper">
            <img src="{p.images[0]}" alt="{p.name}" loading="lazy">
            <div class="product-actions">
              <button onclick="openQuickView({p.id})" class="btn btn-sm btn-light border shadow-sm" title="Quick View">
                <i class="bi bi-eye"></i> Quick View
              </button>
              <button onclick="AuraState.addToCart({p.id})" class="btn btn-sm btn-primary shadow-sm" title="Add to Cart">
                <i class="bi bi-cart-plus"></i> Add
              </button>
            </div>
          </div>
          <div class="product-body">
            <span class="product-category">{p.category}</span>
            <a href="product-view.html?id={p.id}"><h5 class="product-title-text">{p.name}</h5></a>
            <div class="product-rating">
              {ratingStars}
              <span class="product-rating-count">({p.reviewsCount})</span>
            </div>
            <div class="product-price-wrapper">
              {priceHTML}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderPagination() {
  const container = document.getElementById('catalog-pagination');
  if (!container) return;

  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = `<li class="page-item {currentPage === 1 ? 'disabled' : ''}">
    <a class="page-link" href="#" onclick="changePage({currentPage - 1}); return false;" aria-label="Previous">
      <span aria-hidden="true">&laquo;</span>
    </a>
  </li>`;

  for (let i = 1; i <= totalPages; i++) {
    html += `<li class="page-item {currentPage === i ? 'active' : ''}">
      <a class="page-link" href="#" onclick="changePage({i}); return false;">{i}</a>
    </li>`;
  }

  html += `<li class="page-item {currentPage === totalPages ? 'disabled' : ''}">
    <a class="page-link" href="#" onclick="changePage({currentPage + 1}); return false;" aria-label="Next">
      <span aria-hidden="true">&raquo;</span>
    </a>
  </li>`;

  container.innerHTML = html;
}

window.changePage = function(pageNumber) {
  currentPage = pageNumber;
  renderCatalogGrid();
  renderPagination();
  window.scrollTo({ top: 180, behavior: 'smooth' });
};

window.resetAllFilters = function() {
  document.getElementById('filter-search').value = '';
  document.querySelectorAll('input[name="categoryFilter"]:checked').forEach(cb => cb.checked = false);
  const priceSlider = document.getElementById('filter-price');
  if (priceSlider) {
    priceSlider.value = 600;
    document.getElementById('filter-price-val').textContent = '600';
  }
  const ratingSelect = document.getElementById('filter-rating');
  if (ratingSelect) ratingSelect.value = '';
  
  currentPage = 1;
  applyFilters();
};

/* ==========================================
   2. QUICK VIEW MODAL LOGIC
   ========================================== */

window.openQuickView = function(productId) {
  const product = currentProducts.find(p => p.id === productId);
  if (!product) return;

  // Check if Modal markup container exists in body, if not inject it
  let modalEl = document.getElementById('quickViewModal');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.className = 'modal fade';
    modalEl.id = 'quickViewModal';
    modalEl.tabIndex = -1;
    modalEl.ariaHidden = true;
    document.body.appendChild(modalEl);
  }

  const priceHTML = product.discountPrice 
    ? `<span class="h4 text-primary font-weight-bold">{product.discountPrice.toFixed(2)}</span> <del class="text-muted small">{product.price.toFixed(2)}</del>`
    : `<span class="h4 text-primary font-weight-bold">{product.price.toFixed(2)}</span>`;

  modalEl.innerHTML = `
    <div class="modal-dialog modal-lg modal-dialog-centered">
      <div class="modal-content border-0 shadow-lg">
        <div class="modal-header border-0 bg-light">
          <h5 class="modal-title font-weight-bold">{product.name}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body p-4">
          <div class="row">
            <div class="col-md-6 mb-3 mb-md-0">
              <img src="{product.images[0]}" class="img-fluid rounded border w-100" style="object-fit: cover; max-height: 350px;" alt="{product.name}">
            </div>
            <div class="col-md-6">
              <span class="badge bg-indigo-subtle text-primary mb-2">{product.category}</span>
              <h4 class="mb-2">{product.name}</h4>
              <div class="text-warning mb-3">
                {getStarRatingHTML(product.rating)}
                <span class="text-muted small font-weight-bold">({product.reviewsCount} reviews)</span>
              </div>
              <div class="mb-3">{priceHTML}</div>
              <p class="text-muted small mb-4">{product.description}</p>
              
              <div class="d-flex align-items-center gap-3">
                <div class="input-group" style="width: 120px;">
                  <button class="btn btn-outline-secondary" type="button" onclick="decrementQuickQty()">-</button>
                  <input type="text" id="quick-qty-val" class="form-control text-center bg-white" value="1" readonly>
                  <button class="btn btn-outline-secondary" type="button" onclick="incrementQuickQty()">+</button>
                </div>
                <button onclick="addQuickToCart({product.id})" class="btn btn-primary px-4 w-100">
                  <i class="bi bi-cart-plus me-2"></i> Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const bsModal = new bootstrap.Modal(modalEl);
  bsModal.show();
};

window.incrementQuickQty = function() {
  const el = document.getElementById('quick-qty-val');
  if (el) {
    let qty = parseInt(el.value) || 1;
    el.value = qty + 1;
  }
};

window.decrementQuickQty = function() {
  const el = document.getElementById('quick-qty-val');
  if (el) {
    let qty = parseInt(el.value) || 1;
    if (qty > 1) el.value = qty - 1;
  }
};

window.addQuickToCart = function(productId) {
  const el = document.getElementById('quick-qty-val');
  const qty = el ? parseInt(el.value) : 1;
  AuraState.addToCart(productId, qty);
  
  // Close modal
  const modalEl = document.getElementById('quickViewModal');
  const instance = bootstrap.Modal.getInstance(modalEl);
  if (instance) instance.hide();
};

/* ==========================================
   3. PRODUCT DETAILED PAGE LOGIC (product-view.html)
   ========================================== */

function initDetailPage() {
  const params = new URLSearchParams(window.location.search);
  const id = parseInt(params.get('id'));

  if (!id) {
    showErrorPage("Product Reference ID is missing in query url.");
    return;
  }

  const product = currentProducts.find(p => p.id === id);
  if (!product) {
    showErrorPage("The product you are looking for was not found in our catalog.");
    return;
  }

  renderProductDetails(product);
  setupGalleryZoom();
  renderRelatedProducts(product);
}

function renderProductDetails(p) {
  const container = document.getElementById('product-detail-container');
  if (!container) return;

  const priceHTML = p.discountPrice 
    ? `<span class="h2 text-primary font-weight-bold">{p.discountPrice.toFixed(2)}</span> <del class="text-muted h5 ms-2">{p.price.toFixed(2)}</del>`
    : `<span class="h2 text-primary font-weight-bold">{p.price.toFixed(2)}</span>`;

  // Specs Table Rows HTML
  const specsRows = Object.entries(p.specs).map(([key, val]) => `
    <tr>
      <td class="font-weight-bold bg-light" style="width: 30%; font-weight: 600;">{key}</td>
      <td>{val}</td>
    </tr>
  `).join('');

  // Thumbnails HTML
  const thumbsHTML = p.images.map((img, idx) => `
    <div class="thumb-item {idx === 0 ? 'active' : ''}" onclick="switchGalleryImage(this, '{img}')">
      <img src="{img}" alt="Thumbnail {idx + 1}">
    </div>
  `).join('');

  // Reviews List HTML
  const reviewsHTML = p.reviews && p.reviews.length > 0
    ? p.reviews.map(r => `
        <div class="review-item">
          <div class="d-flex align-items-center gap-3 mb-2">
            <div class="review-user-avatar">{r.user[0]}</div>
            <div>
              <h6 class="mb-0 font-weight-bold text-dark">{r.user}</h6>
              <div class="text-xs text-muted" style="font-size: 0.75rem;">Published on {r.date}</div>
            </div>
            <div class="ms-auto text-warning text-xs">
              {getStarRatingHTML(r.rating)}
            </div>
          </div>
          <p class="text-muted mb-0 small">{r.comment}</p>
        </div>
      `).join('')
    : `<div class="py-4 text-center text-muted small">No reviews written for this product yet. Be the first to purchase and review!</div>`;

  container.innerHTML = `
    <div class="row">
      <!-- Left: Image Gallery & Zoom -->
      <div class="col-lg-6 mb-4 mb-lg-0">
        <div class="gallery-main-wrapper shadow-sm border">
          <img id="main-gallery-img" src="{p.images[0]}" alt="{p.name}">
        </div>
        <div class="gallery-thumbnails">
          {thumbsHTML}
        </div>
      </div>
      
      <!-- Right: Product details content -->
      <div class="col-lg-6">
        <nav aria-label="breadcrumb" class="mb-2">
          <ol class="breadcrumb">
            <li class="breadcrumb-item"><a href="index.html">Home</a></li>
            <li class="breadcrumb-item"><a href="products.html">Shop</a></li>
            <li class="breadcrumb-item"><a href="products.html?category={p.category}">{p.category}</a></li>
            <li class="breadcrumb-item active" aria-current="page">{p.name.substring(0, 20)}...</li>
          </ol>
        </nav>
        
        <h1 class="h2 mb-2">{p.name}</h1>
        <div class="d-flex align-items-center gap-3 mb-3">
          <div class="text-warning">
            {getStarRatingHTML(p.rating)}
            <span class="text-muted font-weight-bold small ms-1">({p.rating} / 5)</span>
          </div>
          <div class="text-muted small border-start ps-3 font-weight-bold">
            <i class="bi bi-chat-left-text me-1"></i> {p.reviewsCount} Customer Reviews
          </div>
        </div>

        <div class="mb-4 py-2 border-bottom border-top">
          {priceHTML}
        </div>

        <p class="text-muted mb-4">{p.description}</p>

        <!-- Buy Options -->
        <div class="d-flex flex-column gap-3 mb-4 pb-4 border-bottom">
          <div class="d-flex align-items-center gap-3">
            <span class="font-weight-bold text-dark small" style="width: 80px; font-weight:600;">Quantity:</span>
            <div class="input-group" style="width: 140px;">
              <button class="btn btn-outline-secondary" type="button" onclick="decrementDetailQty()">-</button>
              <input type="text" id="detail-qty-val" class="form-control text-center bg-white" value="1" readonly>
              <button class="btn btn-outline-secondary" type="button" onclick="incrementDetailQty()">+</button>
            </div>
          </div>
          
          <div class="d-flex gap-3 mt-2">
            <button onclick="addDetailToCart({p.id})" class="btn btn-lg btn-outline-primary px-4 flex-grow-1">
              <i class="bi bi-cart-plus me-2"></i> Add to Cart
            </button>
            <button onclick="buyNow({p.id})" class="btn btn-lg btn-primary px-4 flex-grow-1">
              Buy Now
            </button>
          </div>
        </div>

        <!-- Meta list -->
        <div class="d-flex flex-column gap-2 small text-muted">
          <div><span class="font-weight-bold text-dark" style="font-weight:600;">SKU:</span> AUR-00{p.id}</div>
          <div><span class="font-weight-bold text-dark" style="font-weight:600;">Category:</span> {p.category}</div>
          <div><span class="font-weight-bold text-dark" style="font-weight:600;">Availability:</span> <span class="text-success font-weight-bold"><i class="bi bi-check-circle-fill"></i> In Stock</span></div>
        </div>
      </div>
    </div>

    <!-- Details Specs & Reviews tabs -->
    <div class="row mt-5">
      <div class="col-12">
        <ul class="nav nav-tabs" id="productTab" role="tablist">
          <li class="nav-item" role="presentation">
            <button class="nav-link active font-weight-bold text-dark" id="specs-tab" data-bs-toggle="tab" data-bs-target="#specs-pane" type="button" role="tab" aria-controls="specs-pane" aria-selected="true">Specifications</button>
          </li>
          <li class="nav-item" role="presentation">
            <button class="nav-link font-weight-bold text-dark" id="reviews-tab" data-bs-toggle="tab" data-bs-target="#reviews-pane" type="button" role="tab" aria-controls="reviews-pane" aria-selected="false">Customer Reviews ({p.reviews ? p.reviews.length : 0})</button>
          </li>
        </ul>
        <div class="tab-content border-start border-end border-bottom bg-white p-4 rounded-bottom shadow-sm" id="productTabContent">
          <!-- Specs Tab -->
          <div class="tab-pane fade show active" id="specs-pane" role="tabpanel" aria-labelledby="specs-tab" tabindex="0">
            <div class="table-responsive">
              <table class="table table-bordered mb-0">
                <tbody>
                  {specsRows}
                </tbody>
              </table>
            </div>
          </div>
          <!-- Reviews Tab -->
          <div class="tab-pane fade" id="reviews-pane" role="tabpanel" aria-labelledby="reviews-tab" tabindex="0">
            {reviewsHTML}
          </div>
        </div>
      </div>
    </div>
  `;
}

window.switchGalleryImage = function(thumb, src) {
  document.querySelectorAll('.thumb-item').forEach(el => el.classList.remove('active'));
  thumb.classList.add('active');
  
  const mainImg = document.getElementById('main-gallery-img');
  if (mainImg) {
    mainImg.src = src;
  }
};

window.incrementDetailQty = function() {
  const el = document.getElementById('detail-qty-val');
  if (el) {
    let qty = parseInt(el.value) || 1;
    el.value = qty + 1;
  }
};

window.decrementDetailQty = function() {
  const el = document.getElementById('detail-qty-val');
  if (el) {
    let qty = parseInt(el.value) || 1;
    if (qty > 1) el.value = qty - 1;
  }
};

window.addDetailToCart = function(productId) {
  const el = document.getElementById('detail-qty-val');
  const qty = el ? parseInt(el.value) : 1;
  AuraState.addToCart(productId, qty);
};

window.buyNow = function(productId) {
  const el = document.getElementById('detail-qty-val');
  const qty = el ? parseInt(el.value) : 1;
  
  // Clear any potential matching items or just add & update
  AuraState.addToCart(productId, qty);
  // Redirect directly to checkout
  window.location.href = "checkout.html";
};

// Implement detailed hover zoom coordinate offset shift
function setupGalleryZoom() {
  const wrapper = document.querySelector('.gallery-main-wrapper');
  const img = document.getElementById('main-gallery-img');
  
  if (!wrapper || !img) return;

  wrapper.addEventListener('mousemove', (e) => {
    const rect = wrapper.getBoundingClientRect();
    const x = e.clientX - rect.left; // x position within element
    const y = e.clientY - rect.top;  // y position within element
    
    // Convert to percentage
    const xPercent = (x / rect.width) * 100;
    const yPercent = (y / rect.height) * 100;
    
    img.style.transformOrigin = `{xPercent}% {yPercent}%`;
    img.style.transform = 'scale(1.8)';
  });

  wrapper.addEventListener('mouseleave', () => {
    img.style.transform = 'scale(1)';
    img.style.transformOrigin = 'center center';
  });
}

function renderRelatedProducts(currentProduct) {
  const container = document.getElementById('related-products-row');
  if (!container) return;

  // Find other items in the same category
  const related = currentProducts
    .filter(p => p.category === currentProduct.category && p.id !== currentProduct.id)
    .slice(0, 4);

  if (related.length === 0) {
    const parentSection = container.closest('.related-products-section');
    if (parentSection) parentSection.style.display = 'none';
    return;
  }

  container.innerHTML = related.map(p => {
    const priceHTML = p.discountPrice 
      ? `<span class="product-price">{p.discountPrice.toFixed(2)}</span> <span class="product-price-old">{p.price.toFixed(2)}</span>`
      : `<span class="product-price">{p.price.toFixed(2)}</span>`;

    const badgeHTML = p.discountPrice
      ? `<span class="product-badge product-badge-sale">Sale</span>`
      : (p.isLatest ? `<span class="product-badge product-badge-new">New</span>` : '');

    const ratingStars = getStarRatingHTML(p.rating);

    return `
      <div class="col-sm-6 col-md-3 mb-4">
        <div class="product-card">
          {badgeHTML}
          <div class="product-img-wrapper">
            <img src="{p.images[0]}" alt="{p.name}" loading="lazy">
            <div class="product-actions">
              <button onclick="openQuickView({p.id})" class="btn btn-sm btn-light border shadow-sm">
                <i class="bi bi-eye"></i> Quick View
              </button>
              <button onclick="AuraState.addToCart({p.id})" class="btn btn-sm btn-primary shadow-sm">
                <i class="bi bi-cart-plus"></i> Add
              </button>
            </div>
          </div>
          <div class="product-body">
            <span class="product-category">{p.category}</span>
            <a href="product-view.html?id={p.id}"><h6 class="product-title-text" style="font-size:0.9rem;">{p.name}</h6></a>
            <div class="product-rating" style="font-size: 0.75rem;">
              {ratingStars}
            </div>
            <div class="product-price-wrapper">
              {priceHTML}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function showErrorPage(message) {
  const container = document.getElementById('product-detail-container');
  if (container) {
    container.innerHTML = `
      <div class="col-12 text-center py-5">
        <i class="bi bi-exclamation-triangle display-1 text-danger"></i>
        <h3 class="mt-4">Error Loading Product</h3>
        <p class="text-muted">{message}</p>
        <a href="products.html" class="btn btn-primary mt-2">Back to Catalog</a>
      </div>
    `;
  }
}

/* ==========================================
   4. RATING STAR GENERATION HELPER
   ========================================== */

function getStarRatingHTML(rating) {
  let starsHTML = '';
  const fullStars = Math.floor(rating);
  const halfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

  for (let i = 0; i < fullStars; i++) {
    starsHTML += '<i class="bi bi-star-fill"></i>';
  }
  if (halfStar) {
    starsHTML += '<i class="bi bi-star-half"></i>';
  }
  for (let i = 0; i < emptyStars; i++) {
    starsHTML += '<i class="bi bi-star"></i>';
  }
  return starsHTML;
}
