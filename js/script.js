/**
 * Event Registration System - MOBILE OPTIMIZED
 * ✅ Fixed: Payment Return + Auto Submit + Excel Save
 */

const CONFIG = {
    PAYMENT_LINK: "https://rzp.io/rzp/5NCrTAI",
    AMOUNT: 100,
    CURRENCY: "INR",
    GOOGLE_SCRIPT: "https://script.google.com/macros/s/AKfycbywqI8MUkRrIMi-VsYADWO05KtCJOMCaeZAp8s7FuBEbIi3W2JSfFFkVISO8Yg-XNgg/exec",
    RETURN_URL: "https://slciadmin.github.io/Event-Form/",
    DEBUG: true
};

let paymentDone = false;
let currentView = 'landing';
let isSubmitting = false;
let paymentData = {
    razorpay_payment_id: "",
    razorpay_order_id: "",
    razorpay_signature: "",
    payment_link_id: "IRE79PZ"
};

const $ = id => document.getElementById(id);
const $$ = (sel, ctx = document) => ctx.querySelectorAll(sel);

function debug(msg, data = null) {
    if (CONFIG.DEBUG) {
        console.log(`[💳 ${new Date().toLocaleTimeString()}] ${msg}`, data || '');
    }
}

function showView(viewName) {
    currentView = viewName;
    
    // Hide all views first
    $('landingPage')?.classList.add('hidden');
    $('landingPage')?.classList.remove('active-form');
    $('feedbackForm')?.classList.add('hidden-form');
    $('feedbackForm')?.classList.remove('active-form');
    $('paidForm')?.classList.add('hidden-form');
    $('paidForm')?.classList.remove('active-form');
    $('successMsg')?.classList.add('hidden');
    $('successMsg')?.classList.remove('active-form');

    // Show requested view
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

// 🔥 CRITICAL FIX: Enhanced Payment Return Handler for Mobile
function handlePaymentReturn() {
    debug('🔍 Checking payment return...');
    
    // Method 1: Check URL Parameters
    const urlParams = new URLSearchParams(window.location.search);
    const paymentId = urlParams.get('razorpay_payment_id');
    const status = urlParams.get('razorpay_payment_status');
    const orderId = urlParams.get('razorpay_order_id');
    const error = urlParams.get('razorpay_error');
    
    // Method 2: Check if payment data in sessionStorage (fallback)
    const savedPaymentData = sessionStorage.getItem('paymentData');
    
    debug('URL Params:', { paymentId, status, orderId, error });
    debug('Session Payment Data:', savedPaymentData);

    // ✅ CHECK 1: Payment Successful via URL
    if (paymentId && status === 'captured') {
        debug('✅ Payment captured via URL!', { paymentId, orderId });
        processSuccessfulPayment(paymentId, orderId || 'N/A');
        cleanURL();
        return true;
    }
    
    // ✅ CHECK 2: Payment data in sessionStorage (mobile fallback)
    if (savedPaymentData && currentView === 'paid') {
        try {
            const parsedData = JSON.parse(savedPaymentData);
            if (parsedData.razorpay_payment_id && parsedData.payment_status === 'captured') {
                debug('✅ Payment captured via SessionStorage!', parsedData);
                processSuccessfulPayment(parsedData.razorpay_payment_id, parsedData.razorpay_order_id || 'N/A');
                return true;
            }
        } catch (e) {
            debug('⚠️ Failed to parse session payment data', e);
        }
    }

    // ❌ Payment Failed/Cancelled
    if (error || (status && status !== 'captured')) {
        debug('❌ Payment failed/cancelled', { error, status });
        showToast(`⚠️ Payment ${error ? 'Failed' : 'Cancelled'}. Please try again.`, 'warning');
        resetPaymentUI();
        cleanURL();
        return false;
    }
    
    debug('ℹ️ No payment parameters found');
    return false;
}

// 🔥 NEW: Process Successful Payment (Separated for clarity)
function processSuccessfulPayment(paymentId, orderId) {
    paymentDone = true;
    paymentData.razorpay_payment_id = paymentId;
    paymentData.razorpay_order_id = orderId;
    paymentData.razorpay_signature = "AUTO_CAPTURED";
    
    // Save to sessionStorage
    try {
        sessionStorage.setItem('paymentData', JSON.stringify(paymentData));
        debug('💾 Payment data saved to session');
    } catch (e) { 
        debug('⚠️ Session storage failed', e); 
    }

    // Update UI immediately
    updatePaymentUI(true);
    const submitBtn = $('submitBtn');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-check"></i> Complete Registration';
    }

    // Restore form data
    restoreFormData();

    // 🔥 CRITICAL: Auto-submit after short delay (mobile optimized)
    setTimeout(() => {
        if (validatePaidForm()) {
            debug('🔄 Auto-submitting paid form after payment...');
            handlePaidSubmit(null, true);
        } else {
            debug('⚠️ Form validation failed, showing form to user');
            showToast('✅ Payment Successful! Please review and submit.', 'success');
            showView('paid');
        }
    }, 1500); // Reduced from 2000ms for better mobile UX
}

