/**
 * ✅ FINAL: Event Registration System - PAYMENT LINK VERSION
 * Razorpay Payment Link + Google Sheets Integration
 */

const CONFIG = {
    PAYMENT_LINK: "https://rzp.io/rzp/5NCrTAI",  // ✅ NO SPACES
    AMOUNT: 1,
    CURRENCY: "INR",
    GOOGLE_SCRIPT: "https://script.google.com/macros/s/AKfycbzdzpzP-bxaKy904nz5LUXLGtIy4-kTL-cQ4cKxtaBIT1y9xCTMPtLBHrUvQ3MzBTDkEw/exec",  // ✅ NO SPACES
    RETURN_URL: window.location.origin + window.location.pathname,
    DEBUG: true
};

let paymentDone = false;
let currentView = 'landing';
let isSubmitting = false;
let paymentData = {
    razorpay_payment_id: "",
    razorpay_order_id: "",
    razorpay_signature: "",
    payment_link_id: "IRE79PZ",
    payment_status: ""
};

// Utility selectors
const $ = id => document.getElementById(id);
const $$ = (sel, ctx = document) => ctx.querySelectorAll(sel);

// Debug logger
function debug(msg, data = null) {
    if (CONFIG.DEBUG) {
        console.log(`[💳 ${new Date().toLocaleTimeString()}] ${msg}`, data || '');
    }
}

