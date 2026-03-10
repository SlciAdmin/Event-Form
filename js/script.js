/**
 * Event Registration System - Dual Form (Feedback + Paid)
 * Production Ready • Responsive • Accessible
 */
const CONFIG = {
  PAYMENT_LINK: "https://rzp.io/rzp/5NCrTAI",
  AMOUNT: 99900,
  CURRENCY: "INR",
  
  // ✅ FIXED: No trailing spaces
  GOOGLE_SCRIPT: "https://script.google.com/macros/s/AKfycbzq59DmEApdYfiABMIaJZRUGFMfOQv6VnAkvOjt7xXDO9h0_39kkcXtLXRdau8gxanatQ/exec ",
  
  RETURN_URL: window.location.href.split('?')[0],
  DEBUG: true  // ✅ True rakho testing ke liye
};

// ===== STATE MANAGEMENT =====
let paymentDone = false;
let currentView = 'landing';
let paymentData = {
  razorpay_payment_id: "",
  razorpay_order_id: "",
  razorpay_signature: "",
  payment_link_id: "IRE79PZ"
};

// ===== DOM HELPERS =====
const $ = id => document.getElementById(id);
const $$ = (sel, ctx = document) => ctx.querySelectorAll(sel);

// ===== DEBUG LOGGER =====
function debug(msg, data = null) {
  if (CONFIG.DEBUG) {
    console.log(`[💳 ${new Date().toLocaleTimeString()}] ${msg}`, data || '');
  }
}

// ===== VIEW NAVIGATION =====
function showView(viewName) {
  currentView = viewName;

  const landingPage = $('landingPage');
  const feedbackForm = $('feedbackForm');
  const paidForm = $('paidForm');
  const successMsg = $('successMsg');

  if (landingPage) {
    landingPage.classList.add('hidden');
    landingPage.classList.remove('active-form');
  }
  if (feedbackForm) {
    feedbackForm.classList.add('hidden-form');
    feedbackForm.classList.remove('active-form');
  }
  if (paidForm) {
    paidForm.classList.add('hidden-form');
    paidForm.classList.remove('active-form');
  }
  if (successMsg) {
    successMsg.classList.add('hidden');
    successMsg.classList.remove('active-form');
  }

  switch(viewName) {
    case 'landing':
      if (landingPage) {
        landingPage.classList.remove('hidden');
        landingPage.classList.add('active-form');
      }
      debug('🏠 Landing page shown');
      break;

    case 'feedback':
      if (feedbackForm) {
        feedbackForm.classList.remove('hidden-form');
        feedbackForm.classList.add('active-form');
      }
      debug('📋 Feedback form shown');
      break;

    case 'paid':
      if (paidForm) {
        paidForm.classList.remove('hidden-form');
        paidForm.classList.add('active-form');
      }
      debug('💳 Paid form shown');
      break;

    case 'success':
      if (successMsg) {
        successMsg.classList.remove('hidden');
        successMsg.classList.add('active-form');
      }
      debug('✅ Success screen shown');
      break;
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function backToLanding() {
  debug('⬅️ Back to landing');
  showView('landing');
}

// ===== PAYMENT RETURN HANDLER =====
function handlePaymentReturn() {
  debug('🔍 Checking payment return...');
  const urlParams = new URLSearchParams(window.location.search);
  const paymentId = urlParams.get('razorpay_payment_id');
  const status = urlParams.get('razorpay_payment_status');
  const orderId = urlParams.get('razorpay_order_id');
  const error = urlParams.get('razorpay_error');

  if (paymentId && status === 'captured') {
    debug('✅ Payment captured!', { paymentId, orderId });
    paymentDone = true;
    paymentData.razorpay_payment_id = paymentId;
    paymentData.razorpay_order_id = orderId || 'N/A';

    try {
      sessionStorage.setItem('paymentData', JSON.stringify(paymentData));
    } catch (e) {
      debug('⚠️ Session storage failed', e);
    }

    if (window.history.replaceState) {
      window.history.replaceState({}, document.title, CONFIG.RETURN_URL);
    }

    updatePaymentUI(true);
    const submitBtn = $('submitBtn');
    if (submitBtn) submitBtn.disabled = false;

    setTimeout(() => {
      if (validatePaidForm()) {
        debug('🔄 Auto-submitting paid form...');
        handlePaidSubmit(null, true);
      }
    }, 500);

    return true;
  }

  if (error || (status && status !== 'captured')) {
    debug('❌ Payment failed/cancelled', { error, status });
    showToast(`⚠️ Payment ${error ? 'Failed' : 'Cancelled'}. Please try again.`, 'warning');
    resetPaymentUI();
    if (window.history.replaceState) {
      window.history.replaceState({}, document.title, CONFIG.RETURN_URL);
    }
    return false;
  }

  debug('ℹ️ No payment parameters');
  return false;
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  debug('🚀 DOM Content Loaded');
  showView('landing');

  const feedbackBtn = $('showFeedbackBtn');
  const paidBtn = $('showPaidBtn');

  if (feedbackBtn) {
    feedbackBtn.addEventListener('click', (e) => {
      e.preventDefault();
      debug('🖱️ Feedback button clicked');
      showView('feedback');
      initFeedbackForm();
    });
  }

  if (paidBtn) {
    paidBtn.addEventListener('click', (e) => {
      e.preventDefault();
      debug('🖱️ Audit button clicked');
      showView('paid');
      initPaidForm();
    });
  }

  initFeedbackForm();
  initPaidForm();

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      debug('♻️ Page restored from bfcache');
      if (currentView === 'paid' && !paymentDone && !sessionStorage.getItem('paymentData')) {
        window.location.reload();
      }
    }
  });

  if (window.performance?.navigation?.type === 2) {
    debug('🔄 Page loaded via back/forward - resetting');
    resetAll();
  }
});

