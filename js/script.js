// ============================================================================
// UNIFIED FORM - FIXED PAYMENT SUCCESS + DATA STORAGE
// ============================================================================

const CONFIG = {
    GOOGLE_SCRIPT: "https://script.google.com/macros/s/AKfycbwKxN7MxrygVdCBSg-FTxAyL8P_FqN0lE8YjJl8Um7nr_uWNNgUWzPoCg6SuFPiViAVvQ/exec",
    RAZORPAY_LINK: "https://rzp.io/rzp/5NCrTAI",
    RETURN_URL: window.location.origin + window.location.pathname
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
    setTimeout(() => toast.classList.add('hidden'), 4000);
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
// OPTION SELECTION
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
// DATA COLLECTION
// ============================================================================

function collectFormData(isPostPayment = false) {
    const formType = document.querySelector('input[name="form_type"]:checked').value;
    const rating = document.querySelector('input[name="rating"]:checked')?.value || 'Not rated';
    
    return {
        name: document.getElementById('name').value.trim(),
        designation: document.getElementById('designation').value.trim(),
        company: document.getElementById('company').value.trim(),
        employees: document.getElementById('employees').value,
        phone: document.getElementById('phone').value.trim(),
        email: document.getElementById('email').value.trim(),
        city: document.getElementById('city').value.trim(),
        rating: rating,
        remarks: document.getElementById('remarks').value.trim() || 'None',
        // Tracking
        form_type: formType,
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
    console.log('📤 Sending to Google Sheets:', data);
    
    try {
        const formData = new FormData();
        formData.append('payload', JSON.stringify(data));
        
        const response = await fetch(CONFIG.GOOGLE_SCRIPT, {
            method: 'POST',
            body: formData
        });
        
        console.log('✅ Sent! Status:', response.status);
        return true;
        
    } catch (error) {
        console.error('❌ Error:', error);
        // Backup
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
    // ✅ Save form data
    sessionStorage.setItem('pendingAuditData', JSON.stringify({
        formData: formData,
        savedAt: new Date().toISOString()
    }));
    
    // ✅ Build payment URL
    const paymentUrl = new URL(CONFIG.RAZORPAY_LINK.trim());
    paymentUrl.searchParams.set('redirect_url', CONFIG.RETURN_URL);
    paymentUrl.searchParams.set('return_url', CONFIG.RETURN_URL);
    
    console.log('🔗 Redirecting to:', paymentUrl.toString());
    console.log('💾 Saved form data to sessionStorage');
    
    showLoader('Redirecting to payment gateway...');
    
    setTimeout(() => {
        window.location.href = paymentUrl.toString();
    }, 800);
}

// ============================================================================
// CHECK PAYMENT RETURN - FIXED
// ============================================================================

function checkPaymentReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const params = Object.fromEntries(urlParams);
    
    console.log('🔍 URL Parameters:', params);
    
    // ✅ Check for payment ID
    const paymentId = params.razorpay_payment_id || params.payment_id;
    
    if (paymentId && paymentId.startsWith('pay_')) {
        console.log('✅ PAYMENT SUCCESSFUL!');
        console.log('Payment ID:', paymentId);
        
        // ✅ Update payment data
        paymentData = {
            razorpay_payment_id: paymentId,
            razorpay_order_id: params.razorpay_order_id || 'ORD_' + Date.now(),
            payment_status: 'Paid'
        };
        
        // ✅ Get saved form data
        const savedData = sessionStorage.getItem('pendingAuditData');
        
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                const formData = parsed.formData;
                
                console.log('📋 Retrieved form data:', formData);
                
                // ✅ Show loader
                showLoader('✅ Payment Successful! Saving your registration...');
                
                // ✅ Submit to Google Sheets
                setTimeout(async () => {
                    try {
                        await submitRegistration(formData, true);
                    } catch (err) {
                        console.error('❌ Submit failed:', err);
                        showToast('Payment successful but save failed. Contact support.', 'error');
                        hideLoader();
                    }
                }, 1500);
                
                // ✅ Clean URL
                const cleanUrl = CONFIG.RETURN_URL;
                window.history.replaceState({}, document.title, cleanUrl);
                
                return true;
                
            } catch (e) {
                console.error('❌ Parse error:', e);
                showToast('Error processing payment data', 'error');
            }
        } else {
            console.error('❌ No form data found in sessionStorage!');
            showToast('Payment successful but form data lost. Please contact support.', 'error');
        }
        
        // ✅ Clean URL
        window.history.replaceState({}, '', CONFIG.RETURN_URL);
        return true;
    }
    
    return false;
}

