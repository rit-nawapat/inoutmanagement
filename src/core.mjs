const thaiMonths = {
  'ม.ค.': 0, 'ก.พ.': 1, 'มี.ค.': 2, 'เม.ย.': 3, 'พ.ค.': 4, 'มิ.ย.': 5,
  'ก.ค.': 6, 'ส.ค.': 7, 'ก.ย.': 8, 'ต.ค.': 9, 'พ.ย.': 10, 'ธ.ค.': 11,
  'มกราคม': 0, 'กุมภาพันธ์': 1, 'มีนาคม': 2, 'เมษายน': 3, 'พฤษภาคม': 4, 'มิถุนายน': 5,
  'กรกฎาคม': 6, 'สิงหาคม': 7, 'กันยายน': 8, 'ตุลาคม': 9, 'พฤศจิกายน': 10, 'ธันวาคม': 11,
};

const LEGACY_RECURRING_KEY = 'my_recurring_list';
const SAVED_PROFILES_KEY = 'my_saved_profiles';
const CURRENT_PROFILE_KEY = 'my_current_profile_id';

export function getHistoryStorageKey(profileId) {
  return `my_tx_history_${profileId}`;
}

export function getRecurringStorageKey(profileId) {
  return `my_recurring_list_${profileId}`;
}

function parseJsonArray(rawValue) {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadRecurringItems(storage, profileId) {
  const scopedKey = getRecurringStorageKey(profileId);
  const scopedItems = parseJsonArray(storage.getItem(scopedKey));
  if (scopedItems.length > 0) return scopedItems;

  const legacyItems = parseJsonArray(storage.getItem(LEGACY_RECURRING_KEY));
  if (legacyItems.length === 0) return [];

  storage.setItem(scopedKey, JSON.stringify(legacyItems));
  storage.removeItem(LEGACY_RECURRING_KEY);
  return legacyItems;
}

export function saveRecurringItems(storage, profileId, items) {
  storage.setItem(getRecurringStorageKey(profileId), JSON.stringify(items));
}

export function loadSavedProfiles(storage) {
  const rawValue = storage.getItem(SAVED_PROFILES_KEY);
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSavedProfiles(storage, profiles) {
  storage.setItem(SAVED_PROFILES_KEY, JSON.stringify(profiles));
}

export function loadCurrentProfileId(storage) {
  return storage.getItem(CURRENT_PROFILE_KEY) || null;
}

export function saveCurrentProfileId(storage, profileId) {
  if (profileId) {
    storage.setItem(CURRENT_PROFILE_KEY, profileId);
  } else {
    storage.removeItem(CURRENT_PROFILE_KEY);
  }
}

export function parseDateTimeFromOCR(ocrText) {
  const cleanText = ocrText.replace(/\s+/g, ' ');
  const thaiDateRegex = /(\d{1,2})\s*([\u0E00-\u0E7F\.]+)\s*(\d{2,4})\s*(?:-|เวลา)?\s*(\d{2}:\d{2})/;
  const thaiDateMatch = cleanText.match(thaiDateRegex);
  if (thaiDateMatch) {
    const day = parseInt(thaiDateMatch[1], 10);
    const monthStr = thaiDateMatch[2];
    let year = parseInt(thaiDateMatch[3], 10);
    const time = thaiDateMatch[4];

    if (year < 100) year += 2000;
    if (year > 2500) year -= 543;

    const monthIndex = thaiMonths[monthStr] ?? 0;
    const [hours, minutes] = time.split(':');
    const date = new Date(year, monthIndex, day, parseInt(hours, 10), parseInt(minutes, 10));
    if (!Number.isNaN(date.getTime())) {
      date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
      return date.toISOString().slice(0, 16);
    }
  }

  const engDateRegex = /(\d{2})[\/\.-](\d{2})[\/\.-](\d{4}|\d{2})\s+(\d{2}:\d{2})/;
  const engDateMatch = cleanText.match(engDateRegex);
  if (!engDateMatch) return null;

  const day = parseInt(engDateMatch[1], 10);
  const month = parseInt(engDateMatch[2], 10) - 1;
  let year = parseInt(engDateMatch[3], 10);
  const time = engDateMatch[4];
  if (year < 100) year += 2000;

  const [hours, minutes] = time.split(':');
  const date = new Date(year, month, day, parseInt(hours, 10), parseInt(minutes, 10));
  if (Number.isNaN(date.getTime())) return null;

  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function parseRefNoFromOCR(ocrText) {
  const cleanText = ocrText.replace(/\s+/g, ' ');
  const refRegex = /(?:เลขที่อ้างอิง|รหัสอ้างอิง|เลขที่รายการ|ref(?:\.?\s*no)?|trans(?:\.?\s*id)?|transaction\s*id)[\s\S]{0,15}?([A-Za-z0-9\-]{8,25})/i;
  const refMatch = cleanText.match(refRegex);
  return refMatch ? refMatch[1].trim() : null;
}

export function checkDuplicateSlipInHistory(history, refNo) {
  if (!refNo) return undefined;
  return history.find((tx) => tx.slipRefNo === refNo);
}

function tokenizeExpression(expression) {
  const compact = expression.replace(/\s+/g, '');
  if (!compact || /[^0-9+\-*/.]/.test(compact)) {
    throw new Error('Invalid expression');
  }

  const tokens = [];
  let index = 0;

  while (index < compact.length) {
    const char = compact[index];
    const prevToken = tokens[tokens.length - 1];
    const canBeUnaryMinus = char === '-' && (
      index === 0 || prevToken === '+' || prevToken === '-' || prevToken === '*' || prevToken === '/'
    );

    if (/\d|\./.test(char) || canBeUnaryMinus) {
      let value = canBeUnaryMinus ? '-' : '';
      if (canBeUnaryMinus) index += 1;

      let hasDigit = false;
      let hasDot = false;
      while (index < compact.length) {
        const current = compact[index];
        if (/\d/.test(current)) {
          hasDigit = true;
          value += current;
          index += 1;
          continue;
        }
        if (current === '.' && !hasDot) {
          hasDot = true;
          value += current;
          index += 1;
          continue;
        }
        break;
      }

      if (!hasDigit || value === '-' || value === '.' || value === '-.') {
        throw new Error('Invalid expression');
      }

      tokens.push(Number(value));
      continue;
    }

    if ('+-*/'.includes(char)) {
      tokens.push(char);
      index += 1;
      continue;
    }

    throw new Error('Invalid expression');
  }

  return tokens;
}

export function calculateExpression(expression) {
  const tokens = tokenizeExpression(expression);
  if (typeof tokens[0] !== 'number' || typeof tokens[tokens.length - 1] !== 'number') {
    throw new Error('Invalid expression');
  }

  const reduced = [];
  let index = 0;

  while (index < tokens.length) {
    const token = tokens[index];
    if (token === '*' || token === '/') {
      const prevValue = reduced.pop();
      const nextValue = tokens[index + 1];
      if (typeof prevValue !== 'number' || typeof nextValue !== 'number') {
        throw new Error('Invalid expression');
      }

      reduced.push(token === '*' ? prevValue * nextValue : prevValue / nextValue);
      index += 2;
      continue;
    }

    reduced.push(token);
    index += 1;
  }

  let result = reduced[0];
  if (typeof result !== 'number') throw new Error('Invalid expression');

  for (let i = 1; i < reduced.length; i += 2) {
    const operator = reduced[i];
    const value = reduced[i + 1];
    if (typeof value !== 'number' || !['+', '-'].includes(operator)) {
      throw new Error('Invalid expression');
    }
    result = operator === '+' ? result + value : result - value;
  }

  if (!Number.isFinite(result)) {
    throw new Error('Invalid expression');
  }

  return Number(result.toFixed(2)).toString();
}
