// ============================================================================
// UNIFIED FORM - COMPLETE & PROPER VERSION
// ============================================================================
const CONFIG = {
  GOOGLE_SCRIPT: "https://script.google.com/macros/s/AKfycbxUs7HMjL4Ol5YZHTFWYB0gj5u16AxCZGtLmCb6tMpLiJ0xoFLPV5gi-tyFxyT0THWOyA/exec",
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
// DATA COLLECTION
// ============================================================================
function collectFormData(isPostPayment = false) {
  const formType = document.querySelector('input[name="form_type"]:checked').value;
  const rating = document.querySelector('input[name="rating"]:checked')?.value || 'Not rated';
  
  const formData = {
    submission_id: generateSubmissionId(),
    server_time: new Date().toISOString(),
    client_timestamp: new Date().toISOString(),
    local_time_ist: new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    }),
    name: document.getElementById('name').value.trim(),
    company: document.getElementById('company').value.trim(),
    company_size: document.getElementById('employees').value,
    mobile: document.getElementById('phone').value.trim(),
    email: document.getElementById('email').value.trim(),
    city: document.getElementById('city').value.trim(),
    rating: rating,
    remarks: document.getElementById('remarks').value.trim() || 'None',
    form_type: formType,
    selected_option: formType === 'feedback' ? 'Submit Feedback' : 'Book Audit Slot',
    amount: formType === 'audit' ? '999 only' : '0',
    currency: 'INR',
    payment_status: isPostPayment ? 'Paid' : (formType === 'audit' ? 'Payment Initiated' : 'Not Applicable'),
    razorpay_payment_id: paymentData.razorpay_payment_id || (formType === 'audit' ? 'Pending' : 'N/A'),
    razorpay_order_id: paymentData.razorpay_order_id || (formType === 'audit' ? 'Pending' : 'N/A'),
    submission_source: isPostPayment ? 'Post-Payment' : 'Direct-Submit',
    registration_complete: formType === 'feedback' ? 'Yes' : (isPostPayment ? 'Yes' : 'Pending Payment'),
    processed_at: new Date().toISOString()
  };
  
  console.log('📋 Complete form data collected:', formData);
  return formData;
}

// ============================================================================
// GOOGLE SHEETS SUBMISSION
// ============================================================================
async function submitToGoogleSheets(data) {
  console.log('📤 Sending to Google Sheets:', data);
  
  const submittedIds = JSON.parse(localStorage.getItem('submittedIds') || '[]');
  if (submittedIds.includes(data.submission_id)) {
    console.log('⚠️ Duplicate submission detected, skipping...');
    return true;
  }
  
  try {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      formData.append(key, data[key]);
    });
    formData.append('payload', JSON.stringify(data));
    
    const response = await fetch(CONFIG.GOOGLE_SCRIPT, {
      method: 'POST',
      mode: 'no-cors',
      body: formData
    });
    
    console.log('✅ Data sent successfully to Google Sheets');
    
    submittedIds.push(data.submission_id);
    localStorage.setItem('submittedIds', JSON.stringify(submittedIds));
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
// RAZORPAY PAYMENT FLOW
// ============================================================================
function initiateRazorpayPayment(formData) {
  const saveData = {
    formData: formData,
    savedAt: new Date().toISOString(),
    submissionId: formData.submission_id
  };
  sessionStorage.setItem('pendingRegistration', JSON.stringify(saveData));
  
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
// CHECK PAYMENT RETURN
// ============================================================================
function checkPaymentReturn() {
  if (isPaymentProcessed) {
    console.log('⚠️ Payment already processed, skipping...');
    return false;
  }
  
  const urlParams = new URLSearchParams(window.location.search);
  const params = Object.fromEntries(urlParams);
  
  const paymentId = params.razorpay_payment_id || params.payment_id;
  const paymentStatus = params.razorpay_status || params.status;
  
  if (paymentId && (paymentId.startsWith('pay_') || paymentStatus === 'success')) {
    console.log('✅ Payment successful:', paymentId);
    isPaymentProcessed = true;
    
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
// PROCESS PAYMENT SUCCESS
// ============================================================================
async function processPaymentSuccess(paymentId, params) {
  console.log('💰 Processing payment:', paymentId);
  showLoader('✅ Payment Successful! Saving registration...');
  
  try {
    const savedData = sessionStorage.getItem('pendingRegistration');
    if (savedData) {
      const parsed = JSON.parse(savedData);
      const formData = parsed.formData || parsed;
      
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
      await submitToGoogleSheets(finalData);
      showSuccessPage(finalData);
      
      const cleanUrl = CONFIG.RETURN_URL.split('?')[0];
      window.history.replaceState({}, document.title, cleanUrl);
      sessionStorage.removeItem('pendingRegistration');
    } else {
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
  
  // Display user email for confirmation
  document.getElementById('userEmailDisplay').textContent = data.email;
  
  if (data.form_type === 'audit' || data.amount === '999 only') {
    document.getElementById('successTitle').textContent = '🎉 Payment Successful!';
    document.getElementById('successText').textContent = 'Your audit slot has been booked successfully. Check your email for 2 important PDFs!';
    document.getElementById('receiptSection').classList.remove('hidden');
    document.getElementById('receiptName').textContent = data.name;
    document.getElementById('receiptEmail').textContent = data.email;
    document.getElementById('receiptPaymentId').textContent = data.razorpay_payment_id;
    document.getElementById('receiptAmount').textContent = `₹${data.amount}`;
    document.getElementById('receiptType').textContent = 'Audit Slot Booking';
  } else {
    document.getElementById('successTitle').textContent = 'Thank You!';
    document.getElementById('successText').textContent = 'Your feedback has been submitted successfully. Check your email for 2 important PDFs!';
    document.getElementById('receiptSection').classList.add('hidden');
  }
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
  showToast('Registration complete! Check your email 📧', 'success');
}

// ============================================================================
// FORM SUBMIT HANDLER
// ============================================================================
let submitTimeout;
async function handleSubmit(e) {
  e.preventDefault();
  
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
        try {
          await submitToGoogleSheets({
            ...formData,
            payment_status: 'Initiated',
            submission_source: 'Pre-Payment'
          });
        } catch (e) {
          console.log('Initiation save failed, continuing...');
        }
        initiateRazorpayPayment(formData);
      } else {
        await submitToGoogleSheets(formData);
        showSuccessPage(formData);
      }
    } catch (error) {
      console.error('❌ Submission error:', error);
      showToast('Error submitting form. Please try again.', 'error');
      isSubmitting = false;
      submitBtn.disabled = false;
    }
  }, 300);
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================
form.querySelectorAll('input, select, textarea').forEach(field => {
  field.addEventListener('blur', () => validateField(field));
  field.addEventListener('input', () => field.classList.remove('invalid'));
});

form.addEventListener('submit', handleSubmit);

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
  
  const isPaymentReturn = checkPaymentReturn();
  if (!isPaymentReturn) {
    if (window.location.search) {
      const cleanUrl = CONFIG.RETURN_URL.split('?')[0];
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }
  
  console.log('✅ Ready - Fully Functional');
});