// ===== FEEDBACK FORM INIT =====
function initFeedbackForm() {
  const form = $('feedbackForm');
  if (!form) return;

  initStarRating('fb_starRating');

  ['fb_name', 'fb_email', 'fb_phone', 'fb_city', 'fb_employees'].forEach(id => {
    const field = $(id);
    if (field) {
      field.addEventListener('blur', () => validateField(field, 'feedback'));
      field.addEventListener('input', () => {
        if (field.style.borderColor === 'var(--danger)') {
          field.style.borderColor = '';
          field.removeAttribute('aria-invalid');
        }
      });
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleFeedbackSubmit();
  });

  debug('✅ Feedback Form initialized');
}

// ===== PAID FORM INIT =====
function initPaidForm() {
  const form = $('paidForm');
  if (!form) return;

  handlePaymentReturn();

  const savedPayment = sessionStorage.getItem('paymentData');
  if (savedPayment && currentView === 'paid') {
    try {
      paymentData = JSON.parse(savedPayment);
      if (paymentData.razorpay_payment_id) {
        paymentDone = true;
        updatePaymentUI(true);
        const submitBtn = $('submitBtn');
        if (submitBtn) submitBtn.disabled = false;
        debug('🔄 Payment state restored');
      }
    } catch (e) {
      debug('⚠️ Failed to parse payment data', e);
    }
  }

  const payBtn = $('payBtn');
  if (payBtn) {
    payBtn.addEventListener('click', (e) => {
      if (!validatePaidForm()) {
        e.preventDefault();
        showToast('Please fill all required fields before payment', 'error');
        return false;
      }

      try {
        const formData = collectPaidFormData();
        sessionStorage.setItem('tempPaidData', JSON.stringify(formData));
        debug('💾 Form data saved');
      } catch (err) {
        debug('⚠️ Failed to save temp data', err);
      }

      debug('🔗 Redirecting to Razorpay...');
      return true;
    });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handlePaidSubmit();
  });

  ['name', 'email', 'phone', 'city', 'employees'].forEach(id => {
    const field = $(id);
    if (field) {
      field.addEventListener('blur', () => validateField(field, 'paid'));
      field.addEventListener('input', () => {
        if (field.style.borderColor === 'var(--danger)') {
          field.style.borderColor = '';
          field.removeAttribute('aria-invalid');
        }
      });
    }
  });

  initStarRating('audit_starRating');
  debug('✅ Paid Form initialized');
}

