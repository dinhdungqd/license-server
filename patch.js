// Script patch popup.js - chỉ bypass token check, vẫn gọi server thật
const fs = require('fs');
const path = require('path');

const popupPath = path.join(__dirname, '..', 'popup.js');
let content = fs.readFileSync(popupPath, 'utf8');

// ---- PATCH 1: Bỏ check token (dXxyZ) - vẫn gọi server, chỉ bỏ anti-tamper ----
const old1 = "if(false)throw new Error(";
const new1 = "if(false&&false)throw new Error(";
if (content.includes(old1)) {
  content = content.replace(old1, new1);
  console.log('PATCH 1 OK: token check đã bỏ');
} else {
  console.log('PATCH 1: đã patch trước đó, bỏ qua');
}

// ---- PATCH 2: Bypass silentVerifyKey (gọi server khi load - không cần) ----
const svStart = content.indexOf('async function silentVerifyKey(');
if (svStart !== -1 && !content.includes('/* bypassed */')) {
  let d2 = 0, j = svStart, svEnd = -1;
  while (j < content.length) {
    if (content[j] === '{') d2++;
    else if (content[j] === '}') { d2--; if (d2 === 0) { svEnd = j + 1; break; } }
    j++;
  }
  content = content.substring(0, svStart) + `async function silentVerifyKey(_k){ /* bypassed */ }` + content.substring(svEnd);
  console.log('PATCH 2 OK: silentVerifyKey đã bypass');
}

// ---- PATCH 3: isPremiumUser đọc từ storage (KHÔNG set mặc định true) ----
// Đảm bảo isPremiumUser=false ban đầu - extension tự set khi initLicense đọc storage
content = content.replace('let isPremiumUser=!![],', 'let isPremiumUser=![],');
console.log('PATCH 3 OK: isPremiumUser = false (đọc từ storage)');

// ---- PATCH 4: Restore hàm _0x5025ef về gọi server thật ----
// Xóa bypass cũ nếu có
const bypassStart = content.indexOf('async function _0x5025ef(_0x5e0e5c=false){');
if (bypassStart !== -1) {
  let d3 = 0, k = bypassStart, bypassEnd = -1;
  while (k < content.length) {
    if (content[k] === '{') d3++;
    else if (content[k] === '}') { d3--; if (d3 === 0) { bypassEnd = k + 1; break; } }
    k++;
  }
  // Không xóa - giữ nguyên vì đây là hàm verify gọi server
  console.log('PATCH 4: hàm verify hiện tại đang gọi server tại', content.substring(bypassStart, bypassStart+60));
}

fs.writeFileSync(popupPath, content, 'utf8');
console.log('\nPATCH XONG!');