// View manager
function showView(viewName) {
    currentView = viewName;
    
    $('landingPage')?.classList.add('hidden');
    $('landingPage')?.classList.remove('active-form');
    $('feedbackForm')?.classList.add('hidden-form');
    $('feedbackForm')?.classList.remove('active-form');
    $('paidForm')?.classList.add('hidden-form');
    $('paidForm')?.classList.remove('active-form');
    $('successMsg')?.classList.add('hidden');
    $('successMsg')?.classList.remove('active-form');
    
    switch(viewName) {
        case 'landing':
            $('landingPage')?.classList.remove('hidden');
            $('landingPage')?.classList.add('active-form');
            break;
        case 'feedback':
            $('feedbackForm')?.classList.remove('hidden-form');
            $('feedbackForm')?.classList.add('active-form');
            break;
        case 'paid':
            $('paidForm')?.classList.remove('hidden-form');
            $('paidForm')?.classList.add('active-form');
            break;
        case 'success':
            $('successMsg')?.classList.remove('hidden');
            $('successMsg')?.classList.add('active-form');
            break;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function backToLanding() {
    showView('landing');
}

// 🔥 CRITICAL: Payment Return Handler
function handlePaymentReturn() {
    debug('🔍 Checking payment return...');
    
    const urlParams = new URLSearchParams(window.location.search);
    
    // Razorpay Payment Link parameters
    const paymentId = urlParams.get('razorpay_payment_id') || 
                     urlParams.get('payment_id');
    const status = urlParams.get('razorpay_payment_status') || 
                  urlParams.get('payment_status') ||
                  urlParams.get('status');
    const orderId = urlParams.get('razorpay_order_id') || 
                   urlParams.get('order_id');
    const error = urlParams.get('razorpay_error') || 
                 urlParams.get('error');
    
    // SessionStorage fallback
    const savedPaymentData = sessionStorage.getItem('paymentData');
    
    debug('📋 URL Params:', { paymentId, status, orderId, error });
    debug('💾 Session Data:', savedPaymentData ? 'Exists' : 'None');
    
    // ✅ CHECK 1: Payment Successful via URL
    if (paymentId && (status === 'captured' || status === 'success' || status === 'paid')) {
        debug('✅ Payment captured via URL!', { paymentId, orderId });
        showToast('✅ Payment Successful! Processing...', 'success');
        processSuccessfulPayment(paymentId, orderId || 'ORDER_' + Date.now());
        cleanURL();
        return true;
    }
    
    // ✅ CHECK 2: SessionStorage से restore
    if (savedPaymentData && !paymentDone) {
        try {
            const parsedData = JSON.parse(savedPaymentData);
            if (parsedData.razorpay_payment_id && 
                (parsedData.payment_status === 'captured' || 
                 parsedData.payment_status === 'success')) {
                debug('✅ Payment restored from SessionStorage!');
                showToast('✅ Payment Verified! Completing registration...', 'success');
                processSuccessfulPayment(
                    parsedData.razorpay_payment_id, 
                    parsedData.razorpay_order_id || 'ORDER_' + Date.now()
                );
                return true;
            }
        } catch (e) {
            debug('⚠️ Parse error', e);
        }
    }
    
    // ❌ Payment Failed
    if (error || (status && !['captured', 'success', 'paid'].includes(status))) {
        debug('❌ Payment failed', { error, status });
        showToast(`⚠️ Payment ${error ? 'Failed' : 'Cancelled'}. Try again.`, 'warning');
        resetPaymentUI();
        cleanURL();
        return false;
    }
    
    debug('ℹ️ No payment params found');
    return false;
}

// 🔥 Process Payment & Show Form
function processSuccessfulPayment(paymentId, orderId) {
    paymentDone = true;
    paymentData = {
        razorpay_payment_id: paymentId,
        razorpay_order_id: orderId,
        razorpay_signature: "AUTO_CAPTURED",
        payment_status: "captured",
        payment_link_id: "IRE79PZ"
    };
    
    // Save to sessionStorage
    try {
        sessionStorage.setItem('paymentData', JSON.stringify(paymentData));
        debug('💾 Payment data saved');
    } catch (e) {
        debug('⚠️ Session save failed', e);
    }
    
    // Update UI
    updatePaymentUI(true);
    
    // Enable submit button
    const submitBtn = $('submitBtn');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-check"></i> Complete Registration';
        submitBtn.classList.add('pulse-animation');
    }
    
    // Restore form data
    restoreFormData();
    
    // Show paid form if not already visible
    if (currentView !== 'paid') {
        debug('📋 Showing paid form...');
        showView('paid');
        showToast('✅ Payment Successful! Click "Complete Registration"', 'success');
    } else {
        showToast('✅ Payment Successful! Click "Complete Registration"', 'success');
    }
}

// Restore Form Data
function restoreFormData() {
    const savedFormData = sessionStorage.getItem('tempPaidData');
    if (savedFormData) {
        try {
            const formData = JSON.parse(savedFormData);
            const fields = ['name', 'email', 'phone', 'company', 'designation', 'city', 'employees', 'remarks'];
            fields.forEach(fieldId => {
                const field = $(fieldId);
                if (field && formData[fieldId]) {
                    field.value = formData[fieldId];
                }
            });
            
            if (formData.audit_rating) {
                const ratingRadio = document.querySelector(`input[name="audit_rating"][value="${formData.audit_rating}"]`);
                if (ratingRadio) {
                    ratingRadio.checked = true;
                }
            }
            debug('🔄 Form data restored');
        } catch (e) {
            debug('⚠️ Restore failed', e);
        }
    }
}

// Clean URL
function cleanURL() {
    if (window.history.replaceState) {
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        debug('🧹 URL cleaned');
    }
}

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    debug('🚀 DOM Loaded');
    showView('landing');
    
    $('showFeedbackBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        showView('feedback');
        initFeedbackForm();
    });
    
    $('showPaidBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        showView('paid');
        initPaidForm();
    });
    
    initFeedbackForm();
    initPaidForm();
    
    // Check payment return
    setTimeout(() => {
        handlePaymentReturn();
    }, 500);
});

// Initialize Feedback Form
function initFeedbackForm() {
    const form = $('feedbackForm');
    if (!form) return;
    
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    
    initStarRating('fb_starRating');
    
    ['fb_name', 'fb_email', 'fb_phone', 'fb_city', 'fb_employees', 'fb_designation', 'fb_company'].forEach(id => {
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
    
    newForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!isSubmitting) {
            handleFeedbackSubmit();
        }
    });
}

