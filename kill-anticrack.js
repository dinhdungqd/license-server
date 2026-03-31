const fs = require('fs');
const path = require('path');
const bgPath = path.join(__dirname, '..', 'background.js');
let content = fs.readFileSync(bgPath, 'utf8');

function replaceFunc(src, funcName, replacement) {
  const idx = src.indexOf(funcName);
  if (idx === -1) { console.log('NOT FOUND:', funcName); return src; }
  let depth = 0, i = idx, end = -1;
  while (i < src.length) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
    i++;
  }
  console.log(`✅ Replaced: ${funcName} (${end - idx} chars)`);
  return src.substring(0, idx) + replacement + src.substring(end);
}

// 1. Vô hiệu hóa killFakeLicense - không xóa storage nữa
content = replaceFunc(content,
  'function killFakeLicense(',
  'function killFakeLicense(_r){ console.log("anticrack disabled"); }'
);

// 2. Vô hiệu hóa verifyLicenseWithServer
content = replaceFunc(content,
  'function verifyLicenseWithServer(',
  'function verifyLicenseWithServer(_k,_d){ /* disabled */ }'
);

// 3. Xóa toàn bộ storage.onChanged listener chứa antiCrack
// Tìm đoạn chrome.storage.onChanged.addListener có chứa killFakeLicense
const onChangedIdx = content.indexOf("chrome[_0x3a3596(0xe3)][_0x3a3596(0x112)][_0x3a3596(0x138)]");
if (onChangedIdx !== -1) {
  let depth = 0, i = onChangedIdx, end = -1;
  // Tìm opening brace của callback
  while (i < content.length && content[i] !== '{') i++;
  const braceStart = i;
  while (i < content.length) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
    i++;
  }
  // Chỉ xóa nếu đoạn này chứa killFakeLicense
  const chunk = content.substring(onChangedIdx, end);
  if (chunk.includes('killFakeLicense')) {
    content = content.substring(0, onChangedIdx)
      + "chrome.storage.onChanged.addListener(function(){})" // noop
      + content.substring(end);
    console.log('✅ storage.onChanged anticrack listener removed');
  }
}

// 4. Xóa alarm antiCrackScanner - thay bằng noop
content = content.replace(
  "'antiCrackScanner',{'periodInMinutes':0x5}",
  "'antiCrackScanner_disabled',{'periodInMinutes':99999}"
);
console.log('✅ antiCrackScanner alarm disabled');

// 5. Xóa alarm handler antiCrackScanner
const alarmHandlerIdx = content.indexOf("_0xca62ef['Cyjtt']&&chrome['storage']");
if (alarmHandlerIdx !== -1) {
  // Thay bằng noop
  const endSemi = content.indexOf(';', alarmHandlerIdx + 200);
  if (endSemi !== -1) {
    content = content.substring(0, alarmHandlerIdx)
      + "false&&chrome['storage']"
      + content.substring(alarmHandlerIdx + "_0xca62ef['Cyjtt']&&chrome['storage']".length);
    console.log('✅ alarm handler disabled');
  }
}

fs.writeFileSync(bgPath, content, 'utf8');
console.log('\n🎉 XONG! Reload extension - license sẽ được giữ vĩnh viễn.');
