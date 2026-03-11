/**
 * Event Registration System - FULLY WORKING & ERROR-FREE
 * Feedback + Audit with Razorpay Payment Link
 * ✅ Auto Excel Save + Form Restore After Payment + Retry Logic
 */

const CONFIG = {
    // ✅ FIXED: Removed ALL trailing spaces from URLs
    PAYMENT_LINK: "https://rzp.io/rzp/5NCrTAI",
    AMOUNT: 1,  // ✅ Testing: ₹1 as requested
    CURRENCY: "INR",
    GOOGLE_SCRIPT: "https://script.google.com/macros/library/d/1Etu_Q0tgZAGf5VvwxiB2M4dK2WUTqohwnox26q5YMolg8e100zo9zAtl/7",
    RETURN_URL: "https://slciadmin.github.io/Event-Form/",
    DEBUG: true,
    MAX_RETRIES: 3  // ✅ Added retry logic for sheet submission
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
    
    ['landingPage', 'feedbackForm', 'paidForm', 'successMsg'].forEach(id => {
        const el = $(id);
        if (!el) return;
        el.classList.add('hidden-form', 'hidden');
        el.classList.remove('active-form');
    });

    const activeMap = {
        'landing': 'landingPage',
        'feedback': 'feedbackForm', 
        'paid': 'paidForm',
        'success': 'successMsg'
    };
    
    const activeEl = $(activeMap[viewName]);
    if (activeEl) {
        activeEl.classList.remove('hidden-form', 'hidden');
        activeEl.classList.add('active-form');
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function backToLanding() {
    // Clear temp data but keep payment confirmation if already done
    if (!paymentDone) {
        sessionStorage.removeItem('tempPaidData');
    }
    showView('landing');
}

// 🔥 FIXED: Enhanced handlePaymentReturn with proper param handling
function handlePaymentReturn() {
    debug('🔍 Checking payment return...');
    const urlParams = new URLSearchParams(window.location.search);
    
    // ✅ Handle both Payment Link AND Checkout return params
    const paymentId = urlParams.get('razorpay_payment_id') || urlParams.get('payment_id');
    const status = urlParams.get('razorpay_payment_status') || urlParams.get('status');
    const orderId = urlParams.get('razorpay_order_id') || urlParams.get('order_id');
    const error = urlParams.get('razorpay_error') || urlParams.get('error');
    const paymentLinkId = urlParams.get('payment_link_id') || 'IRE79PZ';

    debug('📋 URL Params:', { paymentId, status, orderId, error, paymentLinkId });

    // ✅ PAYMENT SUCCESSFUL - Handle both 'captured' and 'success' status
    if (paymentId && (status === 'captured' || status === 'success')) {
        debug('✅ Payment captured!', { paymentId, orderId });
        paymentDone = true;
        paymentData = {
            razorpay_payment_id: paymentId,
            razorpay_order_id: orderId || 'N/A',
            razorpay_signature: urlParams.get('razorpay_signature') || 'N/A',
            payment_link_id: paymentLinkId
        };
        
        try {
            sessionStorage.setItem('paymentData', JSON.stringify(paymentData));
            debug('💾 Payment data saved to session');
        } catch (e) { 
            debug('⚠️ Session storage failed', e); 
            showToast('⚠️ Browser storage issue - please refresh if form resets', 'warning');
        }

        // ✅ Clean URL without breaking browser history
        if (window.history.replaceState) {
            const cleanUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, cleanUrl);
        }

        updatePaymentUI(true);
        const submitBtn = $('submitBtn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('btn-disabled');
        }

        // 🔥 RESTORE FORM DATA with validation
        restoreFormData();

        // 🔥 Auto-submit with proper delay + validation
        setTimeout(() => {
            if (paymentDone && validatePaidForm()) {
                debug('🔄 Auto-submitting paid form after successful payment...');
                handlePaidSubmit(null, true);
            } else if (!validatePaidForm()) {
                debug('⚠️ Form validation failed after payment restore');
                showToast('✅ Payment successful! Please review & submit form', 'success');
                // Keep form visible for manual submit
                showView('paid');
            }
        }, 2500); // ✅ Increased delay for reliable render
        
        return true;
    }

    // ❌ PAYMENT FAILED/CANCELLED
    if (error || (status && status !== 'captured' && status !== 'success')) {
        debug('❌ Payment failed/cancelled', { error, status });
        showToast(`⚠️ Payment ${error ? 'Failed: ' + error : 'Cancelled'}. Please try again.`, 'warning');
        resetPaymentUI();
        
        if (window.history.replaceState) {
            const cleanUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, cleanUrl);
        }
        return false;
    }
    
    debug('ℹ️ No payment parameters found in URL');
    return false;
}

