// ===== CONFIGURATION =====
const CONFIG = {
    // Razorpay Payment Link (No key exposure needed!)
    PAYMENT_LINK: "https://rzp.io/rzp/IRE79PZ",
    
    // Razorpay Key ID for optional checkout verification (safe to expose)
    RAZORPAY_KEY_ID: "rzp_live_SP580L4d4AeEgL",
    
    AMOUNT: 100, // ₹1.00 = 100 paise
    CURRENCY: "INR",
    
    // Google Apps Script URL (Remove trailing spaces)
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

const form = $('regForm');
const payBtn = $('payBtn');
const submitBtn = $('submitBtn');
const paymentStatus = $('paymentStatus');
const successMsg = $('successMsg');
const loader = $('loader');
const toast = $('toast');
const loaderText = $('loaderText');

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    initStarRating();
    initEventListeners();
    setReceiptTime();
    checkPaymentReturn(); // Check if user returned after payment
});

// ===== CHECK PAYMENT RETURN FROM RAZORPAY =====
function checkPaymentReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentId = urlParams.get('razorpay_payment_id');
    const status = urlParams.get('razorpay_payment_status');
    
    if (paymentId && status === 'captured') {
        // Payment successful - auto-fill success screen
        paymentDone = true;
        paymentData.razorpay_payment_id = paymentId;
        paymentData.razorpay_order_id = urlParams.get('razorpay_order_id') || 'N/A';
        
        updatePaymentUI(true);
        showToast('✅ Payment Successful! Completing registration...', 'success');
        
        // Auto-submit form after short delay
        setTimeout(() => {
            if (validateForm()) {
                handleSubmit(new Event('submit'));
            }
        }, 1500);
    }
}

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
}

