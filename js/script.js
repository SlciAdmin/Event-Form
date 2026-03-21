// ============================================================================
// FEEDBACK FORM - AUTO EMAIL WITH PDF ATTACHMENTS (PRODUCTION READY)
// ============================================================================

const CONFIG = {
  // 🔥 REPLACE WITH YOUR DEPLOYED GOOGLE APPS SCRIPT URL (NO TRAILING SPACES!)
  GOOGLE_SCRIPT: "https://script.google.com/macros/s/AKfycbz0M59hqsY816GUIchtzGPWIV6OrOuJdmGIMk4-TBGEKzpuwqu0HRtFjL2UJWD_FGBXvw/exec",
  RETURN_URL: window.location.origin + window.location.pathname,
  // Optional: Fallback email notification endpoint
  FALLBACK_WEBHOOK: null 
};

const form = document.getElementById('unifiedForm');
const submitBtn = document.getElementById('submitBtn');
const btnText = document.getElementById('btnText');
const successMsg = document.getElementById('successMsg');
const toast = document.getElementById('toast');
const loader = document.getElementById('loader');
const loaderText = document.getElementById('loaderText');

let isSubmitting = false;
let submitTimeout;

// Show toast notification
function showToast(message, type = 'info', duration = 4000) {
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), duration);
}

// Show loading spinner
function showLoader(text) {
  loaderText.textContent = text || 'Processing...';
  loader.classList.remove('hidden');
  document.body.style.overflow = 'hidden'; // Prevent scroll
}

// Hide loading spinner
function hideLoader() {
  loader.classList.add('hidden');
  document.body.style.overflow = '';
}

// Validate individual field
function validateField(field) {
  const value = field.value.trim();
  
  if (field.hasAttribute('required') && !value) {
    field.classList.add('invalid');
    return { valid: false, message: 'This field is required' };
  }
  
  if (field.type === 'email' && value) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      field.classList.add('invalid');
      return { valid: false, message: 'Please enter a valid email address' };
    }
  }
  
  if (field.type === 'tel' && value) {
    const phoneRegex = /^[6-9][0-9]{9}$/;
    if (!phoneRegex.test(value)) {
      field.classList.add('invalid');
      return { valid: false, message: 'Please enter a valid 10-digit Indian mobile number' };
    }
  }
  
  field.classList.remove('invalid');
  return { valid: true };
}

// Validate entire form
function validateForm() {
  let isValid = true;
  
  form.querySelectorAll('input[required], select[required], textarea[required]').forEach(field => {
    const result = validateField(field);
    if (!result.valid) {
      isValid = false;
      if (!toast.classList.contains('hidden') && toast.textContent !== result.message) {
        showToast(result.message, 'error');
      }
    }
  });
  
  // Check rating selection
  if (!document.querySelector('input[name="rating"]:checked')) {
    showToast('Please select a star rating', 'error');
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

// Collect all form data
function collectFormData() {
  const rating = document.querySelector('input[name="rating"]:checked')?.value || 'Not rated';
  const now = new Date();
  const istTime = now.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });

  return {
    submission_id: generateSubmissionId(),
    server_time: istTime,
    client_timestamp: now.toISOString(),
    name: document.getElementById('name').value.trim(),
    company: document.getElementById('company').value.trim(),
    company_size: document.getElementById('employees').value,
    mobile: document.getElementById('phone').value.trim(),
    email: document.getElementById('email').value.trim().toLowerCase(),
    city: document.getElementById('city').value.trim(),
    rating: rating,
    remarks: document.getElementById('remarks').value.trim() || 'None',
    submission_source: 'Web-Form',
    processed_at: now.toISOString(),
    user_agent: navigator.userAgent,
    page_url: window.location.href
  };
}

