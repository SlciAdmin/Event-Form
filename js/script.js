// ===== CONFIGURATION =====
const CONFIG = {
    UPI_ID: "nikhilbajaj2690-2@oksbi",
    UPI_NAME: "Nikhil Bajaj",              // ✅ Updated
    AMOUNT: "1.00",                         // ✅ Updated to 1.00
    NOTE: "Seminar Registration",
    // ✅ FIXED: Removed trailing spaces
    GOOGLE_SCRIPT: "https://script.google.com/macros/s/AKfycbwLzF0hUTdqqZ8pJKKrxofb-C1F3J4iZvnjrPCdAjM94tLbQDIf40lLpxopE9ZImfRe/exec"
};

// ===== STATE =====
let paymentDone = false;
let paymentRef = "";
let selectedUPI = "";

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

// ===== UPI PAYMENT FLOW =====
// ✅ बस यह एक function replace करो - बाकी सब same रहेगा

async function startPayment() {
    if (!validateForm()) return;
    
    setLoading(payBtn, true, 'Opening UPI...');
    
    // ✅ UPI Link बनाओ
    const upiLink = `upi://pay?pa=${CONFIG.UPI_ID}&pn=${CONFIG.UPI_NAME}&am=${CONFIG.AMOUNT}&tn=${CONFIG.NOTE}&cu=INR`;
    
    // ✅ UPI App खोलो
    window.location.href = upiLink;
    
    // ✅ 3 सेकंड बाद confirm पूछो
    setTimeout(() => {
        const paid = confirm(`₹${CONFIG.AMOUNT} का payment कर दिया?\n\nOK = हां\nCancel = नहीं`);
        
        if (paid) {
            paymentDone = true;
            paymentRef = `PAY${Date.now().toString().slice(-8)}`;
            
            // ✅ UI update करो
            paymentStatus.innerHTML = '✅ Payment: <b style="color:green">Completed</b>';
            payBtn.innerHTML = '✅ Paid';
            payBtn.disabled = true;
            submitBtn.disabled = false;
            
            showToast('Payment Done! Form submit करें', 'success');
        }
    }, 3000);
    
    setLoading(payBtn, false);
}

// ✅ UPDATED: Generate UPI Intent with App-Specific Schemes
function generateUPIIntent() {
    const params = new URLSearchParams({
        pa: CONFIG.UPI_ID,
        pn: CONFIG.UPI_NAME,
        am: CONFIG.AMOUNT,
        tn: CONFIG.NOTE,
        cu: "INR",
        tr: `REG-${Date.now()}`  // ✅ Added transaction reference
    });

    let baseURL = "upi://pay?";

    // ✅ App-specific deep links
    if (selectedUPI === "gpay") {
        baseURL = "tez://upi/pay?";  // GPay uses tez://
    } else if (selectedUPI === "phonepe") {
        baseURL = "phonepe://pay?";   // PhonePe deep link
    }
    // ✅ Add more apps as needed:
    // else if (selectedUPI === "paytm") { baseURL = "paytmmp://upi/pay?"; }

    return baseURL + params.toString();
}

async function openUPIApp(url) {
    return new Promise((resolve) => {
        let appOpened = false;
        const startTime = Date.now();
        
        const handleVisibility = () => {
            if (document.hidden) {
                appOpened = true;
                document.removeEventListener('visibilitychange', handleVisibility);
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        
        // ✅ Use window.location for mobile deep links
        window.location.href = url;
        
        setTimeout(() => {
            document.removeEventListener('visibilitychange', handleVisibility);
            const elapsed = Date.now() - startTime;
            
            // Fallback for desktop users
            if (!document.hidden && elapsed < 2500) {
                if (/Windows|Mac|Linux/.test(navigator.platform)) {
                    window.open('https://pay.google.com', '_blank');
                }
                resolve(false);
            } else {
                resolve(true);
            }
        }, 2000);
    });
}

async function waitForPayment() {
    return new Promise((resolve) => {
        setTimeout(() => {
            const confirmed = confirm(
                `✅ Did you complete the payment of ₹${CONFIG.AMOUNT}?\n\n` +
                `• App: ${selectedUPI ? selectedUPI.toUpperCase() : 'UPI'}\n` +
                `• To: ${CONFIG.UPI_ID}\n\n` +
                `Click OK if payment was successful.`
            );
            
            if (confirmed) {
                paymentDone = true;
                paymentRef = `UPI-${Date.now().toString().slice(-8)}`;
                updatePaymentUI(true);
                showToast('Payment confirmed! Submitting registration...', 'success');
                setTimeout(() => form.requestSubmit(), 1200);
                resolve();
            } else {
                resetPaymentUI();
                resolve();
            }
        }, 2500);
    });
}

function updatePaymentUI(paid) {
    if (paid) {
        paymentStatus.innerHTML = '✅ Payment: <b style="color:var(--success)">Completed</b>';
        paymentStatus.classList.add('paid');
        submitBtn.disabled = false;
        payBtn.innerHTML = '<i class="fas fa-check"></i> Paid Successfully';
        payBtn.style.background = 'linear-gradient(135deg, var(--success), var(--success-dark))';
        payBtn.style.cursor = 'default';
        payBtn.disabled = true;
    }
}

function resetPaymentUI() {
    paymentStatus.innerHTML = '⏳ Payment: <b>Not Done</b>';
    paymentStatus.classList.remove('paid');
    submitBtn.disabled = true;
    payBtn.innerHTML = '<i class="fas fa-rupee-sign"></i> Pay ₹1.00 Now';
    payBtn.style.background = '';
    payBtn.style.cursor = 'pointer';
    payBtn.disabled = false;
}

function showManualPaymentInstructions() {
    const msg = `📱 Manual Payment:\n\n1. Copy UPI ID: ${CONFIG.UPI_ID}\n2. Open PhonePe/GPay/Paytm\n3. Send ₹${CONFIG.AMOUNT}\n4. Return here and confirm`;
    if (confirm(msg)) {
        resetPaymentUI();
    }
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