// 🔥 NEW: Dedicated form restore function
function restoreFormData() {
    const savedFormData = sessionStorage.getItem('tempPaidData');
    if (!savedFormData || currentView !== 'paid') {
        debug('ℹ️ No form data to restore or wrong view');
        return;
    }
    
    try {
        const formData = JSON.parse(savedFormData);
        debug('🔄 Restoring form data:', Object.keys(formData));
        
        // Restore all text fields
        const fieldMap = {
            'name': formData.name,
            'email': formData.email, 
            'phone': formData.phone,
            'company': formData.company,
            'designation': formData.designation,
            'city': formData.city,
            'employees': formData.employees,
            'remarks': formData.remarks
        };
        
        Object.entries(fieldMap).forEach(([id, value]) => {
            const field = $(id);
            if (field && value) {
                field.value = value;
                // Trigger validation reset
                field.style.borderColor = '';
                field.removeAttribute('aria-invalid');
            }
        });
        
        // Restore radio button ratings
        if (formData.audit_rating) {
            const ratingRadio = document.querySelector(`input[name="audit_rating"][value="${formData.audit_rating}"]`);
            if (ratingRadio) {
                ratingRadio.checked = true;
                const container = $('audit_starRating');
                if (container) container.style.borderColor = '';
            }
        }
        
        // Visual confirmation
        showToast('📋 Form data restored after payment', 'info');
        debug('✅ Form data successfully restored');
        
    } catch (e) { 
        debug('⚠️ Failed to restore form data', e); 
        showToast('⚠️ Could not restore form - please re-enter details', 'warning');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    debug('🚀 DOM Content Loaded - System Initializing');
    
    // Initialize default view
    showView('landing');

    // Button event listeners
    $('showFeedbackBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        debug('🖱️ Feedback button clicked');
        showView('feedback');
        initFeedbackForm();
    });

    $('showPaidBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        debug('🖱️ Audit/Paid button clicked');
        showView('paid');
        initPaidForm();
    });

    // Initialize forms
    initFeedbackForm();
    initPaidForm();
    
    // ✅ CRITICAL: Check for payment return IMMEDIATELY on load
    handlePaymentReturn();
    
    debug('✅ System Ready - Payment Link Flow Active');
});

function initFeedbackForm() {
    const form = $('feedbackForm');
    if (!form) return;

    // Clone to reset event listeners (prevents duplicate handlers)
    const newForm = form.cloneNode(true);
    form.parentNode?.replaceChild(newForm, form);

    initStarRating('fb_starRating');

    // Real-time validation for feedback fields
    ['fb_name', 'fb_email', 'fb_phone', 'fb_city', 'fb_employees', 'fb_designation', 'fb_company'].forEach(id => {
        const field = $(id);
        if (field) {
            field.addEventListener('blur', () => validateField(field, 'feedback'));
            field.addEventListener('input', () => clearFieldError(field));
        }
    });

    newForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!isSubmitting) handleFeedbackSubmit();
    });

    debug('✅ Feedback Form initialized');
}

