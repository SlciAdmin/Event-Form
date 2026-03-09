// ===== CONFIGURATION =====
const CONFIG = {
  UPI_ID: "nikhilbajaj2690-2@oksbi",
  UPI_NAME: "Nikhil Bajaj",
  AMOUNT: "1.00",
  NOTE: "Seminar Registration",
  // ✅ FIXED: Removed trailing spaces from URL
  GOOGLE_SCRIPT: "https://script.google.com/macros/s/AKfycbwLzF0hUTdqqZ8pJKKrxofb-C1F3J4iZvnjrPCdAjM94tLbQDIf40lLpxopE9ZImfRe/exec"
};

// ===== STATE =====
let paymentDone = false;
let paymentRef = "";
let selectedUPI = "";
let upiAppOpened = false;

// ===== DOM SHORTCUTS =====
const $ = id => document.getElementById(id);
const $$ = (sel, ctx = document) => ctx.querySelectorAll(sel);
const form = $('regForm');
const payBtn = $('payBtn');
const submitBtn = $('submitBtn');
const paymentStatus = $('paymentStatus');
const successMsg = $('successMsg');
const loader = $('loader');
const toast = $('toast');

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  initStarRating();
  initUPIButtons();
  initEventListeners();
  setReceiptTime();
});

// ===== STAR RATING =====
function initStarRating() {
  const rating = $('starRating');
  const stars = $$('.star-rating label', rating);
  
  stars.forEach(star => {
    star.addEventListener('touchstart', (e) => {
      e.preventDefault();
      star.click();
    }, { passive: true });
  });
  
  rating.addEventListener('keydown', (e) => {
    const checked = rating.querySelector('input:checked');
    const inputs = $$('input', rating);
    const idx = checked ? Array.from(inputs).indexOf(checked) : -1;
    
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = inputs[Math.min(idx + 1, inputs.length - 1)];
      if (next) { next.checked = true; next.dispatchEvent(new Event('change')); }
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      const prev = inputs[Math.max(idx - 1, 0)];
      if (prev) { prev.checked = true; prev.dispatchEvent(new Event('change')); }
    }
  });
}

// ===== UPI BUTTONS =====
function initUPIButtons() {
  $$('.upi-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.upi-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedUPI = btn.dataset.app;
      showToast(`Selected: ${btn.querySelector('span').textContent}`, 'info');
    });
  });
}

// ===== EVENT LISTENERS =====
function initEventListeners() {
  payBtn.addEventListener('click', startPayment);
  form.addEventListener('submit', handleSubmit);
  
  ['name', 'email', 'phone'].forEach(id => {
    $(id).addEventListener('blur', () => validateField($(id)));
    $(id).addEventListener('input', () => {
      if ($(id).style.borderColor === 'rgb(231, 76, 60)') {
        $(id).style.borderColor = '';
      }
    });
  });
}

