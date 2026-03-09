const CONFIG = {
    // ✅ NO TRAILING SPACES - CRITICAL FIX
    PAYMENT_LINK: "https://rzp.io/rzp/5NCrTAI",
    
    AMOUNT: 100,
    CURRENCY: "INR",
    
    GOOGLE_SCRIPT: "https://script.google.com/macros/s/AKfycbwLzF0hUTdqqZ8pJKKrxofb-C1F3J4iZvnjrPCdAjM94tLbQDIf40lLpxopE9ZImfRe/exec",
    
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

// ===== DEBUG HELPER =====
function debug(msg, data = null) {
    console.log(`[💳 DEBUG] ${msg}`, data || '');
}

// ===== HANDLE PAYMENT RETURN (After Razorpay Redirect) =====
function handlePaymentReturn() {
    debug('Checking payment return params...');
    
    const urlParams = new URLSearchParams(window.location.search);
    const paymentId = urlParams.get('razorpay_payment_id');
    const status = urlParams.get('razorpay_payment_status');
    const orderId = urlParams.get('razorpay_order_id');
    const error = urlParams.get('razorpay_error');
    
    // ✅ Payment Successful
    if (paymentId && status === 'captured') {
        debug('✅ Payment captured!', { paymentId, orderId });
        
        paymentDone = true;
        paymentData.razorpay_payment_id = paymentId;
        paymentData.razorpay_order_id = orderId || 'N/A';
        
        // Save to sessionStorage
        sessionStorage.setItem('paymentData', JSON.stringify(paymentData));
        
        // Clean URL
        if (window.history.replaceState) {
            window.history.replaceState({}, document.title, CONFIG.RETURN_URL);
        }
        
        // Update UI
        updatePaymentUI(true);
        $('submitBtn') && ($('submitBtn').disabled = false);
        
        return true;
    }
    
    // ✅ Payment Failed/Cancelled
    if (error || (status && status !== 'captured')) {
        debug('❌ Payment failed/cancelled', { error, status });
        showToast(`⚠️ Payment ${error ? 'Failed' : 'Cancelled'}. Try again.`, 'warning');
        resetPaymentUI();
        
        if (window.history.replaceState) {
            window.history.replaceState({}, document.title, CONFIG.RETURN_URL);
        }
        return false;
    }
    
    debug('ℹ️ No payment params in URL');
    return false;
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    debug('🚀 DOM Loaded');
    
    // STEP 1: Check payment return FIRST
    const paymentReceived = handlePaymentReturn();
    
    // STEP 2: Restore from session if exists
    const savedPayment = sessionStorage.getItem('paymentData');
    if (savedPayment && !paymentReceived) {
        debug('🔄 Restoring from session');
        paymentData = JSON.parse(savedPayment);
        if (paymentData.razorpay_payment_id) {
            paymentDone = true;
            updatePaymentUI(true);
            $('submitBtn') && ($('submitBtn').disabled = false);
        }
    } else if (!paymentReceived && !savedPayment) {
        debug('🆕 Fresh session');
        forceResetForNewUser();
    }
    
    // Initialize UI
    initStarRating();
    initEventListeners();
    setReceiptTime();
    
    // Handle page cache
    window.addEventListener('pageshow', (event) => {
        if (event.persisted && !paymentDone && !sessionStorage.getItem('paymentData')) {
            debug('♻️ Page restored from cache - reloading');
            window.location.reload();
        }
    });
});