// Initialize Paid Form
function initPaidForm() {
    const form = $('paidForm');
    if (!form) return;
    
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    
    // Check saved payment
    const savedPayment = sessionStorage.getItem('paymentData');
    if (savedPayment) {
        try {
            paymentData = JSON.parse(savedPayment);
            if (paymentData.razorpay_payment_id) {
                paymentDone = true;
                updatePaymentUI(true);
                const submitBtn = $('submitBtn');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-check"></i> Complete Registration';
                }
            }
        } catch (e) {
            debug('⚠️ Parse failed', e);
        }
    }
    
    // Payment button handler
    const payBtn = $('payBtn');
    if (payBtn) {
        payBtn.addEventListener('click', (e) => {
            if (!validatePaidForm()) {
                e.preventDefault();
                showToast('Please fill all required fields first', 'error');
                return false;
            }
            
            // Save form data BEFORE redirect
            try {
                const formData = collectPaidFormData();
                sessionStorage.setItem('tempPaidData', JSON.stringify(formData));
                debug('💾 Form data saved before payment');
            } catch (err) {
                debug('⚠️ Save failed', err);
            }
            
            debug('🔗 Redirecting to Razorpay...');
            return true;
        });
    }
    
    // Form submit handler
    newForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!isSubmitting && paymentDone) {
            handlePaidSubmit();
        } else if (!paymentDone) {
            showToast('⚠️ Please complete payment first', 'error');
        }
    });
    
    // Field validation
    ['name', 'email', 'phone', 'city', 'employees', 'designation', 'company'].forEach(id => {
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
}

// Validate single field
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
            showToast('Please enter valid email', 'error');
            isValid = false;
        }
    }
    
    if (field.type === 'tel' && value) {
        const phoneRegex = /^[6-9][0-9]{9}$/;
        if (!phoneRegex.test(value)) {
            markInvalid(field);
            showToast('Please enter valid 10-digit number', 'error');
            isValid = false;
        }
    }
    
    if (field.type === 'number' && value) {
        if (isNaN(value) || value < 1) {
            markInvalid(field);
            showToast('Please enter valid number', 'error');
            isValid = false;
        }
    }
    
    if (isValid) {
        field.style.borderColor = '';
        field.removeAttribute('aria-invalid');
    }
    
    return isValid;
}

// Validate Feedback Form
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
        showToast('Please select a rating', 'error');
        const ratingContainer = $('fb_starRating');
        if (ratingContainer) ratingContainer.style.borderColor = 'var(--danger)';
        isValid = false;
    } else {
        const ratingContainer = $('fb_starRating');
        if (ratingContainer) ratingContainer.style.borderColor = '';
    }
    
    return isValid;
}

// Validate Paid Form
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
        showToast('Please select a rating', 'error');
        const ratingContainer = $('audit_starRating');
        if (ratingContainer) ratingContainer.style.borderColor = 'var(--danger)';
        isValid = false;
    } else {
        const ratingContainer = $('audit_starRating');
        if (ratingContainer) ratingContainer.style.borderColor = '';
    }
    
    return isValid;
}

// Mark field invalid
function markInvalid(field) {
    if (!field) return;
    field.style.borderColor = 'var(--danger)';
    field.setAttribute('aria-invalid', 'true');
    field.style.animation = 'none';
    setTimeout(() => {
        field.style.animation = 'shake 0.3s ease';
    }, 10);
}

// Handle Feedback Submission
async function handleFeedbackSubmit() {
    debug('📤 Feedback submit triggered');
    
    if (isSubmitting) return;
    
    if (!validateFeedbackForm()) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    isSubmitting = true;
    showLoader('Submitting Feedback...');
    
    try {
        const data = collectFeedbackData();
        debug('📦 Data collected', data);
        
        await submitToGoogleSheets(data, 'feedback');
        showSuccess(data, 'feedback');
    } catch (error) {
        console.error('Feedback error:', error);
        showToast('⚠️ Feedback saved locally', 'warning');
        showSuccess(collectFeedbackData(), 'feedback');
    } finally {
        hideLoader();
        isSubmitting = false;
    }
}

