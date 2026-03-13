// ============================================================================
// UNIFIED FORM - COMPLETE FIXED VERSION
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
// DATA COLLECTION - COMPLETE WITH ALL FIELDS
// ============================================================================

function collectFormData(isPostPayment = false) {
    const formType = document.querySelector('input[name="form_type"]:checked').value;
    const rating = document.querySelector('input[name="rating"]:checked')?.value || 'Not rated';
    
    // Get all form values
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const designation = document.getElementById('designation').value.trim();
    const company = document.getElementById('company').value.trim();
    const employees = document.getElementById('employees').value;
    const city = document.getElementById('city').value.trim();
    const remarks = document.getElementById('remarks').value.trim() || 'None';
    
    // Generate unique ID for tracking
    const submissionId = 'SUB_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    return {
        // Core fields - ALL captured
        submission_id: submissionId,
        timestamp: new Date().toISOString(),
        local_time: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        name: name,
        email: email,
        phone: phone,
        designation: designation,
        company: company,
        company_size: employees,
        city: city,
        rating: rating,
        remarks: remarks,
        
        // Registration type
        form_type: formType,
        selected_option: formType === 'feedback' ? 'Submit Feedback' : 'Book Audit Slot',
        
        // Payment details
        amount: formType === 'audit' ? '999' : '0',
        currency: 'INR',
        payment_status: isPostPayment ? 'Paid' : (formType === 'audit' ? 'Payment Initiated' : 'Not Applicable'),
        razorpay_payment_id: paymentData.razorpay_payment_id || (formType === 'audit' ? 'Pending' : 'N/A'),
        razorpay_order_id: paymentData.razorpay_order_id || (formType === 'audit' ? 'Pending' : 'N/A'),
        
        // Metadata
        submission_source: isPostPayment ? 'Post-Payment' : 'Direct-Submit',
        user_agent: navigator.userAgent,
        page_url: window.location.href,
        ip_address: 'Collected by server', // Server will add this
        
        // Additional tracking
        registration_complete: formType === 'feedback' ? 'Yes' : (isPostPayment ? 'Yes' : 'Pending Payment')
    };
}

// ============================================================================
// GOOGLE SHEETS SUBMISSION - WITH RETRY AND BACKUP
// ============================================================================

async function submitToGoogleSheets(data) {
    console.log('📤 Sending to Google Sheets:', data);
    
    try {
        // Create FormData for submission
        const formData = new FormData();
        
        // Add all data fields individually (more reliable than JSON string)
        Object.keys(data).forEach(key => {
            formData.append(key, data[key]);
        });
        
        // Also add JSON payload for backward compatibility
        formData.append('payload', JSON.stringify(data));
        
        const response = await fetch(CONFIG.GOOGLE_SCRIPT, {
            method: 'POST',
            mode: 'no-cors', // Important for Google Apps Script
            body: formData
        });
        
        console.log('✅ Data sent successfully');
        
        // Save to localStorage as backup
        saveToLocalBackup(data);
        
        return true;
        
    } catch (error) {
        console.error('❌ Error sending to Google Sheets:', error);
        
        // Save to localStorage for retry
        saveToLocalBackup(data);
        
        // Also save to pending queue
        const pendingSubmissions = JSON.parse(localStorage.getItem('pendingSubmissions') || '[]');
        pendingSubmissions.push({
            data: data,
            timestamp: new Date().toISOString(),
            retryCount: 0
        });
        localStorage.setItem('pendingSubmissions', JSON.stringify(pendingSubmissions));
        
        throw error;
    }
}

function saveToLocalBackup(data) {
    const backups = JSON.parse(localStorage.getItem('formBackups') || '[]');
    backups.push({ 
        ...data, 
        backup_time: new Date().toISOString(),
        synced: false 
    });
    localStorage.setItem('formBackups', JSON.stringify(backups));
}

// ============================================================================
// RAZORPAY PAYMENT FLOW
// ============================================================================

