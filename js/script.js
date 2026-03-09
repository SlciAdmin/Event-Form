const CONFIG = {
    // ✅ FIXED: Removed trailing spaces from URLs
    PAYMENT_LINK: "https://rzp.io/rzp/5NCrTAI",
    
    AMOUNT: 100, // ₹1.00 = 100 paise
    CURRENCY: "INR",
    
    // ✅ FIXED: Removed trailing spaces
    GOOGLE_SCRIPT: "https://script.google.com/macros/s/AKfycbwLzF0hUTdqqZ8pJKKrxofb-C1F3J4iZvnjrPCdAjM94tLbQDIf40lLpxopE9ZImfRe/exec",
    
    // ✅ ADD: Your page URL for payment return (IMPORTANT for Payment Links)
    RETURN_URL: window.location.href.split('?')[0]
};

// ===== STATE =====
let paymentDone = false;
let paymentData = {
    razorpay_payment_id: "",
    razorpay_order_id: "",
    razorpay_signature: "",
    payment_link_id: "IRE79PZ"
};

// ===== DOM SHORTCUTS =====
const $ = id => document.getElementById(id);
const $$ = (sel, ctx = document) => ctx.querySelectorAll(sel);

// ===== CRITICAL: Handle Payment Return FIRST before any reset =====
function handlePaymentReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentId = urlParams.get('razorpay_payment_id');
    const status = urlParams.get('razorpay_payment_status');
    const orderId = urlParams.get('razorpay_order_id');
    const error = urlParams.get('razorpay_error');
    
    // ✅ If payment successful
    if (paymentId && status === 'captured') {
        paymentDone = true;
        paymentData.razorpay_payment_id = paymentId;
        paymentData.razorpay_order_id = orderId || 'N/A';
        
        // Save to sessionStorage for form submission
        sessionStorage.setItem('paymentData', JSON.stringify(paymentData));
        
        // Clean URL without reload
        window.history.replaceState({}, document.title, CONFIG.RETURN_URL);
        
        return true;
    }
    
    // ✅ If payment failed/cancelled
    if (error || (status && status !== 'captured')) {
        showToast(`⚠️ Payment ${error ? 'Failed' : 'Cancelled'}. Try again.`, 'warning');
        resetPaymentUI();
        window.history.replaceState({}, document.title, CONFIG.RETURN_URL);
        return false;
    }
    
    return false;
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    // ✅ STEP 1: Check payment return FIRST (before reset)
    const paymentReceived = handlePaymentReturn();
    
    // ✅ STEP 2: Only reset if NO payment data in URL AND no saved session
    const savedPayment = sessionStorage.getItem('paymentData');
    if (!paymentReceived && !savedPayment) {
        forceResetForNewUser();
    } else if (savedPayment) {
        // Restore payment state from session
        paymentData = JSON.parse(savedPayment);
        paymentDone = true;
        updatePaymentUI(true);
        const submitBtn = $('submitBtn');
        if (submitBtn) submitBtn.disabled = false;
    }
    
    initStarRating();
    initEventListeners();
    setReceiptTime();
    
    // Prevent page cache issues
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            // Only reload if no payment in progress
            if (!paymentDone && !sessionStorage.getItem('paymentData')) {
                window.location.reload();
            }
        }
    });
});

// ===== RESET FOR NEW USER (Safe Version) =====
function forceResetForNewUser() {
    console.log('🔄 Fresh session started');
    
    // Clear ONLY form-related storage, keep payment if exists
    const paymentDataTemp = sessionStorage.getItem('paymentData');
    
    sessionStorage.clear();
    localStorage.clear();
    
    // Restore payment data if it existed
    if (paymentDataTemp) {
        sessionStorage.setItem('paymentData', paymentDataTemp);
    }
    
    // Reset state only if no payment
    if (!paymentDataTemp) {
        paymentDone = false;
        paymentData = {
            razorpay_payment_id: "",
            razorpay_order_id: "",
            razorpay_signature: "",
            payment_link_id: "IRE79PZ"
        };
    }
    
    clearFormFields();
    
    if (!paymentDataTemp) {
        resetPaymentUI();
        hideSuccessScreen();
        showForm();
    }
    
    // Clean URL
    if (window.location.search && !window.location.search.includes('razorpay_')) {
        window.history.replaceState({}, document.title, CONFIG.RETURN_URL);
    }
    
    const submitBtn = $('submitBtn');
    if (submitBtn && !paymentDone) submitBtn.disabled = true;
    
    console.log('✅ State initialized');
}

