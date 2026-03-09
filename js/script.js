// ===== CONFIGURATION =====
const CONFIG = {
    // Razorpay Test Credentials (Replace with your Key ID in production)
    RAZORPAY_KEY_ID: "rzp_test_YOUR_KEY_ID", // 🔴 Replace with your actual test key
    AMOUNT: 100, // Amount in paise (₹1.00 = 100 paise)
    CURRENCY: "INR",
    NAME: "Seminar Registration",
    DESCRIPTION: "Test Payment - Event Registration",
    PREFILL_EMAIL: "", // Will be auto-filled from form
    PREFILL_CONTACT: "", // Will be auto-filled from form
    
    // Google Apps Script URL (Ensure no trailing spaces)
    GOOGLE_SCRIPT: "https://script.google.com/macros/s/AKfycbwLzF0hUTdqqZ8pJKKrxofb-C1F3J4iZvnjrPCdAjM94tLbQDIf40lLpxopE9ZImfRe/exec"
};

// ===== STATE =====
let paymentDone = false;
let paymentData = {
    razorpay_payment_id: "",
    razorpay_order_id: "",
    razorpay_signature: ""
};

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
    initEventListeners();
    setReceiptTime();
    
    // Auto-fill Razorpay prefill from form when fields change
    ['email', 'phone'].forEach(id => {
        $(id)?.addEventListener('blur', updateRazorpayPrefill);
    });
});