function initiateRazorpayPayment(formData) {
    // Save ALL form data to sessionStorage (not just audit data)
    const saveData = {
        formData: formData,
        savedAt: new Date().toISOString(),
        allFields: true
    };
    
    sessionStorage.setItem('pendingRegistration', JSON.stringify(saveData));
    sessionStorage.setItem('pendingAuditData', JSON.stringify(saveData)); // Keep for compatibility
    
    console.log('💾 Complete form data saved to sessionStorage:', formData);
    
    // Build payment URL with return parameters
    const paymentUrl = new URL(CONFIG.RAZORPAY_LINK.trim());
    paymentUrl.searchParams.set('redirect_url', CONFIG.RETURN_URL);
    paymentUrl.searchParams.set('return_url', CONFIG.RETURN_URL);
    
    // Add customer info for better tracking
    paymentUrl.searchParams.set('customer_name', formData.name);
    paymentUrl.searchParams.set('customer_email', formData.email);
    paymentUrl.searchParams.set('customer_phone', formData.phone);
    
    console.log('🔗 Payment URL:', paymentUrl.toString());
    showLoader('Redirecting to secure payment...');
    
    // Redirect to Razorpay
    setTimeout(() => {
        window.location.href = paymentUrl.toString();
    }, 800);
}

// ============================================================================
// CHECK PAYMENT RETURN - ENHANCED FOR ALL PARAMETERS
// ============================================================================

function checkPaymentReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const params = Object.fromEntries(urlParams);
    
    console.log('🔍 URL Parameters received:', params);
    
    // Check for payment success indicators
    const paymentId = params.razorpay_payment_id || params.payment_id || params.razorpay_paymentid;
    const paymentStatus = params.razorpay_status || params.status || params.payment_status;
    const orderId = params.razorpay_order_id || params.order_id;
    
    // Case 1: Payment successful with payment_id
    if (paymentId && (paymentId.startsWith('pay_') || paymentId.length > 10)) {
        console.log('✅ PAYMENT SUCCESSFUL! Payment ID:', paymentId);
        
        // Update payment data
        paymentData = {
            razorpay_payment_id: paymentId,
            razorpay_order_id: orderId || 'ORD_' + Date.now(),
            payment_status: 'Paid'
        };
        
        // Process the successful payment
        processPaymentSuccess(paymentId, params);
        return true;
    }
    
    // Case 2: Payment success from status
    if (paymentStatus === 'success' || paymentStatus === 'paid' || paymentStatus === 'captured') {
        console.log('✅ Payment status success:', paymentStatus);
        
        const tempPaymentId = paymentId || 'pay_' + Date.now();
        paymentData = {
            razorpay_payment_id: tempPaymentId,
            razorpay_order_id: orderId || 'ORD_' + Date.now(),
            payment_status: 'Paid'
        };
        
        processPaymentSuccess(tempPaymentId, params);
        return true;
    }
    
    return false;
}

// ============================================================================
// PROCESS PAYMENT SUCCESS - COMPLETE DATA TO EXCEL
// ============================================================================

