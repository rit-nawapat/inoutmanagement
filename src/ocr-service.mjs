import { checkDuplicateSlipInHistory, parseDateTimeFromOCR as parseDateTimeFromOCRCore, parseRefNoFromOCR as parseRefNoFromOCRCore } from './core.mjs';
import { guessCategoryFromText } from './catalog-service.mjs';

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