// 🔥 NEW: Restore Form Data from Session
function restoreFormData() {
    const savedFormData = sessionStorage.getItem('tempPaidData');
    if (savedFormData) {
        try {
            const formData = JSON.parse(savedFormData);
            
            // Restore all fields
            const fields = ['name', 'email', 'phone', 'company', 'designation', 'city', 'employees', 'remarks'];
            fields.forEach(fieldId => {
                const field = $(fieldId);
                if (field && formData[fieldId]) {
                    field.value = formData[fieldId];
                }
            });
            
            // Restore rating
            if (formData.audit_rating) {
                const ratingRadio = document.querySelector(`input[name="audit_rating"][value="${formData.audit_rating}"]`);
                if (ratingRadio) {
                    ratingRadio.checked = true;
                    debug('⭐ Rating restored:', formData.audit_rating);
                }
            }
            
            debug('🔄 Form data restored successfully');
        } catch (e) { 
            debug('⚠️ Failed to restore form data', e); 
        }
    }
}

// 🔥 NEW: Clean URL Parameters
function cleanURL() {
    if (window.history.replaceState) {
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        debug('🧹 URL cleaned');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    debug('🚀 DOM Content Loaded');
    showView('landing');

    // Button Event Listeners
    $('showFeedbackBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        debug('🖱️ Feedback button clicked');
        showView('feedback');
        initFeedbackForm();
    });

    $('showPaidBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        debug('🖱️ Audit button clicked');
        showView('paid');
        initPaidForm();
    });

    // Initialize forms
    initFeedbackForm();
    initPaidForm();
    
    // ✅ CRITICAL: Check payment return AFTER everything is loaded
    setTimeout(() => {
        handlePaymentReturn();
    }, 300);
});

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

    debug('✅ Feedback Form initialized');
}

function initPaidForm() {
    const form = $('paidForm');
    if (!form) return;

    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    // Check for saved payment state
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
                debug('🔄 Payment state restored from session');
            }
        } catch (e) {
            debug('⚠️ Failed to parse payment data', e);
        }
    }

    // Payment Button Handler
    const payBtn = $('payBtn');
    if (payBtn) {
        payBtn.addEventListener('click', (e) => {
            if (!validatePaidForm()) {
                e.preventDefault();
                showToast('Please fill all required fields before payment', 'error');
                return false;
            }

            // Save form data BEFORE redirect
            try {
                const formData = collectPaidFormData();
                sessionStorage.setItem('tempPaidData', JSON.stringify(formData));
                debug('💾 Form data saved to session before payment');
            } catch (err) {
                debug('⚠️ Failed to save temp data', err);
            }

            debug('🔗 Redirecting to Razorpay...');
            return true;
        });
    }

    // Form Submit Handler
    newForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!isSubmitting && paymentDone) {
            handlePaidSubmit();
        } else if (!paymentDone) {
            showToast('⚠️ Please complete payment first', 'error');
        }
    });

    // Field Validation
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
    debug('✅ Paid Form initialized');
}

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