// ===== RESET FOR NEW USER =====
function forceResetForNewUser() {
    debug('🔄 Resetting for new user');
    
    // Clear storage but preserve payment if exists
    const paymentTemp = sessionStorage.getItem('paymentData');
    
    sessionStorage.clear();
    localStorage.clear();
    
    if (paymentTemp) {
        sessionStorage.setItem('paymentData', paymentTemp);
    } else {
        paymentDone = false;
        paymentData = {
            razorpay_payment_id: "",
            razorpay_order_id: "",
            razorpay_signature: "",
            payment_link_id: "IRE79PZ"
        };
    }
    
    clearFormFields();
    
    if (!paymentTemp) {
        resetPaymentUI();
        hideSuccessScreen();
        showForm();
    }
    
    // Clean URL
    if (window.location.search && !window.location.search.includes('razorpay_')) {
        if (window.history.replaceState) {
            window.history.replaceState({}, document.title, CONFIG.RETURN_URL);
        }
    }
    
    const submitBtn = $('submitBtn');
    if (submitBtn) submitBtn.disabled = !paymentDone;
    
    debug('✅ Reset complete');
}

// ===== CLEAR FORM =====
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
    
    // ✅ Pay Button Click - Validation BEFORE redirect
    if (payBtn) {
        payBtn.addEventListener('click', function(e) {
            debug('💳 Pay button clicked');
            
            // Validate form first
            if (!validateForm()) {
                e.preventDefault(); // Stop redirect if validation fails
                debug('❌ Validation failed');
                showToast('Please fill all required fields', 'error');
                return false;
            }
            
            debug('✅ Validation passed - saving form data');
            
            // Save form data before redirect
            const formData = collectFormData();
            sessionStorage.setItem('tempFormData', JSON.stringify(formData));
            
            // Allow default anchor redirect to Razorpay
            debug('🔗 Redirecting to Razorpay...');
            return true;
        });
    }
    
    // Form Submit
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
        payBtn.style.pointerEvents = 'none';
        payBtn.setAttribute('aria-disabled', 'true');
        
        if (submitBtn) submitBtn.disabled = false;
        debug('🎨 UI updated: Paid state');
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
    payBtn.style.pointerEvents = '';
    payBtn.removeAttribute('aria-disabled');
    
    if (submitBtn) submitBtn.disabled = true;
    debug('🎨 UI updated: Pending state');
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
    field.style.borderColor = 'var(--danger, #e74c3c)';
    field.setAttribute('aria-invalid', 'true');
}

// ===== FORM SUBMISSION =====
async function handleSubmit(e) {
    if (e) e.preventDefault();
    
    debug('📤 Form submit triggered');
    
    if (!paymentDone) {
        debug('❌ Payment not done');
        showToast('⚠️ Please complete payment first', 'error');
        $('payBtn')?.scrollIntoView({ behavior: 'smooth' });
        return;
    }
    
    // Get payment data
    if (!paymentData.razorpay_payment_id) {
        const saved = sessionStorage.getItem('paymentData');
        if (saved) {
            paymentData = JSON.parse(saved);
        }
    }
    
    if (!paymentData.razorpay_payment_id) {
        debug('❌ No payment ID found');
        showToast('⚠️ Payment verification failed', 'error');
        forceResetForNewUser();
        return;
    }
    
    const loader = $('loader');
    loader?.classList.remove('hidden');
    
    try {
        const data = collectFormData();
        debug('📦 Submitting data:', data);
        
        await submitToGoogleSheets(data);
        showSuccess(data);
        
        // Reset after 3 seconds
        setTimeout(() => {
            debug('🔄 Auto-resetting for next user');
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
        debug('📋 Demo mode - Google Script not configured');
        return true;
    }
    
    try {
        await fetch(CONFIG.GOOGLE_SCRIPT, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        debug('✅ Google Sheets request sent');
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
    debug('🎉 Success screen shown');
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

// ===== STAR RATING =====
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

// ===== BACK BUTTON HANDLER =====
window.addEventListener('popstate', () => {
    if (!paymentDone && !window.location.search.includes('razorpay_')) {
        debug('⬅️ Back button pressed - resetting');
        forceResetForNewUser();
    }
});

// ===== CLEANUP =====
window.addEventListener('beforeunload', () => {
    sessionStorage.removeItem('tempFormData');
});