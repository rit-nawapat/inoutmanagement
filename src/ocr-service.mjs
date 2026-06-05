import { checkDuplicateSlipInHistory, parseDateTimeFromOCR as parseDateTimeFromOCRCore, parseRefNoFromOCR as parseRefNoFromOCRCore } from './core.mjs';
import { guessCategoryFromText } from './catalog-service.mjs';
import { createIcon } from './render-helpers.mjs';

let ctx = {};

export function initOcrUi(context) {
  ctx = {
    createIcon,
    ...context
  };
}

function extractDetectedAmount(text) {
  let detectedAmount = 0;
  const normalized = text.replace(/ /g, '');
  const moneyRegex = /(?:จำนวนเงิน|ยอดโอน|บาท|amt|amount)[\s\S]{0,15}?([0-9,]+\.[0-9]{2})/i;
  const match = normalized.match(moneyRegex);
  if (match && match[1]) {
    detectedAmount = parseFloat(match[1].replace(/,/g, ''));
  } else {
    const genericAmountRegex = /\b([0-9,]+\.[0-9]{2})\b/g;
    const allAmounts = [];
    let amountMatch;
    while ((amountMatch = genericAmountRegex.exec(normalized)) !== null) {
      const value = parseFloat(amountMatch[1].replace(/,/g, ''));
      if (!Number.isNaN(value) && value > 0) allAmounts.push(value);
    }
    if (allAmounts.length > 0) detectedAmount = Math.max(...allAmounts);
  }
  return detectedAmount;
}

export function analyzeSlipText(text, txHistory = []) {
  const detectedAmount = extractDetectedAmount(text);
  const parsedDate = parseDateTimeFromOCRCore(text);
  const refNo = parseRefNoFromOCRCore(text);
  const guessedCategoryId = guessCategoryFromText(text);
  const duplicateTx = refNo ? checkDuplicateSlipInHistory(txHistory, refNo) || null : null;

  return {
    detectedAmount,
    parsedDate,
    refNo,
    guessedCategoryId,
    duplicateTx,
  };
}

export function processSlipOCR(fileInput, doc = globalThis.document, win = globalThis.window) {
  const file = fileInput.files[0];
  if (!file) return;
  ctx.showToast('กำลังแกะข้อมูลจากสลิป...', 'success');

  // Use win.Tesseract or fallback
  const tesseract = win.Tesseract || globalThis.Tesseract;
  if (!tesseract) {
      ctx.showToast('ระบบแกะภาพไม่พร้อมใช้งาน', 'error');
      fileInput.value = "";
      return;
  }

  tesseract.recognize(file, 'tha+eng').then(({ data: { text } }) => {
      const {
          detectedAmount,
          parsedDate,
          refNo,
          guessedCategoryId,
          duplicateTx,
      } = analyzeSlipText(text, ctx.appState.txHistory);

      if (detectedAmount > 0) {
          ctx.playScanSuccessSound();
          ctx.uiState.expression = detectedAmount.toString();
          
          const display = doc.getElementById('display');
          const displayInput = doc.getElementById('display-input');
          if (display) display.innerText = ctx.uiState.expression;
          if (displayInput) displayInput.value = ctx.uiState.expression;

          if (parsedDate) {
              const dateInput = doc.getElementById('tx-date');
              if (dateInput) {
                  dateInput.value = parsedDate;
                  dateInput.dispatchEvent(new Event('change', { bubbles: true }));
              }
              ctx.showToast('ปรับปรุงวันที่และเวลาตามสลิป', 'success');
          }

          ctx.uiState.currentSlipRefNo = refNo || "";
          if (refNo) {
              if (duplicateTx) {
                  ctx.showToast(`⚠️ สลิปซ้ำ! เคยบันทึกแล้วเมื่อ ${duplicateTx.date} ยอด ฿${duplicateTx.amount}`, 'error');
              } else {
                  ctx.showToast(`เลขอ้างอิงสลิป: ${refNo}`, 'success');
              }
          }

          if (guessedCategoryId) {
              ctx.uiState.selectedCategory = guessedCategoryId;
              ctx.renderCategories();
          }

          ctx.uiState.selectedAccount = 'qrscan';
          ctx.renderAccounts();

          ctx.uiState.currentScannedBarcode = refNo ? `สลิปโอนเงิน (Ref: ${refNo})` : "สลิปโอนเงิน (OCR)";
          showScannedNote('file-text', `฿${detectedAmount} ${refNo ? `[${refNo.slice(-6)}]` : ''}`.trim(), doc, win.lucide);

          ctx.showToast(`สแกนสลิปสำเร็จ ยอด ฿${detectedAmount}`, 'success');
      } else {
          ctx.showToast('ไม่พบยอดเงิน กรุณาพิมพ์ระบุเอง', 'error');
      }
  }).catch(err => {
      console.error("OCR Error:", err);
      ctx.showToast('สแกนไม่สำเร็จ หรือรูปภาพไม่ชัดเจน', 'error');
  }).finally(() => {
      fileInput.value = "";
  });
}