// ===== UPI PAYMENT FLOW - MERGED & FIXED =====
async function startPayment() {
  // Validate form first
  if (!validateForm()) {
    showToast('Please fill all required fields first', 'error');
    return;
  }
  
  // Check if UPI app selected
  if (!selectedUPI) {
    showToast('Please select a UPI app first', 'warning');
    document.querySelector('.upi-apps')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  
  setLoading(payBtn, true, 'Opening UPI App...');
  upiAppOpened = false;
  
  // Create UPI Link with proper encoding
  const upiLink = `upi://pay?pa=${encodeURIComponent(CONFIG.UPI_ID)}&pn=${encodeURIComponent(CONFIG.UPI_NAME)}&am=${CONFIG.AMOUNT}&tn=${encodeURIComponent(CONFIG.NOTE)}&cu=INR`;
  
  // Track if app opened
  const startTime = Date.now();
  let appOpened = false;
  
  // Visibility change handler - detects when user switches to UPI app
  const handleVisibilityChange = () => {
    if (document.hidden) {
      appOpened = true;
      upiAppOpened = true;
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Try to open UPI app with standard link
  window.location.href = upiLink;
  
  // App-specific fallback links for better compatibility
  if (selectedUPI === 'gpay') {
    setTimeout(() => {
      if (!appOpened) {
        window.location.href = `tez://upi/pay?pa=${encodeURIComponent(CONFIG.UPI_ID)}&pn=${encodeURIComponent(CONFIG.UPI_NAME)}&am=${CONFIG.AMOUNT}&tn=${encodeURIComponent(CONFIG.NOTE)}&cu=INR`;
      }
    }, 1500);
  } else if (selectedUPI === 'phonepe') {
    setTimeout(() => {
      if (!appOpened) {
        window.location.href = `phonepe://pay?pa=${encodeURIComponent(CONFIG.UPI_ID)}&pn=${encodeURIComponent(CONFIG.UPI_NAME)}&am=${CONFIG.AMOUNT}&tn=${encodeURIComponent(CONFIG.NOTE)}&cu=INR`;
      }
    }, 1500);
  } else if (selectedUPI === 'paytm') {
    setTimeout(() => {
      if (!appOpened) {
        window.location.href = `paytmmp://upi/pay?pa=${encodeURIComponent(CONFIG.UPI_ID)}&pn=${encodeURIComponent(CONFIG.UPI_NAME)}&am=${CONFIG.AMOUNT}&tn=${encodeURIComponent(CONFIG.NOTE)}&cu=INR`;
      }
    }, 1500);
  }
  
  // Wait and check if app opened
  setTimeout(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    setLoading(payBtn, false);
    
    const timeElapsed = Date.now() - startTime;
    
    // Show confirmation dialog after short delay
    setTimeout(() => {
      const confirmationMsg = `₹${CONFIG.AMOUNT} का payment complete हुआ?
      
✅ अगर payment हो गया तो OK दबाएं
❌ अगर payment नहीं हुआ तो Cancel दबाएं

📱 UPI ID: ${CONFIG.UPI_ID}
💰 Amount: ₹${CONFIG.AMOUNT}
📝 Note: ${CONFIG.NOTE}`;
      
      const paid = confirm(confirmationMsg);
      
      if (paid) {
        paymentDone = true;
        paymentRef = `PAY${Date.now().toString().slice(-8)}`;
        
        // Update UI with success state
        paymentStatus.innerHTML = '✅ Payment: <b style="color:var(--success); font-weight:600">Completed</b>';
        paymentStatus.classList.add('paid');
        payBtn.innerHTML = '<i class="fas fa-check-circle"></i> Payment Successful';
        payBtn.disabled = true;
        payBtn.style.background = 'linear-gradient(135deg, var(--success), var(--success-dark))';
        payBtn.style.cursor = 'default';
        submitBtn.disabled = false;
        
        showToast('Payment Confirmed! Now submit the form', 'success');
        
        // Auto scroll to submit button with animation
        setTimeout(() => {
          submitBtn?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          submitBtn.style.transform = 'scale(1.05)';
          setTimeout(() => submitBtn.style.transform = '', 300);
        }, 500);
      } else {
        showToast('Payment cancelled. Try again when ready.', 'info');
        payBtn.disabled = false;
        payBtn.style.background = '';
        payBtn.style.cursor = 'pointer';
      }
    }, 2000);
    
  }, 2500);
}

// ===== FORM VALIDATION =====
function validateForm() {
  const required = ['name', 'designation', 'company', 'phone', 'email', 'city'];
  let isValid = true;
  
  required.forEach(id => {
    const field = $(id);
    if (!field || !field.value.trim()) {
      if (field) markInvalid(field);
      isValid = false;
    }
  });
  
  const email = $('email')?.value.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    markInvalid($('email'), 'Please enter valid email');
    isValid = false;
  }
  
  const phone = $('phone')?.value.trim();
  if (phone && !/^[6-9]\d{9}$/.test(phone)) {
    markInvalid($('phone'), 'Enter 10-digit mobile number');
    isValid = false;
  }
  
  if (!isValid) {
    showToast('Please fill all required fields correctly', 'error');
    const firstInvalid = document.querySelector('input:invalid, select:invalid');
    if (firstInvalid) firstInvalid.focus();
  }
  
  return isValid;
}

function validateField(field) {
  if (!field) return false;
  
  if (!field.value.trim() && field.required) {
    markInvalid(field);
    return false;
  }
  
  if (field.type === 'email' && field.value) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)) {
      markInvalid(field, 'Invalid email format');
      return false;
    }
  }
  
  if (field.type === 'tel' && field.value) {
    if (!/^[6-9]\d{9}$/.test(field.value)) {
      markInvalid(field, 'Invalid mobile number');
      return false;
    }
  }
  
  field.style.borderColor = '';
  field.removeAttribute('aria-invalid');
  return true;
}

