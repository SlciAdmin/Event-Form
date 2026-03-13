// ============================================================================
// AUDIT REGISTRATION - AUTO PAYMENT DETECTION & GOOGLE SHEETS
// ============================================================================

const CONFIG = {
    // ✅ NO TRAILING SPACES
    PAYMENT_LINK: "https://rzp.io/rzp/5NCrTAI",
    GOOGLE_SCRIPT: "https://script.google.com/macros/s/AKfycbxSAJHIbkTYMxQCZYbYXxaZVX-MmkfOzQjaqs81mjQsy3Ua3TlHwx9QQpTlCC_JdcglNA/exec",
    RETURN_URL: window.location.origin + window.location.pathname
};

// DOM Elements
const form = document.getElementById('auditForm');
const payBtn = document.getElementById('payNowBtn');
const completeBtn = document.getElementById('completeBtn');
const paymentStatus = document.getElementById('paymentStatus');
const successMsg = document.getElementById('auditSuccessMsg');
const toast = document.getElementById('toast');
const loader = document.getElementById('loader');
const loaderText = document.querySelector('#loader p');

// State
let paymentDone = false;
let isSubmitting = false;
let paymentData = {
    razorpay_payment_id: '',
    razorpay_order_id: '',
    payment_status: ''
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

function showLoader(text) {
    loaderText.textContent = text;
    loader.classList.remove('hidden');
}

function hideLoader() {
    loader.classList.add('hidden');
}

// ============================================================================
// 🔥 AUTO PAYMENT DETECTION - PAGE LOAD PAR CHECK
// ============================================================================

function checkPaymentReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const params = Object.fromEntries(urlParams.entries());
    
    console.log('🔍 URL Parameters:', params);
    console.log('🔍 Full URL:', window.location.href);
    
    // Razorpay returns these parameters
    const paymentId = params.razorpay_payment_id || params.payment_id;
    const orderId = params.razorpay_order_id || params.order_id;
    const signature = params.razorpay_signature || params.signature;
    const status = params.razorpay_payment_status || params.status || params.payment_status;
    
    console.log('💳 Payment Details:', { paymentId, orderId, status });
    
    // ✅ Check if payment ID exists and starts with 'pay_'
    if (paymentId && paymentId.startsWith('pay_')) {
        console.log('✅ Payment detected! ID:', paymentId);
        
        paymentData = {
            razorpay_payment_id: paymentId,
            razorpay_order_id: orderId || 'ORDER_' + Date.now(),
            razorpay_signature: signature || '',
            payment_status: 'captured'
        };
        
        // Save to session
        sessionStorage.setItem('auditPayment', JSON.stringify(paymentData));
        
        // Restore form data
        restoreFormData();
        
        // ✅ UPDATE UI AUTOMATICALLY
        paymentDone = true;
        paymentStatus.innerHTML = '✅ Payment Successful!<br><small>ID: ' + paymentId + '</small>';
        paymentStatus.className = 'payment-status success';
        payBtn.disabled = true;
        payBtn.style.opacity = '0.6';
        completeBtn.disabled = false;  // ✅ ENABLE BUTTON
        
        showToast('Payment successful! Click "Complete Registration"', 'success');
        
        // Clean URL (remove payment params)
        const cleanUrl = CONFIG.RETURN_URL;
        window.history.replaceState({}, document.title, cleanUrl);
        
        // ✅ AUTO-SUBMIT AFTER 2 SECONDS
        setTimeout(() => {
            if (paymentDone && !isSubmitting) {
                console.log('🚀 Auto-submitting registration...');
                completeBtn.click();
            }
        }, 2000);
        
        return true;
    }
    
    // ✅ Also check status parameter
    if (status && ['success', 'captured', 'paid'].includes(status.toLowerCase())) {
        console.log('✅ Status-based payment detection');
        paymentDone = true;
        paymentStatus.innerHTML = '✅ Payment Successful!';
        paymentStatus.className = 'payment-status success';
        payBtn.disabled = true;
        payBtn.style.opacity = '0.6';
        completeBtn.disabled = false;
        showToast('Payment successful!', 'success');
        
        // Auto-submit
        setTimeout(() => {
            if (paymentDone && !isSubmitting) {
                completeBtn.click();
            }
        }, 2000);
        
        return true;
    }
    
    return false;
}

