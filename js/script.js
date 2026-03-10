const CONFIG = {
    PAYMENT_LINK: "https://rzp.io/rzp/5NCrTAI",
    AMOUNT: 100,
    CURRENCY: "INR",
    GOOGLE_SCRIPT: "https://script.google.com/macros/s/AKfycbxR8886dsk6fB3xCKKWFjJSy5y5pJjHN6TLaynY06URgzuJyTO4QFOPhSB3bAwBjciw/exec",
    RETURN_URL: window.location.href.split('?')[0]
};

// ===== STATE =====
let paymentDone = false;
let currentFormType = 'feedback'; // 'feedback' or 'paid'
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

// ===== FORM TOGGLE LOGIC =====
function initFormToggle() {
    const feedbackBtn = $('showFeedbackBtn');
    const paidBtn = $('showPaidBtn');
    const feedbackForm = $('feedbackForm');
    const paidForm = $('paidForm');

    function switchForm(targetForm) {
        currentFormType = targetForm;
        
        // Update buttons
        if (targetForm === 'feedback') {
            feedbackBtn.classList.add('active');
            feedbackBtn.setAttribute('aria-pressed', 'true');
            paidBtn.classList.remove('active');
            paidBtn.setAttribute('aria-pressed', 'false');
            feedbackForm.classList.remove('hidden-form');
            feedbackForm.classList.add('active-form');
            paidForm.classList.add('hidden-form');
            paidForm.classList.remove('active-form');
            debug('📋 Switched to Feedback Form');
        } else {
            paidBtn.classList.add('active');
            paidBtn.setAttribute('aria-pressed', 'true');
            feedbackBtn.classList.remove('active');
            feedbackBtn.setAttribute('aria-pressed', 'false');
            paidForm.classList.remove('hidden-form');
            paidForm.classList.add('active-form');
            feedbackForm.classList.add('hidden-form');
            feedbackForm.classList.remove('active-form');
            debug('💳 Switched to Paid Registration Form');
        }
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (feedbackBtn) feedbackBtn.addEventListener('click', () => switchForm('feedback'));
    if (paidBtn) paidBtn.addEventListener('click', () => switchForm('paid'));
    
    // Default: Show Feedback Form
    switchForm('feedback');
}

// ===== HANDLE PAYMENT RETURN (Paid Form Only) =====
function handlePaymentReturn() {
    if (currentFormType !== 'paid') return false;
    
    debug('Checking payment return params...');
    
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
        
        sessionStorage.setItem('paymentData', JSON.stringify(paymentData));
        
        if (window.history.replaceState) {
            window.history.replaceState({}, document.title, CONFIG.RETURN_URL);
        }
        
        updatePaymentUI(true);
        $('submitBtn') && ($('submitBtn').disabled = false);
        
        return true;
    }
    
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
    
    // Initialize form toggle FIRST
    initFormToggle();
    
    // Initialize forms based on type
    initFeedbackForm();
    initPaidForm();
    
    // Handle page cache
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            debug('♻️ Page restored from cache');
            if (currentFormType === 'paid' && !paymentDone && !sessionStorage.getItem('paymentData')) {
                window.location.reload();
            }
        }
    });
});

// ===== FEEDBACK FORM INIT =====
function initFeedbackForm() {
    const form = $('feedbackForm');
    if (!form) return;
    
    // Star rating for feedback
    initStarRating('fb_starRating');
    
    // Real-time validation
    ['fb_name', 'fb_email', 'fb_phone', 'fb_city'].forEach(id => {
        const field = $(id);
        if (field) {
            field.addEventListener('blur', () => validateFeedbackField(field));
            field.addEventListener('input', () => {
                if (field.style.borderColor === 'rgb(231, 76, 60)') {
                    field.style.borderColor = '';
                }
            });
        }
    });
    
    // Form submit
    form.addEventListener('submit', handleFeedbackSubmit);
    
    debug('✅ Feedback Form initialized');
}