// ===== CLEAR FORM FIELDS =====
function clearFormFields() {
    const form = $('regForm');
    if (!form) return;
    
    form.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], textarea').forEach(input => {
        input.value = '';
        input.style.borderColor = '';
        input.removeAttribute('aria-invalid');
    });
    
    form.querySelectorAll('select').forEach(select => select.selectedIndex = 0);
    form.querySelectorAll('input[type="radio"]').forEach(radio => radio.checked = false);
}

// ===== UI HELPERS =====
function hideSuccessScreen() {
    $('successMsg')?.classList.add('hidden');
    $('regForm')?.classList.remove('hidden');
}

function showForm() {
    const form = $('regForm');
    if (form) {
        form.style.display = 'block';
        form.classList.remove('hidden');
    }
}

// ===== EVENT LISTENERS =====
function initEventListeners() {
    const payBtn = $('payBtn');
    const form = $('regForm');
    
    if (payBtn) {
        payBtn.addEventListener('click', initiatePayment);
    }
    if (form) {
        form.addEventListener('submit', handleSubmit);
    }
    
    // Real-time validation
    ['name', 'email', 'phone'].forEach(id => {
        const field = $(id);
        if (field) {
            field.addEventListener('blur', () => validateField(field));
            field.addEventListener('input', () => {
                if (field.style.borderColor === 'rgb(231, 76, 60)') {
                    field.style.borderColor = '';
                }
            });
        }
    });
}

// ===== PAYMENT INITIATION - FIXED =====
async function initiatePayment() {
    if (!validateForm()) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    if (paymentDone) {
        showToast('⚠️ Payment already completed', 'warning');
        return;
    }
    
    const payBtn = $('payBtn');
    setLoading(payBtn, true, 'Redirecting...');
    
    try {
        // ✅ Save form data before redirect
        const formData = collectFormData();
        sessionStorage.setItem('tempFormData', JSON.stringify(formData));
        
        // ✅ FIXED: Open Payment Link in SAME tab with proper return URL handling
        // Razorpay Payment Links automatically redirect back to configured URL
        // Make sure your Razorpay dashboard has RETURN_URL set as "Redirect URL"
        
        setTimeout(() => {
            // ✅ CRITICAL: Use replace to avoid back-button issues
            window.location.replace(CONFIG.PAYMENT_LINK.trim());
        }, 500);
        
    } catch (error) {
        console.error('Payment initiation error:', error);
        showToast('⚠️ Could not start payment. Try again.', 'error');
        resetPaymentUI();
        setLoading(payBtn, false);
    }
}

// ===== UI UPDATES =====
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
        payBtn.disabled = true;
        
        if (submitBtn) submitBtn.disabled = false;
    }
}

function resetPaymentUI() {
    const paymentStatus = $('paymentStatus');
    const payBtn = $('payBtn');
    const submitBtn = $('submitBtn');
    
    if (!paymentStatus || !payBtn) return;
    
    paymentStatus.innerHTML = '⏳ Payment: <b>Pending</b>';
    paymentStatus.classList.remove('paid');
    
    payBtn.innerHTML = '<i class="fas fa-rupee-sign"></i> Pay ₹1 Securely';
    payBtn.style.background = '';
    payBtn.disabled = false;
    
    if (submitBtn) submitBtn.disabled = true;
}

// ===== VALIDATION =====
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
        markInvalid($('email'));
        isValid = false;
    }
    
    const phone = $('phone')?.value.trim();
    if (phone && !/^[6-9]\d{9}$/.test(phone)) {
        markInvalid($('phone'));
        isValid = false;
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
            markInvalid(field);
            return false;
        }
    }
    
    if (field.type === 'tel' && field.value) {
        if (!/^[6-9]\d{9}$/.test(field.value)) {
            markInvalid(field);
            return false;
        }
    }
    
    field.style.borderColor = '';
    return true;
}