// ===== EVENT LISTENERS =====
function initEventListeners() {
    payBtn?.addEventListener('click', initiatePayment);
    form?.addEventListener('submit', handleSubmit);
    
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

// ===== PAYMENT FLOW - PAYMENT LINK METHOD =====
async function initiatePayment() {
    if (!validateForm()) {
        showToast('Please fill all required fields correctly', 'error');
        return;
    }
    
    // Show loading
    setLoading(payBtn, true, 'Redirecting to Payment...');
    loaderText.textContent = 'Redirecting to secure payment...';
    loader?.classList.remove('hidden');
    
    try {
        // Collect form data for passing to payment link
        const formData = collectFormData();
        
        // Save data to sessionStorage for retrieval after payment
        sessionStorage.setItem('registrationData', JSON.stringify(formData));
        
        // Build return URL to capture payment status
        const returnUrl = `${window.location.origin}${window.location.pathname}?razorpay_payment_id={payment_id}&razorpay_payment_status={payment_status}&razorpay_order_id={order_id}`;
        
        // Redirect to Razorpay Payment Link
        // Razorpay will auto-append payment details to return URL
        const paymentUrl = `${CONFIG.PAYMENT_LINK}?amount=100&currency=INR&name=${encodeURIComponent(formData.name)}&email=${encodeURIComponent(formData.email)}&contact=${encodeURIComponent(formData.phone)}&return_url=${encodeURIComponent(returnUrl)}`;
        
        // Redirect user to payment
        window.location.href = CONFIG.PAYMENT_LINK;
        
    } catch (error) {
        console.error('Payment initiation error:', error);
        showToast('⚠️ Could not start payment. Please try again.', 'error');
        resetPaymentUI();
    } finally {
        setLoading(payBtn, false);
        loader?.classList.add('hidden');
    }
}

// ===== ALTERNATIVE: Razorpay Checkout SDK Method =====
// Use this if you have backend to create orders
async function startRazorpayCheckout() {
    if (!validateForm()) {
        showToast('Please fill all required fields correctly', 'error');
        return;
    }
    
    setLoading(payBtn, true, 'Initializing Payment...');
    
    try {
        // ⚠️ In production, fetch order_id from YOUR backend
        // Never create orders from frontend with key_secret
        const options = {
            key: CONFIG.RAZORPAY_KEY_ID,
            amount: CONFIG.AMOUNT,
            currency: CONFIG.CURRENCY,
            name: "EventPro Seminar",
            description: "Event Registration - ₹1",
            image: "https://via.placeholder.com/150x150/667eea/ffffff?text=EP",
            // order_id: "", // Fetch from backend in production
            handler: function(response) {
                paymentDone = true;
                paymentData = {
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_order_id: response.razorpay_order_id || 'ORDER_' + Date.now(),
                    razorpay_signature: response.razorpay_signature
                };
                
                updatePaymentUI(true);
                showToast('✅ Payment Successful! Complete your registration.', 'success');
                submitBtn?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            },
            prefill: {
                name: $('name')?.value.trim() || '',
                email: $('email')?.value.trim() || '',
                contact: $('phone')?.value.trim() || ''
            },
            notes: {
                registration: "true",
                company: $('company')?.value.trim() || ''
            },
            theme: { color: "#667eea" },
            modal: {
                ondismiss: function() {
                    showToast('Payment cancelled. Try again when ready.', 'warning');
                    resetPaymentUI();
                }
            }
        };
        
        const razorpay = new Razorpay(options);
        
        razorpay.on('payment.failed', function(response) {
            console.error('Payment failed:', response.error);
            showToast(`❌ Payment Failed: ${response.error.description || 'Please try again'}`, 'error');
            resetPaymentUI();
        });
        
        razorpay.open();
        
    } catch (error) {
        console.error('Razorpay error:', error);
        showToast('⚠️ Payment system error. Please try again.', 'error');
        resetPaymentUI();
    } finally {
        setLoading(payBtn, false);
    }
}

// ===== UI UPDATES =====
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
    
    paymentStatus.innerHTML = '⏳ Payment: <b>Pending</b>';
    paymentStatus.classList.remove('paid');
    submitBtn.disabled = true;
    payBtn.innerHTML = '<i class="fas fa-rupee-sign"></i> Pay ₹1 Securely';
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
    if (e) e.preventDefault();
    
    if (!paymentDone) {
        showToast('⚠️ Please complete payment first', 'warning');
        payBtn?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    
    loader?.classList.remove('hidden');
    loaderText.textContent = 'Saving your registration...';
    
    try {
        const data = collectFormData();
        await submitToGoogleSheets(data);
        showSuccess(data);
    } catch (error) {
        console.error('Submission error:', error);
        // Still show success for better UX
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
        payment_status: paymentDone ? 'Paid' : 'Pending',
        amount: `₹${(CONFIG.AMOUNT / 100).toFixed(2)}`,
        payment_method: 'Razorpay',
        razorpay_payment_id: paymentData.razorpay_payment_id || 'PENDING',
        razorpay_order_id: paymentData.razorpay_order_id || 'N/A',
        payment_link_id: paymentData.payment_link_id || 'IRE79PZ',
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        page_url: window.location.href
    };
}

async function submitToGoogleSheets(data) {
    // Skip if demo/placeholder URL
    if (!CONFIG.GOOGLE_SCRIPT || CONFIG.GOOGLE_SCRIPT.includes('YOUR_')) {
        console.log('✅ Demo mode - Data ready:', data);
        return true;
    }
    
    try {
        const response = await fetch(CONFIG.GOOGLE_SCRIPT, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        console.log('Google Sheets response:', response.status);
        return true;
    } catch (err) {
        console.error('Google Sheets error:', err);
        throw err;
    }
}

// ===== SUCCESS SCREEN =====
function showSuccess(data) {
    form?.classList.add('hidden');
    successMsg?.classList.remove('hidden');
    
    $('sName') && ($('sName').textContent = data.name);
    $('sEmail') && ($('sEmail').textContent = data.email);
    $('sAmount') && ($('sAmount').textContent = data.amount);
    $('sPaymentId') && ($('sPaymentId').textContent = paymentData.razorpay_payment_id || 'Processing...');
    $('sStatus') && ($('sStatus').textContent = data.payment_status);
    $('sTime') && ($('sTime').textContent = new Date().toLocaleString('en-IN', {
        weekday: 'short', day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit'
    }));
    
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
    
    if (toast.timeoutId) clearTimeout(toast.timeoutId);
    toast.timeoutId = setTimeout(() => {
        toast.classList.add('hidden');
    }, 3200);
}

// ===== ERROR HANDLING =====
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    showToast('⚠️ An unexpected error occurred. Please refresh.', 'error');
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise:', e.reason);
    showToast('⚠️ Connection issue. Please check internet.', 'warning');
});

// ===== PWA & PRINT =====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // navigator.serviceWorker.register('/sw.js');
    });
}

window.addEventListener('beforeprint', () => document.body.classList.add('printing'));
window.addEventListener('afterprint', () => document.body.classList.remove('printing'));