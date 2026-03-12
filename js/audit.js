// ============================================================================
// AUDIT REGISTRATION FORM - GOOGLE SHEETS + RAZORPAY INTEGRATION
// URL: https://script.google.com/macros/s/AKfycbxSAJHIbkTYMxQCZYbYXxaZVX-MmkfOzQjaqs81mjQsy3Ua3TlHwx9QQpTlCC_JdcglNA/exec
// ============================================================================

const CONFIG = {
    // ✅ NO TRAILING SPACES - CRITICAL FIX
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
// PAYMENT RETURN HANDLING (After Razorpay Redirect)
// ============================================================================

function checkPaymentReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    
    const paymentId = urlParams.get('razorpay_payment_id') || urlParams.get('payment_id');
    const orderId = urlParams.get('razorpay_order_id') || urlParams.get('order_id');
    const signature = urlParams.get('razorpay_signature');
    const status = urlParams.get('razorpay_payment_status') || urlParams.get('status');
    
    console.log('🔍 Payment Return Check:', { paymentId, orderId, status });
    
    if (paymentId) {
        paymentData = {
            razorpay_payment_id: paymentId,
            razorpay_order_id: orderId || 'ORDER_' + Date.now(),
            razorpay_signature: signature || '',
            payment_status: 'captured'
        };
        
        console.log('✅ Payment Captured:', paymentData);
        
        sessionStorage.setItem('auditPayment', JSON.stringify(paymentData));
        restoreFormData();
        
        paymentDone = true;
        paymentStatus.innerHTML = '✅ Payment Successful!<br><small>ID: ' + paymentId.substring(0, 15) + '...</small>';
        paymentStatus.className = 'payment-status success';
        payBtn.disabled = true;
        payBtn.style.opacity = '0.6';
        completeBtn.disabled = false;
        
        showToast('Payment successful! Click "Complete Registration"', 'success');
        window.history.replaceState({}, document.title, CONFIG.RETURN_URL);
        
        return true;
    }
    
    return false;
}

function checkSessionPayment() {
    const savedPayment = sessionStorage.getItem('auditPayment');
    if (savedPayment) {
        try {
            const parsed = JSON.parse(savedPayment);
            if (parsed.razorpay_payment_id) {
                paymentData = parsed;
                paymentDone = true;
                
                paymentStatus.innerHTML = '✅ Payment Successful!<br><small>ID: ' + parsed.razorpay_payment_id.substring(0, 15) + '...</small>';
                paymentStatus.className = 'payment-status success';
                payBtn.disabled = true;
                payBtn.style.opacity = '0.6';
                completeBtn.disabled = false;
                
                restoreFormData();
                return true;
            }
        } catch (e) {
            console.error('Session parse error', e);
        }
    }
    return false;
}

function restoreFormData() {
    const savedData = sessionStorage.getItem('auditFormData');
    if (savedData) {
        try {
            const data = JSON.parse(savedData);
            Object.keys(data).forEach(id => {
                const field = document.getElementById(id);
                if (field && data[id]) field.value = data[id];
            });
            console.log('🔄 Form data restored from session');
        } catch (e) {
            console.error('Restore error', e);
        }
    }
}

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
    console.log('💾 Form data saved to session');
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

function validateField(field) {
    const value = field.value.trim();
    
    if (field.hasAttribute('required') && !value) {
        field.classList.add('invalid');
        return false;
    }
    
    if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        field.classList.add('invalid');
        showToast('Please enter a valid email', 'error');
        return false;
    }
    
    if (field.type === 'tel' && value && !/^[6-9][0-9]{9}$/.test(value)) {
        field.classList.add('invalid');
        showToast('Please enter valid 10-digit number', 'error');
        return false;
    }
    
    if (field.type === 'number' && value && (isNaN(value) || value < 1)) {
        field.classList.add('invalid');
        showToast('Please enter valid number', 'error');
        return false;
    }
    
    field.classList.remove('invalid');
    return true;
}

function validateFormForPayment() {
    let isValid = true;
    const requiredFields = ['name', 'designation', 'company', 'employees', 'phone', 'email', 'city'];
    
    requiredFields.forEach(id => {
        const field = document.getElementById(id);
        if (field && !validateField(field)) isValid = false;
    });
    
    if (!document.querySelector('input[name="audit_rating"]:checked')) {
        showToast('Please select a rating', 'error');
        isValid = false;
    }
    
    return isValid;
}

function validateFormForSubmit() {
    let isValid = true;
    const requiredFields = ['name', 'designation', 'company', 'employees', 'phone', 'email', 'city'];
    
    requiredFields.forEach(id => {
        const field = document.getElementById(id);
        if (field && !validateField(field)) isValid = false;
    });
    
    if (!document.querySelector('input[name="audit_rating"]:checked')) {
        showToast('Please select a rating', 'error');
        isValid = false;
    }
    
    return isValid;
}

// ============================================================================
// DATA COLLECTION & SUBMISSION TO GOOGLE SHEETS
// ============================================================================

function collectFormData() {
    const rating = document.querySelector('input[name="audit_rating"]:checked')?.value || 'Not rated';
    
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
        await fetch(CONFIG.GOOGLE_SCRIPT, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        console.log('✅ Data sent successfully to Google Sheets');
        return true;
    } catch (error) {
        console.error('❌ Submission error:', error);
        
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
    console.log('💳 Payment button clicked');
    
    if (!validateFormForPayment()) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    saveFormData();
    
    const paymentUrl = new URL(CONFIG.PAYMENT_LINK);
    paymentUrl.searchParams.set('redirect_url', CONFIG.RETURN_URL);
    paymentUrl.searchParams.set('return_url', CONFIG.RETURN_URL);
    
    console.log('🔗 Redirecting to Razorpay:', paymentUrl.toString());
    window.location.href = paymentUrl.toString();
});

async function handleSubmit(e) {
    e.preventDefault();
    console.log('📝 Complete Registration clicked');
    
    if (!paymentDone) {
        showToast('Please complete payment first', 'error');
        return;
    }
    
    if (isSubmitting) return;
    if (!validateFormForSubmit()) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    isSubmitting = true;
    completeBtn.disabled = true;
    showLoader('Completing registration...');
    
    try {
        const formData = collectFormData();
        console.log('📊 Final Form Data:', formData);
        
        await submitToGoogleSheets(formData);
        
        document.getElementById('receiptName').textContent = formData.name;
        document.getElementById('receiptEmail').textContent = formData.email;
        document.getElementById('receiptPaymentId').textContent = formData.razorpay_payment_id;
        
        form.classList.add('hidden');
        successMsg.classList.remove('hidden');
        
        sessionStorage.removeItem('auditPayment');
        sessionStorage.removeItem('auditFormData');
        
        showToast('Registration completed successfully!', 'success');
        
    } catch (error) {
        console.error('Error during submission:', error);
        showToast('Registration saved locally', 'warning');
        
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
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Audit form initialized');
    console.log('🔧 Config:', {
        PAYMENT_LINK: CONFIG.PAYMENT_LINK,
        GOOGLE_SCRIPT: CONFIG.GOOGLE_SCRIPT,
        RETURN_URL: CONFIG.RETURN_URL
    });
    
    const paymentHandled = checkPaymentReturn();
    if (!paymentHandled) checkSessionPayment();
    
    ['name', 'designation', 'company', 'employees', 'phone', 'email', 'city'].forEach(id => {
        const field = document.getElementById(id);
        if (field) {
            field.addEventListener('blur', () => validateField(field));
            field.addEventListener('input', () => field.classList.remove('invalid'));
        }
    });
    
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