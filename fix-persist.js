/**
 * Fix: license luôn được giữ sau khi reload
 * Thay initLicense để chỉ cần có appLicenseKey là unlock PRO
 */
const fs = require('fs');
const path = require('path');
const popupPath = path.join(__dirname, '..', 'popup.js');
let content = fs.readFileSync(popupPath, 'utf8');

// ── PATCH: Thay toàn bộ hàm initLicense ──────────────────────
const funcName = 'async function initLicense()';
const start = content.indexOf(funcName);
if (start === -1) { console.log('ERROR: không tìm thấy initLicense'); process.exit(1); }

// Tìm closing brace
let depth = 0, i = start, end = -1;
while (i < content.length) {
  if (content[i] === '{') depth++;
  else if (content[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  i++;
}

const newInitLicense = `async function initLicense(){
  globalDeviceId = await getDeviceId();
  if(infoDeviceId) infoDeviceId.textContent = globalDeviceId;

  chrome.storage.local.get(['appLicenseKey','appLicenseStatus','appLicenseTier','appLicenseExpiry'], function(data){
    const hasKey = data.appLicenseKey && data.appLicenseKey.length > 0;
    const status = data.appLicenseStatus;
    const isPro = hasKey && (status === 'active' || status === 'success');

    if(isPro){
      isPremiumUser = true;
      if(typeof renderLicenseUI === 'function') renderLicenseUI('premium', data);
    } else {
      isPremiumUser = false;
      if(typeof renderLicenseUI === 'function') renderLicenseUI('free', null);
    }

    if(typeof loadPresets === 'function') loadPresets();
    if(typeof loadPromptLibrary === 'function') loadPromptLibrary();
    if(typeof applySystemSettings === 'function') applySystemSettings();
    if(typeof loadGallery === 'function') loadGallery();
  });
}`;

content = content.substring(0, start) + newInitLicense + content.substring(end);
console.log('✅ PATCH initLicense OK');

// ── Đảm bảo silentVerifyKey không làm gì ──────────────────────
const svIdx = content.indexOf('async function silentVerifyKey(');
if (svIdx !== -1) {
  let d2 = 0, j = svIdx, svEnd = -1;
  while (j < content.length) {
    if (content[j] === '{') d2++;
    else if (content[j] === '}') { d2--; if (d2 === 0) { svEnd = j + 1; break; } }
    j++;
  }
  content = content.substring(0, svIdx)
    + `async function silentVerifyKey(_k){ /* bypassed */ }`
    + content.substring(svEnd);
  console.log('✅ silentVerifyKey bypassed');
}

// ── isPremiumUser = false ban đầu (initLicense sẽ set đúng) ───
content = content.replace('let isPremiumUser=!![],', 'let isPremiumUser=![],');

fs.writeFileSync(popupPath, content, 'utf8');
console.log('\n🎉 XONG! Reload extension - license sẽ được giữ vĩnh viễn sau khi nhập key.');
