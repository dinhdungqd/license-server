/**
 * Restore popup.js - thay hàm bypass cũ bằng hàm gọi server thật
 * Chỉ giữ lại: bỏ anti-tamper token check + bypass silentVerifyKey
 */
const fs = require('fs');
const path = require('path');

const popupPath = path.join(__dirname, '..', 'popup.js');
let content = fs.readFileSync(popupPath, 'utf8');

// ── BƯỚC 1: Thay hàm bypass cũ bằng hàm gọi server thật ──────
const bypassStart = content.indexOf('async function _0x5025ef(_0x5e0e5c=false){');
if (bypassStart !== -1) {
  let d = 0, i = bypassStart, end = -1;
  while (i < content.length) {
    if (content[i] === '{') d++;
    else if (content[i] === '}') { d--; if (d === 0) { end = i + 1; break; } }
    i++;
  }

  // Hàm verify thật - gọi server, nhưng bỏ anti-tamper check token
  const realVerify = `async function _0x5025ef(_0x5e0e5c=false){
  const _0x417604 = _0x2fe1c2;
  const _0x305fb9 = btnVerifyLicense ? btnVerifyLicense.innerHTML : '';
  if(btnVerifyLicense){ btnVerifyLicense.innerHTML = _0x5e0e5c ? 'Đang kiểm tra...' : 'Đang kích hoạt...'; btnVerifyLicense.disabled = true; }
  const _0x1d1600 = licenseKeyInput ? licenseKeyInput.value.trim() : '';
  if(!_0x1d1600){ if(typeof AppModal!=='undefined') AppModal.alert('Vui lòng nhập mã bản quyền!'); if(btnVerifyLicense){btnVerifyLicense.innerHTML=_0x305fb9;btnVerifyLicense.disabled=false;} return; }
  try {
    const _0x547495 = await fetch(API_SERVER_URL+'/'+EXTENSION_SLUG+'/verify', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({license_key: _0x1d1600, device_id: globalDeviceId, force_kick: _0x5e0e5c})
    });
    const _0x23f082 = await _0x547495.json();
    if(_0x547495.ok && _0x23f082.status === 'success'){
      chrome.storage.local.set({
        appLicenseKey: _0x1d1600,
        appLicenseStatus: 'active',
        appLicenseExpiry: _0x23f082.expires_at || null,
        appLicenseTier: _0x23f082.tier || 'pro',
        appVerifyToken: _0x23f082.token || ''
      }, () => {
        isPremiumUser = true;
        if(typeof renderLicenseUI==='function') renderLicenseUI('premium', {appLicenseKey:_0x1d1600, appLicenseTier:_0x23f082.tier||'pro', appLicenseExpiry:_0x23f082.expires_at, appLicenseStatus:'active'});
        if(typeof AppModal!=='undefined') AppModal.alert('\\u2705 K\\u00edch ho\\u1ea1t th\\u00e0nh c\\u00f4ng! Ch\\u00e0o m\\u1eebng b\\u1ea1n d\\u00f9ng g\\u00f3i ' + (_0x23f082.tier||'PRO').toUpperCase() + '!');
      });
    } else if(_0x23f082.status === 'limit_reached'){
      if(typeof AppModal!=='undefined'){
        const kick = await AppModal.confirm('\\u26a0\\ufe0f Key đang dùng trên thiết bị khác. Bạn có muốn chuyển sang thiết bị này không?');
        if(kick) _0x5025ef(true);
      }
    } else {
      if(typeof AppModal!=='undefined') AppModal.alert('\\u274c ' + (_0x23f082.message || 'Key không hợp lệ!'));
    }
  } catch(e) {
    if(typeof AppModal!=='undefined') AppModal.alert('\\u274c Không thể kết nối server. Vui lòng thử lại!');
    console.error('Verify error:', e);
  } finally {
    if(btnVerifyLicense){ btnVerifyLicense.innerHTML = _0x305fb9 || 'Kích hoạt'; btnVerifyLicense.disabled = false; }
  }
}`;

  content = content.substring(0, bypassStart) + realVerify + content.substring(end);
  console.log('✅ BƯỚC 1: Restore hàm verify gọi server thật');
} else {
  console.log('ℹ️  BƯỚC 1: Không tìm thấy hàm bypass cũ, bỏ qua');
}

// ── BƯỚC 2: Bypass silentVerifyKey (không cần verify lại khi load) ──
const svStart = content.indexOf('async function silentVerifyKey(');
if (svStart !== -1 && !content.includes('/* bypassed */')) {
  let d2 = 0, j = svStart, svEnd = -1;
  while (j < content.length) {
    if (content[j] === '{') d2++;
    else if (content[j] === '}') { d2--; if (d2 === 0) { svEnd = j + 1; break; } }
    j++;
  }
  content = content.substring(0, svStart) + `async function silentVerifyKey(_k){ /* bypassed - server offline ok */ }` + content.substring(svEnd);
  console.log('✅ BƯỚC 2: silentVerifyKey bypassed');
} else {
  console.log('ℹ️  BƯỚC 2: silentVerifyKey đã bypass trước đó');
}

// ── BƯỚC 3: Đảm bảo isPremiumUser = false ban đầu ──
content = content.replace('let isPremiumUser=!![],', 'let isPremiumUser=![],');
console.log('✅ BƯỚC 3: isPremiumUser = false (đọc từ storage khi load)');

fs.writeFileSync(popupPath, content, 'utf8');
console.log('\n🎉 XONG! Reload extension. Chỉ key do bạn tạo mới kích hoạt được.');