// Check session storage (page refresh)
function checkSessionPayment() {
    const savedPayment = sessionStorage.getItem('auditPayment');
    if (savedPayment) {
        try {
            const parsed = JSON.parse(savedPayment);
            if (parsed.razorpay_payment_id && parsed.razorpay_payment_id.startsWith('pay_')) {
                paymentData = parsed;
                paymentDone = true;
                
                paymentStatus.innerHTML = '✅ Payment Successful!<br><small>ID: ' + parsed.razorpay_payment_id + '</small>';
                paymentStatus.className = 'payment-status success';
                payBtn.disabled = true;
                payBtn.style.opacity = '0.6';
                completeBtn.disabled = false;
                
                restoreFormData();
                
                // Auto-submit
                setTimeout(() => {
                    if (paymentDone && !isSubmitting) {
                        completeBtn.click();
                    }
                }, 2000);
                
                return true;
            }
        } catch (e) {
            console.error('Session error:', e);
        }
    }
    return false;
}

// Restore form data
function restoreFormData() {
    const savedData = sessionStorage.getItem('auditFormData');
    if (savedData) {
        try {
            const data = JSON.parse(savedData);
            Object.keys(data).forEach(id => {
                const field = document.getElementById(id);
                if (field && data[id]) field.value = data[id];
            });
            console.log('🔄 Form restored');
        } catch (e) {
            console.error('Restore error:', e);
        }
    }
}

// Save form data before payment
function saveFormData() {
    const formData = {
        name: document.getElementById('name').value,
        designation: document.getElementById('designation').value,
        company: document.getElementById('company').value,
        employees: document.getElementById('employees').value,
        phone: document.getElementById('phone').value,
        email: document.getElementById('email').value,
        city: document.getElementById('city').value,
        remarks: document.getElementById('remarks').value
    };
    sessionStorage.setItem('auditFormData', JSON.stringify(formData));
    console.log('💾 Form saved');
}

// ============================================================================
// VALIDATION
// ============================================================================

function validateField(field) {
    const value = field.value.trim();
    
    if (field.hasAttribute('required') && !value) {
        field.classList.add('invalid');
        return false;
    }
    
    if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        field.classList.add('invalid');
        showToast('Invalid email', 'error');
        return false;
    }
    
    if (field.type === 'tel' && value && !/^[6-9][0-9]{9}$/.test(value)) {
        field.classList.add('invalid');
        showToast('Invalid phone', 'error');
        return false;
    }
    
    field.classList.remove('invalid');
    return true;
}

function validateFormForPayment() {
    let isValid = true;
    ['name', 'designation', 'company', 'employees', 'phone', 'email', 'city'].forEach(id => {
        const field = document.getElementById(id);
        if (field && !validateField(field)) isValid = false;
    });
    
    if (!document.querySelector('input[name="audit_rating"]:checked')) {
        showToast('Select rating', 'error');
        isValid = false;
    }
    
    return isValid;
}

function validateFormForSubmit() {
    let isValid = true;
    ['name', 'designation', 'company', 'employees', 'phone', 'email', 'city'].forEach(id => {
        const field = document.getElementById(id);
        if (field && !validateField(field)) isValid = false;
    });
    
    if (!document.querySelector('input[name="audit_rating"]:checked')) {
        showToast('Select rating', 'error');
        isValid = false;
    }
    
    return isValid;
}

// ============================================================================
// DATA COLLECTION & SUBMISSION
// ============================================================================

function collectFormData() {
    const rating = document.querySelector('input[name="audit_rating"]:checked')?.value || '5';
    
    return {
        name: document.getElementById('name').value.trim(),
        designation: document.getElementById('designation').value.trim(),
        company: document.getElementById('company').value.trim(),
        employees: document.getElementById('employees').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        email: document.getElementById('email').value.trim(),
        city: document.getElementById('city').value.trim(),
        audit_rating: rating,
        remarks: document.getElementById('remarks').value.trim() || 'None',
        form_type: 'audit_registration',
        payment_status: 'Paid',
        amount: '₹1',
        razorpay_payment_id: paymentData.razorpay_payment_id || 'PENDING',
        razorpay_order_id: paymentData.razorpay_order_id || 'N/A',
        razorpay_signature: paymentData.razorpay_signature || 'N/A',
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent
    };
}