// Collect Feedback Data
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

// Reset Feedback Form
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
}

// Handle Paid Submission
async function handlePaidSubmit(e = null, autoSubmit = false) {
    if (e) e.preventDefault();
    debug('📤 Paid submit triggered', { autoSubmit });
    
    if (isSubmitting) return;
    
    if (!paymentDone) {
        debug('❌ Payment not done');
        showToast('⚠️ Please complete payment first', 'error');
        $('payBtn')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    
    if (!validatePaidForm()) {
        showToast('Please fill all required fields', 'error');
        const firstInvalid = document.querySelector('#paidForm [aria-invalid="true"]');
        if (firstInvalid) firstInvalid.focus();
        return;
    }
    
    // Restore payment data
    if (!paymentData.razorpay_payment_id) {
        try {
            const saved = sessionStorage.getItem('paymentData');
            if (saved) {
                paymentData = JSON.parse(saved);
                debug('🔄 Payment data restored');
            }
        } catch (err) {
            debug('⚠️ Restore failed', err);
        }
    }
    
    if (!paymentData.razorpay_payment_id) {
        debug('❌ No payment ID');
        showToast('⚠️ Payment verification failed', 'error');
        resetPaidForm();
        return;
    }
    
    isSubmitting = true;
    showLoader(autoSubmit ? 'Processing...' : 'Completing Registration...');
    
    try {
        const data = collectPaidFormData();
        debug('📦 Data collected', data);
        
        await submitToGoogleSheets(data, 'audit');
        showSuccess(data, 'paid');
        
        // Clear session
        sessionStorage.removeItem('paymentData');
        sessionStorage.removeItem('tempPaidData');
        debug('🧹 Session cleared');
        
    } catch (error) {
        console.error('Paid error:', error);
        showToast('⚠️ Registration saved locally', 'warning');
        showSuccess(collectPaidFormData(), 'paid');
    } finally {
        hideLoader();
        isSubmitting = false;
    }
}

// Collect Paid Data
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
        amount: '₹1.00',
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

// Reset Paid Form
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
        payment_link_id: "IRE79PZ",
        payment_status: ""
    };
    
    try {
        sessionStorage.removeItem('paymentData');
        sessionStorage.removeItem('tempPaidData');
    } catch (e) {
        debug('⚠️ Cleanup failed', e);
    }
}