// ===== PAID FORM INIT =====
function initPaidForm() {
    const form = $('paidForm');
    if (!form) return;
    
    // Check payment return
    handlePaymentReturn();
    
    // Restore from session
    const savedPayment = sessionStorage.getItem('paymentData');
    if (savedPayment && currentFormType === 'paid') {
        debug('🔄 Restoring payment from session');
        paymentData = JSON.parse(savedPayment);
        if (paymentData.razorpay_payment_id) {
            paymentDone = true;
            updatePaymentUI(true);
            $('submitBtn') && ($('submitBtn').disabled = false);
        }
    }
    
    // Star rating not needed for paid form (removed)
    
    // Pay button click
    const payBtn = $('payBtn');
    if (payBtn) {
        payBtn.addEventListener('click', function(e) {
            if (!validatePaidForm()) {
                e.preventDefault();
                showToast('Please fill all required fields', 'error');
                return false;
            }
            
            // Save form data before redirect
            const formData = collectPaidFormData();
            sessionStorage.setItem('tempPaidData', JSON.stringify(formData));
            
            debug('🔗 Redirecting to Razorpay...');
            return true;
        });
    }
    
    // Form submit
    form.addEventListener('submit', handlePaidSubmit);
    
    // Real-time validation
    ['name', 'email', 'phone', 'city'].forEach(id => {
        const field = $(id);
        if (field) {
            field.addEventListener('blur', () => validatePaidField(field));
            field.addEventListener('input', () => {
                if (field.style.borderColor === 'rgb(231, 76, 60)') {
                    field.style.borderColor = '';
                }
            });
        }
    });
    
    debug('✅ Paid Form initialized');
}

// ===== FEEDBACK FORM VALIDATION =====
function validateFeedbackForm() {
    const required = ['fb_name', 'fb_designation', 'fb_company', 'fb_phone', 'fb_email', 'fb_city', 'fb_learned', 'fb_recommend'];
    let isValid = true;
    
    required.forEach(id => {
        const field = $(id);
        if (!field || !field.value.trim()) {
            if (field) markInvalid(field);
            isValid = false;
        }
    });
    
    // Rating required
    const rating = document.querySelector('input[name="fb_rating"]:checked');
    if (!rating) {
        showToast('Please select a session rating', 'error');
        isValid = false;
    }
    
    // Email validation
    const email = $('fb_email')?.value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        markInvalid($('fb_email'));
        isValid = false;
    }
    
    // Phone validation
    const phone = $('fb_phone')?.value.trim();
    if (phone && !/^[6-9]\d{9}$/.test(phone)) {
        markInvalid($('fb_phone'));
        isValid = false;
    }
    
    return isValid;
}

function validateFeedbackField(field) {
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

// ===== PAID FORM VALIDATION =====
function validatePaidForm() {
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

function validatePaidField(field) {
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

// ===== FEEDBACK FORM SUBMISSION =====
async function handleFeedbackSubmit(e) {
    if (e) e.preventDefault();
    
    debug('📤 Feedback Form submit triggered');
    
    if (!validateFeedbackForm()) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    const loader = $('loader');
    loader?.classList.remove('hidden');
    $('loaderText').textContent = 'Submitting Feedback...';
    
    try {
        const data = collectFeedbackData();
        debug('📦 Submitting feedback:', data);
        
        await submitToGoogleSheets(data, 'feedback');
        showSuccess(data, 'feedback');
        
        // Reset after 3 seconds
        setTimeout(() => {
            debug('🔄 Auto-resetting feedback form');
            resetFeedbackForm();
        }, 3000);
        
    } catch (error) {
        console.error('Feedback submit error:', error);
        showToast('⚠️ Feedback saved but confirmation pending', 'warning');
        showSuccess(collectFeedbackData(), 'feedback');
    } finally {
        $('loader')?.classList.add('hidden');
    }
}

function collectFeedbackData() {
    const rating = document.querySelector('input[name="fb_rating"]:checked')?.value || 'Not rated';
    const recommend = document.querySelector('input[name="fb_recommend"]:checked')?.value || 'Not specified';
    
    return {
        // User Details
        name: $('fb_name')?.value.trim() || '',
        designation: $('fb_designation')?.value.trim() || '',
        company: $('fb_company')?.value.trim() || '',
        employees: $('fb_employees')?.value || 'Not specified',
        phone: $('fb_phone')?.value.trim() || '',
        email: $('fb_email')?.value.trim() || '',
        city: $('fb_city')?.value.trim() || '',
        
        // Session Feedback
        session_rating: rating,
        learned: $('fb_learned')?.value.trim() || '',
        speaker_rating: $('fb_speaker_rating')?.value || 'Not specified',
        would_recommend: recommend,
        suggestions: $('fb_suggestions')?.value.trim() || 'None',
        remarks: $('fb_remarks')?.value.trim() || 'None',
        
        // Meta
        form_type: 'feedback',
        payment_status: 'Not Applicable',
        amount: '₹0.00',
        payment_method: 'None',
        razorpay_payment_id: 'N/A',
        timestamp: new Date().toISOString()
    };
}

function resetFeedbackForm() {
    const form = $('feedbackForm');
    if (!form) return;
    
    form.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], textarea').forEach(input => {
        input.value = '';
        input.style.borderColor = '';
        input.removeAttribute('aria-invalid');
    });
    
    form.querySelectorAll('select').forEach(select => select.selectedIndex = 0);
    form.querySelectorAll('input[type="radio"]').forEach(radio => radio.checked = false);
    
    debug('✅ Feedback form reset');
}

