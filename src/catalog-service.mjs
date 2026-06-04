import { createEl } from './dom-helpers.mjs';
import { createIcon } from './render-helpers.mjs';

export const categories = {
  spent: [
    { id: 'food', name: 'อาหาร', icon: 'utensils' },
    { id: 'beverage', name: 'เครื่องดื่ม', icon: 'coffee' },
    { id: 'grocery', name: 'ของใช้', icon: 'shopping-cart' },
    { id: 'transport', name: 'เดินทาง', icon: 'car' },
    { id: 'fuel', name: 'น้ำมัน', icon: 'fuel' },
    { id: 'electricity', name: 'ค่าไฟ', icon: 'zap' },
    { id: 'water', name: 'ค่าน้ำ', icon: 'droplets' },
    { id: 'internet', name: 'ค่าเน็ต', icon: 'wifi' },
    { id: 'bills', name: 'บิลอื่นๆ', icon: 'receipt' },
    { id: 'entertainment', name: 'บันเทิง', icon: 'clapperboard' },
    { id: 'travel', name: 'เที่ยว', icon: 'palmtree' },
    { id: 'other_exp', name: 'อื่นๆ', icon: 'help-circle' },
  ],
  income: [
    { id: 'salary', name: 'เงินเดือน', icon: 'briefcase' },
    { id: 'bonus', name: 'โบนัส', icon: 'gift' },
    { id: 'investment', name: 'ลงทุน', icon: 'trending-up' },
    { id: 'rider', name: 'ไรเดอร์', icon: 'bike' },
    { id: 'other_inc', name: 'อื่นๆ', icon: 'sparkles' },
  ],
};

export const accounts = [
  { id: 'cash', name: 'เงินสด', icon: 'banknote' },
  { id: 'credit', name: 'บัตรเครดิต', icon: 'credit-card' },
  { id: 'spaylater', name: 'SPayLater', icon: 'zap' },
  { id: 'qrscan', name: 'สแกนจ่าย', icon: 'scan' },
  { id: 'promptpay', name: 'พร้อมเพย์', icon: 'smartphone' },
];

const categoryMappings = [
  { categoryId: 'electricity', keywords: ['ไฟ', 'ค่าไฟ', 'electric', 'mea', 'pea'] },
  { categoryId: 'water', keywords: ['น้ำ', 'ค่าน้ำ', 'water', 'mwa', 'pwa'] },
  { categoryId: 'internet', keywords: ['เน็ต', 'อินเทอร์เน็ต', 'internet', 'wifi', 'ais', 'true', '3bb'] },
  { categoryId: 'fuel', keywords: ['น้ำมัน', 'ปตท', 'ptt', 'shell', 'bangchak', 'บางจาก', 'เชลล์', 'gas', 'fuel'] },
  { categoryId: 'rider', keywords: ['ไรเดอร์', 'rider', 'grab', 'lineman', 'foodpanda', 'shopeefood', 'lalamove', 'แกร็บ', 'ไลน์แมน'] },
  { categoryId: 'bills', keywords: ['โทรศัพท์', 'มือถือ', 'ส่วนกลาง', 'บ้าน', 'คอนโด', 'บัตร', 'ประกัน', 'งวด', 'เช่า', 'bill', 'phone', 'condo', 'card', 'insurance'] },
  { categoryId: 'transport', keywords: ['รถ', 'ทางด่วน', 'บีทีเอส', 'bts', 'mrt', 'แท็กซี่', 'taxi', 'car', 'toll'] },
  { categoryId: 'food', keywords: ['อาหาร', 'ข้าว', 'กิน', 'ชาบู', 'หมูกระทะ', 'บุฟเฟต์', 'food', 'shabu', 'buffet', 'lunch', 'dinner', 'kfc', 'mcdonald', 'ร้านอาหาร', 'ก๋วยเตี๋ยว', 'คาเฟ่', 'coffee', 'starbucks', 'ส้มตำ', 'ชาไข่มุก'] },
  { categoryId: 'beverage', keywords: ['กาแฟ', 'ชา', 'นม', 'น้ำดื่ม', 'เบียร์', 'เหล้า', 'coffee', 'tea', 'drink', 'beverage', 'beer'] },
  { categoryId: 'grocery', keywords: ['ของใช้', 'สบู่', 'ยาสีฟัน', 'แชมพู', 'ซื้อของ', 'ห้าง', 'โลตัส', 'เซเว่น', 'grocery', 'shopping', 'supermarket', '7-eleven', '7-11', 'lotus', 'bigc', 'big c', 'makro', 'tops', 'cj'] },
  { categoryId: 'entertainment', keywords: ['บันเทิง', 'หนัง', 'เน็ตฟลิกส์', 'netflix', 'youtube', 'disney', 'spotify', 'เกม', 'game', 'movie', 'sf', 'major'] },
  { categoryId: 'travel', keywords: ['เที่ยว', 'ตั๋ว', 'บิน', 'เครื่องบิน', 'โรงแรม', 'travel', 'hotel', 'flight', 'trip'] },
];