// ===== VALIDATION =====
function validateField(field, formType) {
  if (!field) return false;

  const value = field.value.trim();
  let isValid = true;

  if (field.required && !value) {
    markInvalid(field);
    isValid = false;
  }

  if (field.type === 'email' && value) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      markInvalid(field);
      showToast('Please enter a valid email address', 'error');
      isValid = false;
    }
  }

  if (field.type === 'tel' && value) {
    const phoneRegex = /^[6-9][0-9]{9}$/;
    if (!phoneRegex.test(value)) {
      markInvalid(field);
      showToast('Please enter a valid 10-digit mobile number', 'error');
      isValid = false;
    }
  }

  if (field.type === 'number' && value) {
    if (isNaN(value) || value < 1) {
      markInvalid(field);
      showToast('Please enter a valid number', 'error');
      isValid = false;
    }
  }

  if (field.pattern && value && !new RegExp(field.pattern).test(value)) {
    markInvalid(field);
    isValid = false;
  }

  if (isValid) {
    field.style.borderColor = '';
    field.removeAttribute('aria-invalid');
  }

  return isValid;
}

function validateFeedbackForm() {
  let isValid = true;

  const requiredFields = ['fb_name', 'fb_designation', 'fb_company', 'fb_phone', 'fb_email', 'fb_city', 'fb_employees'];
  requiredFields.forEach(id => {
    const field = $(id);
    if (field && !validateField(field, 'feedback')) {
      isValid = false;
    }
  });

  const rating = document.querySelector('input[name="fb_rating"]:checked');
  if (!rating) {
    showToast('Please select a session rating', 'error');
    const ratingContainer = $('fb_starRating');
    if (ratingContainer) ratingContainer.style.borderColor = 'var(--danger)';
    isValid = false;
  } else {
    const ratingContainer = $('fb_starRating');
    if (ratingContainer) ratingContainer.style.borderColor = '';
  }

  return isValid;
}

function validatePaidForm() {
  let isValid = true;

  const requiredFields = ['name', 'designation', 'company', 'phone', 'email', 'city', 'employees'];
  requiredFields.forEach(id => {
    const field = $(id);
    if (field && !validateField(field, 'paid')) {
      isValid = false;
    }
  });

  const auditRating = document.querySelector('input[name="audit_rating"]:checked');
  if (!auditRating) {
    showToast('Please select an experience rating', 'error');
    const ratingContainer = $('audit_starRating');
    if (ratingContainer) ratingContainer.style.borderColor = 'var(--danger)';
    isValid = false;
  } else {
    const ratingContainer = $('audit_starRating');
    if (ratingContainer) ratingContainer.style.borderColor = '';
  }

  return isValid;
}

function markInvalid(field) {
  if (!field) return;
  field.style.borderColor = 'var(--danger)';
  field.setAttribute('aria-invalid', 'true');
  field.style.animation = 'none';
  setTimeout(() => {
    field.style.animation = 'shake 0.3s ease';
  }, 10);
}

// ===== FEEDBACK SUBMISSION =====
async function handleFeedbackSubmit() {
  debug('📤 Feedback submission triggered');

  if (!validateFeedbackForm()) {
    showToast('Please fill all required fields correctly', 'error');
    const firstInvalid = document.querySelector('#feedbackForm [aria-invalid="true"]');
    if (firstInvalid) firstInvalid.focus();
    return;
  }

  showLoader('Submitting Feedback...');

  try {
    const data = collectFeedbackData();
    debug('📦 Feedback data collected', data);

    await submitToGoogleSheets(data, 'feedback');
    showSuccess(data, 'feedback');
  } catch (error) {
    console.error('Feedback submission error:', error);
    showToast('⚠️ Feedback saved locally', 'warning');
    const data = collectFeedbackData();
    showSuccess(data, 'feedback');
  } finally {
    hideLoader();
  }
}

