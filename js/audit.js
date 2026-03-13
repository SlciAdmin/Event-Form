// ============================================================================
// AUDIT REGISTRATION - CLICK → SEND TO EXCEL → PAY → SUCCESS
// ============================================================================
const CONFIG = {
    // ✅ URLs Trimmed - NO SPACES
    PAYMENT_LINK: "https://rzp.io/rzp/5NCrTAI",
    GOOGLE_SCRIPT: "https://script.google.com/macros/s/AKfycbxSAJHIbkTYMxQCZYbYXxaZVX-MmkfOzQjaqs81mjQsy3Ua3TlHwx9QQpTlCC_JdcglNA/exec",
    RETURN_URL: window.location.origin + window.location.pathname
};

// DOM Elements
const form = document.getElementById('auditForm');
const completeBtn = document.getElementById('completeBtn');
const paymentStatus = document.getElementById('paymentStatus');
const successMsg = document.getElementById('auditSuccessMsg');
const toast = document.getElementById('toast');
const loader = document.getElementById('loader');
const loaderText = document.querySelector('#loader p');

// State
let isSubmitting = false;
let paymentData = {
    razorpay_payment_id: '',
    razorpay_order_id: '',
    payment_status: 'Pending'
};

// ============================================================================
// UTILITIES
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
        showToast('Please enter valid email', 'error');
        return false;
    }
    if (field.type === 'tel' && value && !/^[6-9][0-9]{9}$/.test(value)) {
        field.classList.add('invalid');
        showToast('Please enter valid 10-digit number', 'error');
        return false;
    }
    field.classList.remove('invalid');
    return true;
}

function validateForm() {
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
// COLLECT FORM DATA FOR EXCEL
// ============================================================================
function collectFormData(paymentStatusVal, paymentId = '') {
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
        payment_status: paymentStatusVal,           // "Pending" or "Paid"
        amount: '₹1',                                // Amount sent to Excel
        razorpay_payment_id: paymentId || 'PENDING',
        razorpay_order_id: paymentData.razorpay_order_id || 'N/A',
        timestamp: new Date().toISOString(),        // Exact click time
        user_agent: navigator.userAgent
    };
}

// ============================================================================
// SEND TO GOOGLE SHEETS (EXCEL)
// ============================================================================
async function submitToGoogleSheets(data) {
    console.log('📤 Sending to Google Sheets:', data);
    try {
        await fetch(CONFIG.GOOGLE_SCRIPT.trim(), {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        console.log('✅ Data sent to Google Sheets');
        return true;
    } catch (error) {
        console.error('❌ Error:', error);
        // Backup to localStorage if offline
        const backups = JSON.parse(localStorage.getItem('auditBackups') || '[]');
        backups.push({ ...data, backup_time: new Date().toISOString() });
        localStorage.setItem('auditBackups', JSON.stringify(backups));
        throw error;
    }
}

// ============================================================================
// ✅ MAIN BUTTON CLICK HANDLER - SEND DATA → THEN PAY
// ============================================================================
completeBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    console.log('🔘 Complete Registration Clicked');

    if (isSubmitting) return;

    // Validate Form First
    if (!validateForm()) {
        showToast('Please fill all required fields', 'error');
        return;
    }

    isSubmitting = true;
    completeBtn.disabled = true;
    showLoader('Sending data to records...');

    try {
        // ✅ STEP 1: Collect & Send Data to Excel IMMEDIATELY on Click
        const formData = collectFormData('Pending'); // Mark as Pending initially
        await submitToGoogleSheets(formData);
        console.log('✅ Data sent to Excel with status: Pending');

        // ✅ STEP 2: Update UI & Redirect to Razorpay for Payment
        paymentStatus.innerHTML = '✅ Data Saved! Redirecting to Payment...';
        paymentStatus.className = 'payment-status success';
        showLoader('Redirecting to Payment...');

        // Prepare Payment URL with Return URL
        const paymentUrl = new URL(CONFIG.PAYMENT_LINK.trim());
        paymentUrl.searchParams.set('redirect_url', CONFIG.RETURN_URL);
        paymentUrl.searchParams.set('return_url', CONFIG.RETURN_URL);

        // Redirect to Razorpay after small delay
        setTimeout(() => {
            window.location.href = paymentUrl.toString();
        }, 1000);

    } catch (error) {
        showToast('Data saved locally. Proceeding to payment...', 'warning');
        // Still redirect to payment even if Excel fails
        const paymentUrl = new URL(CONFIG.PAYMENT_LINK.trim());
        paymentUrl.searchParams.set('redirect_url', CONFIG.RETURN_URL);
        paymentUrl.searchParams.set('return_url', CONFIG.RETURN_URL);
        setTimeout(() => {
            window.location.href = paymentUrl.toString();
        }, 1000);
    } finally {
        // Loader will hide on redirect
    }
});

// ============================================================================
// CHECK PAYMENT RETURN (After Razorpay)
// ============================================================================
function checkPaymentReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const params = Object.fromEntries(urlParams.entries());
    
    const paymentId = params.razorpay_payment_id || params.payment_id;
    const orderId = params.razorpay_order_id || params.order_id;
    const status = params.razorpay_payment_status || params.status;

    // ✅ If Payment ID exists, Payment was successful
    if (paymentId && paymentId.startsWith('pay_')) {
        console.log('✅ Payment Detected:', paymentId);
        
        paymentData = {
            razorpay_payment_id: paymentId,
            razorpay_order_id: orderId || 'ORDER_' + Date.now(),
            payment_status: (status === 'captured' || status === 'success') ? 'Paid' : 'Pending'
        };

        // ✅ Show Success Screen
        document.getElementById('receiptName').textContent = document.getElementById('name').value;
        document.getElementById('receiptEmail').textContent = document.getElementById('email').value;
        document.getElementById('receiptPaymentId').textContent = paymentId;
        
        form.classList.add('hidden');
        successMsg.classList.remove('hidden');
        paymentStatus.innerHTML = '✅ Payment Successful!<br><small>ID: ' + paymentId + '</small>';
        
        showToast('Registration Complete!', 'success');
        
        // Clean URL
        const cleanUrl = CONFIG.RETURN_URL;
        window.history.replaceState({}, document.title, cleanUrl);
        return true;
    }
    return false;
}

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Audit form loaded');
    
    // Check if returning from payment
    const paymentDetected = checkPaymentReturn();
    
    // If not returning, enable form validation
    if (!paymentDetected) {
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