export function showScannedNote(iconName, message, doc = globalThis.document, lucide = globalThis.lucide) {
  const noteEl = doc.getElementById('scanned-note');
  if (!noteEl) return;

  noteEl.replaceChildren();
  noteEl.appendChild(ctx.createIcon(iconName, 'w-3 h-3 inline-block'));
  noteEl.appendChild(doc.createTextNode(` ${message}`));
  noteEl.classList.remove('hidden');
  lucide?.createIcons?.();
}

export function autoSelectCategoryByName(name, doc = globalThis.document) {
  if (!name) return;
  name = name.toLowerCase().trim();

  // 1. Try to find in history
  const historyMatch = ctx.appState.txHistory.find(tx => {
      const txDesc = (tx.desc || tx.barcodeNote || '').toLowerCase();
      return txDesc.includes(name) || name.includes(txDesc);
  });

  if (historyMatch) {
      const catList = ctx.categories.spent || [];
      const matchedCat = catList.find(c => c.name === historyMatch.categoryName);
      if (matchedCat) {
          const selectEl = doc.getElementById('req-category');
          if (selectEl) { selectEl.value = matchedCat.id; }
          
          const matchedAcc = ctx.accounts.find(a => a.name === historyMatch.accountName);
          if (matchedAcc) {
              const accSelect = doc.getElementById('req-account');
              if (accSelect) { accSelect.value = matchedAcc.id; }
          }
          return;
      }
  }

  // 2. Fallback to keyword mapping
  const mappings = [
      { categoryId: 'bills', keywords: ['ไฟ', 'น้ำ', 'เน็ต', 'อินเทอร์เน็ต', 'โทรศัพท์', 'มือถือ', 'ส่วนกลาง', 'บ้าน', 'คอนโด', 'บัตร', 'ประกัน', 'งวด', 'เช่า', 'bill', 'electric', 'water', 'internet', 'wifi', 'phone', 'condo', 'card', 'insurance'] },
      { categoryId: 'transport', keywords: ['รถ', 'น้ำมัน', 'ทางด่วน', 'บีทีเอส', 'bts', 'mrt', 'แท็กซี่', 'taxi', 'car', 'gas', 'fuel', 'toll'] },
      { categoryId: 'food', keywords: ['อาหาร', 'ข้าว', 'กิน', 'ชาบู', 'หมูกระทะ', 'บุฟเฟต์', 'food', 'shabu', 'buffet', 'lunch', 'dinner'] },
      { categoryId: 'beverage', keywords: ['กาแฟ', 'ชา', 'นม', 'น้ำดื่ม', 'เบียร์', 'เหล้า', 'คาเฟ่', 'coffee', 'tea', 'milk', 'drink', 'beverage', 'beer', 'cafe'] },
      { categoryId: 'grocery', keywords: ['ของใช้', 'สบู่', 'ยาสีฟัน', 'แชมพู', 'ซื้อของ', 'ห้าง', 'โลตัส', 'เซเว่น', 'grocery', 'shopping', 'supermarket'] },
      { categoryId: 'entertainment', keywords: ['บันเทิง', 'หนัง', 'เน็ตฟลิกส์', 'netflix', 'youtube', 'disney', 'spotify', 'เกม', 'game', 'movie'] },
      { categoryId: 'travel', keywords: ['เที่ยว', 'ตั๋ว', 'บิน', 'เครื่องบิน', 'โรงแรม', 'travel', 'hotel', 'flight', 'trip'] }
  ];

  for (const mapping of mappings) {
      const matched = mapping.keywords.some(keyword => name.includes(keyword));
      if (matched) {
          const selectEl = doc.getElementById('req-category');
          if (selectEl) { selectEl.value = mapping.categoryId; }
          break;
      }
  }
}