async function submitToGoogleSheets(data) {
    console.log('📤 Sending to Google Sheets:', data);
    
    try {
        await fetch(CONFIG.GOOGLE_SCRIPT.trim(), {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        console.log('✅ Data sent successfully!');
        return true;
    } catch (error) {
        console.error('❌ Error:', error);
        const backups = JSON.parse(localStorage.getItem('auditBackups') || '[]');
        backups.push({ ...data, backup_time: new Date().toISOString() });
        localStorage.setItem('auditBackups', JSON.stringify(backups));
        throw error;
    }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

payBtn.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('💳 Pay button clicked');
    
    if (!validateFormForPayment()) {
        showToast('Fill all fields', 'error');
        return;
    }
    
    saveFormData();
    
    // Add return URL
    const paymentUrl = new URL(CONFIG.PAYMENT_LINK.trim());
    paymentUrl.searchParams.set('redirect_url', CONFIG.RETURN_URL);
    paymentUrl.searchParams.set('return_url', CONFIG.RETURN_URL);
    
    console.log('🔗 Redirecting to:', paymentUrl.toString());
    window.location.href = paymentUrl.toString();
});

async function handleSubmit(e) {
    if (e) e.preventDefault();
    console.log('📝 Complete Registration clicked');
    
    if (!paymentDone) {
        showToast('Complete payment first', 'error');
        return;
    }
    
    if (isSubmitting) return;
    if (!validateFormForSubmit()) return;
    
    isSubmitting = true;
    completeBtn.disabled = true;
    showLoader('Completing registration...');
    
    try {
        const formData = collectFormData();
        console.log('📊 Data:', formData);
        
        await submitToGoogleSheets(formData);
        
        document.getElementById('receiptName').textContent = formData.name;
        document.getElementById('receiptEmail').textContent = formData.email;
        document.getElementById('receiptPaymentId').textContent = formData.razorpay_payment_id;
        
        form.classList.add('hidden');
        successMsg.classList.remove('hidden');
        
        sessionStorage.removeItem('auditPayment');
        sessionStorage.removeItem('auditFormData');
        
        showToast('Registration complete!', 'success');
        
    } catch (error) {
        console.error('Error:', error);
        showToast('Saved locally', 'warning');
        
        document.getElementById('receiptName').textContent = document.getElementById('name').value;
        document.getElementById('receiptEmail').textContent = document.getElementById('email').value;
        document.getElementById('receiptPaymentId').textContent = paymentData.razorpay_payment_id || 'Pending';
        
        form.classList.add('hidden');
        successMsg.classList.remove('hidden');
        
    } finally {
        hideLoader();
        isSubmitting = false;
    }
}

// ============================================================================
// INITIALIZATION - AUTO CHECK ON PAGE LOAD
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Audit form loaded');
    console.log('📍 URL:', window.location.href);
    console.log('🔧 Config:', {
        PAYMENT_LINK: CONFIG.PAYMENT_LINK.trim(),
        GOOGLE_SCRIPT: CONFIG.GOOGLE_SCRIPT.trim()
    });
    
    // ✅ AUTO CHECK PAYMENT ON PAGE LOAD
    const paymentDetected = checkPaymentReturn();
    
    if (!paymentDetected) {
        checkSessionPayment();
    }
    
    // Validation
    ['name', 'designation', 'company', 'employees', 'phone', 'email', 'city'].forEach(id => {
        const field = document.getElementById(id);
        if (field) {
            field.addEventListener('blur', () => validateField(field));
            field.addEventListener('input', () => field.classList.remove('invalid'));
        }
    });
    
    // Star rating
    document.querySelectorAll('.star-rating label').forEach(label => {
        label.setAttribute('tabindex', '0');
        label.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                label.click();
            }
        });
    });
});

form.addEventListener('submit', handleSubmit);