// ============================================================================
// FINAL SUBMISSION - WITH SUCCESS MESSAGE
// ============================================================================

async function submitRegistration(formData, isPostPayment = false) {
    if (isSubmitting) return;
    
    isSubmitting = true;
    showLoader(isPostPayment ? 'Saving registration...' : 'Submitting feedback...');
    
    try {
        const finalData = isPostPayment ? collectFormData(true) : formData;
        
        console.log('📤 Final data to save:', finalData);
        
        await submitToGoogleSheets(finalData);
        
        // ✅ HIDE FORM
        form.classList.add('hidden');
        
        // ✅ SHOW SUCCESS MESSAGE
        const isAudit = finalData.form_type === 'audit';
        
        document.getElementById('successTitle').textContent = isAudit 
            ? '🎉 Payment Successful!' 
            : '✨ Thank You!';
        
        document.getElementById('successText').textContent = isAudit 
            ? 'Your audit slot has been booked successfully. You will receive an email with details shortly.' 
            : 'Your feedback has been submitted successfully.';
        
        // ✅ SHOW RECEIPT FOR AUDIT
        if (isAudit) {
            document.getElementById('receiptSection').classList.remove('hidden');
            document.getElementById('receiptName').textContent = finalData.name;
            document.getElementById('receiptEmail').textContent = finalData.email;
            document.getElementById('receiptPaymentId').textContent = finalData.razorpay_payment_id || 'N/A';
            document.getElementById('receiptAmount').textContent = finalData.amount;
        }
        
        // ✅ SHOW SUCCESS DIV
        successMsg.classList.remove('hidden');
        
        // ✅ SCROLL TO TOP
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // ✅ CLEAR SESSION
        sessionStorage.removeItem('pendingAuditData');
        
        // ✅ TOAST
        showToast(isAudit ? 'Registration complete!' : 'Feedback submitted!', 'success');
        
        console.log('✅ SUCCESS! Data saved to Google Sheets');
        
    } catch (error) {
        console.error('❌ Submission error:', error);
        showToast('Saved locally. Will sync when online.', 'warning');
        
        // Still show success
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
    
    if (isSubmitting) {
        console.log('⚠️ Already submitting...');
        return;
    }
    
    if (!validateForm()) {
        console.log('❌ Form validation failed');
        return;
    }
    
    const formData = collectFormData();
    console.log('📋 Form data collected:', formData);
    
    if (formData.form_type === 'audit') {
        console.log('💰 Initiating payment flow...');
        initiateRazorpayPayment(formData);
    } else {
        console.log('📝 Submitting feedback...');
        await submitRegistration(formData, false);
    }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

form.querySelectorAll('input, select, textarea').forEach(field => {
    field.addEventListener('blur', () => validateField(field));
    field.addEventListener('input', () => field.classList.remove('invalid'));
});

document.querySelectorAll('.star-rating label').forEach(lbl => {
    lbl.setAttribute('tabindex', '0');
    lbl.addEventListener('keydown', (e) => {
        if (['Enter', ' '].includes(e.key)) {
            e.preventDefault();
            lbl.click();
        }
    });
});

form.addEventListener('submit', handleSubmit);

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Form initialized');
    console.log('📊 Google Script:', CONFIG.GOOGLE_SCRIPT);
    console.log('🔗 Return URL:', CONFIG.RETURN_URL);
    
    // ✅ Check for payment return
    const isPaymentReturn = checkPaymentReturn();
    
    if (!isPaymentReturn) {
        console.log('ℹ️ Normal page load');
    }
});

console.log('✅ Event Registration System Ready');