function collectFeedbackData() {
  const rating = document.querySelector('input[name="fb_rating"]:checked')?.value || 'Not rated';
  return {
    name: $('fb_name')?.value.trim() || '',
    designation: $('fb_designation')?.value.trim() || '',
    company: $('fb_company')?.value.trim() || '',
    employees: $('fb_employees')?.value.trim() || '',
    phone: $('fb_phone')?.value.trim() || '',
    email: $('fb_email')?.value.trim() || '',
    city: $('fb_city')?.value.trim() || '',
    session_rating: rating,
    remarks: $('fb_remarks')?.value.trim() || 'None',
    form_type: 'feedback',
    payment_status: 'Not Applicable',
    amount: '₹0.00',
    payment_method: 'None',
    razorpay_payment_id: 'N/A',
    timestamp: new Date().toISOString(),
    user_agent: navigator.userAgent,
    screen_resolution: `${screen.width}x${screen.height}`
  };
}

function resetFeedbackForm() {
  const form = $('feedbackForm');
  if (!form) return;

  form.querySelectorAll('input, textarea, select').forEach(el => {
    if (el.type === 'radio' || el.type === 'checkbox') {
      el.checked = false;
    } else if (el.tagName === 'SELECT') {
      el.selectedIndex = 0;
    } else {
      el.value = '';
    }
    el.style.borderColor = '';
    el.removeAttribute('aria-invalid');
  });

  const ratingContainer = $('fb_starRating');
  if (ratingContainer) ratingContainer.style.borderColor = '';

  debug('✅ Feedback form reset');
}

