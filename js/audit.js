// ============================================================================
// AUDIT REGISTRATION - SINGLE BUTTON & AUTO SUBMIT
// ============================================================================
const CONFIG = {
    // ✅ URLs Trimmed (No Spaces)
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
    payment_status: ''
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
// 1. CHECK PAYMENT RETURN (Auto-Detect on Page Load)
// ============================================================================
function checkPaymentReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const params = Object.fromEntries(urlParams.entries());
    
    const paymentId = params.razorpay_payment_id || params.payment_id;
    const orderId = params.razorpay_order_id || params.order_id;
    const status = params.razorpay_payment_status || params.status;

    // ✅ If Payment ID exists, Payment was done
    if (paymentId && paymentId.startsWith('pay_')) {
        console.log('✅ Payment Detected:', paymentId);
        
        paymentData = {
            razorpay_payment_id: paymentId,
            razorpay_order_id: orderId || 'ORDER_' + Date.now(),
            payment_status: (status === 'captured' || status === 'success') ? 'Paid' : 'Pending'
        };

        // Update UI
        paymentStatus.innerHTML = '✅ Payment Successful!<br><small>ID: ' + paymentId + '</small>';
        paymentStatus.className = 'payment-status success';
        completeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Finalizing...';
        completeBtn.disabled = true;

        // ✅ AUTO-SUBMIT TO EXCEL (No extra click needed)
        setTimeout(() => {
            handleAutoSubmit();
        }, 1500);

        // Clean URL
        const cleanUrl = CONFIG.RETURN_URL;
        window.history.replaceState({}, document.title, cleanUrl);
        return true;
    }
    return false;
}

// ============================================================================
// 2. SAVE FORM DATA (Before Redirect)
// ============================================================================
function saveFormData() {
    const formData = {
        name: document.getElementById('name').value,
        designation: document.getElementById('designation').value,
        company: document.getElementById('company').value,
        employees: document.getElementById('employees').value,
        phone: document.getElementById('phone').value,
        email: document.getElementById('email').value,
        city: document.getElementById('city').value,
        remarks: document.getElementById('remarks').value,
        rating: document.querySelector('input[name="audit_rating"]:checked')?.value || '5'
    };
    sessionStorage.setItem('auditFormData', JSON.stringify(formData));
}

// ============================================================================
// 3. RESTORE FORM DATA (After Return)
// ============================================================================
function restoreFormData() {
    const savedData = sessionStorage.getItem('auditFormData');
    if (savedData) {
        try {
            const data = JSON.parse(savedData);
            Object.keys(data).forEach(key => {
                if(key === 'rating') {
                    const radio = document.querySelector(`input[name="audit_rating"][value="${data[key]}"]`);
                    if(radio) radio.checked = true;
                } else {
                    const field = document.getElementById(key);
                    if (field && data[key]) field.value = data[key];
                }
            });
        } catch (e) { console.error('Restore error:', e); }
    }
}

// ============================================================================
// 4. COLLECT DATA FOR EXCEL
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
        payment_status: paymentData.payment_status || 'Paid',
        amount: '₹1',
        razorpay_payment_id: paymentData.razorpay_payment_id || 'PENDING',
        razorpay_order_id: paymentData.razorpay_order_id || 'N/A',
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent
    };
}

// ============================================================================
// 5. SEND TO GOOGLE SHEETS (EXCEL)
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
        console.log('✅ Data sent successfully!');
        return true;
    } catch (error) {
        console.error('❌ Error:', error);
        // Backup to local storage if offline
        const backups = JSON.parse(localStorage.getItem('auditBackups') || '[]');
        backups.push({ ...data, backup_time: new Date().toISOString() });
        localStorage.setItem('auditBackups', JSON.stringify(backups));
        throw error;
    }
}

// ============================================================================
// 6. HANDLE AUTO SUBMISSION
// ============================================================================
async function handleAutoSubmit() {
    if (isSubmitting) return;
    isSubmitting = true;
    showLoader('Sending data to records...');

    try {
        const formData = collectFormData();
        await submitToGoogleSheets(formData);
        
        // Show Success Screen
        document.getElementById('receiptName').textContent = formData.name;
        document.getElementById('receiptEmail').textContent = formData.email;
        document.getElementById('receiptPaymentId').textContent = formData.razorpay_payment_id;
        
        form.classList.add('hidden');
        successMsg.classList.remove('hidden');
        showToast('Registration Complete!', 'success');
        
        sessionStorage.removeItem('auditFormData');
    } catch (error) {
        showToast('Payment Done! Data saved locally.', 'warning');
        // Still show success screen
        document.getElementById('receiptName').textContent = document.getElementById('name').value;
        document.getElementById('receiptEmail').textContent = document.getElementById('email').value;
        document.getElementById('receiptPaymentId').textContent = paymentData.razorpay_payment_id;
        form.classList.add('hidden');
        successMsg.classList.remove('hidden');
    } finally {
        hideLoader();
        isSubmitting = false;
    }
}

// ============================================================================
// 7. SINGLE BUTTON CLICK HANDLER
// ============================================================================
completeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('💳 Pay & Complete Clicked');

    // Validate Form
    const requiredFields = ['name', 'designation', 'company', 'employees', 'phone', 'email', 'city'];
    let isValid = true;
    
    requiredFields.forEach(id => {
        const field = document.getElementById(id);
        if (!field.value.trim()) {
            field.classList.add('invalid');
            isValid = false;
        }
    });

    const ratingSelected = document.querySelector('input[name="audit_rating"]:checked');
    if (!ratingSelected) {
        showToast('Please select a rating', 'error');
        isValid = false;
    }

    if (!isValid) {
        showToast('Please fill all required fields', 'error');
        return;
    }

    // Save Data -> Redirect to Payment
    saveFormData();
    showLoader('Redirecting to Payment...');
    
    // Add Return URL to Payment Link
    const paymentUrl = new URL(CONFIG.PAYMENT_LINK.trim());
    paymentUrl.searchParams.set('redirect_url', CONFIG.RETURN_URL);
    paymentUrl.searchParams.set('return_url', CONFIG.RETURN_URL);
    
    // Redirect
    setTimeout(() => {
        window.location.href = paymentUrl.toString();
    }, 1000);
});

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Audit form loaded');
    
    // Check if returning from payment
    const paymentDetected = checkPaymentReturn();
    
    // If not returning, restore form data
    if (!paymentDetected) {
        restoreFormData();
    }

    // Live Validation Styling
    ['name', 'designation', 'company', 'employees', 'phone', 'email', 'city'].forEach(id => {
        const field = document.getElementById(id);
        if (field) {
            field.addEventListener('blur', () => {
                if (!field.value.trim()) field.classList.add('invalid');
                else field.classList.remove('invalid');
            });
            field.addEventListener('input', () => field.classList.remove('invalid'));
        }
    });
});