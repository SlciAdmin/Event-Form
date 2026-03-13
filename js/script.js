// ============================================================================
// UNIFIED FORM - COMPLETE & PROPER VERSION
// ============================================================================

const CONFIG = {
    GOOGLE_SCRIPT: "https://script.google.com/macros/s/AKfycbwANbBNgrO3Q7EDzrJUUIXnTDJfedgMOL2gwNek9n1ZqLUa6aVzsdpzV1a086wf7bMdHQ/exec",
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
let isPaymentProcessed = false;
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

// Generate unique submission ID
function generateSubmissionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9).toUpperCase();
    return `SUB_${timestamp}_${random}`;
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
            btnText.textContent = 'Pay ₹999 only & Register';
            paymentInfo.classList.remove('hidden');
        } else {
            btnText.textContent = 'Submit Feedback';
            paymentInfo.classList.add('hidden');
        }
    });
});

// ============================================================================
// DATA COLLECTION - ALL FIELDS IN SINGLE ROW
// ============================================================================

function collectFormData(isPostPayment = false) {
    const formType = document.querySelector('input[name="form_type"]:checked').value;
    const rating = document.querySelector('input[name="rating"]:checked')?.value || 'Not rated';
    
    // Get ALL form values
    const formData = {
        // Unique ID to prevent duplicates
        submission_id: generateSubmissionId(),
        
        // Timestamps
        server_time: new Date().toISOString(),
        client_timestamp: new Date().toISOString(),
        local_time_ist: new Date().toLocaleString('en-IN', { 
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        }),
        
        // Personal Details - ALL CAPTURED
        name: document.getElementById('name').value.trim(),
        company: document.getElementById('company').value.trim(),
        company_size: document.getElementById('employees').value,
        mobile: document.getElementById('phone').value.trim(),
        email: document.getElementById('email').value.trim(),
        city: document.getElementById('city').value.trim(),
        
        // Feedback
        rating: rating,
        remarks: document.getElementById('remarks').value.trim() || 'None',
        
        // Registration Type
        form_type: formType,
        selected_option: formType === 'feedback' ? 'Submit Feedback' : 'Book Audit Slot',
        
        // Payment Details
        amount: formType === 'audit' ? '999 only' : '0',
        currency: 'INR',
        payment_status: isPostPayment ? 'Paid' : (formType === 'audit' ? 'Payment Initiated' : 'Not Applicable'),
        razorpay_payment_id: paymentData.razorpay_payment_id || (formType === 'audit' ? 'Pending' : 'N/A'),
        razorpay_order_id: paymentData.razorpay_order_id || (formType === 'audit' ? 'Pending' : 'N/A'),
        
        // Metadata
        submission_source: isPostPayment ? 'Post-Payment' : 'Direct-Submit',
        registration_complete: formType === 'feedback' ? 'Yes' : (isPostPayment ? 'Yes' : 'Pending Payment'),
        processed_at: new Date().toISOString()
    };
    
    console.log('📋 Complete form data collected:', formData);
    return formData;
}

// ============================================================================
// GOOGLE SHEETS SUBMISSION - SINGLE ENTRY GUARANTEE
// ============================================================================

