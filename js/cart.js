/**
 * AORASTYLE - Cart Management Module
 * Loads items from localStorage, fetches full details from products.json,
 * handles quantity updates, coupon discounts, tax rates, and subtotal calculation.
 */

let allProductsDB = [];
let appliedCoupon = null; // Stores { code: string, discountPercent: number, freeShipping: boolean }

document.addEventListener('DOMContentLoaded', () => {
  const cartGrid = document.getElementById('cart-items-container');
  if (!cartGrid) return; // Exit if not on cart page

  // Load applied coupon from localStorage if exists
  const storedCoupon = localStorage.getItem('AORASTYLE_coupon');
  if (storedCoupon) {
    appliedCoupon = JSON.parse(storedCoupon);
  }

  // Fetch full details of products from JSON db
  fetch('data/products.json')
    .then(res => res.json())
    .then(data => {
      allProductsDB = data;
      renderCartPage();
    })
    .catch(err => {
      console.error("Failed to load products inside cart: ", err);
      cartGrid.innerHTML = `<div class="alert alert-danger">Error loading cart items. Please refresh the page.</div>`;
    });

  // Setup Coupon input box submit
  const couponForm = document.getElementById('coupon-form');
  if (couponForm) {
    couponForm.addEventListener('submit', (e) => {
      e.preventDefault();
      applyCouponCode();
    });
  }

  // Bind listener for external cart updates
  window.addEventListener('cartUpdated', () => {
    renderCartPage();
  });
});

function renderCartPage() {
  const container = document.getElementById('cart-items-container');
  const totalsContainer = document.getElementById('cart-totals-card');
  if (!container) return;

  const cart = AORAState.cart;

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5">
        <i class="bi bi-cart-x display-1 text-muted"></i>
        <h4 class="mt-4">Your Shopping Cart is Empty</h4>
        <p class="text-muted mb-4">You haven't added any products to your cart yet.</p>
        <a href="products.html" class="btn btn-primary btn-lg">Start Shopping</a>
      </div>
    `;
    if (totalsContainer) totalsContainer.style.display = 'none';
    return;
  }

  if (totalsContainer) totalsContainer.style.display = 'block';

  let subtotal = 0;

  // Generate Cart Table rows
  let cartRowsHTML = '';
  
  cart.forEach(cartItem => {
    const product = allProductsDB.find(p => p.id === cartItem.id);
    if (!product) return;

    const itemPrice = product.discountPrice || product.price;
    const rowTotal = itemPrice * cartItem.quantity;
    subtotal += rowTotal;

    cartRowsHTML += `
      <div class="card mb-3 border border-slate-subtle rounded shadow-sm">
        <div class="row g-0 align-items-center p-3">
          <div class="col-3 col-md-2">
            <img src="${product.images[0]}" alt="${product.name}" class="img-fluid rounded border" style="object-fit: cover; aspect-ratio: 1; max-height: 80px;">
          </div>
          <div class="col-9 col-md-4 ps-3 ps-md-4">
            <span class="text-xs text-muted uppercase tracking-wider" style="font-size:0.75rem;">${product.category}</span>
            <a href="product-view.html?id=${product.id}"><h6 class="mb-1 font-weight-bold text-dark text-truncate">${product.name}</h6></a>
            <div class="text-primary font-weight-bold" style="font-size: 0.95rem;">${window.formatPrice(itemPrice)}</div>
          </div>
          <div class="col-6 col-md-3 mt-3 mt-md-0 d-flex justify-content-start justify-content-md-center">
            <div class="input-group input-group-sm" style="width: 100px;">
              <button class="btn btn-outline-secondary" type="button" onclick="updateCartItemQty(${product.id}, ${cartItem.quantity - 1})">-</button>
              <input type="text" class="form-control text-center bg-white" value="${cartItem.quantity}" readonly>
              <button class="btn btn-outline-secondary" type="button" onclick="updateCartItemQty(${product.id}, ${cartItem.quantity + 1})">+</button>
            </div>
          </div>
          <div class="col-4 col-md-2 mt-3 mt-md-0 text-start text-md-end">
            <div class="font-weight-bold text-dark" style="font-size: 1rem; font-weight:600;">${window.formatPrice(rowTotal)}</div>
          </div>
          <div class="col-2 col-md-1 mt-3 mt-md-0 text-end">
            <button onclick="removeCartItem(${product.id})" class="btn btn-link text-danger p-0" title="Remove Item">
              <i class="bi bi-trash3-fill" style="font-size: 1.1rem;"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = cartRowsHTML;

  // Calculations
  let discountAmount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.discountPercent) {
      discountAmount = subtotal * (appliedCoupon.discountPercent / 100);
    }
  }

  // Shipping cost defaults to 15. Free shipping if subtotal >= 150 or coupon says so.
  let shippingCost = subtotal >= 150 ? 0 : 15;
  if (appliedCoupon && appliedCoupon.freeShipping) {
    shippingCost = 0;
  }

  // Tax calculation (8% rate)
  const taxRate = 0.08;
  const taxAmount = (subtotal - discountAmount) * taxRate;

  const grandTotal = subtotal - discountAmount + taxAmount + shippingCost;

  // Save detailed final price elements to localStorage so checkout can fetch them
  const totalsObj = {
    subtotal: subtotal,
    discount: discountAmount,
    shipping: shippingCost,
    tax: taxAmount,
    grandTotal: grandTotal,
    couponCode: appliedCoupon ? appliedCoupon.code : null
  };
  localStorage.setItem('AORASTYLE_totals', JSON.stringify(totalsObj));

  // Render summaries panel
  const totalsCard = document.getElementById('cart-totals-card');
  if (totalsCard) {
    let couponFeedbackHTML = '';
    if (appliedCoupon) {
      couponFeedbackHTML = `
        <div class="alert alert-success d-flex justify-content-between align-items-center py-2 px-3 mb-3 small">
          <span><i class="bi bi-tag-fill me-1"></i> Coupon <strong>${appliedCoupon.code}</strong> applied!</span>
          <button onclick="removeCouponCode()" class="btn btn-sm btn-close" aria-label="Remove Coupon"></button>
        </div>
      `;
    }

    totalsCard.innerHTML = `
      <div class="card border border-slate-subtle rounded shadow-sm">
        <div class="card-body p-4">
          <h5 class="card-title font-weight-bold mb-4 pb-2 border-bottom">Order Summary</h5>
          
          <div class="d-flex justify-content-between mb-2">
            <span class="text-muted">Subtotal</span>
            <span class="font-weight-bold text-dark">${window.formatPrice(subtotal)}</span>
          </div>

          ${appliedCoupon ? `
          <div class="d-flex justify-content-between mb-2 text-success">
            <span>Discount (${appliedCoupon.discountPercent ? appliedCoupon.discountPercent + '%' : 'Free Shipping'})</span>
            <span>-${window.formatPrice(discountAmount)}</span>
          </div>
          ` : ''}

          <div class="d-flex justify-content-between mb-2">
            <span class="text-muted">Estimated Tax (8%)</span>
            <span class="font-weight-bold text-dark">${window.formatPrice(taxAmount)}</span>
          </div>

          <div class="d-flex justify-content-between mb-3">
            <span class="text-muted">Shipping</span>
            <span class="font-weight-bold text-dark">
              ${shippingCost === 0 ? '<span class="text-success">Free</span>' : `${window.formatPrice(shippingCost)}`}
            </span>
          </div>

          ${couponFeedbackHTML}

          <div class="d-flex justify-content-between mb-4 pt-3 border-top">
            <span class="h5 font-weight-bold text-dark mb-0">Grand Total</span>
            <span class="h4 font-weight-bold text-primary mb-0">${window.formatPrice(grandTotal)}</span>
          </div>

          <a href="checkout.html" class="btn btn-primary w-100 py-3 font-weight-bold rounded">
            Proceed to Checkout
          </a>
          
          <div class="text-center mt-3">
            <a href="products.html" class="small text-muted"><i class="bi bi-arrow-left me-1"></i> Continue Shopping</a>
          </div>
        </div>
      </div>
    `;
  }
}