// ===== PAID FORM SUBMISSION =====
async function handlePaidSubmit(e) {
    if (e) e.preventDefault();
    
    debug('📤 Paid Form submit triggered');
    
    if (!paymentDone) {
        debug('❌ Payment not done');
        showToast('⚠️ Please complete payment first', 'error');
        $('payBtn')?.scrollIntoView({ behavior: 'smooth' });
        return;
    }
    
    if (!validatePaidForm()) {
        showToast('Please fill all required fields', 'error');
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
        resetPaidForm();
        return;
    }
    
    const loader = $('loader');
    loader?.classList.remove('hidden');
    $('loaderText').textContent = 'Processing Registration...';
    
    try {
        const data = collectPaidFormData();
        debug('📦 Submitting paid registration:', data);
        
        await submitToGoogleSheets(data, 'paid');
        showSuccess(data, 'paid');
        
        // Reset after 3 seconds
        setTimeout(() => {
            debug('🔄 Auto-resetting paid form');
            resetPaidForm();
        }, 3000);
        
    } catch (error) {
        console.error('Paid submit error:', error);
        showToast('⚠️ Registration saved but confirmation pending', 'warning');
        showSuccess(collectPaidFormData(), 'paid');
    } finally {
        $('loader')?.classList.add('hidden');
    }
}

function collectPaidFormData() {
    return {
        // User Details (same as feedback)
        name: $('name')?.value.trim() || '',
        designation: $('designation')?.value.trim() || '',
        company: $('company')?.value.trim() || '',
        employees: $('employees')?.value || 'Not specified',
        phone: $('phone')?.value.trim() || '',
        email: $('email')?.value.trim() || '',
        city: $('city')?.value.trim() || '',
        
        // Payment Info
        remarks: $('remarks')?.value.trim() || 'None',
        
        // Meta
        form_type: 'paid_registration',
        payment_status: 'Paid',
        amount: '₹1.00',
        payment_method: 'Razorpay',
        razorpay_payment_id: paymentData.razorpay_payment_id || 'PENDING',
        razorpay_order_id: paymentData.razorpay_order_id || 'N/A',
        timestamp: new Date().toISOString()
    };
}

function resetPaidForm() {
    const form = $('paidForm');
    if (!form) return;
    
    form.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], textarea').forEach(input => {
        input.value = '';
        input.style.borderColor = '';
        input.removeAttribute('aria-invalid');
    });
    
    form.querySelectorAll('select').forEach(select => select.selectedIndex = 0);
    
    // Reset payment UI
    resetPaymentUI();
    paymentDone = false;
    paymentData = {
        razorpay_payment_id: "",
        razorpay_order_id: "",
        razorpay_signature: "",
        payment_link_id: "IRE79PZ"
    };
    sessionStorage.removeItem('paymentData');
    
    debug('✅ Paid form reset');
}