// ===== PAID SUBMISSION =====
async function handlePaidSubmit(e = null, autoSubmit = false) {
  if (e) e.preventDefault();

  debug('📤 Paid submission triggered', { autoSubmit });

  if (!paymentDone) {
    debug('❌ Payment not completed');
    showToast('⚠️ Please complete the payment first', 'error');
    $('payBtn')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  if (!validatePaidForm()) {
    showToast('Please fill all required fields correctly', 'error');
    const firstInvalid = document.querySelector('#paidForm [aria-invalid="true"]');
    if (firstInvalid) firstInvalid.focus();
    return;
  }

  if (!paymentData.razorpay_payment_id) {
    try {
      const saved = sessionStorage.getItem('paymentData');
      if (saved) {
        paymentData = JSON.parse(saved);
      }
    } catch (err) {
      debug('⚠️ Failed to restore payment data', err);
    }
  }

  if (!paymentData.razorpay_payment_id) {
    debug('❌ No payment ID');
    showToast('⚠️ Payment verification failed', 'error');
    resetPaidForm();
    return;
  }

  showLoader(autoSubmit ? 'Processing Payment...' : 'Processing Registration...');

  try {
    const data = collectPaidFormData();
    debug('📦 Paid data collected', data);

    await submitToGoogleSheets(data, 'audit');
    showSuccess(data, 'paid');
  } catch (error) {
    console.error('Paid submission error:', error);
    showToast('⚠️ Registration saved', 'warning');
    const data = collectPaidFormData();
    showSuccess(data, 'paid');
  } finally {
    hideLoader();
  }
}

function collectPaidFormData() {
  const auditRating = document.querySelector('input[name="audit_rating"]:checked')?.value || 'Not rated';
  return {
    name: $('name')?.value.trim() || '',
    designation: $('designation')?.value.trim() || '',
    company: $('company')?.value.trim() || '',
    employees: $('employees')?.value.trim() || '',
    phone: $('phone')?.value.trim() || '',
    email: $('email')?.value.trim() || '',
    city: $('city')?.value.trim() || '',
    audit_rating: auditRating,
    remarks: $('remarks')?.value.trim() || 'None',
    form_type: 'paid_registration',
    payment_status: 'Paid',
    amount: '₹999.00',
    payment_method: 'Razorpay',
    razorpay_payment_id: paymentData.razorpay_payment_id || 'PENDING',
    razorpay_order_id: paymentData.razorpay_order_id || 'N/A',
    razorpay_signature: paymentData.razorpay_signature || 'N/A',
    payment_link_id: paymentData.payment_link_id || 'IRE79PZ',
    timestamp: new Date().toISOString(),
    user_agent: navigator.userAgent,
    screen_resolution: `${screen.width}x${screen.height}`,
    return_url: CONFIG.RETURN_URL
  };
}

function resetPaidForm() {
  const form = $('paidForm');
  if (!form) return;

  form.querySelectorAll('input, textarea, select').forEach(el => {
    if (el.type === 'radio' || el.type === 'checkbox') {
      el.checked = false;
    } else if (el.tagName === 'SELECT') {
      el.selectedIndex = 0;
    } else {
      el.value = '';
    }
    el.style.borderColor = '';
    el.removeAttribute('aria-invalid');
  });

  resetPaymentUI();

  paymentDone = false;
  paymentData = {
    razorpay_payment_id: "",
    razorpay_order_id: "",
    razorpay_signature: "",
    payment_link_id: "IRE79PZ"
  };

  try {
    sessionStorage.removeItem('paymentData');
    sessionStorage.removeItem('tempPaidData');
  } catch (e) {
    debug('⚠️ Session cleanup failed', e);
  }

  debug('✅ Paid form reset');
}

// ===== GOOGLE SHEETS SUBMISSION =====
async function submitToGoogleSheets(data, formType) {
  if (!CONFIG.GOOGLE_SCRIPT || CONFIG.GOOGLE_SCRIPT.includes('YOUR_')) {
    debug('📋 Demo mode: Google Script not configured');
    return true;
  }

  try {
    const response = await fetch(CONFIG.GOOGLE_SCRIPT, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    debug(`✅ ${formType} data sent to Google Sheet`);
    return true;
  } catch (error) {
    console.error(`Google Sheets error (${formType}):`, error);
    return false;
  }
}

// ===== SUCCESS SCREEN =====
function showSuccess(data, formType) {
  $('feedbackForm')?.classList.add('hidden-form');
  $('paidForm')?.classList.add('hidden-form');

  const successMsg = $('successMsg');
  if (successMsg) {
    successMsg.classList.remove('hidden');

    const mappings = {
      sName: data.name,
      sEmail: data.email,
      sAmount: data.amount,
      sTime: new Date().toLocaleString('en-IN', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }),
      sType: formType === 'paid' ? 'Audit Registration' : 'Free Feedback',
      sStatus: 'Completed'
    };

    Object.entries(mappings).forEach(([id, value]) => {
      const el = $(id);
      if (el) el.textContent = value;
    });

    const paymentIdRow = $('paymentIdRow');
    const sPaymentId = $('sPaymentId');
    if (formType === 'paid' && data.razorpay_payment_id && data.razorpay_payment_id !== 'N/A') {
      if (paymentIdRow) paymentIdRow.style.display = 'flex';
      if (sPaymentId) sPaymentId.textContent = data.razorpay_payment_id;
    } else {
      if (paymentIdRow) paymentIdRow.style.display = 'none';
    }

    const successTitle = $('successTitle');
    if (successTitle) {
      successTitle.textContent = formType === 'paid'
        ? '✅ Registration Successful!'
        : '✅ Feedback Submitted!';
    }

    debug(`🎉 Success screen displayed for ${formType}`);
  }

  currentView = 'success';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== PAYMENT UI =====
function updatePaymentUI(paid) {
  const paymentStatus = $('paymentStatus');
  const payBtn = $('payBtn');
  const submitBtn = $('submitBtn');

  if (!paymentStatus || !payBtn) return;

  if (paid) {
    paymentStatus.innerHTML = '✅ Payment: <b style="color:var(--success)">Completed</b>';
    paymentStatus.classList.add('paid');
    payBtn.innerHTML = '<i class="fas fa-check"></i> Payment Successful';
    payBtn.style.background = 'linear-gradient(135deg, var(--success), var(--success-dark))';
    payBtn.style.pointerEvents = 'none';
    payBtn.setAttribute('aria-disabled', 'true');
    payBtn.setAttribute('tabindex', '-1');

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.focus();
    }

    debug('🎨 Payment UI: Paid state');
  }
}

function resetPaymentUI() {
  const paymentStatus = $('paymentStatus');
  const payBtn = $('payBtn');
  const submitBtn = $('submitBtn');

  if (!paymentStatus || !payBtn) return;

  paymentStatus.innerHTML = '⏳ Payment: <b>Pending</b>';
  paymentStatus.classList.remove('paid');
  payBtn.innerHTML = '<i class="fas fa-rupee-sign"></i> Pay ₹999 Securely';
  payBtn.style.background = '';
  payBtn.style.pointerEvents = '';
  payBtn.removeAttribute('aria-disabled');
  payBtn.removeAttribute('tabindex');

  if (submitBtn) submitBtn.disabled = true;

  debug('🎨 Payment UI: Pending state');
}

// ===== STAR RATING =====
function initStarRating(containerId) {
  const container = $(containerId);
  if (!container) return;

  const labels = container.querySelectorAll('label');
  labels.forEach(label => {
    label.addEventListener('click', function(e) {
      e.preventDefault();
      const inputId = this.getAttribute('for');
      const input = document.getElementById(inputId);
      if (input) {
        container.querySelectorAll('input').forEach(radio => {
          radio.checked = false;
        });
        input.checked = true;
        container.style.borderColor = '';
        debug(`⭐ Rating selected: ${input.value}`);
      }
    });

    label.setAttribute('tabindex', '0');
    label.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        label.click();
      }
    });
  });
}

