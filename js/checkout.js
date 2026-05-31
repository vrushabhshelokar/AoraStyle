/**
 * AuraStyle - Checkout Page Module
 * Loads order totals, renders right sidebar order items summary,
 * implements shipping/billing forms jQuery validation, and processes payment.
 */

$(document).ready(function() {
  const checkoutItemsContainer = document.getElementById('checkout-items-summary');
  if (!checkoutItemsContainer) return; // Exit if not on checkout page

  // Check if cart is empty, if so, redirect back to cart
  if (AuraState.cart.length === 0) {
    window.location.href = 'cart.html';
    return;
  }

  // Load totals and load product database
  let totals = JSON.parse(localStorage.getItem('aurastyle_totals')) || {
    subtotal: 0,
    discount: 0,
    shipping: 15,
    tax: 0,
    grandTotal: 0
  };

  fetch('data/products.json')
    .then(res => res.json())
    .then(products => {
      renderCheckoutSummary(products, totals);
    })
    .catch(err => {
      console.error("Error loading products details on checkout: ", err);
    });

  // Toggle billing address fields if "same as shipping" is checked
  $('#same-address').on('change', function() {
    if (this.checked) {
      $('#billing-fields-wrapper').slideUp();
    } else {
      $('#billing-fields-wrapper').slideDown();
    }
  });

  // Coupon handling on checkout page
  $('#checkout-coupon-form').on('submit', function(e) {
    e.preventDefault();
    const code = $('#checkout-coupon-code').val().trim().toUpperCase();
    if (!code) return;

    let applied = null;
    if (code === 'WELCOME10') {
      applied = { code: 'WELCOME10', discountPercent: 10, freeShipping: false };
      AuraState.showToast("10% discount applied!", "success");
    } else if (code === 'FREESHIP') {
      applied = { code: 'FREESHIP', discountPercent: 0, freeShipping: true };
      AuraState.showToast("Free shipping applied!", "success");
    } else {
      AuraState.showToast("Invalid coupon code.", "error");
      return;
    }

    localStorage.setItem('aurastyle_coupon', JSON.stringify(applied));
    
    // Recompute totals
    recalculateCheckoutTotals(applied);
  });

  // Setup jQuery Form Validation
  $("#checkout-form").validate({
    rules: {
      firstName: "required",
      lastName: "required",
      email: {
        required: true,
        email: true
      },
      phone: {
        required: true,
        digits: true,
        minlength: 10,
        maxlength: 12
      },
      address: "required",
      city: "required",
      state: "required",
      zip: {
        required: true,
        digits: true,
        minlength: 5,
        maxlength: 6
      },
      cardName: "required",
      cardNumber: {
        required: true,
        creditcard: true
      },
      cardExpiry: {
        required: true,
        pattern: /^(0[1-9]|1[0-2])\/?([0-9]{2})/ // MM/YY format
      },
      cardCvv: {
        required: true,
        digits: true,
        minlength: 3,
        maxlength: 4
      }
    },
    messages: {
      firstName: "Please enter your first name",
      lastName: "Please enter your last name",
      email: {
        required: "An email address is required to send your confirmation invoice",
        email: "Please enter a valid email address (e.g. name@domain.com)"
      },
      phone: {
        required: "Phone number is required for delivery notifications",
        digits: "Phone number must contain digits only",
        minlength: "Phone number must be at least 10 digits long"
      },
      address: "Please enter your delivery street address",
      city: "Please enter your city",
      state: "Please select your state",
      zip: {
        required: "Please provide a ZIP/Postal Code",
        digits: "ZIP code must contain digits only",
        minlength: "ZIP code must be at least 5 digits"
      },
      cardName: "Please enter the cardholder name",
      cardNumber: {
        required: "Credit card number is required for payment",
        creditcard: "Please enter a valid credit card number"
      },
      cardExpiry: {
        required: "Expiry date is required",
        pattern: "Must be in MM/YY format"
      },
      cardCvv: {
        required: "CVV code is required",
        digits: "CVV must be digits only",
        minlength: "Must be 3 or 4 digits"
      }
    },
    submitHandler: function(form) {
      processOrderSubmission();
    }
  });

  // Custom Validation method for credit card regex format fallback
  jQuery.validator.addMethod("pattern", function(value, element, param) {
    if (this.optional(element)) {
      return true;
    }
    if (typeof param === 'string') {
      param = new RegExp('^(?:' + param + ')');
    }
    return param.test(value);
  }, "Invalid format.");
});