// ===== GOOGLE SHEETS SUBMISSION =====
async function submitToGoogleSheets(data, formType) {
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
        debug(`✅ ${formType} data sent to Google Sheets`);
        return true;
    } catch (err) {
        console.error('Google Sheets error:', err);
        throw err;
    }
}

// ===== SUCCESS SCREEN =====
function showSuccess(data, formType) {
    // Hide forms
    $('feedbackForm')?.classList.add('hidden-form');
    $('paidForm')?.classList.add('hidden-form');
    
    // Show success
    $('successMsg')?.classList.remove('hidden');
    
    // Update success content
    $('sName') && ($('sName').textContent = data.name);
    $('sEmail') && ($('sEmail').textContent = data.email);
    $('sAmount') && ($('sAmount').textContent = data.amount);
    $('sTime') && ($('sTime').textContent = new Date().toLocaleString('en-IN'));
    $('sType') && ($('sType').textContent = formType === 'paid' ? 'Paid Registration' : 'Free Feedback');
    
    // Payment ID row
    const paymentIdRow = $('paymentIdRow');
    if (formType === 'paid' && data.razorpay_payment_id && data.razorpay_payment_id !== 'N/A') {
        paymentIdRow && (paymentIdRow.style.display = 'flex');
        $('sPaymentId') && ($('sPaymentId').textContent = data.razorpay_payment_id);
    } else {
        paymentIdRow && (paymentIdRow.style.display = 'none');
    }
    
    // Update title
    $('successTitle') && ($('successTitle').textContent = formType === 'paid' ? '✅ Registration Successful!' : '✅ Feedback Submitted!');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    debug(`🎉 Success screen shown for ${formType}`);
}

// ===== PAYMENT UI UPDATES =====
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
        debug('🎨 Paid UI updated: Paid state');
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
    payBtn.style.pointerEvents = '';
    payBtn.removeAttribute('aria-disabled');
    
    if (submitBtn) submitBtn.disabled = true;
    debug('🎨 Paid UI updated: Pending state');
}

// ===== STAR RATING (Generic) =====
function initStarRating(containerId) {
    const container = $(containerId);
    if (!container) return;
    
    const stars = container.querySelectorAll('label');
    stars.forEach(label => {
        label.addEventListener('click', function() {
            const value = this.getAttribute('for').replace('fb_star', '').replace('star', '');
            container.querySelectorAll('input').forEach(radio => {
                radio.checked = (radio.value === value);
            });
        });
    });
}

// ===== GLOBAL RESET =====
function resetAll() {
    // Hide success
    $('successMsg')?.classList.add('hidden');
    
    // Reset both forms
    resetFeedbackForm();
    resetPaidForm();
    
    // Show feedback form by default
    currentFormType = 'feedback';
    const feedbackBtn = $('showFeedbackBtn');
    const paidBtn = $('showPaidBtn');
    const feedbackForm = $('feedbackForm');
    const paidForm = $('paidForm');
    
    if (feedbackBtn) {
        feedbackBtn.classList.add('active');
        feedbackBtn.setAttribute('aria-pressed', 'true');
    }
    if (paidBtn) {
        paidBtn.classList.remove('active');
        paidBtn.setAttribute('aria-pressed', 'false');
    }
    if (feedbackForm) {
        feedbackForm.classList.remove('hidden-form');
        feedbackForm.classList.add('active-form');
    }
    if (paidForm) {
        paidForm.classList.add('hidden-form');
        paidForm.classList.remove('active-form');
    }
    
    // Clean URL
    if (window.history.replaceState) {
        window.history.replaceState({}, document.title, CONFIG.RETURN_URL);
    }
    
    debug('🔄 All forms reset, showing Feedback Form');
}

// ===== UTILITIES =====
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

// ===== BACK BUTTON HANDLER =====
window.addEventListener('popstate', () => {
    if (!paymentDone && !window.location.search.includes('razorpay_')) {
        debug('⬅️ Back button pressed - resetting');
        resetAll();
    }
});

// ===== CLEANUP =====
window.addEventListener('beforeunload', () => {
    sessionStorage.removeItem('tempFormData');
    sessionStorage.removeItem('tempPaidData');
});