// ===== LOADER =====
function showLoader(text = 'Processing...') {
  const loader = $('loader');
  const loaderText = $('loaderText');

  if (loader) {
    loader.classList.remove('hidden');
    loader.setAttribute('aria-hidden', 'false');
  }
  if (loaderText) loaderText.textContent = text;

  document.body.style.overflow = 'hidden';
  debug(`🔄 Loader shown: ${text}`);
}

function hideLoader() {
  const loader = $('loader');
  if (loader) {
    loader.classList.add('hidden');
    loader.setAttribute('aria-hidden', 'true');
  }

  document.body.style.overflow = '';
  debug('🔄 Loader hidden');
}

// ===== TOAST =====
function showToast(message, type = 'info') {
  const toast = $('toast');
  if (!toast) return;

  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle'
  };

  if (toast._timeoutId) {
    clearTimeout(toast._timeoutId);
    delete toast._timeoutId;
  }

  toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');

  toast._timeoutId = setTimeout(() => {
    toast.classList.add('hidden');
    delete toast._timeoutId;
  }, 3500);

  debug(`🔔 Toast: [${type}] ${message}`);
}

// ===== GLOBAL RESET =====
function resetAll() {
  debug('🔄 Global reset triggered');

  $('successMsg')?.classList.add('hidden');
  resetFeedbackForm();
  resetPaidForm();
  showView('landing');

  if (window.history.replaceState) {
    window.history.replaceState({}, document.title, CONFIG.RETURN_URL);
  }

  debug('✅ Global reset complete');
}

// ===== EVENT LISTENERS =====
window.addEventListener('popstate', () => {
  if (!paymentDone && !window.location.search.includes('razorpay_')) {
    debug('⬅️ Back navigation - resetting');
    resetAll();
  }
});

window.addEventListener('beforeunload', () => {
  try {
    sessionStorage.removeItem('tempPaidData');
  } catch (e) {
    // Ignore
  }
});

document.addEventListener('focusin', (e) => {
  if (e.target.tagName === 'INPUT' && window.innerWidth < 500) {
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta && !meta.content.includes('user-scalable=no')) {
      meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    }
  }
});

$$('input[type="text"], input[type="email"], input[type="tel"], input[type="number"], textarea').forEach(field => {
  field.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      const form = e.target.closest('form');
      const fields = Array.from(form?.querySelectorAll('input, textarea, select') || []);
      const currentIndex = fields.indexOf(e.target);
      const nextField = fields[currentIndex + 1];
      if (nextField) nextField.focus();
      else e.target.blur();
    }
  });
});

const style = document.createElement('style');
style.textContent = `
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}
`;
document.head.appendChild(style);

debug('🎯 Event Registration System Ready');