function markInvalid(field) {
    if (!field) return;
    field.style.borderColor = 'var(--danger)';
    field.setAttribute('aria-invalid', 'true');
}

// ===== FORM SUBMISSION =====
async function handleSubmit(e) {
    if (e) e.preventDefault();
    
    if (!paymentDone) {
        showToast('⚠️ Please complete payment first', 'error');
        $('payBtn')?.scrollIntoView({ behavior: 'smooth' });
        return;
    }
    
    // Get payment data from session if not in memory
    if (!paymentData.razorpay_payment_id) {
        const saved = sessionStorage.getItem('paymentData');
        if (saved) {
            paymentData = JSON.parse(saved);
        }
    }
    
    if (!paymentData.razorpay_payment_id) {
        showToast('⚠️ Payment verification failed', 'error');
        forceResetForNewUser();
        return;
    }
    
    const loader = $('loader');
    loader?.classList.remove('hidden');
    
    try {
        const data = collectFormData();
        await submitToGoogleSheets(data);
        showSuccess(data);
        
        // ✅ Reset after 3 seconds for next user
        setTimeout(() => {
            forceResetForNewUser();
        }, 3000);
        
    } catch (error) {
        console.error('Submit error:', error);
        showToast('⚠️ Registration saved but confirmation pending', 'warning');
        showSuccess(collectFormData());
    } finally {
        $('loader')?.classList.add('hidden');
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
        payment_status: 'Paid',
        amount: '₹1.00',
        payment_method: 'Razorpay',
        razorpay_payment_id: paymentData.razorpay_payment_id || 'PENDING',
        timestamp: new Date().toISOString()
    };
}

async function submitToGoogleSheets(data) {
    if (!CONFIG.GOOGLE_SCRIPT || CONFIG.GOOGLE_SCRIPT.includes('YOUR_')) {
        console.log('📋 Demo mode - Data:', data);
        return true;
    }
    
    try {
        // ✅ Use mode: 'no-cors' for Google Apps Script
        await fetch(CONFIG.GOOGLE_SCRIPT.trim(), {
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
    $('regForm')?.classList.add('hidden');
    $('successMsg')?.classList.remove('hidden');
    
    $('sName') && ($('sName').textContent = data.name);
    $('sEmail') && ($('sEmail').textContent = data.email);
    $('sAmount') && ($('sAmount').textContent = data.amount);
    $('sPaymentId') && ($('sPaymentId').textContent = paymentData.razorpay_payment_id);
    $('sTime') && ($('sTime').textContent = new Date().toLocaleString('en-IN'));
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setReceiptTime() {
    const sTime = $('sTime');
    if (sTime) sTime.textContent = new Date().toLocaleString('en-IN');
}

// ===== UTILITIES =====
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
    const toast = $('toast');
    if (!toast) return;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    
    if (toast.timeoutId) clearTimeout(toast.timeoutId);
    toast.timeoutId = setTimeout(() => {
        toast.classList.add('hidden');
    }, 3500);
}

// ===== STAR RATING (Basic Implementation) =====
function initStarRating() {
    const stars = $$('.star-rating label');
    stars.forEach(label => {
        label.addEventListener('click', function() {
            const value = this.getAttribute('for').replace('star', '');
            document.querySelectorAll('.star-rating input').forEach(radio => {
                radio.checked = (radio.value === value);
            });
        });
    });
}

// ===== PREVENT BACK NAVIGATION ISSUES =====
window.addEventListener('popstate', () => {
    // Only reset if not in payment flow
    if (!paymentDone && !window.location.search.includes('razorpay_')) {
        forceResetForNewUser();
    }
});

// ===== CLEANUP ON UNLOAD =====
window.addEventListener('beforeunload', () => {
    // Only clear temp form data, keep payment data
    sessionStorage.removeItem('tempFormData');
});