// Submit data to Google Apps Script
async function submitToBackend(data) {
  console.log('📤 Sending to backend:', { ...data, email: '[REDACTED]' });
  
  // Prevent duplicate submissions (last 100 IDs)
  const submittedIds = JSON.parse(localStorage.getItem('submittedIds') || '[]');
  if (submittedIds.includes(data.submission_id)) {
    console.warn('⚠️ Duplicate submission blocked:', data.submission_id);
    return { success: true, duplicate: true };
  }
  
  try {
    const formData = new FormData();
    Object.keys(data).forEach(key => formData.append(key, data[key]));
    formData.append('action', 'submit_feedback');
    
    // Use no-cors mode (required for Google Apps Script)
    // Note: We cannot read response body with no-cors, so we assume success if no network error
    const response = await fetch(CONFIG.GOOGLE_SCRIPT, {
      method: 'POST',
      mode: 'no-cors',
      body: formData,
      headers: { 'Accept': 'application/json' }
    });
    
    console.log('✅ Fetch completed (no-cors mode - cannot verify response body)');
    
    // Save submission ID to prevent duplicates
    submittedIds.push(data.submission_id);
    localStorage.setItem('submittedIds', JSON.stringify(submittedIds.slice(-100)));
    
    return { success: true, submissionId: data.submission_id };
    
  } catch (error) {
    console.error('❌ Submission error:', error);
    
    // Optional: Try fallback webhook if configured
    if (CONFIG.FALLBACK_WEBHOOK) {
      try {
        await fetch(CONFIG.FALLBACK_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, fallback: true })
        });
        console.log('✅ Fallback webhook sent');
        return { success: true, fallback: true };
      } catch (fbError) {
        console.error('❌ Fallback also failed:', fbError);
      }
    }
    
    throw new Error('Network error - please check your connection and try again');
  }
}

// Show success page
function showSuccessPage(data) {
  form.classList.add('hidden');
  successMsg.classList.remove('hidden');
  
  document.getElementById('userEmailDisplay').textContent = data.email;
  document.getElementById('successTitle').textContent = 'Thank You!';
  document.getElementById('successText').textContent = 'Your feedback has been submitted successfully. Check your email for 2 important PDFs!';
  
  // Clear form data for security
  form.reset();
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
  showToast('Registration complete! Check your email 📧', 'success', 6000);
}

// Handle form submission
async function handleSubmit(e) {
  e.preventDefault();
  
  if (isSubmitting) {
    showToast('Please wait - submission in progress...', 'warning');
    return;
  }
  
  if (!validateForm()) return;
  
  isSubmitting = true;
  submitBtn.disabled = true;
  const originalBtnText = btnText.textContent;
  btnText.textContent = 'Sending...';
  
  try {
    const formData = collectFormData();
    console.log('📋 Submitting:', { ...formData, email: '[REDACTED]' });
    
    showLoader('Submitting your feedback...');
    
    const result = await submitToBackend(formData);
    
    hideLoader();
    
    if (result.success) {
      showSuccessPage(formData);
    } else {
      throw new Error('Submission failed');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    hideLoader();
    showToast(error.message || 'Error submitting. Please try again.', 'error', 6000);
    
    // Re-enable button after delay
    setTimeout(() => {
      isSubmitting = false;
      submitBtn.disabled = false;
      btnText.textContent = originalBtnText;
    }, 1000);
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Feedback Form Initialized - Auto Email with PDFs Enabled');
  
  // Real-time validation
  form.querySelectorAll('input, select, textarea').forEach(field => {
    field.addEventListener('blur', () => validateField(field));
    field.addEventListener('input', () => {
      field.classList.remove('invalid');
      if (toast.classList.contains('hidden') === false && toast.className.includes('error')) {
        // Clear error toast when user starts fixing
      }
    });
  });
  
  // Star rating accessibility
  const stars = document.querySelectorAll('.star-rating input');
  stars.forEach(star => {
    star.addEventListener('change', () => {
      showToast(`Rating: ${star.value} star${star.value > 1 ? 's' : ''} ⭐`, 'info', 2000);
    });
  });
  
  // Form submission
  form.addEventListener('submit', handleSubmit);
  
  // Handle browser back/forward navigation
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      location.reload();
    }
  });
  
  // Clean URL if needed
  if (location.search) {
    const cleanUrl = CONFIG.RETURN_URL.split('?')[0];
    history.replaceState({}, document.title, cleanUrl);
  }
  
  console.log('✅ Ready - Fully Functional');
});

// Prevent accidental form resubmission on page refresh
window.addEventListener('beforeunload', (e) => {
  if (isSubmitting) {
    e.preventDefault();
    e.returnValue = '';
  }
});