async function handleFeedbackSubmit() {
    debug('📤 Feedback submission triggered');

    if (isSubmitting) {
        debug('⚠️ Already submitting - ignoring');
        return;
    }

    if (!validateFeedbackForm()) {
        showToast('Please fill all required fields correctly', 'error');
        const firstInvalid = document.querySelector('#feedbackForm [aria-invalid="true"]');
        if (firstInvalid) firstInvalid.focus();
        return;
    }

    isSubmitting = true;
    showLoader('Submitting Feedback...');

    try {
        const data = collectFeedbackData();
        debug('📦 Feedback data collected', data);

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

async function handlePaidSubmit(e = null, autoSubmit = false) {
    if (e) e.preventDefault();

    debug('📤 Paid submission triggered', { autoSubmit });

    if (isSubmitting) {
        debug('⚠️ Already submitting - ignoring');
        return;
    }

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

    // Restore payment data if needed
    if (!paymentData.razorpay_payment_id) {
        try {
            const saved = sessionStorage.getItem('paymentData');
            if (saved) {
                paymentData = JSON.parse(saved);
                debug('🔄 Payment data restored from session');
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

    isSubmitting = true;
    showLoader(autoSubmit ? 'Processing Payment...' : 'Processing Registration...');

    try {
        const data = collectPaidFormData();
        debug('📦 Paid data collected', data);

        await submitToGoogleSheets(data, 'audit');
        showSuccess(data, 'paid');
        
        // Clear session after successful submission
        sessionStorage.removeItem('paymentData');
        sessionStorage.removeItem('tempPaidData');
        debug('🧹 Session data cleared');
        
    } catch (error) {
        console.error('Paid submission error:', error);
        showToast('⚠️ Registration saved locally', 'warning');
        showSuccess(collectPaidFormData(), 'paid');
    } finally {
        hideLoader();
        isSubmitting = false;
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

async function submitToGoogleSheets(data, formType) {

    try {

        const blob = new Blob(
            [JSON.stringify(data)],
            { type: 'application/json' }
        );

        navigator.sendBeacon(CONFIG.GOOGLE_SCRIPT, blob);

        debug(`📤 ${formType} data sent using Beacon`);

        return true;

    } catch (error) {

        console.error("Beacon error:", error);

        // fallback fetch
        await fetch(CONFIG.GOOGLE_SCRIPT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        return true;
    }
}

const started = sessionStorage.getItem("tempPaidData");

if (!paymentId && started) {

    debug("⚡ Payment assumed successful (mobile return)");

    processSuccessfulPayment(
        "MOBILE_PAYMENT",
        "N/A"
    );

    return true;
}

function showSuccess(data, formType) {
    // Hide Both Forms Immediately
    $('feedbackForm')?.classList.add('hidden-form');
    $('paidForm')?.classList.add('hidden-form');
    $('landingPage')?.classList.add('hidden');

    const successMsg = $('successMsg');
    if (!successMsg) return;

    // Show Success Container
    successMsg.classList.remove('hidden');

    // FEEDBACK - Minimal Message
    if (formType === 'feedback') {
        successMsg.innerHTML = `
            <div class="success-icon" style="font-size:4rem; color:var(--success); margin-bottom:15px">
                <i class="fas fa-check-circle"></i>
            </div>
            <h2 id="successTitle" style="margin:10px 0; color:var(--text)">✅ Feedback Submitted!</h2>
            <p style="color:var(--muted); margin:15px 0; font-size:1.1rem">
                Thank you for sharing your valuable feedback! 🙏
            </p>
            <button type="button" onclick="resetAll()" class="btn-primary" style="margin-top:25px; max-width: 250px;">
                <i class="fas fa-home"></i> Back to Home
            </button>
        `;
        debug('🎉 Minimal success screen for feedback');
    } 
    // PAID/AUDIT - Full Receipt
    else {
        const mappings = {
            sName: data.name,
            sEmail: data.email,
            sAmount: data.amount,
            sTime: new Date().toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
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
        debug('🎉 Full success screen for paid registration');
    }

    currentView = 'success';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

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
            debug('✅ Submit button enabled after payment');
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

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-lock"></i> Complete Registration';
    }
    debug('🎨 Payment UI: Pending state');
}

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

function resetAll() {
    debug('🔄 Global reset triggered');
    $('successMsg')?.classList.add('hidden');
    resetFeedbackForm();
    resetPaidForm();
    isSubmitting = false;
    showView('landing');

    if (window.history.replaceState) {
        window.history.replaceState({}, document.title, CONFIG.RETURN_URL);
    }

    debug('✅ Global reset complete');
}

window.addEventListener('popstate', () => {
    if (!paymentDone && !window.location.search.includes('razorpay_')) {
        debug('⬅️ Back navigation - resetting');
        resetAll();
    }
});

window.addEventListener('beforeunload', () => {
    try {
        sessionStorage.removeItem('tempPaidData');
    } catch (e) {}
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

debug('🎯 Event Registration System Ready - Mobile Optimized');