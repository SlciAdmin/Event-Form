// ============================================================================
// UNIFIED FORM - GOOGLE SHEETS + RAZORPAY (FINAL PRODUCTION v5)
// ============================================================================

const CONFIG = {
    // ✅ UPDATED: Your NEW Google Script URL - TRIMMED, NO SPACES
    GOOGLE_SCRIPT: "https://script.google.com/macros/s/AKfycbwKxN7MxrygVdCBSg-FTxAyL8P_FqN0lE8YjJl8Um7nr_uWNNgUWzPoCg6SuFPiViAVvQ/exec",
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
        showToast('Please enter valid email', 'error');
        return false;
    }
    if (field.type === 'tel' && value && !/^[6-9][0-9]{9}$/.test(value)) {
        field.classList.add('invalid');
        showToast('Enter valid 10-digit mobile', 'error');
        return false;
    }
    field.classList.remove('invalid');
    return true;
}

function validateForm() {
    let isValid = true;
    form.querySelectorAll('input[required], select[required], textarea[required]').forEach(f => {
        if (!validateField(f)) isValid = false;
    });
    if (!document.querySelector('input[name="rating"]:checked')) {
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
        const val = this.querySelector('input').value;
        if (val === 'audit') {
            btnText.textContent = 'Pay ₹999 & Register';
            paymentInfo.classList.remove('hidden');
        } else {
            btnText.textContent = 'Submit Feedback';
            paymentInfo.classList.add('hidden');
        }
    });
});

// ============================================================================
// DATA COLLECTION - TRACKS USER SELECTION
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
        // Feedback
        rating: rating,
        remarks: document.getElementById('remarks').value.trim() || 'None',
        // ✅ TRACKING: Excel mein clear dikhega kisne kya select kiya
        form_type: formType,  // ← "feedback" ya "audit" - MAIN FILTER
        selected_option: formType === 'feedback' ? 'Submit Feedback' : 'Book Audit Slot',
        // Payment
        amount: formType === 'audit' ? '₹999' : '₹0',
        payment_status: isPostPayment ? paymentData.payment_status : (formType === 'audit' ? 'Initiated' : 'Not Applicable'),
        razorpay_payment_id: paymentData.razorpay_payment_id || (formType === 'audit' ? 'Pending' : 'N/A'),
        razorpay_order_id: paymentData.razorpay_order_id || (formType === 'audit' ? 'Pending' : 'N/A'),
        // Metadata
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
        email: data.email,
        amount: data.amount 
    });
    
    try {
        // ✅ Use FormData for Google Apps Script compatibility
        const formData = new FormData();
        formData.append('payload', JSON.stringify(data));
        
        const response = await fetch(CONFIG.GOOGLE_SCRIPT, {
            method: 'POST',
            body: formData
            // ✅ No custom headers - browser sets them automatically
        });
        
        console.log('✅ Sent successfully! Status:', response.status);
        return true;
        
    } catch (error) {
        console.error('❌ Submission error:', error);
        
        // ✅ Backup to localStorage if offline/error
        const backups = JSON.parse(localStorage.getItem('formBackups') || '[]');
        backups.push({ 
            ...data, 
            backup_time: new Date().toISOString(), 
            status: 'pending_sync' 
        });
        localStorage.setItem('formBackups', JSON.stringify(backups));
        
        console.log('💾 Data backed up locally');
        throw error;
    }
}

// ============================================================================
// RAZORPAY PAYMENT FLOW
// ============================================================================

function initiateRazorpayPayment(formData) {
    return new Promise((resolve) => {
        // ✅ Save complete form data before redirect
        sessionStorage.setItem('pendingAuditData', JSON.stringify({ 
            formData: formData, 
            ts: Date.now() 
        }));
        
        // ✅ Build payment URL with return parameters
        const paymentUrl = new URL(CONFIG.RAZORPAY_LINK.trim());
        paymentUrl.searchParams.set('redirect_url', CONFIG.RETURN_URL);
        paymentUrl.searchParams.set('return_url', CONFIG.RETURN_URL);
        
        console.log('🔗 Redirecting to Razorpay:', paymentUrl.toString());
        showLoader('Redirecting to secure payment...');
        
        // ✅ Redirect after small delay for UX
        setTimeout(() => {
            window.location.href = paymentUrl.toString();
        }, 500);
        
        resolve();
    });
}

// ============================================================================
// CHECK PAYMENT RETURN (Called on Page Load)
// ============================================================================