export function formatCurrencyInput(input) {
  const value = input.value.replace(/,/g, '');
  const number = parseFloat(value);
  if (Number.isNaN(number)) {
    input.value = '';
    return;
  }

  const parts = value.split('.');
  parts[0] = parseInt(parts[0] || 0, 10).toLocaleString('en-US');
  input.value = parts.join('.');
}

export function guessCategoryFromText(ocrText) {
  const text = ocrText.toLowerCase();
  for (const mapping of categoryMappings) {
    if (mapping.keywords.some((keyword) => text.includes(keyword))) {
      return mapping.categoryId;
    }
  }
  return null;
}

export function guessAccountForCategory(categoryId, txHistory = []) {
  const categoryObj = categories.spent.find((c) => c.id === categoryId) || categories.income.find((c) => c.id === categoryId);
  if (!categoryObj) return null;

  const matchingTx = txHistory.filter((tx) => tx.categoryName === categoryObj.name && tx.type === 'spent');

  if (matchingTx.length > 0) {
    const counts = {};
    matchingTx.forEach((tx) => {
      const acc = accounts.find((a) => a.name === tx.accountName);
      if (acc) {
        counts[acc.id] = (counts[acc.id] || 0) + 1;
      }
    });

    let bestAccountId = null;
    let maxCount = 0;
    for (const accId in counts) {
      if (counts[accId] > maxCount) {
        maxCount = counts[accId];
        bestAccountId = accId;
      }
    }
    if (bestAccountId) return bestAccountId;
  }

  if (categoryId === 'food' || categoryId === 'beverage') return 'qrscan';
  if (categoryId === 'bills') return 'promptpay';
  if (categoryId === 'grocery' || categoryId === 'travel' || categoryId === 'entertainment') return 'credit';
  return null;
}

export function renderCategories({
  currentType,
  selectedCategory,
  selectedAccount,
  txHistory,
  onSelectCategory,
  onSelectAccount,
  onGuessAccount,
  onAccountGuessed,
  doc = globalThis.document,
  lucide = globalThis.lucide,
} = {}) {
  const grid = doc.getElementById('category-grid');
  if (!grid) return;

  grid.replaceChildren();
  categories[currentType].forEach((cat) => {
    const isSelected = cat.id === selectedCategory;
    const item = createEl('div', { className: 'flex-shrink-0 flex flex-col items-center cursor-pointer snap-start min-w-[50px]' });
    item.onclick = () => {
      onSelectCategory?.(cat.id);
      if (currentType === 'spent') {
        const guessedAccId = onGuessAccount?.(cat.id, txHistory);
        if (guessedAccId && guessedAccId !== selectedAccount) {
          onSelectAccount?.(guessedAccId);
          onAccountGuessed?.(guessedAccId);
        }
      }
    };

    const iconWrap = createEl('div', {
      className: `w-10 h-10 flex items-center justify-center rounded-xl border ${isSelected ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-500'}`,
    });
    iconWrap.appendChild(createIcon(cat.icon, 'w-4 h-4'));
    item.appendChild(iconWrap);
    item.appendChild(createEl('span', {
      className: `text-[9px] font-bold mt-1 ${isSelected ? 'text-indigo-600' : 'text-slate-500'}`,
      text: cat.name,
    }));
    grid.appendChild(item);
  });

  lucide?.createIcons?.();
}

export function renderAccounts({
  selectedAccount,
  accountTab = 'money',
  onSelectAccount,
  doc = globalThis.document,
  lucide = globalThis.lucide,
} = {}) {
  const grid = doc.getElementById('account-grid');
  if (!grid) return;

  grid.replaceChildren();

  const DEBT_IDS = ['credit', 'spaylater'];
  const filteredAccounts = accounts.filter(acc => accountTab === 'debt' ? DEBT_IDS.includes(acc.id) : !DEBT_IDS.includes(acc.id));

  filteredAccounts.forEach((acc) => {
    const isSelected = acc.id === selectedAccount;
    const item = createEl('div', { className: 'flex-shrink-0 snap-start' });
    item.onclick = () => onSelectAccount?.(acc.id);
    const pill = createEl('div', {
      className: `flex items-center space-x-1 py-1.5 px-3 rounded-lg text-[9px] font-bold border ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-500'}`,
    });
    pill.appendChild(createIcon(acc.icon, 'w-3 h-3'));
    pill.appendChild(createEl('span', { text: acc.name }));
    item.appendChild(pill);
    grid.appendChild(item);
  });

  lucide?.createIcons?.();
}
