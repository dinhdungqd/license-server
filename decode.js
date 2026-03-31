// Decode các obfuscated string trong popup.js
const content = require('fs').readFileSync(require('path').join(__dirname,'..','popup.js'), 'utf8');
// Lấy phần string array + decoder function rồi eval
// Chỉ lấy đủ để decode
const chunk = content.substring(0, 8000);
try {
  // Chạy phần đầu để có hàm _0x4b00c2
  eval(chunk.split('const inputIdsToSave')[0]);
  console.log('0x750 =', _0x4b00c2(0x750)); // appLicenseStatus key
  console.log('0x7c9 =', _0x4b00c2(0x7c9)); // giá trị check
  console.log('0x3ae =', _0x4b00c2(0x3ae)); // FSvIa value
} catch(e) {
  console.log('eval error:', e.message);
}