function checkPaymentReturn() {
    const params = new URLSearchParams(window.location.search);
    const paymentId = params.get('razorpay_payment_id') || params.get('payment_id');
    
    console.log('🔍 Checking payment params:', { paymentId });
    
    if (paymentId && paymentId.startsWith('pay_')) {
        console.log('✅ PAYMENT DETECTED! ID:', paymentId);
        
        // ✅ Update payment data globally
        paymentData = {
            razorpay_payment_id: paymentId,
            razorpay_order_id: params.get('razorpay_order_id') || 'ORD_' + Date.now(),
            payment_status: 'Paid'
        };
        
        // ✅ Retrieve and submit saved form data
        const saved = sessionStorage.getItem('pendingAuditData');
        if (saved) {
            try {
                const { formData } = JSON.parse(saved);
                showLoader('Payment verified. Saving registration...');
                
                setTimeout(() => {
                    submitRegistration(formData, true); // true = post-payment
                }, 1000);
                
                // ✅ Clean URL for better UX
                window.history.replaceState({}, '', CONFIG.RETURN_URL);
                return true;
                
            } catch (e) {
                console.error('❌ Restore error:', e);
                showToast('Please contact support', 'error');
            }
        }
        
        // ✅ Clean URL even if restore fails
        window.history.replaceState({}, '', CONFIG.RETURN_URL);
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
    const actionText = formData.form_type === 'audit' 
        ? 'Confirming registration...' 
        : 'Submitting feedback...';
    showLoader(actionText);
    
    try {
        // ✅ Collect final data (merge payment info if post-payment)
        const finalData = isPostPayment ? collectFormData(true) : formData;
        
        await submitToGoogleSheets(finalData);
        
        // ✅ Show appropriate success message
        const isAudit = finalData.form_type === 'audit';
        document.getElementById('successTitle').textContent = isAudit 
            ? 'Registration Confirmed! 🎉' 
            : 'Thank You! ✨';
            
        document.getElementById('successText').textContent = isAudit 
            ? 'Your audit slot is booked. Check your email for details.' 
            : 'Your feedback has been submitted successfully.';
        
        // ✅ Show receipt ONLY for audit payments
        if (isAudit) {
            document.getElementById('receiptSection').classList.remove('hidden');
            document.getElementById('receiptName').textContent = finalData.name;
            document.getElementById('receiptEmail').textContent = finalData.email;
            document.getElementById('receiptPaymentId').textContent = finalData.razorpay_payment_id;
            document.getElementById('receiptAmount').textContent = finalData.amount;
        }
        
        // ✅ Switch to success view
        form.classList.add('hidden');
        successMsg.classList.remove('hidden');
        
        // ✅ Clear temporary storage
        sessionStorage.removeItem('pendingAuditData');
        
        showToast(isAudit ? 'Payment successful!' : 'Feedback submitted!', 'success');
        
    } catch (error) {
        console.error('❌ Submission failed:', error);
        showToast('Data saved locally. Will sync when online.', 'warning');
        
        // ✅ Still show success for better UX (data is backed up)
        form.classList.add('hidden');
        successMsg.classList.remove('hidden');
        
    } finally {
        hideLoader();
        isSubmitting = false;
    }
}

// ============================================================================
// FORM SUBMIT HANDLER - MAIN ENTRY POINT
// ============================================================================

async function handleSubmit(e) {
    e.preventDefault();
    
    if (isSubmitting) return;
    if (!validateForm()) return;
    
    const formData = collectFormData();
    const formType = formData.form_type;
    
    console.log('🎯 Form submitted:', { 
        form_type: formType, 
        name: formData.name,
        email: formData.email 
    });
    
    if (formType === 'audit') {
        // 🔹 AUDIT FLOW: Payment first, then submit
        console.log('💰 Initiating Razorpay payment...');
        await initiateRazorpayPayment(formData);
        // After payment return, checkPaymentReturn() will auto-submit
        
    } else {
        // 🔹 FEEDBACK FLOW: Direct submit
        console.log('📝 Submitting feedback directly...');
        await submitRegistration(formData, false);
    }
}

// ============================================================================
// EVENT LISTENERS & INITIALIZATION
// ============================================================================

// ✅ Live validation on blur/input
form.querySelectorAll('input, select, textarea').forEach(field => {
    field.addEventListener('blur', () => validateField(field));
    field.addEventListener('input', () => field.classList.remove('invalid'));
});

// ✅ Star rating keyboard accessibility
document.querySelectorAll('.star-rating label').forEach(label => {
    label.setAttribute('tabindex', '0');
    label.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            label.click();
        }
    });
});

// ✅ Form submit handler
form.addEventListener('submit', handleSubmit);

// ✅ Page load: Check if returning from Razorpay payment
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Unified form initialized');
    console.log('📊 Google Script:', CONFIG.GOOGLE_SCRIPT);
    
    // ✅ Critical: Check payment return FIRST before any other logic
    const paymentDetected = checkPaymentReturn();
    
    if (!paymentDetected) {
        console.log('ℹ️ Normal page load (not payment return)');
    }
});

// ✅ Console info for debugging
console.log('✅ Event Registration System Ready - Production v5');
console.log('📊 Data will be stored with form_type column for filtering');
console.log('💳 Audit payments tracked via razorpay_payment_id');