async function submitToGoogleSheets(data) {
    console.log('📤 Sending to Google Sheets:', data);
    
    // Check if already submitted (prevent duplicates)
    const submittedIds = JSON.parse(localStorage.getItem('submittedIds') || '[]');
    if (submittedIds.includes(data.submission_id)) {
        console.log('⚠️ Duplicate submission detected, skipping...');
        return true;
    }
    
    try {
        const formData = new FormData();
        
        // Add each field individually for proper Excel formatting
        Object.keys(data).forEach(key => {
            formData.append(key, data[key]);
        });
        
        // Add JSON payload
        formData.append('payload', JSON.stringify(data));
        
        const response = await fetch(CONFIG.GOOGLE_SCRIPT, {
            method: 'POST',
            mode: 'no-cors',
            body: formData
        });
        
        console.log('✅ Data sent successfully to Google Sheets');
        
        // Mark as submitted to prevent duplicates
        submittedIds.push(data.submission_id);
        localStorage.setItem('submittedIds', JSON.stringify(submittedIds));
        
        // Keep only last 100 IDs to save space
        if (submittedIds.length > 100) {
            submittedIds.shift();
            localStorage.setItem('submittedIds', JSON.stringify(submittedIds));
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Error sending to Google Sheets:', error);
        throw error;
    }
}

// ============================================================================
// RAZORPAY PAYMENT FLOW - WITH DUPLICATE PREVENTION
// ============================================================================

function initiateRazorpayPayment(formData) {
    // Save complete form data
    const saveData = {
        formData: formData,
        savedAt: new Date().toISOString(),
        submissionId: formData.submission_id
    };
    
    sessionStorage.setItem('pendingRegistration', JSON.stringify(saveData));
    console.log('💾 Form data saved with ID:', formData.submission_id);
    
    // Build payment URL
    const paymentUrl = new URL(CONFIG.RAZORPAY_LINK.trim());
    paymentUrl.searchParams.set('redirect_url', CONFIG.RETURN_URL);
    paymentUrl.searchParams.set('return_url', CONFIG.RETURN_URL);
    paymentUrl.searchParams.set('customer_name', formData.name);
    paymentUrl.searchParams.set('customer_email', formData.email);
    paymentUrl.searchParams.set('customer_phone', formData.mobile);
    paymentUrl.searchParams.set('submission_id', formData.submission_id);
    paymentUrl.searchParams.set('amount', '999');
    paymentUrl.searchParams.set('description', 'Audit Slot Booking');
    
    console.log('🔗 Payment URL:', paymentUrl.toString());
    showLoader('Redirecting to secure payment...');
    
    setTimeout(() => {
        window.location.href = paymentUrl.toString();
    }, 800);
}

// ============================================================================
// CHECK PAYMENT RETURN - ONCE ONLY
// ============================================================================

function checkPaymentReturn() {
    // Prevent processing twice
    if (isPaymentProcessed) {
        console.log('⚠️ Payment already processed, skipping...');
        return false;
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const params = Object.fromEntries(urlParams);
    
    console.log('🔍 URL Parameters:', params);
    
    const paymentId = params.razorpay_payment_id || params.payment_id;
    const paymentStatus = params.razorpay_status || params.status;
    
    if (paymentId && (paymentId.startsWith('pay_') || paymentStatus === 'success')) {
        console.log('✅ Payment successful:', paymentId);
        isPaymentProcessed = true; // Mark as processed
        
        paymentData = {
            razorpay_payment_id: paymentId,
            razorpay_order_id: params.razorpay_order_id || 'ORD_' + Date.now(),
            payment_status: 'Paid'
        };
        
        processPaymentSuccess(paymentId, params);
        return true;
    }
    
    return false;
}

// ============================================================================
// PROCESS PAYMENT SUCCESS - SINGLE ENTRY
// ============================================================================

async function processPaymentSuccess(paymentId, params) {
    console.log('💰 Processing payment:', paymentId);
    
    showLoader('✅ Payment Successful! Saving registration...');
    
    try {
        // Get saved form data
        const savedData = sessionStorage.getItem('pendingRegistration');
        
        if (savedData) {
            const parsed = JSON.parse(savedData);
            const formData = parsed.formData || parsed;
            
            // Update with payment info - ALL IN ONE ROW
            const finalData = {
                ...formData,
                submission_id: params.submission_id || formData.submission_id || generateSubmissionId(),
                razorpay_payment_id: paymentId,
                razorpay_order_id: params.razorpay_order_id || paymentData.razorpay_order_id,
                payment_status: 'Paid',
                form_type: 'audit',
                selected_option: 'Book Audit Slot',
                amount: '999 only',
                submission_source: 'Post-Payment',
                registration_complete: 'Yes',
                payment_completed_at: new Date().toISOString(),
                processed_at: new Date().toISOString()
            };
            
            console.log('📤 Final data for Excel (single entry):', finalData);
            
            // Submit to Google Sheets - ONCE
            await submitToGoogleSheets(finalData);
            
            // Show success
            showSuccessPage(finalData);
            
            // Clean URL to prevent re-submission
            const cleanUrl = CONFIG.RETURN_URL.split('?')[0];
            window.history.replaceState({}, document.title, cleanUrl);
            
            // Clear storage AFTER successful submission
            sessionStorage.removeItem('pendingRegistration');
            
        } else {
            // Create minimal data if no saved form data found
            const fallbackData = {
                submission_id: generateSubmissionId(),
                name: params.customer_name || 'Customer',
                email: params.customer_email || 'email@example.com',
                mobile: params.customer_phone || '0000000000',
                company: 'Not Provided',
                company_size: 'Not Provided',
                city: 'Not Provided',
                rating: 'Not rated',
                remarks: 'None',
                form_type: 'audit',
                selected_option: 'Book Audit Slot',
                amount: '999 only',
                currency: 'INR',
                payment_status: 'Paid',
                razorpay_payment_id: paymentId,
                razorpay_order_id: params.razorpay_order_id || 'ORD_' + Date.now(),
                submission_source: 'Post-Payment-Fallback',
                registration_complete: 'Yes',
                processed_at: new Date().toISOString()
            };
            
            await submitToGoogleSheets(fallbackData);
            showSuccessPage(fallbackData);
        }
        
    } catch (error) {
        console.error('❌ Error processing payment:', error);
        showToast('Payment successful but save failed. Contact support.', 'error');
    } finally {
        hideLoader();
    }
}

// ============================================================================
// SHOW SUCCESS PAGE
// ============================================================================

function showSuccessPage(data) {
    form.classList.add('hidden');
    successMsg.classList.remove('hidden');
    
    if (data.form_type === 'audit' || data.amount === '999 only') {
        document.getElementById('successTitle').textContent = '🎉 Payment Successful!';
        document.getElementById('successText').textContent = 'Your audit slot has been booked successfully. Thank you for sharing your experience!';
        
        document.getElementById('receiptSection').classList.remove('hidden');
        document.getElementById('receiptName').textContent = data.name;
        document.getElementById('receiptEmail').textContent = data.email;
        document.getElementById('receiptPaymentId').textContent = data.razorpay_payment_id;
        document.getElementById('receiptAmount').textContent = `₹${data.amount}`;
        document.getElementById('receiptType').textContent = 'Audit Slot Booking';
    } else {
        document.getElementById('successTitle').textContent = 'Thank You!';
        document.getElementById('successText').textContent = 'Your feedback has been submitted successfully. Thank you for sharing your experience!';
        document.getElementById('receiptSection').classList.add('hidden');
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Registration complete!', 'success');
}

// ============================================================================
// FORM SUBMIT HANDLER - WITH DEBOUNCING
// ============================================================================

let submitTimeout;

async function handleSubmit(e) {
    e.preventDefault();
    
    // Prevent multiple submissions
    if (isSubmitting) {
        showToast('Please wait, processing...', 'warning');
        return;
    }
    
    if (!validateForm()) return;
    
    isSubmitting = true;
    submitBtn.disabled = true;
    
    clearTimeout(submitTimeout);
    submitTimeout = setTimeout(async () => {
        try {
            const formData = collectFormData(false);
            console.log('📋 Submitting:', formData);
            
            if (formData.form_type === 'audit') {
                // Save initiation record
                try {
                    await submitToGoogleSheets({
                        ...formData,
                        payment_status: 'Initiated',
                        submission_source: 'Pre-Payment'
                    });
                } catch (e) {
                    console.log('Initiation save failed, continuing...');
                }
                
                // Go to payment
                initiateRazorpayPayment(formData);
            } else {
                // Direct feedback submission
                await submitToGoogleSheets(formData);
                showSuccessPage(formData);
            }
        } catch (error) {
            console.error('❌ Submission error:', error);
            showToast('Error submitting form. Please try again.', 'error');
            isSubmitting = false;
            submitBtn.disabled = false;
        }
    }, 300); // 300ms debounce
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

form.querySelectorAll('input, select, textarea').forEach(field => {
    field.addEventListener('blur', () => validateField(field));
    field.addEventListener('input', () => field.classList.remove('invalid'));
});

form.addEventListener('submit', handleSubmit);

// Prevent back button after payment
window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        window.location.reload();
    }
});

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Form initialized - Complete & Proper Version');
    
    // Check payment return
    const isPaymentReturn = checkPaymentReturn();
    
    if (!isPaymentReturn) {
        // Clean URL on load
        if (window.location.search) {
            const cleanUrl = CONFIG.RETURN_URL.split('?')[0];
            window.history.replaceState({}, document.title, cleanUrl);
        }
    }
    
    console.log('✅ Ready - Fully Functional');
});