// Submit to Google Sheets
async function submitToGoogleSheets(data, formType) {
    if (!CONFIG.GOOGLE_SCRIPT || CONFIG.GOOGLE_SCRIPT.includes('YOUR_')) {
        debug('📋 Demo mode');
        return true;
    }
    
    debug(`📤 Sending ${formType} data...`);
    
    try {
        const scriptURL = `${CONFIG.GOOGLE_SCRIPT}?t=${Date.now()}`;
        
        const response = await fetch(scriptURL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        debug(`✅ ${formType} sent (type: ${response.type})`);
        
        if (navigator.sendBeacon) {
            navigator.sendBeacon(scriptURL, JSON.stringify(data));
            debug('📡 Beacon sent');
        }
        
        return true;
        
    } catch (error) {
        console.error(`${formType} error:`, error);
        debug(`❌ Error:`, error);
        
        // Backup
        try {
            const backups = JSON.parse(localStorage.getItem('formBackups') || '[]');
            backups.push({ data, formType, timestamp: new Date().toISOString() });
            localStorage.setItem('formBackups', JSON.stringify(backups));
            debug('💾 Backup saved');
        } catch (e) {
            debug('⚠️ Backup failed', e);
        }
        
        throw error;
    }
}

// Show Success Screen
function showSuccess(data, formType) {
    $('feedbackForm')?.classList.add('hidden-form');
    $('paidForm')?.classList.add('hidden-form');
    $('landingPage')?.classList.add('hidden');
    
    const successMsg = $('successMsg');
    if (!successMsg) return;
    
    successMsg.classList.remove('hidden');
    
    if (formType === 'feedback') {
        successMsg.innerHTML = `
            <div class="success-icon" style="font-size:4rem; color:var(--success); margin-bottom:15px">
                <i class="fas fa-check-circle"></i>
            </div>
            <h2 id="successTitle" style="margin:10px 0; color:var(--text)">✅ Feedback Submitted!</h2>
            <p style="color:var(--muted); margin:15px 0; font-size:1.1rem">
                Thank you for your feedback! 🙏
            </p>
            <button type="button" onclick="resetAll()" class="btn-primary" style="margin-top:25px; max-width: 250px;">
                <i class="fas fa-home"></i> Back to Home
            </button>
        `;
    } else {
        const mappings = {
            sName: data.name,
            sEmail: data.email,
            sAmount: data.amount,
            sTime: new Date().toLocaleString('en-IN', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
            }),
            sType: 'Audit Registration',
            sStatus: 'Completed'
        };
        
        Object.entries(mappings).forEach(([id, value]) => {
            const el = $(id);
            if (el) el.textContent = value;
        });
        
        const paymentIdRow = $('paymentIdRow');
        const sPaymentId = $('sPaymentId');
        if (data.razorpay_payment_id && data.razorpay_payment_id !== 'N/A') {
            if (paymentIdRow) paymentIdRow.style.display = 'flex';
            if (sPaymentId) sPaymentId.textContent = data.razorpay_payment_id;
        } else {
            if (paymentIdRow) paymentIdRow.style.display = 'none';
        }
        
        const successTitle = $('successTitle');
        if (successTitle) successTitle.textContent = '✅ Registration Successful!';
        
        const printBtn = successMsg.querySelector('.btn-outline');
        if (printBtn) printBtn.style.display = 'inline-flex';
    }
    
    currentView = 'success';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Update Payment UI
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
            submitBtn.innerHTML = '<i class="fas fa-check"></i> Complete Registration';
            submitBtn.focus();
        }
    }
}

// Reset Payment UI
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
    payBtn.removeAttribute('tabindex');
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-lock"></i> Complete Registration';
    }
}

// Initialize Star Rating
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

// Show Loader
function showLoader(text = 'Processing...') {
    const loader = $('loader');
    const loaderText = $('loaderText');
    
    if (loader) {
        loader.classList.remove('hidden');
        loader.setAttribute('aria-hidden', 'false');
    }
    if (loaderText) loaderText.textContent = text;
    document.body.style.overflow = 'hidden';
}

// Hide Loader
function hideLoader() {
    const loader = $('loader');
    if (loader) {
        loader.classList.add('hidden');
        loader.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = '';
}

// Show Toast
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
}

// Global Reset
function resetAll() {
    debug('🔄 Global reset');
    $('successMsg')?.classList.add('hidden');
    resetFeedbackForm();
    resetPaidForm();
    isSubmitting = false;
    showView('landing');
    
    if (window.history.replaceState) {
        window.history.replaceState({}, document.title, CONFIG.RETURN_URL);
    }
}

// Back button
window.addEventListener('popstate', () => {
    if (!paymentDone && !window.location.search.includes('razorpay_')) {
        debug('⬅️ Back - resetting');
        resetAll();
    }
});

// Clean on unload
window.addEventListener('beforeunload', () => {
    try {
        sessionStorage.removeItem('tempPaidData');
    } catch (e) {}
});

// Mobile keyboard
document.addEventListener('focusin', (e) => {
    if (e.target.tagName === 'INPUT' && window.innerWidth < 500) {
        const meta = document.querySelector('meta[name="viewport"]');
        if (meta && !meta.content.includes('user-scalable=no')) {
            meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
        }
    }
});

// Enter key
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

// Add CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
    }
    .pulse-animation {
        animation: pulse 2s ease-in-out infinite;
    }
`;
document.head.appendChild(style);

debug('🎯 System Ready');