async function processPaymentSuccess(paymentId, params) {
    console.log('💰 Processing payment success:', { paymentId, params });
    
    // Get saved form data - try multiple storage keys
    let savedData = null;
    const storageKeys = ['pendingRegistration', 'pendingAuditData', 'formBackups'];
    
    for (const key of storageKeys) {
        const data = sessionStorage.getItem(key) || localStorage.getItem(key);
        if (data) {
            try {
                const parsed = JSON.parse(data);
                if (parsed.formData) {
                    savedData = parsed.formData;
                } else if (parsed.data) {
                    savedData = parsed.data;
                } else {
                    savedData = parsed;
                }
                console.log(`📋 Found data in ${key}:`, savedData);
                break;
            } catch (e) {
                console.log(`Error parsing ${key}:`, e);
            }
        }
    }
    
    // If we have saved data, use it
    if (savedData) {
        console.log('📋 Using saved form data:', savedData);
        
        // Update with payment info
        const finalData = {
            ...savedData,
            razorpay_payment_id: paymentId,
            razorpay_order_id: params.razorpay_order_id || paymentData.razorpay_order_id,
            payment_status: 'Paid',
            form_type: 'audit',
            selected_option: 'Book Audit Slot',
            amount: '999',
            submission_source: 'Post-Payment',
            registration_complete: 'Yes',
            payment_completed_at: new Date().toISOString()
        };
        
        // Ensure all required fields are present
        ensureAllFields(finalData);
        
        console.log('📤 Final data for Excel:', finalData);
        
        // Show success loader
        showLoader('✅ Payment Successful! Saving your registration...');
        
        // Submit to Google Sheets
        try {
            await submitRegistration(finalData, true);
        } catch (err) {
            console.error('❌ Save failed:', err);
            showToast('Payment successful but save failed. Data saved locally.', 'warning');
            
            // Still show success page with local data
            showSuccessPage(finalData);
        }
        
        // Clean URL
        const cleanUrl = CONFIG.RETURN_URL;
        window.history.replaceState({}, document.title, cleanUrl);
        
        // Clear storage
        sessionStorage.removeItem('pendingRegistration');
        sessionStorage.removeItem('pendingAuditData');
        
    } else {
        console.error('❌ No saved form data found!');
        
        // Create minimal data from URL params
        const fallbackData = createFallbackData(params, paymentId);
        
        if (fallbackData.name || fallbackData.email) {
            console.log('📋 Using URL parameters as fallback:', fallbackData);
            
            showLoader('Saving registration from URL data...');
            
            try {
                await submitRegistration(fallbackData, true);
            } catch (err) {
                console.error('❌ Fallback save failed:', err);
                showSuccessPage(fallbackData);
            }
        } else {
            showToast('Form data not found. Please contact support.', 'error');
            hideLoader();
        }
    }
}

function ensureAllFields(data) {
    // Ensure all expected fields exist with default values
    const defaultFields = {
        name: '',
        email: '',
        phone: '',
        designation: '',
        company: '',
        company_size: '',
        city: '',
        rating: '',
        remarks: 'None',
        form_type: 'audit',
        selected_option: 'Book Audit Slot',
        amount: '999',
        payment_status: 'Paid',
        razorpay_payment_id: '',
        razorpay_order_id: '',
        submission_id: 'SUB_' + Date.now(),
        timestamp: new Date().toISOString(),
        local_time: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    };
    
    // Fill missing fields with defaults
    Object.keys(defaultFields).forEach(key => {
        if (!data[key] || data[key] === '') {
            data[key] = defaultFields[key];
        }
    });
    
    return data;
}

function createFallbackData(params, paymentId) {
    return {
        submission_id: 'FALLBACK_' + Date.now(),
        timestamp: new Date().toISOString(),
        local_time: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        name: params.name || params.customer_name || params.customerName || 'Not Provided',
        email: params.email || params.customer_email || params.customerEmail || 'Not Provided',
        phone: params.phone || params.customer_phone || params.mobile || 'Not Provided',
        designation: 'Not Provided',
        company: 'Not Provided',
        company_size: 'Not Provided',
        city: 'Not Provided',
        rating: 'Not rated',
        remarks: 'Payment completed without form data',
        form_type: 'audit',
        selected_option: 'Book Audit Slot',
        amount: '999',
        payment_status: 'Paid',
        razorpay_payment_id: paymentId,
        razorpay_order_id: params.razorpay_order_id || 'ORD_' + Date.now(),
        submission_source: 'URL-Fallback',
        registration_complete: 'Yes'
    };
}

// ============================================================================
// SHOW SUCCESS PAGE - WITH CORRECT MESSAGES
// ============================================================================

