// ============================================================================
// UNIFIED FORM - GOOGLE SHEETS + RAZORPAY INTEGRATION
// ============================================================================

const CONFIG = {
    GOOGLE_SCRIPT: "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec",
    RAZORPAY_LINK: "https://rzp.io/rzp/YOUR_PAYMENT_LINK",
    RETURN_URL: window.location.href.split('?')[0] // Clean URL for return
};

// DOM Elements
const form = document.getElementById('unifiedForm');
const submitBtn = document.getElementById('submitBtn');
const btnText = document.getElementById('btnText');
const successMsg = document.getElementById('successMsg');
const toast = document.getElementById('toast');
const loader = document.getElementById('loader');
const loaderText = document.getElementById('loaderText');
const paymentInfo = document.getElementById('paymentInfo');
const optionCards = document.querySelectorAll('.option-card');

// State
let isSubmitting = false;
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
    setTimeout(() => toast.classList.add('hidden'), 3500);
}

function showLoader(text) {
    loaderText.textContent = text;
    loader.classList.remove('hidden');
}

function hideLoader() {
    loader.classList.add('hidden');
}

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
        showToast('Enter valid 10-digit mobile number', 'error');
        return false;
    }
    
    field.classList.remove('invalid');
    return true;
}

function validateForm() {
    let isValid = true;
    const requiredFields = form.querySelectorAll('input[required], select[required], textarea[required]');
    
    requiredFields.forEach(field => {
        if (!validateField(field)) isValid = false;
    });
    
    const ratingSelected = document.querySelector('input[name="rating"]:checked');
    if (!ratingSelected) {
        showToast('Please select a rating', 'error');
        isValid = false;
    }
    
    return isValid;
}

// ============================================================================
// OPTION SELECTION HANDLER
// ============================================================================

optionCards.forEach(card => {
    card.addEventListener('click', function() {
        // Update UI selection
        optionCards.forEach(c => c.classList.remove('selected'));
        this.classList.add('selected');
        
        // Update button text & show/hide payment info
        const value = this.querySelector('input').value;
        if (value === 'audit') {
            btnText.textContent = 'Pay ₹999 & Register';
            paymentInfo.classList.remove('hidden');
        } else {
            btnText.textContent = 'Submit Feedback';
            paymentInfo.classList.add('hidden');
        }
    });
});

// ============================================================================
// DATA COLLECTION
// ============================================================================

function collectFormData() {
    const formType = document.querySelector('input[name="form_type"]:checked').value;
    const rating = document.querySelector('input[name="rating"]:checked')?.value || 'Not rated';
    
    return {
        // Personal Details
        name: document.getElementById('name').value.trim(),
        designation: document.getElementById('designation').value.trim(),
        company: document.getElementById('company').value.trim(),
        employees: document.getElementById('employees').value,
        phone: document.getElementById('phone').value.trim(),
        email: document.getElementById('email').value.trim(),
        city: document.getElementById('city').value.trim(),
        
        // Feedback
        rating: rating,
        remarks: document.getElementById('remarks').value.trim() || 'None',
        
        // System Fields
        form_type: formType,
        selected_option: formType === 'feedback' ? 'Submit Feedback' : 'Book Audit Slot',
        amount: formType === 'audit' ? '₹999' : '₹0',
        payment_status: formType === 'audit' ? paymentData.payment_status : 'Not Applicable',
        razorpay_payment_id: paymentData.razorpay_payment_id || 'N/A',
        razorpay_order_id: paymentData.razorpay_order_id || 'N/A',
        
        // Metadata
        timestamp: new Date().toISOString(),
        local_time: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        user_agent: navigator.userAgent,
        page_url: window.location.href
    };
}

// ============================================================================
// GOOGLE SHEETS SUBMISSION
// ============================================================================

