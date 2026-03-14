// ============================================================================
// UNIFIED FORM - NO PAYMENT VERSION
// ============================================================================
const CONFIG = {
GOOGLE_SCRIPT: "https://script.google.com/macros/s/AKfycbxCaxMEtlOUQ_GVGA73N-OcSc2QGn8RCxwwlrE4Yg-Cm6pcsm61RYS8IpuM1tDgTrEHzA/exec",
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

// State
let isSubmitting = false;

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
if (!document.querySelector('input[name="want_audit"]:checked')) {
showToast('Please select audit interest', 'error');
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
// DATA COLLECTION
// ============================================================================
function collectFormData() {
const wantAudit = document.querySelector('input[name="want_audit"]:checked')?.value || 'No';
const rating = document.querySelector('input[name="rating"]:checked')?.value || 'Not rated';

// Get current time in IST format
const now = new Date();
const istTime = now.toLocaleString('en-IN', {
timeZone: 'Asia/Kolkata',
year: 'numeric',
month: '2-digit',
day: '2-digit',
hour: '2-digit',
minute: '2-digit',
second: '2-digit',
hour12: false
});

const formData = {
submission_id: generateSubmissionId(),
server_time: istTime,
client_timestamp: now.toISOString(),
local_time_ist: istTime,
name: document.getElementById('name').value.trim(),
company: document.getElementById('company').value.trim(),
company_size: document.getElementById('employees').value,
mobile: document.getElementById('phone').value.trim(),
email: document.getElementById('email').value.trim(),
city: document.getElementById('city').value.trim(),
rating: rating,
remarks: document.getElementById('remarks').value.trim() || 'None',
want_audit: wantAudit,
submission_source: 'Direct-Submit',
processed_at: now.toISOString()
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
// SHOW SUCCESS PAGE
// ============================================================================
function showSuccessPage(data) {
form.classList.add('hidden');
successMsg.classList.remove('hidden');

// Display user email for confirmation
document.getElementById('userEmailDisplay').textContent = data.email;

// Simple Success Message (No Payment Receipt)
document.getElementById('successTitle').textContent = 'Thank You!';
document.getElementById('successText').textContent = 'Your feedback has been submitted successfully. Check your email for 2 important PDFs!';
document.getElementById('receiptSection').classList.add('hidden');

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
const formData = collectFormData();
console.log('📋 Submitting:', formData);

// Show Loader
showLoader('Submitting your feedback...');

// Submit to Google Sheets
await submitToGoogleSheets(formData);

// Show Success
hideLoader();
showSuccessPage(formData);

} catch (error) {
console.error('❌ Submission error:', error);
showToast('Error submitting form. Please try again.', 'error');
hideLoader();
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
console.log('🚀 Form initialized - No Payment Version');
if (window.location.search) {
const cleanUrl = CONFIG.RETURN_URL.split('?')[0];
window.history.replaceState({}, document.title, cleanUrl);
}
console.log('✅ Ready - Fully Functional');
});