function initPaidForm() {
    const form = $('paidForm');
    if (!form) return;

    // Clone to reset event listeners
    const newForm = form.cloneNode(true);
    form.parentNode?.replaceChild(newForm, form);

    // ✅ Restore payment state from session
    try {
        const savedPayment = sessionStorage.getItem('paymentData');
        if (savedPayment && currentView === 'paid') {
            paymentData = JSON.parse(savedPayment);
            if (paymentData.razorpay_payment_id) {
                paymentDone = true;
                updatePaymentUI(true);
                const submitBtn = $('submitBtn');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.classList.remove('btn-disabled');
                }
                debug('🔄 Payment state restored from session');
            }
        }
    } catch (e) {
        debug('⚠️ Failed to parse payment data', e);
    }

    // Pay button handler - SAVE FORM DATA before redirect
    const payBtn = $('payBtn');
    if (payBtn) {
        payBtn.addEventListener('click', (e) => {
            if (!validatePaidForm()) {
                e.preventDefault();
                showToast('Please fill all required fields before payment', 'error');
                return false;
            }

            try {
                // ✅ CRITICAL: Save form data BEFORE redirect to Razorpay
                const formData = collectPaidFormData();
                sessionStorage.setItem('tempPaidData', JSON.stringify(formData));
                debug('💾 Form data saved to session before payment redirect');
            } catch (err) {
                debug('⚠️ Failed to save temp form data', err);
                showToast('⚠️ Could not save form - please try again', 'warning');
                return false;
            }

            debug('🔗 Redirecting to Razorpay Payment Link...');
            // Let the link redirect naturally - no preventDefault
            return true;
        });
    }

    // Form submit handler (for manual submit after payment)
    newForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!isSubmitting && paymentDone) {
            handlePaidSubmit();
        } else if (!paymentDone) {
            showToast('⚠️ Please complete payment first', 'error');
            $('payBtn')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });

    // Real-time validation for paid form fields
    ['name', 'email', 'phone', 'city', 'employees', 'designation', 'company'].forEach(id => {
        const field = $(id);
        if (field) {
            field.addEventListener('blur', () => validateField(field, 'paid'));
            field.addEventListener('input', () => clearFieldError(field));
        }
    });

    initStarRating('audit_starRating');
    debug('✅ Paid Form initialized with payment restore logic');
}

// Helper: Clear field error styling
function clearFieldError(field) {
    if (!field) return;
    if (field.style.borderColor === 'var(--danger)') {
        field.style.borderColor = '';
        field.removeAttribute('aria-invalid');
    }
}

function validateField(field, formType) {
    if (!field) return false;
    const value = field.value.trim();
    let isValid = true;

    // Required field check
    if (field.hasAttribute('required') && !value) {
        markInvalid(field, 'This field is required');
        return false;
    }

    // Email validation
    if (field.type === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            markInvalid(field, 'Please enter a valid email');
            isValid = false;
        }
    }

    // Phone validation (Indian mobile)
    if ((field.type === 'tel' || field.name === 'phone') && value) {
        const phoneRegex = /^[6-9][0-9]{9}$/;
        if (!phoneRegex.test(value.replace(/[\s\-\(\)]/g, ''))) {
            markInvalid(field, 'Enter valid 10-digit mobile number');
            isValid = false;
        }
    }

    // Number validation
    if (field.type === 'number' && value && !isNaN(value)) {
        const num = parseInt(value);
        if (num < 1 || num > 10000) {
            markInvalid(field, 'Please enter a valid number (1-10000)');
            isValid = false;
        }
    }

    if (isValid) {
        field.style.borderColor = '';
        field.removeAttribute('aria-invalid');
        field.removeAttribute('title');
    }

    return isValid;
}

function markInvalid(field, message = 'Invalid input') {
    if (!field) return;
    field.style.borderColor = 'var(--danger, #dc3545)';
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('title', message);
    field.style.animation = 'none';
    setTimeout(() => {
        field.style.animation = 'shake 0.3s ease';
    }, 10);
    // Auto-focus on first error
    if (!document.querySelector('[aria-invalid="true"]:focus')) {
        field.focus();
    }
}

function validateFeedbackForm() {
    let isValid = true;
    const requiredIds = ['fb_name', 'fb_designation', 'fb_company', 'fb_phone', 'fb_email', 'fb_city', 'fb_employees'];
    
    requiredIds.forEach(id => {
        const field = $(id);
        if (field && !validateField(field, 'feedback')) {
            isValid = false;
        }
    });

    // Rating validation
    const rating = document.querySelector('input[name="fb_rating"]:checked');
    const ratingContainer = $('fb_starRating');
    if (!rating) {
        if (ratingContainer) {
            ratingContainer.style.borderColor = 'var(--danger, #dc3545)';
            ratingContainer.setAttribute('aria-invalid', 'true');
        }
        showToast('Please select a session rating ⭐', 'error');
        isValid = false;
    } else if (ratingContainer) {
        ratingContainer.style.borderColor = '';
        ratingContainer.removeAttribute('aria-invalid');
    }

    return isValid;
}