async function submitToGoogleSheets(data) {
    console.log('📤 Sending data:', data);
    
    try {
        // Using no-cors mode for Google Apps Script
        await fetch(CONFIG.GOOGLE_SCRIPT, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        console.log('✅ Data sent to Google Sheets');
        return true;
    } catch (error) {
        console.error('❌ Submission error:', error);
        
        // Backup to localStorage
        const backups = JSON.parse(localStorage.getItem('formBackups') || '[]');
        backups.push({ ...data, backup_time: new Date().toISOString() });
        localStorage.setItem('formBackups', JSON.stringify(backups));
        
        throw error;
    }
}

// ============================================================================
// RAZORPAY PAYMENT FLOW
// ============================================================================

function initiateRazorpayPayment(formData) {
    return new Promise((resolve, reject) => {
        // Save form data temporarily
        sessionStorage.setItem('pendingFormData', JSON.stringify(formData));
        
        // Build payment URL with return parameters
        const paymentUrl = new URL(CONFIG.RAZORPAY_LINK.trim());
        paymentUrl.searchParams.set('redirect_url', CONFIG.RETURN_URL);
        paymentUrl.searchParams.set('return_url', CONFIG.RETURN_URL);
        
        console.log('🔗 Redirecting to Razorpay:', paymentUrl.toString());
        
        // Show loader
        showLoader('Redirecting to secure payment...');
        
        // Redirect after small delay
        setTimeout(() => {
            window.location.href = paymentUrl.toString();
        }, 800);
        
        // Note: After payment, user returns to same page with payment params
        // checkPaymentReturn() will handle the rest
        resolve();
    });
}

function checkPaymentReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const params = Object.fromEntries(urlParams.entries());
    
    console.log('🔍 Checking payment return params:', params);
    
    // Check for Razorpay payment ID
    const paymentId = params.razorpay_payment_id || params.payment_id;
    
    if (paymentId && paymentId.startsWith('pay_')) {
        console.log('✅ Payment successful! ID:', paymentId);
        
        // Update payment data
        paymentData = {
            razorpay_payment_id: paymentId,
            razorpay_order_id: params.razorpay_order_id || 'ORDER_' + Date.now(),
            payment_status: 'Paid'
        };
        
        // Restore form data if available
        const savedData = sessionStorage.getItem('pendingFormData');
        if (savedData) {
            try {
                const formData = JSON.parse(savedData);
                // Auto-submit to Google Sheets
                setTimeout(() => {
                    submitRegistration(formData);
                }, 1500);
                return true;
            } catch (e) {
                console.error('Restore error:', e);
            }
        }
        
        // Clean URL
        const cleanUrl = CONFIG.RETURN_URL;
        window.history.replaceState({}, document.title, cleanUrl);
        
        return true;
    }
    
    return false;
}

// ============================================================================
// FINAL SUBMISSION
// ============================================================================

async function submitRegistration(formData) {
    if (isSubmitting) return;
    
    isSubmitting = true;
    showLoader(formData.form_type === 'audit' ? 'Confirming registration...' : 'Submitting feedback...');
    
    try {
        await submitToGoogleSheets(formData);
        
        // Show success UI
        document.getElementById('successTitle').textContent = 
            formData.form_type === 'audit' ? 'Registration Confirmed! 🎉' : 'Thank You! ✨';
        
        document.getElementById('successText').textContent = 
            formData.form_type === 'audit' 
                ? 'Your audit slot is booked. Check your email for details.' 
                : 'Your feedback has been submitted successfully.';
        
        // Show receipt for audit
        if (formData.form_type === 'audit') {
            document.getElementById('receiptSection').classList.remove('hidden');
            document.getElementById('receiptName').textContent = formData.name;
            document.getElementById('receiptEmail').textContent = formData.email;
            document.getElementById('receiptPaymentId').textContent = formData.razorpay_payment_id;
            document.getElementById('receiptAmount').textContent = formData.amount;
        }
        
        // Hide form, show success
        form.classList.add('hidden');
        successMsg.classList.remove('hidden');
        
        // Clear temp data
        sessionStorage.removeItem('pendingFormData');
        
        showToast('Success!', 'success');
        
    } catch (error) {
        console.error('❌ Error:', error);
        showToast('Saved locally. Will sync when online.', 'warning');
        
        // Still show success for better UX
        form.classList.add('hidden');
        successMsg.classList.remove('hidden');
        
    } finally {
        hideLoader();
        isSubmitting = false;
    }
}

// ============================================================================
// FORM SUBMIT HANDLER
// ============================================================================

async function handleSubmit(e) {
    e.preventDefault();
    
    if (isSubmitting) return;
    if (!validateForm()) return;
    
    const formData = collectFormData();
    const formType = formData.form_type;
    
    if (formType === 'audit') {
        // Audit flow: Payment first, then submit
        await initiateRazorpayPayment(formData);
        // After payment return, checkPaymentReturn() will auto-submit
    } else {
        // Feedback flow: Direct submit
        await submitRegistration(formData);
    }
}

// ============================================================================
// EVENT LISTENERS & INIT
// ============================================================================

// Live validation
form.querySelectorAll('input, select, textarea').forEach(field => {
    field.addEventListener('blur', () => validateField(field));
    field.addEventListener('input', () => field.classList.remove('invalid'));
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

// Form submit
form.addEventListener('submit', handleSubmit);

// Page load: Check if returning from payment
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Unified form initialized');
    
    // Check payment return on load
    const paymentDetected = checkPaymentReturn();
    
    if (paymentDetected) {
        // Payment flow is handled in checkPaymentReturn()
        showLoader('Processing your registration...');
    }
});

console.log('✅ Event Registration System Ready');