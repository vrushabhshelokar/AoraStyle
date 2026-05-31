/**
 * AuraStyle - Search Page Module
 * Reads query terms, filters products database matching name, category, or description,
 * updates search results layout, and responds to live keystrokes.
 */

let productsDatabase = [];

document.addEventListener('DOMContentLoaded', () => {
  const searchGrid = document.getElementById('search-results-grid');
  if (!searchGrid) return; // Exit if not on search.html

  const queryTitle = document.getElementById('search-query-title');
  const searchInput = document.getElementById('search-page-input');

  // Load products list
  fetch('data/products.json')
    .then(res => res.json())
    .then(data => {
      productsDatabase = data;
      
      // Check query parameter from URL
      const params = new URLSearchParams(window.location.search);
      const query = params.get('q');
      
      if (query) {
        if (searchInput) searchInput.value = query;
        performSearch(query);
      } else {
        performSearch(''); // Show all or empty
      }
    })
    .catch(err => {
      console.error("Error loading products on search page: ", err);
    });

  // Bind live keystroke search on the search page itself
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.trim();
      performSearch(term);
      
      // Update browser history query state without reloading
      const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + `?q={encodeURIComponent(term)}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
    });
  }
});

function performSearch(term) {
  const grid = document.getElementById('search-results-grid');
  const queryTitle = document.getElementById('search-query-title');
  if (!grid) return;

  const normalizedTerm = term.toLowerCase().trim();

  // If search query is empty, prompt user or show all
  let matches = [];
  if (normalizedTerm === '') {
    matches = productsDatabase;
    if (queryTitle) queryTitle.textContent = "Showing All Products";
  } else {
    matches = productsDatabase.filter(p => 
      p.name.toLowerCase().includes(normalizedTerm) || 
      p.category.toLowerCase().includes(normalizedTerm) ||
      p.description.toLowerCase().includes(normalizedTerm)
    );
    if (queryTitle) queryTitle.textContent = `Search Results for "{term}" ({matches.length} found)`;
  }

  if (matches.length === 0) {
    grid.innerHTML = `
      <div class="col-12 text-center py-5">
        <i class="bi bi-search-heart display-1 text-muted"></i>
        <h4 class="mt-4">No results found</h4>
        <p class="text-muted">We couldn't find anything matching your search query. Try typing something else or browse categories.</p>
        <a href="products.html" class="btn btn-primary mt-2">Browse All Products</a>
      </div>
    `;
    return;
  }

  // Render cards
  grid.innerHTML = matches.map(p => {
    const priceHTML = p.discountPrice 
      ? `<span class="product-price">{p.discountPrice.toFixed(2)}</span> <span class="product-price-old">{p.price.toFixed(2)}</span>`
      : `<span class="product-price">{p.price.toFixed(2)}</span>`;

    const badgeHTML = p.discountPrice
      ? `<span class="product-badge product-badge-sale">Sale</span>`
      : (p.isLatest ? `<span class="product-badge product-badge-new">New</span>` : '');

    const ratingStars = getStarRatingHTML(p.rating);

    return `
      <div class="col-sm-6 col-md-4 col-lg-3 mb-4">
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

// Reuse rating stars generator helper
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
