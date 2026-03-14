// ============================================================================
// UNIFIED FORM - NO PAYMENT VERSION (FIXED)
// ============================================================================
const CONFIG = {
GOOGLE_SCRIPT: "https://script.google.com/macros/s/AKfycbzSV5Rient4UfUGIopQJO3DTI3h7AQ8HHT2wDVDKO7GrTPBU9fYOPzmQpG59y-86jZd2Q/exec",
RETURN_URL: window.location.origin + window.location.pathname
};

const form = document.getElementById('unifiedForm');
const submitBtn = document.getElementById('submitBtn');
const btnText = document.getElementById('btnText');
const successMsg = document.getElementById('successMsg');
const toast = document.getElementById('toast');
const loader = document.getElementById('loader');
const loaderText = document.getElementById('loaderText');

let isSubmitting = false;

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

function generateSubmissionId() {
const timestamp = Date.now();
const random = Math.random().toString(36).substr(2, 9).toUpperCase();
return `SUB_${timestamp}_${random}`;
}

function collectFormData() {
const wantAudit = document.querySelector('input[name="want_audit"]:checked')?.value || 'No';
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
}

async function submitToGoogleSheets(data) {
console.log('📤 Sending to Google Sheets:', data);
const submittedIds = JSON.parse(localStorage.getItem('submittedIds') || '[]');
if (submittedIds.includes(data.submission_id)) {
console.log('⚠️ Duplicate submission detected');
return true;
}
try {
const formData = new FormData();
Object.keys(data).forEach(key => formData.append(key, data[key]));
formData.append('payload', JSON.stringify(data));

await fetch(CONFIG.GOOGLE_SCRIPT, {
method: 'POST',
mode: 'no-cors',
body: formData
});

console.log('✅ Data sent to Google Sheets');
submittedIds.push(data.submission_id);
localStorage.setItem('submittedIds', JSON.stringify(submittedIds.slice(-100)));
return true;
} catch (error) {
console.error('❌ Error:', error);
throw error;
}
}

function showSuccessPage(data) {
form.classList.add('hidden');
successMsg.classList.remove('hidden');
document.getElementById('userEmailDisplay').textContent = data.email;
document.getElementById('successTitle').textContent = 'Thank You!';
document.getElementById('successText').textContent = 'Your feedback has been submitted successfully. Check your email for 2 important PDFs!';
document.getElementById('receiptSection').classList.add('hidden');
window.scrollTo({ top: 0, behavior: 'smooth' });
showToast('Registration complete! Check your email 📧', 'success');
}

let submitTimeout;
async function handleSubmit(e) {
e.preventDefault();
if (isSubmitting) { showToast('Please wait...', 'warning'); return; }
if (!validateForm()) return;

isSubmitting = true;
submitBtn.disabled = true;

clearTimeout(submitTimeout);
submitTimeout = setTimeout(async () => {
try {
const formData = collectFormData();
console.log('📋 Submitting:', formData);
showLoader('Submitting your feedback...');
await submitToGoogleSheets(formData);
hideLoader();
showSuccessPage(formData);
} catch (error) {
console.error('❌ Error:', error);
showToast('Error submitting. Please try again.', 'error');
hideLoader();
isSubmitting = false;
submitBtn.disabled = false;
}
}, 300);
}

form.querySelectorAll('input, select, textarea').forEach(field => {
field.addEventListener('blur', () => validateField(field));
field.addEventListener('input', () => field.classList.remove('invalid'));
});
form.addEventListener('submit', handleSubmit);
window.addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });

document.addEventListener('DOMContentLoaded', () => {
console.log('🚀 Form initialized - PDF Attachment Fixed');
if (location.search) {
const cleanUrl = CONFIG.RETURN_URL.split('?')[0];
history.replaceState({}, document.title, cleanUrl);
}
console.log('✅ Ready - Fully Functional');
});