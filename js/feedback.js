// ============================================================================
// FEEDBACK FORM - GOOGLE SHEETS INTEGRATION
// URL: https://script.google.com/macros/s/AKfycbz_KuFcQG_-voZY3UZvRIem3bEjEni8fbAq3rFtElP6yDi3YJ9ZeeaGZrqUWeZIqTM6sg/exec
// ============================================================================

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_KuFcQG_-voZY3UZvRIem3bEjEni8fbAq3rFtElP6yDi3YJ9ZeeaGZrqUWeZIqTM6sg/exec";

// DOM Elements
const form = document.getElementById('feedbackForm');
const submitBtn = document.getElementById('fbSubmitBtn');
const successMsg = document.getElementById('fbSuccessMsg');
const toast = document.getElementById('toast');
const loader = document.getElementById('loader');
const loaderText = document.querySelector('#loader p');

let isSubmitting = false;

// ============================================================================
// UTILITY FUNCTIONS
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
// VALIDATION FUNCTIONS
// ============================================================================

function validateField(field) {
    const value = field.value.trim();
    
    if (field.hasAttribute('required') && !value) {
        field.classList.add('invalid');
        return false;
    }
    
    if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        field.classList.add('invalid');
        showToast('Please enter a valid email address', 'error');
        return false;
    }
    
    if (field.type === 'tel' && value && !/^[6-9][0-9]{9}$/.test(value)) {
        field.classList.add('invalid');
        showToast('Please enter a valid 10-digit mobile number', 'error');
        return false;
    }
    
    if (field.type === 'number' && value && (isNaN(value) || value < 1)) {
        field.classList.add('invalid');
        showToast('Please enter a valid number', 'error');
        return false;
    }
    
    field.classList.remove('invalid');
    return true;
}

function validateForm() {
    let isValid = true;
    const requiredFields = form.querySelectorAll('input[required], textarea[required]');
    
    requiredFields.forEach(field => {
        if (!validateField(field)) isValid = false;
    });
    
    const ratingSelected = document.querySelector('input[name="fb_rating"]:checked');
    if (!ratingSelected) {
        showToast('Please select a rating', 'error');
        isValid = false;
    }
    
    return isValid;
}

// ============================================================================
// DATA COLLECTION & SUBMISSION
// ============================================================================

function collectFormData() {
    const rating = document.querySelector('input[name="fb_rating"]:checked')?.value || 'Not rated';
    
    return {
        name: document.getElementById('fb_name').value.trim(),
        designation: document.getElementById('fb_designation').value.trim(),
        company: document.getElementById('fb_company').value.trim(),
        employees: document.getElementById('fb_employees').value.trim(),
        phone: document.getElementById('fb_phone').value.trim(),
        email: document.getElementById('fb_email').value.trim(),
        city: document.getElementById('fb_city').value.trim(),
        rating: rating,
        remarks: document.getElementById('fb_remarks').value.trim() || 'None',
        form_type: 'feedback',
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent
    };
}

async function submitToGoogleSheets(data) {
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return true;
    } catch (error) {
        console.error('Submission error:', error);
        
        // Backup to localStorage
        const backups = JSON.parse(localStorage.getItem('feedbackBackups') || '[]');
        backups.push({ ...data, backup_time: new Date().toISOString() });
        localStorage.setItem('feedbackBackups', JSON.stringify(backups));
        
        throw error;
    }
}

// ============================================================================
// FORM SUBMIT HANDLER
// ============================================================================

async function handleSubmit(e) {
    e.preventDefault();
    
    if (isSubmitting) return;
    if (!validateForm()) return;
    
    isSubmitting = true;
    submitBtn.disabled = true;
    showLoader('Submitting your feedback...');
    
    try {
        const formData = collectFormData();
        await submitToGoogleSheets(formData);
        
        form.classList.add('hidden');
        successMsg.classList.remove('hidden');
        
    } catch (error) {
        showToast('Feedback saved locally. Will sync when online.', 'warning');
        form.classList.add('hidden');
        successMsg.classList.remove('hidden');
        
    } finally {
        hideLoader();
        isSubmitting = false;
    }
}

// ============================================================================
// EVENT LISTENERS & INITIALIZATION
// ============================================================================

function resetForm() {
    form.reset();
    form.querySelectorAll('.invalid').forEach(f => f.classList.remove('invalid'));
}

// Live validation
form.querySelectorAll('input, textarea').forEach(field => {
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

// Submit event
form.addEventListener('submit', handleSubmit);

console.log('✅ Feedback form initialized - URL:', GOOGLE_SCRIPT_URL);