function renderCheckoutSummary(products, totals) {
  const container = document.getElementById('checkout-items-summary');
  if (!container) return;

  const cart = AuraState.cart;
  let itemsHTML = '';

  cart.forEach(item => {
    const p = products.find(prod => prod.id === item.id);
    if (!p) return;

    const itemPrice = p.discountPrice || p.price;
    itemsHTML += `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div style="max-width: 75%;">
          <span class="badge bg-secondary me-2">${item.quantity}</span>
          <span class="small font-weight-bold text-dark text-truncate d-inline-block align-middle" style="max-width: 170px;">${p.name}</span>
        </div>
        <span class="text-dark small font-weight-bold">${window.formatPrice(itemPrice * item.quantity)}</span>
      </div>
    `;
  });

  container.innerHTML = itemsHTML;
  updateTotalsUI(totals);
}

function updateTotalsUI(totals) {
  $('#checkout-subtotal').text(window.formatPrice(totals.subtotal));
  
  if (totals.discount > 0) {
    $('#checkout-discount-row').show();
    $('#checkout-discount').text('-' + window.formatPrice(totals.discount));
  } else {
    $('#checkout-discount-row').hide();
  }

  $('#checkout-tax').text(window.formatPrice(totals.tax));
  
  if (totals.shipping === 0) {
    $('#checkout-shipping').html('<span class="text-success">Free</span>');
  } else {
    $('#checkout-shipping').text(window.formatPrice(totals.shipping));
  }

  $('#checkout-grand-total').text(window.formatPrice(totals.grandTotal));
}

function recalculateCheckoutTotals(coupon) {
  let totals = JSON.parse(localStorage.getItem('aurastyle_totals')) || { subtotal: 0 };
  const subtotal = totals.subtotal;
  
  let discount = 0;
  if (coupon.discountPercent) {
    discount = subtotal * (coupon.discountPercent / 100);
  }

  let shipping = subtotal >= 150 ? 0 : 15;
  if (coupon.freeShipping) {
    shipping = 0;
  }

  const tax = (subtotal - discount) * 0.08;
  const grandTotal = subtotal - discount + tax + shipping;

  const newTotals = {
    subtotal: subtotal,
    discount: discount,
    shipping: shipping,
    tax: tax,
    grandTotal: grandTotal,
    couponCode: coupon.code
  };

  localStorage.setItem('aurastyle_totals', JSON.stringify(newTotals));
  updateTotalsUI(newTotals);
}

function processOrderSubmission() {
  // Show spinner or processing toast
  AuraState.showToast("Processing payment. Please wait...", "success");

  // Generate random order fields
  const orderNum = 'AUR-' + Math.floor(100000 + Math.random() * 900000) + '-' + Array.from({length: 3}, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('');
  
  // Package order details
  const finalTotals = JSON.parse(localStorage.getItem('aurastyle_totals'));
  const customerEmail = $('#email').val();
  const customerName = $('#firstName').val() + ' ' + $('#lastName').val();

  const orderReceipt = {
    orderNumber: orderNum,
    name: customerName,
    email: customerEmail,
    itemsCount: AuraState.cart.reduce((tot, item) => tot + item.quantity, 0),
    total: finalTotals.grandTotal,
    date: new Date().toLocaleDateString(),
    deliveryDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toLocaleDateString() // 4 days later
  };

  // Save order to history and active order slot
  localStorage.setItem('aurastyle_last_order', JSON.stringify(orderReceipt));

  // Reset cart, totals and coupon codes
  AuraState.cart = [];
  AuraState.saveCart();
  localStorage.removeItem('aurastyle_totals');
  localStorage.removeItem('aurastyle_coupon');

  setTimeout(() => {
    // Redirect to success confirmation page
    window.location.href = 'order-confirmation.html';
  }, 149);
}