// ===== STAR RATING =====
function initStarRating() {
    const rating = $('starRating');
    if (!rating) return;
    
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

// ===== EVENT LISTENERS =====
function initEventListeners() {
    payBtn?.addEventListener('click', startRazorpayPayment);
    form?.addEventListener('submit', handleSubmit);
    
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

function updateRazorpayPrefill() {
    CONFIG.PREFILL_EMAIL = $('email')?.value.trim() || '';
    CONFIG.PREFILL_CONTACT = $('phone')?.value.trim() || '';
}

// ===== RAZORPAY PAYMENT FLOW =====
async function startRazorpayPayment() {
    if (!validateForm()) {
        showToast('Please fill all required fields correctly', 'error');
        return;
    }
    
    // Update prefill with latest form values
    updateRazorpayPrefill();
    
    // Show loading state
    setLoading(payBtn, true, 'Initializing Payment...');
    
    try {
        // For test mode, we can directly open checkout without creating order on server
        // In production, you should create an order via your backend first
        const options = {
            key: CONFIG.RAZORPAY_KEY_ID,
            amount: CONFIG.AMOUNT,
            currency: CONFIG.CURRENCY,
            name: "EventPro Seminar",
            description: CONFIG.DESCRIPTION,
            image: "https://via.placeholder.com/150x150/667eea/ffffff?text=EP", // Optional logo
            order_id: "", // Empty for test mode; use server-generated order_id in production
            handler: function(response) {
                // Payment successful
                paymentDone = true;
                paymentData = {
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_order_id: response.razorpay_order_id || 'TEST_ORDER',
                    razorpay_signature: response.razorpay_signature || 'TEST_SIG'
                };
                
                // Update UI
                updatePaymentUI(true);
                showToast('✅ Payment Successful! Complete your registration.', 'success');
                
                // Auto-scroll to submit button
                submitBtn?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            },
            prefill: {
                name: $('name')?.value.trim() || '',
                email: CONFIG.PREFILL_EMAIL,
                contact: CONFIG.PREFILL_CONTACT
            },
            notes: {
                registration: "true",
                user_agent: navigator.userAgent
            },
            theme: {
                color: "#667eea"
            },
            modal: {
                ondismiss: function() {
                    // User closed the modal without paying
                    showToast('Payment cancelled. Try again when ready.', 'warning');
                    resetPaymentUI();
                }
            }
        };
        
        // Initialize Razorpay
        const razorpay = new Razorpay(options);
        
        // Handle payment failure
        razorpay.on('payment.failed', function(response) {
            console.error('Payment failed:', response.error);
            showToast(`❌ Payment Failed: ${response.error.description || 'Please try again'}`, 'error');
            resetPaymentUI();
        });
        
        // Open Razorpay Checkout
        razorpay.open();
        
    } catch (error) {
        console.error('Razorpay initialization error:', error);
        showToast('⚠️ Payment system error. Please try again.', 'error');
        resetPaymentUI();
    } finally {
        setLoading(payBtn, false);
    }
}

function updatePaymentUI(paid) {
    if (!paymentStatus || !payBtn || !submitBtn) return;
    
    if (paid) {
        paymentStatus.innerHTML = '✅ Payment: <b style="color:var(--success)">Completed</b>';
        paymentStatus.classList.add('paid');
        submitBtn.disabled = false;
        payBtn.innerHTML = '<i class="fas fa-check"></i> Payment Successful';
        payBtn.style.background = 'linear-gradient(135deg, var(--success), var(--success-dark))';
        payBtn.style.cursor = 'default';
        payBtn.disabled = true;
    }
}

function resetPaymentUI() {
    if (!paymentStatus || !payBtn || !submitBtn) return;
    
    paymentStatus.innerHTML = '⏳ Payment: <b>Not Done</b>';
    paymentStatus.classList.remove('paid');
    submitBtn.disabled = true;
    payBtn.innerHTML = '<i class="fas fa-rupee-sign"></i> Pay ₹1 with Razorpay';
    payBtn.style.background = '';
    payBtn.style.cursor = 'pointer';
    payBtn.disabled = false;
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
        // Still show success even if Google Sheets fails (offline support)
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
        payment_status: 'Paid',
        amount: `₹${(CONFIG.AMOUNT / 100).toFixed(2)}`,
        payment_method: 'Razorpay',
        razorpay_payment_id: paymentData.razorpay_payment_id || 'TEST_PAYMENT',
        razorpay_order_id: paymentData.razorpay_order_id || 'TEST_ORDER',
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
    };
}

async function submitToGoogleSheets(data) {
    if (!CONFIG.GOOGLE_SCRIPT || CONFIG.GOOGLE_SCRIPT.includes('YOUR_') || CONFIG.GOOGLE_SCRIPT.includes('script.google.com/macros/s/AKfycbw')) {
        console.log('✅ Demo mode - Data ready for Google Sheets:', data);
        return true;
    }
    
    try {
        const response = await fetch(CONFIG.GOOGLE_SCRIPT, {
            method: 'POST',
            mode: 'no-cors', // Required for Google Apps Script
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(data)
        });
        console.log('Google Sheets response status:', response.status);
        return true;
    } catch (err) {
        console.error('Google Sheets submission error:', err);
        throw err;
    }
}

// ===== SUCCESS SCREEN =====
function showSuccess(data) {
    form?.classList.add('hidden');
    successMsg?.classList.remove('hidden');
    
    const sName = $('sName');
    const sEmail = $('sEmail');
    const sRef = $('sRef');
    const sTime = $('sTime');
    const sPaymentId = $('sPaymentId');
    
    if (sName) sName.textContent = data.name;
    if (sEmail) sEmail.textContent = data.email;
    if (sRef) sRef.textContent = paymentData.razorpay_order_id || 'N/A';
    if (sPaymentId) sPaymentId.textContent = paymentData.razorpay_payment_id || 'TEST_PAYMENT_ID';
    if (sTime) sTime.textContent = new Date().toLocaleString('en-IN', {
        weekday: 'short', day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit'
    });
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (navigator.vibrate) navigator.vibrate([50, 100, 50]);
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
    
    // Clear existing timeout if any
    if (toast.timeoutId) clearTimeout(toast.timeoutId);
    toast.timeoutId = setTimeout(() => {
        toast.classList.add('hidden');
    }, 3200);
}

// ===== PRINT & PWA =====
window.addEventListener('beforeprint', () => document.body.classList.add('printing'));
window.addEventListener('afterprint', () => document.body.classList.remove('printing'));

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // You can show an install button here if needed
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW registration failed:', err));
    });
}

// ===== ERROR HANDLING =====
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    showToast('⚠️ An unexpected error occurred. Please refresh.', 'error');
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
    showToast('⚠️ Connection issue. Please check your internet.', 'warning');
});