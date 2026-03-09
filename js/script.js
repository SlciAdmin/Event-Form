const CONFIG = {
    // Aapka Razorpay.me link (full URL)
    PAYMENT_LINK: "https://rzp.io/rzp/5NCrTAI",
    
    AMOUNT: 100, // ₹1.00 = 100 paise
    CURRENCY: "INR",
    
    // Google Apps Script URL
    GOOGLE_SCRIPT: "https://script.google.com/macros/s/AKfycbwLzF0hUTdqqZ8pJKKrxofb-C1F3J4iZvnjrPCdAjM94tLbQDIf40lLpxopE9ZImfRe/exec"
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

// ===== CRITICAL: PREVENT BACK/FORWARD CACHE =====
if (window.performance && window.performance.navigation.type === window.performance.navigation.TYPE_BACK_FORWARD) {
    // User used back/forward button - FORCE RELOAD
    window.location.reload(true);
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    // CRITICAL: Always reset for new user
    forceResetForNewUser();
    
    initStarRating();
    initEventListeners();
    setReceiptTime();
    checkPaymentReturn();
    
    // Prevent page cache
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            // Page was loaded from bfcache - reload fresh
            window.location.reload();
        }
    });
});

// ===== CRITICAL: FORCE RESET FOR EVERY NEW USER =====
function forceResetForNewUser() {
    console.log('🔄 New user detected - Resetting everything...');
    
    // 1. Clear ALL storage
    sessionStorage.clear();
    localStorage.clear();
    
    // 2. Reset payment state
    paymentDone = false;
    paymentData = {
        razorpay_payment_id: "",
        razorpay_order_id: "",
        razorpay_signature: "",
        payment_link_id: "IRE79PZ"
    };
    
    // 3. Clear form fields
    clearFormFields();
    
    // 4. Reset UI
    resetPaymentUI();
    hideSuccessScreen();
    showForm();
    
    // 5. Clean URL
    if (window.location.search) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // 6. Disable submit button
    const submitBtn = $('submitBtn');
    if (submitBtn) submitBtn.disabled = true;
    
    console.log('✅ Fresh state ready for new user');
}

// ===== CLEAR ALL FORM FIELDS =====
function clearFormFields() {
    const form = $('regForm');
    if (!form) return;
    
    // Clear all inputs
    const inputs = form.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], textarea');
    inputs.forEach(input => {
        input.value = '';
        input.style.borderColor = '';
        input.removeAttribute('aria-invalid');
    });
    
    // Reset selects
    const selects = form.querySelectorAll('select');
    selects.forEach(select => select.selectedIndex = 0);
    
    // Clear radio buttons (star rating)
    const radios = form.querySelectorAll('input[type="radio"]');
    radios.forEach(radio => radio.checked = false);
    
    console.log('🧹 Form fields cleared');
}

// ===== HIDE SUCCESS SCREEN & SHOW FORM =====
function hideSuccessScreen() {
    const successMsg = $('successMsg');
    const form = $('regForm');
    
    if (successMsg) successMsg.classList.add('hidden');
    if (form) form.classList.remove('hidden');
}

function showForm() {
    const form = $('regForm');
    if (form) {
        form.style.display = 'block';
        form.classList.remove('hidden');
    }
}

// ===== CHECK PAYMENT RETURN =====
function checkPaymentReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentId = urlParams.get('razorpay_payment_id');
    const status = urlParams.get('razorpay_payment_status');
    const orderId = urlParams.get('razorpay_order_id');
    
    if (paymentId && status === 'captured') {
        // Valid payment received
        paymentDone = true;
        paymentData.razorpay_payment_id = paymentId;
        paymentData.razorpay_order_id = orderId || 'N/A';
        
        updatePaymentUI(true);
        showToast('✅ Payment Successful! Complete registration.', 'success');
        
        // Enable submit button
        const submitBtn = $('submitBtn');
        if (submitBtn) submitBtn.disabled = false;
        
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Scroll to submit button
        setTimeout(() => {
            submitBtn?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 500);
    }
}

// ===== EVENT LISTENERS =====
function initEventListeners() {
    const payBtn = $('payBtn');
    const form = $('regForm');
    
    if (payBtn) payBtn.addEventListener('click', initiatePayment);
    if (form) form.addEventListener('submit', handleSubmit);
    
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

// ===== PAYMENT INITIATION =====
async function initiatePayment() {
    if (!validateForm()) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    if (paymentDone) {
        showToast('⚠️ Payment already done', 'warning');
        return;
    }
    
    // Show loading
    setLoading($('payBtn'), true, 'Redirecting...');
    
    try {
        // Save form data temporarily
        const formData = collectFormData();
        sessionStorage.setItem('tempFormData', JSON.stringify(formData));
        
        // Redirect to Razorpay
        setTimeout(() => {
            window.location.href = CONFIG.PAYMENT_LINK;
        }, 800);
        
    } catch (error) {
        console.error('Payment error:', error);
        showToast('⚠️ Payment failed. Try again.', 'error');
        resetPaymentUI();
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
        showToast('⚠️ Payment required!', 'error');
        $('payBtn')?.scrollIntoView({ behavior: 'smooth' });
        return;
    }
    
    if (!paymentData.razorpay_payment_id) {
        showToast('⚠️ Payment verification failed', 'error');
        forceResetForNewUser();
        return;
    }
    
    // Show loader
    const loader = $('loader');
    if (loader) loader.classList.remove('hidden');
    
    try {
        const data = collectFormData();
        await submitToGoogleSheets(data);
        showSuccess(data);
        
        // CRITICAL: Reset after successful submission
        // This ensures next user gets fresh form
        setTimeout(() => {
            forceResetForNewUser();
        }, 3000);
        
    } catch (error) {
        console.error('Submit error:', error);
        showSuccess(collectFormData());
    } finally {
        const loader = $('loader');
        if (loader) loader.classList.add('hidden');
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
        console.log('Demo mode:', data);
        return true;
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
        console.error('Sheets error:', err);
        throw err;
    }
}

// ===== SUCCESS SCREEN =====
function showSuccess(data) {
    const form = $('regForm');
    const successMsg = $('successMsg');
    
    if (form) form.classList.add('hidden');
    if (successMsg) successMsg.classList.remove('hidden');
    
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
    }, 3000);
}

// Prevent back button bypass
window.addEventListener('popstate', () => {
    forceResetForNewUser();
});

// Prevent page cache
window.addEventListener('beforeunload', () => {
    sessionStorage.clear();
});