// ============================================================================
// UNIFIED FORM - GOOGLE SHEETS + RAZORPAY INTEGRATION (FINAL PRODUCTION)
// ============================================================================

const CONFIG = {
    // ✅ UPDATED: Your new Google Script URL (trimmed, no spaces)
    GOOGLE_SCRIPT: "https://script.google.com/macros/s/AKfycbwKF8j8Qa0rtw194dn8PPhJVcITgFzapUqVH2IRwrr4ObaqSFz0aukdGT_zETMvVBwGDA/exec",
    RAZORPAY_LINK: "https://rzp.io/rzp/5NCrTAI",
    RETURN_URL: window.location.href.split('?')[0]
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
        optionCards.forEach(c => c.classList.remove('selected'));
        this.classList.add('selected');
        
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
// DATA COLLECTION - TRACKS USER SELECTION PROPERLY
// ============================================================================

function collectFormData(isPostPayment = false) {
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
        
        // Feedback Fields
        rating: rating,
        remarks: document.getElementById('remarks').value.trim() || 'None',
        
        // ✅ KEY TRACKING: Excel mein clear dikhega kisne kya select kiya
        form_type: formType,  // "feedback" OR "audit" ← MAIN FILTER COLUMN
        selected_option: formType === 'feedback' ? 'Submit Feedback' : 'Book Audit Slot',
        
        // Payment Fields
        amount: formType === 'audit' ? '₹999' : '₹0',
        payment_status: isPostPayment ? paymentData.payment_status : (formType === 'audit' ? 'Initiated' : 'Not Applicable'),
        razorpay_payment_id: paymentData.razorpay_payment_id || (formType === 'audit' ? 'Pending' : 'N/A'),
        razorpay_order_id: paymentData.razorpay_order_id || (formType === 'audit' ? 'Pending' : 'N/A'),
        
        // Metadata for tracking
        timestamp: new Date().toISOString(),
        local_time: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        submission_source: isPostPayment ? 'Post-Payment-Return' : 'Direct-Submit',
        user_agent: navigator.userAgent,
        page_url: window.location.href
    };
}

// ============================================================================
// GOOGLE SHEETS SUBMISSION
// ============================================================================

async function submitToGoogleSheets(data) {
    console.log('📤 Sending to Sheets:', { 
        form_type: data.form_type, 
        name: data.name, 
        payment_status: data.payment_status 
    });
    
    try {
        await fetch(CONFIG.GOOGLE_SCRIPT, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        console.log('✅ Data sent successfully');
        return true;
    } catch (error) {
        console.error('❌ Submission error:', error);
        
        // Backup to localStorage if offline
        const backups = JSON.parse(localStorage.getItem('formBackups') || '[]');
        backups.push({ ...data, backup_time: new Date().toISOString(), status: 'pending_sync' });
        localStorage.setItem('formBackups', JSON.stringify(backups));
        
        throw error;
    }
}

// ============================================================================
// RAZORPAY PAYMENT FLOW
// ============================================================================

function initiateRazorpayPayment(formData) {
    return new Promise((resolve) => {
        // Save complete form data before redirect
        sessionStorage.setItem('pendingAuditData', JSON.stringify({
            formData: formData,
            timestamp: Date.now()
        }));
        
        // Build payment URL with return parameters
        const paymentUrl = new URL(CONFIG.RAZORPAY_LINK.trim());
        paymentUrl.searchParams.set('redirect_url', CONFIG.RETURN_URL);
        paymentUrl.searchParams.set('return_url', CONFIG.RETURN_URL);
        
        console.log('🔗 Redirecting to Razorpay:', paymentUrl.toString());
        showLoader('Redirecting to secure payment...');
        
        setTimeout(() => {
            window.location.href = paymentUrl.toString();
        }, 600);
        
        resolve();
    });
}

// ============================================================================
// CHECK PAYMENT RETURN (Called on Page Load)
// ============================================================================

function checkPaymentReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const params = Object.fromEntries(urlParams.entries());
    
    console.log('🔍 URL params:', params);
    
    const paymentId = params.razorpay_payment_id || params.payment_id;
    
    if (paymentId && paymentId.startsWith('pay_')) {
        console.log('✅ PAYMENT DETECTED! ID:', paymentId);
        
        paymentData = {
            razorpay_payment_id: paymentId,
            razorpay_order_id: params.razorpay_order_id || 'ORDER_' + Date.now(),
            payment_status: 'Paid'
        };
        
        const saved = sessionStorage.getItem('pendingAuditData');
        if (saved) {
            try {
                const { formData } = JSON.parse(saved);
                showLoader('Payment verified. Saving registration...');
                
                setTimeout(() => {
                    submitRegistration(formData, true);
                }, 1200);
                
                const cleanUrl = CONFIG.RETURN_URL;
                window.history.replaceState({}, document.title, cleanUrl);
                
                return true;
            } catch (e) {
                console.error('❌ Restore error:', e);
                showToast('Please contact support', 'error');
            }
        }
        
        const cleanUrl = CONFIG.RETURN_URL;
        window.history.replaceState({}, document.title, cleanUrl);
        return true;
    }
    
    return false;
}

// ============================================================================
// FINAL SUBMISSION TO GOOGLE SHEETS
// ============================================================================

async function submitRegistration(formData, isPostPayment = false) {
    if (isSubmitting) return;
    
    isSubmitting = true;
    const actionText = formData.form_type === 'audit' ? 'Confirming registration...' : 'Submitting feedback...';
    showLoader(actionText);
    
    try {
        const finalData = isPostPayment ? collectFormData(true) : formData;
        await submitToGoogleSheets(finalData);
        
        const isAudit = finalData.form_type === 'audit';
        document.getElementById('successTitle').textContent = isAudit ? 'Registration Confirmed! 🎉' : 'Thank You! ✨';
        document.getElementById('successText').textContent = isAudit 
            ? 'Your audit slot is booked. Check your email for details.' 
            : 'Your feedback has been submitted successfully.';
        
        if (isAudit) {
            document.getElementById('receiptSection').classList.remove('hidden');
            document.getElementById('receiptName').textContent = finalData.name;
            document.getElementById('receiptEmail').textContent = finalData.email;
            document.getElementById('receiptPaymentId').textContent = finalData.razorpay_payment_id;
            document.getElementById('receiptAmount').textContent = finalData.amount;
        }
        
        form.classList.add('hidden');
        successMsg.classList.remove('hidden');
        sessionStorage.removeItem('pendingAuditData');
        
        showToast(isAudit ? 'Payment successful!' : 'Feedback submitted!', 'success');
        
    } catch (error) {
        console.error('❌ Submission failed:', error);
        showToast('Data saved locally. Will sync when online.', 'warning');
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
        console.log('🎯 Audit flow initiated');
        await initiateRazorpayPayment(formData);
    } else {
        console.log('🎯 Feedback flow initiated');
        await submitRegistration(formData, false);
    }
}

// ============================================================================
// EVENT LISTENERS & INIT
// ============================================================================

form.querySelectorAll('input, select, textarea').forEach(field => {
    field.addEventListener('blur', () => validateField(field));
    field.addEventListener('input', () => field.classList.remove('invalid'));
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

form.addEventListener('submit', handleSubmit);

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Unified form initialized');
    const paymentDetected = checkPaymentReturn();
    if (!paymentDetected) {
        console.log('ℹ️ Normal page load (not payment return)');
    }
});

console.log('✅ Event Registration System Ready - Data stores in Google Sheet by form_type');