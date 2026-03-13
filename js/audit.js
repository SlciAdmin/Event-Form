// ============================================================================
// AUDIT REGISTRATION - COMPLETE WORKING VERSION WITH RAZORPAY
// ============================================================================

const CONFIG = {
    PAYMENT_LINK: "https://rzp.io/rzp/5NCrTAI",
    GOOGLE_SCRIPT: "https://script.google.com/macros/s/AKfycbxSAJHIbkTYMxQCZYbYXxaZVX-MmkfOzQjaqs81mjQsy3Ua3TlHwx9QQpTlCC_JdcglNA/exec",
    RETURN_URL: window.location.origin + window.location.pathname
};

// DOM Elements
const form = document.getElementById('auditForm');
const payNowBtn = document.getElementById('payNowBtn');
const paymentStatus = document.getElementById('paymentStatus');
const successMsg = document.getElementById('auditSuccessMsg');
const toast = document.getElementById('toast');
const loader = document.getElementById('loader');
const loaderText = document.querySelector('#loader p');

// State
let isSubmitting = false;
let paymentDone = false;
let paymentData = {
    razorpay_payment_id: '',
    razorpay_order_id: '',
    payment_status: 'Pending'
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
        showToast('Please enter a valid email address', 'error');
        return false;
    }
    
    if (field.type === 'tel' && value && !/^[6-9][0-9]{9}$/.test(value)) {
        field.classList.add('invalid');
        showToast('Please enter a valid 10-digit mobile number', 'error');
        return false;
    }
    
    if (field.type === 'number' && value && (isNaN(value) || value < 1)) {
        field.classList.add('invalid');
        showToast('Please enter a valid number', 'error');
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
        showToast('Please select a rating', 'error');
        isValid = false;
    }
    
    return isValid;
}

// ============================================================================
// SAVE FORM DATA BEFORE PAYMENT
// ============================================================================

function saveFormData() {
    const formData = {
        name: document.getElementById('name').value.trim(),
        designation: document.getElementById('designation').value.trim(),
        company: document.getElementById('company').value.trim(),
        employees: document.getElementById('employees').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        email: document.getElementById('email').value.trim(),
        city: document.getElementById('city').value.trim(),
        remarks: document.getElementById('remarks').value.trim(),
        rating: document.querySelector('input[name="audit_rating"]:checked')?.value || '5'
    };
    sessionStorage.setItem('auditFormData', JSON.stringify(formData));
    console.log('💾 Form data saved');
}

// ============================================================================
// RESTORE FORM DATA AFTER PAYMENT RETURN
// ============================================================================

function restoreFormData() {
    const savedData = sessionStorage.getItem('auditFormData');
    if (savedData) {
        try {
            const data = JSON.parse(savedData);
            Object.keys(data).forEach(id => {
                const field = document.getElementById(id);
                if (field && data[id]) field.value = data[id];
            });
            
            // Restore rating
            if (data.rating) {
                const ratingInput = document.querySelector(`input[name="audit_rating"][value="${data.rating}"]`);
                if (ratingInput) ratingInput.checked = true;
            }
            
            console.log('🔄 Form data restored');
        } catch (e) {
            console.error('Restore error:', e);
        }
    }
}

// ============================================================================
// CHECK PAYMENT RETURN (AUTO DETECT ON PAGE LOAD)
// ============================================================================

function checkPaymentReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const params = Object.fromEntries(urlParams.entries());
    
    console.log('🔍 Checking for payment return...');
    
    // Check for Razorpay payment ID
    const paymentId = params.razorpay_payment_id || params.payment_id;
    
    if (paymentId && paymentId.startsWith('pay_')) {
        console.log('✅ Payment detected! ID:', paymentId);
        
        paymentData = {
            razorpay_payment_id: paymentId,
            razorpay_order_id: params.razorpay_order_id || 'ORDER_' + Date.now(),
            payment_status: 'Paid'
        };
        
        paymentDone = true;
        
        // Update UI
        paymentStatus.innerHTML = `✅ Payment Successful!<br><small>ID: ${paymentId}</small>`;
        paymentStatus.className = 'payment-status success';
        payNowBtn.disabled = true;
        payNowBtn.style.opacity = '0.6';
        
        // Restore form data
        restoreFormData();
        
        showToast('Payment successful! Submitting registration...', 'success');
        
        // Auto-submit to Google Sheets after 2 seconds
        setTimeout(() => {
            if (paymentDone && !isSubmitting) {
                submitRegistration();
            }
        }, 2000);
        
        // Clean URL
        const cleanUrl = CONFIG.RETURN_URL;
        window.history.replaceState({}, document.title, cleanUrl);
        
        return true;
    }
    
    return false;
}

// ============================================================================
// SUBMIT REGISTRATION TO GOOGLE SHEETS
// ============================================================================

async function submitRegistration() {
    if (isSubmitting) return;
    
    isSubmitting = true;
    showLoader('Completing registration...');
    
    try {
        const formData = {
            name: document.getElementById('name').value.trim(),
            designation: document.getElementById('designation').value.trim(),
            company: document.getElementById('company').value.trim(),
            employees: document.getElementById('employees').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            email: document.getElementById('email').value.trim(),
            city: document.getElementById('city').value.trim(),
            audit_rating: document.querySelector('input[name="audit_rating"]:checked')?.value || '5',
            remarks: document.getElementById('remarks').value.trim() || 'None',
            form_type: 'audit_registration',
            payment_status: 'Paid',
            amount: '₹1',
            razorpay_payment_id: paymentData.razorpay_payment_id,
            razorpay_order_id: paymentData.razorpay_order_id,
            timestamp: new Date().toISOString(),
            user_agent: navigator.userAgent
        };
        
        console.log('📤 Submitting to Google Sheets:', formData);
        
        await fetch(CONFIG.GOOGLE_SCRIPT, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        // Show success message
        document.getElementById('receiptName').textContent = formData.name;
        document.getElementById('receiptEmail').textContent = formData.email;
        document.getElementById('receiptPaymentId').textContent = formData.razorpay_payment_id;
        
        form.classList.add('hidden');
        successMsg.classList.remove('hidden');
        
        // Clear session storage
        sessionStorage.removeItem('auditFormData');
        
        showToast('Registration complete!', 'success');
        
    } catch (error) {
        console.error('❌ Error:', error);
        showToast('Saved locally', 'warning');
        
        // Still show success
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
// PAY BUTTON CLICK HANDLER
// ============================================================================

payNowBtn.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('💰 Pay button clicked');
    
    // Validate form first
    if (!validateFormForPayment()) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    // Save form data before redirect
    saveFormData();
    
    // Build payment URL with return URL
    const paymentUrl = new URL(CONFIG.PAYMENT_LINK.trim());
    paymentUrl.searchParams.set('redirect_url', CONFIG.RETURN_URL);
    paymentUrl.searchParams.set('return_url', CONFIG.RETURN_URL);
    
    console.log('🔗 Redirecting to:', paymentUrl.toString());
    
    // Show loader
    showLoader('Redirecting to payment...');
    
    // Redirect to Razorpay
    setTimeout(() => {
        window.location.href = paymentUrl.toString();
    }, 500);
});

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Audit form initialized');
    
    // Check if returning from payment
    const paymentDetected = checkPaymentReturn();
    
    if (!paymentDetected) {
        // Add validation listeners
        ['name', 'designation', 'company', 'employees', 'phone', 'email', 'city'].forEach(id => {
            const field = document.getElementById(id);
            if (field) {
                field.addEventListener('blur', () => validateField(field));
                field.addEventListener('input', () => field.classList.remove('invalid'));
            }
        });
        
        // Star rating accessibility
        document.querySelectorAll('.star-rating label').forEach(label => {
            label.setAttribute('tabindex', '0');
            label.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    label.click();
                }
            });
        });
    }
});