function showSuccessPage(data) {
    form.classList.add('hidden');
    successMsg.classList.remove('hidden');
    
    // Set correct message based on registration type
    if (data.form_type === 'audit' || data.selected_option === 'Book Audit Slot' || data.amount === '999') {
        document.getElementById('successTitle').textContent = '🎉 Payment Successful!';
        document.getElementById('successText').textContent = 'Your audit slot has been booked successfully. A confirmation email will be sent shortly.';
        
        // Show receipt with all details
        document.getElementById('receiptSection').classList.remove('hidden');
        document.getElementById('receiptName').textContent = data.name || 'N/A';
        document.getElementById('receiptEmail').textContent = data.email || 'N/A';
        document.getElementById('receiptPaymentId').textContent = data.razorpay_payment_id || 'N/A';
        document.getElementById('receiptAmount').textContent = data.amount ? `₹${data.amount}` : '₹999';
        document.getElementById('receiptType').textContent = 'Audit Slot Booking';
    } else {
        document.getElementById('successTitle').textContent = 'Thank You!';
        document.getElementById('successText').textContent = 'Your feedback has been submitted successfully.';
        document.getElementById('receiptSection').classList.add('hidden');
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Clear storage
    sessionStorage.removeItem('pendingRegistration');
    sessionStorage.removeItem('pendingAuditData');
    
    showToast('Registration complete!', 'success');
}

// ============================================================================
// FINAL SUBMISSION - WITH COMPLETE DATA
// ============================================================================

async function submitRegistration(formData, isPostPayment = false) {
    if (isSubmitting) return;
    
    isSubmitting = true;
    showLoader(isPostPayment ? 'Saving registration to database...' : 'Submitting feedback...');
    
    try {
        // Ensure all data is complete
        const finalData = isPostPayment ? ensureAllFields(formData) : collectFormData(false);
        
        console.log('📤 Submitting to Excel:', finalData);
        
        // Submit to Google Sheets
        await submitToGoogleSheets(finalData);
        
        // Show success page
        showSuccessPage(finalData);
        
    } catch (error) {
        console.error('❌ Submission error:', error);
        
        // Save to localStorage
        const errorData = formData || collectFormData(false);
        saveToLocalBackup(errorData);
        
        showToast('Data saved locally. Will sync automatically.', 'warning');
        
        // Still show success
        showSuccessPage(errorData);
        
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
    
    if (isSubmitting || !validateForm()) return;
    
    // Collect ALL form data
    const formData = collectFormData(false);
    console.log('📋 Complete form data:', formData);
    
    if (formData.form_type === 'audit') {
        console.log('💰 Initiating payment for audit booking...');
        
        // Save to Google Sheets as initiated
        try {
            await submitToGoogleSheets({
                ...formData,
                payment_status: 'Initiated',
                submission_source: 'Pre-Payment'
            });
            console.log('✅ Initiation record saved');
        } catch (e) {
            console.log('Initiation save failed, continuing...');
        }
        
        // Go to payment
        initiateRazorpayPayment(formData);
        
    } else {
        console.log('📝 Submitting feedback...');
        await submitRegistration(formData, false);
    }
}

// ============================================================================
// RETRY PENDING SUBMISSIONS
// ============================================================================

async function retryPendingSubmissions() {
    const pending = JSON.parse(localStorage.getItem('pendingSubmissions') || '[]');
    
    if (pending.length === 0) return;
    
    console.log(`🔄 Retrying ${pending.length} pending submissions...`);
    
    const newPending = [];
    
    for (const item of pending) {
        try {
            if (item.retryCount < 3) { // Max 3 retries
                await submitToGoogleSheets(item.data);
                console.log('✅ Retry successful for:', item.data.submission_id);
            } else {
                newPending.push(item);
            }
        } catch (e) {
            item.retryCount++;
            newPending.push(item);
        }
    }
    
    localStorage.setItem('pendingSubmissions', JSON.stringify(newPending));
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

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Form initialized - Complete Data Collection Active');
    console.log('📊 Google Script:', CONFIG.GOOGLE_SCRIPT);
    console.log('🔗 Return URL:', CONFIG.RETURN_URL);
    
    // Check if this is a payment return
    const isPaymentReturn = checkPaymentReturn();
    
    if (!isPaymentReturn) {
        console.log('ℹ️ Normal page load');
    }
    
    // Retry any pending submissions
    await retryPendingSubmissions();
});

console.log('✅ Event Registration System Ready - All Data Will Go to Excel');