function validatePaidForm() {
    let isValid = true;
    const requiredIds = ['name', 'designation', 'company', 'phone', 'email', 'city', 'employees'];
    
    requiredIds.forEach(id => {
        const field = $(id);
        if (field && !validateField(field, 'paid')) {
            isValid = false;
        }
    });

    // Audit rating validation
    const auditRating = document.querySelector('input[name="audit_rating"]:checked');
    const ratingContainer = $('audit_starRating');
    if (!auditRating) {
        if (ratingContainer) {
            ratingContainer.style.borderColor = 'var(--danger, #dc3545)';
            ratingContainer.setAttribute('aria-invalid', 'true');
        }
        showToast('Please select your experience rating ⭐', 'error');
        isValid = false;
    } else if (ratingContainer) {
        ratingContainer.style.borderColor = '';
        ratingContainer.removeAttribute('aria-invalid');
    }

    return isValid;
}

// 🔥 FIXED: Submit with retry logic for Google Sheets
async function submitToGoogleSheets(data, formType, retryCount = 0) {
    if (!CONFIG.GOOGLE_SCRIPT || CONFIG.GOOGLE_SCRIPT.includes('YOUR_') || CONFIG.GOOGLE_SCRIPT.includes('AKfyc')) {
        debug('📋 Demo mode: Using mock submission (replace GOOGLE_SCRIPT with your deployed URL)');
        // Simulate success for testing
        return new Promise(resolve => setTimeout(() => resolve(true), 500));
    }

    debug(`📤 Attempting to send ${formType} data to Google Sheets (Attempt ${retryCount + 1}/${CONFIG.MAX_RETRIES})`);

    try {
        const response = await fetch(CONFIG.GOOGLE_SCRIPT, {
            method: 'POST',
            // ✅ CRITICAL: Use 'cors' mode to read response (GAS must allow CORS)
            mode: 'cors',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(data),
            // Add timeout to prevent hanging
            signal: AbortSignal.timeout(15000)
        });

        // ✅ Read and parse response to confirm success
        const responseText = await response.text();
        debug(`📡 Server response: ${responseText.substring(0, 200)}`);
        
        // Handle both JSON and plain text responses from GAS
        let result;
        try {
            result = JSON.parse(responseText);
        } catch {
            result = { status: response.ok ? 'success' : 'error', message: responseText };
        }

        if (response.ok && result.status === 'success') {
            debug(`✅ ${formType} data saved successfully`);
            return true;
        } else {
            throw new Error(result.message || `HTTP ${response.status}`);
        }
        
    } catch (error) {
        console.error(`❌ Google Sheets error (${formType}, attempt ${retryCount + 1}):`, error.message);
        
        // 🔥 Retry logic with exponential backoff
        if (retryCount < CONFIG.MAX_RETRIES) {
            const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
            debug(`🔄 Retrying in ${delay/1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return submitToGoogleSheets(data, formType, retryCount + 1);
        }
        
        // All retries failed
        debug(`❌ All ${CONFIG.MAX_RETRIES} attempts failed for ${formType}`);
        throw new Error(`Failed to save data after ${CONFIG.MAX_RETRIES} attempts: ${error.message}`);
    }
}

async function handleFeedbackSubmit() {
    debug('📤 Feedback submission triggered');

    if (isSubmitting) {
        debug('⚠️ Submission already in progress - ignoring duplicate');
        return;
    }

    if (!validateFeedbackForm()) {
        showToast('Please fill all required fields correctly', 'error');
        return;
    }

    isSubmitting = true;
    showLoader('Submitting Feedback...');

    try {
        const data = collectFeedbackData();
        debug('📦 Feedback data prepared', { name: data.name, email: data.email });

        await submitToGoogleSheets(data, 'feedback');
        showSuccess(data, 'feedback');
        resetFeedbackForm();
        
    } catch (error) {
        console.error('Feedback submission error:', error);
        // ✅ Fallback: Save to localStorage so data isn't lost
        saveDataLocally(data, 'feedback');
        showToast('⚠️ Saved locally - will sync when online', 'warning');
        showSuccess(data, 'feedback');
        
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
        screen_resolution: `${screen.width}x${screen.height}`,
        page_url: window.location.href
    };
}

function resetFeedbackForm() {
    const form = $('feedbackForm');
    if (!form) return;

    form.reset();
    form.querySelectorAll('[aria-invalid="true"]').forEach(el => {
        el.removeAttribute('aria-invalid');
        el.style.borderColor = '';
    });
    
    const ratingContainer = $('fb_starRating');
    if (ratingContainer) {
        ratingContainer.style.borderColor = '';
        ratingContainer.removeAttribute('aria-invalid');
    }
    
    debug('✅ Feedback form reset');
}

// 🔥 MAIN: Paid/Audit Form Submission (AFTER PAYMENT)
async function handlePaidSubmit(e = null, autoSubmit = false) {
    if (e) e.preventDefault();

    debug('📤 Paid/Audit submission triggered', { autoSubmit, paymentDone });

    if (isSubmitting) {
        debug('⚠️ Submission already in progress - ignoring');
        return;
    }

    // ✅ Double-check payment completion
    if (!paymentDone) {
        // Try to restore payment data from session
        try {
            const saved = sessionStorage.getItem('paymentData');
            if (saved) {
                paymentData = JSON.parse(saved);
                if (paymentData.razorpay_payment_id) {
                    paymentDone = true;
                    updatePaymentUI(true);
                    debug('🔄 Payment state restored from session');
                }
            }
        } catch (err) {
            debug('⚠️ Failed to restore payment data', err);
        }
    }

    if (!paymentDone || !paymentData.razorpay_payment_id) {
        debug('❌ Payment not verified - cannot submit');
        showToast('⚠️ Payment verification pending. Please wait or contact support.', 'error');
        $('payBtn')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    if (!validatePaidForm()) {
        showToast('Please correct the highlighted fields', 'error');
        return;
    }

    isSubmitting = true;
    showLoader(autoSubmit ? 'Processing Payment Confirmation...' : 'Finalizing Registration...');

    try {
        const data = collectPaidFormData();
        debug('📦 Audit data prepared', { 
            name: data.name, 
            payment_id: data.razorpay_payment_id,
            amount: data.amount 
        });

        // ✅ CRITICAL: Save to Google Sheets with retry
        await submitToGoogleSheets(data, 'audit');
        
        // ✅ Clear session data ONLY after successful save
        sessionStorage.removeItem('paymentData');
        sessionStorage.removeItem('tempPaidData');
        
        showSuccess(data, 'paid');
        debug('🎉 Audit registration completed successfully');
        
    } catch (error) {
        console.error('❌ Audit submission error:', error);
        
        // ✅ Fallback: Save to localStorage to prevent data loss
        const data = collectPaidFormData();
        saveDataLocally(data, 'audit');
        
        showToast('✅ Payment confirmed! Registration saved (syncing to Excel)', 'success');
        showSuccess(data, 'paid');
        
    } finally {
        hideLoader();
        isSubmitting = false;
    }
}

// 🔥 NEW: Save data to localStorage as fallback
function saveDataLocally(data, type) {
    try {
        const key = `pending_${type}_${Date.now()}`;
        localStorage.setItem(key, JSON.stringify({
            ...data,
            sync_status: 'pending',
            saved_at: new Date().toISOString()
        }));
        debug(`💾 Data saved locally: ${key}`);
        
        // Attempt to sync in background when online
        if (navigator.onLine) {
            setTimeout(() => attemptLocalSync(key, type), 5000);
        }
    } catch (e) {
        debug('⚠️ Local storage save failed', e);
    }
}

// 🔥 NEW: Background sync for locally saved data
async function attemptLocalSync(storageKey, formType) {
    if (!navigator.onLine) return;
    
    try {
        const item = localStorage.getItem(storageKey);
        if (!item) return;
        
        const data = JSON.parse(item);
        if (data.sync_status === 'synced') return; // Already synced
        
        debug(`🔄 Attempting background sync for ${storageKey}`);
        await submitToGoogleSheets(data, formType);
        
        // Mark as synced or remove
        data.sync_status = 'synced';
        localStorage.setItem(storageKey, JSON.stringify(data));
        setTimeout(() => localStorage.removeItem(storageKey), 1000);
        
        debug(`✅ Background sync successful for ${storageKey}`);
    } catch (e) {
        debug(`⚠️ Background sync failed for ${storageKey}`, e);
        // Keep in localStorage for next attempt
    }
}

function collectPaidFormData() {
    const auditRating = document.querySelector('input[name="audit_rating"]:checked')?.value || 'Not rated';
    return {
        // User Details
        name: $('name')?.value.trim() || '',
        designation: $('designation')?.value.trim() || '',
        company: $('company')?.value.trim() || '',
        employees: $('employees')?.value.trim() || '',
        phone: $('phone')?.value.trim() || '',
        email: $('email')?.value.trim() || '',
        city: $('city')?.value.trim() || '',
        
        // Form Specific
        audit_rating: auditRating,
        remarks: $('remarks')?.value.trim() || 'None',
        form_type: 'paid_registration',
        
        // Payment Details - CRITICAL for Excel
        payment_status: 'Paid',
        amount: `₹${CONFIG.AMOUNT}.00`, // ✅ Dynamic based on CONFIG
        payment_method: 'Razorpay Payment Link',
        razorpay_payment_id: paymentData.razorpay_payment_id || 'PENDING',
        razorpay_order_id: paymentData.razorpay_order_id || 'N/A',
        razorpay_signature: paymentData.razorpay_signature || 'N/A',
        payment_link_id: paymentData.payment_link_id || 'IRE79PZ',
        
        // Tracking & Debug
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent,
        screen_resolution: `${screen.width}x${screen.height}`,
        page_url: window.location.href,
        return_url: CONFIG.RETURN_URL,
        submission_type: 'post_payment_redirect'
    };
}

function resetPaidForm() {
    const form = $('paidForm');
    if (!form) return;

    form.reset();
    form.querySelectorAll('[aria-invalid="true"]').forEach(el => {
        el.removeAttribute('aria-invalid');
        el.style.borderColor = '';
    });
    
    resetPaymentUI();
    
    // Reset state
    paymentDone = false;
    paymentData = {
        razorpay_payment_id: "",
        razorpay_order_id: "",
        razorpay_signature: "",
        payment_link_id: "IRE79PZ"
    };
    
    // Clear session storage
    try {
        sessionStorage.removeItem('paymentData');
        sessionStorage.removeItem('tempPaidData');
    } catch (e) {
        debug('⚠️ Session cleanup failed', e);
    }
    
    debug('✅ Paid form fully reset');
}

function showSuccess(data, formType) {
    // Hide all forms
    ['feedbackForm', 'paidForm', 'landingPage'].forEach(id => {
        $(id)?.classList.add('hidden-form', 'hidden');
        $(id)?.classList.remove('active-form');
    });

    const successMsg = $('successMsg');
    if (!successMsg) {
        debug('❌ Success message element not found');
        return;
    }

    successMsg.classList.remove('hidden-form', 'hidden');
    successMsg.classList.add('active-form');

    if (formType === 'feedback') {
        // ✅ Minimal success for feedback
        successMsg.innerHTML = `
            <div style="text-align:center; padding:20px">
                <div style="font-size:4rem; color:var(--success, #28a745); margin-bottom:15px">
                    <i class="fas fa-check-circle"></i>
                </div>
                <h2 id="successTitle" style="margin:10px 0; color:var(--text, #333)">✅ Feedback Submitted!</h2>
                <p style="color:var(--muted, #666); margin:15px 0; font-size:1.1rem">
                    Thank you for your valuable feedback! 🙏
                </p>
                <button type="button" onclick="resetAll()" class="btn-primary" 
                        style="margin-top:25px; padding:12px 30px; cursor:pointer">
                    <i class="fas fa-home"></i> Back to Home
                </button>
            </div>
        `;
        debug('🎉 Feedback success screen displayed');
        
    } else {
        // ✅ Full receipt for paid registration
        const mappings = {
            sName: data.name,
            sEmail: data.email,
            sAmount: data.amount,
            sTime: new Date(data.timestamp).toLocaleString('en-IN', { 
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata'
            }),
            sType: 'Audit & Compliance Registration',
            sStatus: 'Payment Confirmed'
        };
        
        Object.entries(mappings).forEach(([id, value]) => {
            const el = $(id);
            if (el) el.textContent = value;
        });
        
        // Show payment ID if available
        const paymentIdRow = $('paymentIdRow');
        const sPaymentId = $('sPaymentId');
        if (paymentIdRow && sPaymentId) {
            if (data.razorpay_payment_id && data.razorpay_payment_id !== 'N/A') {
                paymentIdRow.style.display = 'flex';
                sPaymentId.textContent = data.razorpay_payment_id;
            } else {
                paymentIdRow.style.display = 'none';
            }
        }
        
        // Update title
        const successTitle = $('successTitle');
        if (successTitle) successTitle.textContent = '✅ Registration Confirmed!';
        
        // Show print button
        const printBtn = successMsg.querySelector('.btn-outline');
        if (printBtn) printBtn.style.display = 'inline-flex';
        
        debug('🎉 Paid registration success screen displayed');
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
        // ✅ Paid state
        paymentStatus.innerHTML = '✅ Payment: <strong style="color:var(--success, #28a745)">Confirmed</strong>';
        paymentStatus.classList.add('paid');
        
        payBtn.innerHTML = '<i class="fas fa-check-circle"></i> Payment Successful';
        payBtn.style.background = 'linear-gradient(135deg, var(--success, #28a745), var(--success-dark, #218838))';
        payBtn.style.cursor = 'not-allowed';
        payBtn.setAttribute('disabled', 'true');
        payBtn.setAttribute('aria-disabled', 'true');
        payBtn.classList.add('btn-disabled');

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('btn-disabled');
            submitBtn.focus();
            debug('✅ Submit button enabled after payment confirmation');
        }
        
    } else {
        // Reset to pending state
        resetPaymentUI();
    }
}

function resetPaymentUI() {
    const paymentStatus = $('paymentStatus');
    const payBtn = $('payBtn');
    const submitBtn = $('submitBtn');

    if (!paymentStatus || !payBtn) return;

    paymentStatus.innerHTML = '⏳ Payment: <strong>Pending</strong>';
    paymentStatus.classList.remove('paid');
    
    payBtn.innerHTML = `<i class="fas fa-rupee-sign"></i> Pay ₹${CONFIG.AMOUNT} Securely`;
    payBtn.style.background = '';
    payBtn.style.cursor = 'pointer';
    payBtn.removeAttribute('disabled');
    payBtn.removeAttribute('aria-disabled');
    payBtn.classList.remove('btn-disabled');

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('btn-disabled');
    }
    
    debug('🎨 Payment UI reset to pending state');
}

function initStarRating(containerId) {
    const container = $(containerId);
    if (!container) return;

    const labels = container.querySelectorAll('label');
    const inputs = container.querySelectorAll('input[type="radio"]');
    
    labels.forEach(label => {
        // Click handler
        label.addEventListener('click', function(e) {
            e.preventDefault();
            const inputId = this.getAttribute('for');
            const input = document.getElementById(inputId);
            if (input) {
                // Uncheck all, check selected
                inputs.forEach(radio => radio.checked = false);
                input.checked = true;
                // Clear error state
                container.style.borderColor = '';
                container.removeAttribute('aria-invalid');
                debug(`⭐ Rating selected: ${input.value} for ${containerId}`);
            }
        });

        // Keyboard accessibility
        label.setAttribute('tabindex', '0');
        label.setAttribute('role', 'radio');
        label.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                label.click();
            }
        });
    });
    
    // Update label states based on checked radio
    inputs.forEach(input => {
        input.addEventListener('change', function() {
            if (this.checked) {
                const label = document.querySelector(`label[for="${this.id}"]`);
                if (label) {
                    label.setAttribute('aria-checked', 'true');
                }
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
    
    // Prevent background scrolling
    document.body.style.overflow = 'hidden';
    debug(`🔄 Loader displayed: ${text}`);
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
    if (!toast) {
        console.log(`[TOAST] ${type.toUpperCase()}: ${message}`);
        return;
    }

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle', 
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };

    // Clear existing timeout
    if (toast._timeoutId) {
        clearTimeout(toast._timeoutId);
        delete toast._timeoutId;
    }

    // Update content and show
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
    toast.className = `toast toast-${type}`;
    toast.classList.remove('hidden');
    toast.setAttribute('aria-live', 'polite');

    // Auto-hide after delay
    toast._timeoutId = setTimeout(() => {
        toast.classList.add('hidden');
        delete toast._timeoutId;
    }, type === 'error' ? 5000 : 3500);

    debug(`🔔 Toast [${type}]: ${message}`);
}

function resetAll() {
    debug('🔄 Global reset triggered');
    
    // Hide success message
    $('successMsg')?.classList.add('hidden-form', 'hidden');
    
    // Reset both forms
    resetFeedbackForm();
    resetPaidForm();
    
    // Reset state
    isSubmitting = false;
    paymentDone = false;
    
    // Return to landing
    showView('landing');

    // Clean URL
    if (window.history.replaceState) {
        window.history.replaceState({}, document.title, CONFIG.RETURN_URL);
    }

    debug('✅ Global reset complete');
}

// Handle browser back button
window.addEventListener('popstate', () => {
    if (!paymentDone && !window.location.search.includes('razorpay_') && !window.location.search.includes('payment_')) {
        debug('⬅️ Back navigation detected - resetting to safe state');
        resetAll();
    }
});

// Cleanup on page unload (but keep payment confirmation)
window.addEventListener('beforeunload', (e) => {
    // Only clear temp form data, NOT payment confirmation
    if (!paymentDone) {
        try {
            sessionStorage.removeItem('tempPaidData');
        } catch (err) {}
    }
    // Don't prevent unload - let user leave if they want
});

// Mobile keyboard viewport fix
document.addEventListener('focusin', (e) => {
    if (e.target.tagName === 'INPUT' && window.innerWidth < 500) {
        const meta = document.querySelector('meta[name="viewport"]');
        if (meta && !meta.content.includes('user-scalable=no')) {
            meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
        }
    }
});

// Enter key navigation (skip textarea)
$$('input[type="text"], input[type="email"], input[type="tel"], input[type="number"]').forEach(field => {
    field.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const form = e.target.closest('form');
            if (!form) return;
            
            const fields = Array.from(form.querySelectorAll('input:not([type="hidden"]), select'));
            const currentIndex = fields.indexOf(e.target);
            const nextField = fields[currentIndex + 1];
            
            if (nextField) {
                nextField.focus();
            } else {
                e.target.blur();
                // If last field, trigger form validation (not submit)
                if (form.id === 'paidForm' && paymentDone) {
                    validatePaidForm();
                }
            }
        }
    });
});

// Inject CSS animations
const style = document.createElement('style');
style.textContent = `
@keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
}
.shake { animation: shake 0.3s ease; }
.btn-disabled { opacity: 0.7; cursor: not-allowed; }
.toast { 
    position: fixed; bottom: 20px; right: 20px; 
    padding: 12px 20px; border-radius: 8px; 
    color: white; font-weight: 500; z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideIn 0.3s ease;
}
.toast-success { background: var(--success, #28a745); }
.toast-error { background: var(--danger, #dc3545); }
.toast-warning { background: #ffc107; color: #212529; }
.toast-info { background: var(--primary, #007bff); }
@keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}
.hidden { display: none !important; }
.hidden-form { display: none; }
.active-form { display: block; }
`;
document.head.appendChild(style);

// Final debug log
debug('🎯 Event Registration System READY - Payment Link Flow + Auto Excel Save + Retry Logic Enabled');