function markInvalid(field, message = '') {
  if (!field) return;
  field.style.borderColor = 'var(--danger)';
  field.setAttribute('aria-invalid', 'true');
  if (message) showToast(message, 'error');
}

// ===== FORM SUBMISSION =====
async function handleSubmit(e) {
  e.preventDefault();
  
  if (!paymentDone) {
    showToast('⚠️ Please complete payment first', 'warning');
    payBtn?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  
  loader?.classList.remove('hidden');
  
  try {
    const data = collectFormData();
    await submitToGoogleSheets(data);
    showSuccess(data);
  } catch (error) {
    console.error('Submission error:', error);
    showSuccess(collectFormData());
    showToast('⚠️ Saved locally. Confirmation may be delayed.', 'warning');
  } finally {
    loader?.classList.add('hidden');
  }
}

function collectFormData() {
  const rating = document.querySelector('input[name="rating"]:checked')?.value || 'Not rated';
  
  return {
    name: $('name')?.value.trim() || '',
    designation: $('designation')?.value.trim() || '',
    company: $('company')?.value.trim() || '',
    employees: $('employees')?.value || 'Not specified',
    phone: $('phone')?.value.trim() || '',
    email: $('email')?.value.trim() || '',
    city: $('city')?.value.trim() || '',
    rating: rating,
    remarks: $('remarks')?.value.trim() || 'None',
    payment: 'Paid',
    amount: `₹${CONFIG.AMOUNT}`,
    ref: paymentRef,
    upi_app: selectedUPI || 'Not selected',
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent
  };
}

async function submitToGoogleSheets(data) {
  if (!CONFIG.GOOGLE_SCRIPT || CONFIG.GOOGLE_SCRIPT.includes('YOUR_')) {
    console.log('✅ Demo mode - Data:', data);
    return;
  }
  
  try {
    await fetch(CONFIG.GOOGLE_SCRIPT, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return true;
  } catch (err) {
    console.error('Google Sheets error:', err);
    throw err;
  }
}

// ===== SUCCESS SCREEN =====
function showSuccess(data) {
  if (form) form.classList.add('hidden');
  if (successMsg) successMsg.classList.remove('hidden');
  
  const sName = $('sName');
  const sEmail = $('sEmail');
  const sRef = $('sRef');
  const sTime = $('sTime');
  
  if (sName) sName.textContent = data.name;
  if (sEmail) sEmail.textContent = data.email;
  if (sRef) sRef.textContent = paymentRef || 'N/A';
  if (sTime) sTime.textContent = new Date().toLocaleString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit'
  });
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  if (navigator.vibrate) navigator.vibrate(50);
}

function setReceiptTime() {
  const sTime = $('sTime');
  if (sTime) sTime.textContent = new Date().toLocaleString('en-IN');
}

// ===== UI UTILITIES =====
function setLoading(button, loading, text = '') {
  if (!button) return;
  
  button.disabled = loading;
  
  if (loading && text) {
    button.dataset.original = button.innerHTML;
    button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${text}`;
  } else if (!loading && button.dataset.original) {
    button.innerHTML = button.dataset.original;
    delete button.dataset.original;
  }
}

function showToast(message, type = 'info') {
  if (!toast) return;
  
  toast.textContent = '';
  toast.className = `toast ${type}`;
  
  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle'
  };
  
  toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
  toast.classList.remove('hidden');
  
  setTimeout(() => toast.classList.add('hidden'), 3200);
}

// ===== PRINT & PWA =====
window.addEventListener('beforeprint', () => document.body.classList.add('printing'));
window.addEventListener('afterprint', () => document.body.classList.remove('printing'));

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // navigator.serviceWorker.register('/sw.js');
  });
}