
SETUP GUIDE

1. Create Razorpay account
https://razorpay.com

2. Replace in js/script.js
YOUR_RAZORPAY_KEY

3. Create Google Sheet
Columns:
Name | Email | Phone | Company | Payment

4. Open Extensions → Apps Script
Paste:

function doPost(e){
  var sheet = SpreadsheetApp.getActiveSheet();
  var data = JSON.parse(e.postData.contents);

  sheet.appendRow([
    data.name,
    data.email,
    data.phone,
    data.company,
    data.payment
  ]);

  return ContentService.createTextOutput("success");
}

5. Deploy as Web App
Anyone access

6. Replace
YOUR_GOOGLE_SCRIPT_URL
inside script.js

7. Upload project to Netlify

8. Generate QR code of the page URL