window.updateCartItemQty = function(productId, newQty) {
  if (newQty <= 0) {
    removeCartItem(productId);
    return;
  }
  
  const item = AORAState.cart.find(i => i.id === productId);
  if (item) {
    item.quantity = newQty;
    AORAState.saveCart();
    AORAState.showToast("Cart updated successfully!", "success");
  }
};

window.removeCartItem = function(productId) {
  AORAState.cart = AORAState.cart.filter(i => i.id !== productId);
  AORAState.saveCart();
  AORAState.showToast("Product removed from cart.", "error");
};

function applyCouponCode() {
  const couponInput = document.getElementById('coupon-code');
  if (!couponInput) return;

  const code = couponInput.value.trim().toUpperCase();
  if (!code) {
    AORAState.showToast("Please enter a coupon code.", "error");
    return;
  }

  // Simple mock codes
  if (code === 'WELCOME10') {
    appliedCoupon = { code: 'WELCOME10', discountPercent: 10, freeShipping: false };
    AORAState.showToast("10% discount applied!", "success");
  } else if (code === 'FREESHIP') {
    appliedCoupon = { code: 'FREESHIP', discountPercent: 0, freeShipping: true };
    AORAState.showToast("Free shipping applied!", "success");
  } else {
    AORAState.showToast("Invalid coupon code.", "error");
    return;
  }

  localStorage.setItem('AORASTYLE_coupon', JSON.stringify(appliedCoupon));
  couponInput.value = '';
  renderCartPage();
}

window.removeCouponCode = function() {
  appliedCoupon = null;
  localStorage.removeItem('AORASTYLE_coupon');
  AORAState.showToast("Coupon removed.", "error");
  renderCartPage();
};
