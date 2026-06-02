import { createEl, sanitizeIconName, setText } from './dom-helpers.mjs';

export function createIcon(iconName, className) {
  return createEl('i', {
    className,
    attrs: { 'data-lucide': sanitizeIconName(iconName) },
  });
}

export function createOption(value, label, selected = false) {
  const option = createEl('option', { text: label });
  option.value = value;
  if (selected) option.selected = true;
  return option;
}

export function createRecurringRow(item, { isPaidThisMonth, onPay, onToggleFav, onEdit, onDelete }) {
  const block = createEl('div', {
    className: `flex flex-col md:grid md:grid-cols-12 md:items-center justify-between p-3 md:px-6 md:py-2 border-b border-slate-100 gap-2 ${isPaidThisMonth ? 'bg-slate-50 opacity-80' : 'bg-white'}`,
  });

  const left = createEl('div', { className: 'flex items-center space-x-2 md:col-span-3' });
  const colorWrap = createEl('div', {
    className: `w-8 h-8 flex items-center justify-center rounded-full ${item.color} shrink-0`,
  });
  colorWrap.appendChild(createIcon(item.icon, 'w-4 h-4'));

  const leftText = createEl('div');
  leftText.appendChild(createEl('h4', { className: 'font-bold text-slate-800 text-xs leading-tight', text: item.name }));
  leftText.appendChild(createEl('p', { className: 'text-[9px] text-slate-400 mt-0.5', text: item.desc }));

  left.appendChild(colorWrap);
  left.appendChild(leftText);

  const hiddenDesktopDesc = createEl('div', { className: 'hidden md:block text-[10px] font-medium text-slate-500 col-span-2 text-center', text: item.desc });

  const middle = createEl('div', { className: 'flex items-center justify-between md:contents' });
  const amount = createEl('div', {
    className: `font-bold ${isPaidThisMonth ? 'text-slate-500' : 'text-rose-600'} text-xs md:col-span-2 md:text-right w-20 md:w-auto`,
    text: `${item.amount.toLocaleString()} ฿`,
  });
  const category = createEl('div', { className: 'hidden md:flex justify-center col-span-2' });
  category.appendChild(createEl('span', {
    className: 'bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[9px] font-bold',
    text: item.category,
  }));

  const status = createEl('div', { className: 'hidden md:flex justify-center col-span-1' });
  status.appendChild(createEl('span', {
    className: isPaidThisMonth
      ? 'bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[9px] font-bold'
      : 'bg-amber-50 text-amber-600 px-2 py-0.5 rounded text-[9px] font-bold',
    text: isPaidThisMonth ? 'จ่ายแล้ว' : 'ยังไม่จ่าย',
  }));

  const actions = createEl('div', { className: 'flex items-center space-x-1.5 md:col-span-2 md:justify-end' });
  const payBtn = createEl('button', {
    className: isPaidThisMonth
      ? 'bg-slate-100 text-slate-400 px-2.5 py-1.5 rounded-lg text-[9px] font-bold shadow-none flex items-center gap-1 cursor-not-allowed mr-1'
      : 'bg-emerald-50 text-emerald-600 px-2.5 py-1.5 rounded-lg text-[9px] font-bold shadow-sm hover:bg-emerald-100 flex items-center gap-1 cursor-pointer mr-1',
  });
  payBtn.disabled = isPaidThisMonth;
  payBtn.appendChild(createIcon('check-circle', 'w-3 h-3'));
  payBtn.appendChild(document.createTextNode(isPaidThisMonth ? ' จ่ายแล้ว' : ' จ่าย'));
  if (!isPaidThisMonth) payBtn.onclick = onPay;

  const starBtn = createEl('button', { className: 'cursor-pointer active:scale-90 transition-transform' });
  starBtn.appendChild(createIcon('star', `w-3.5 h-3.5 ${item.fav ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`));
  starBtn.onclick = onToggleFav;

  const editBtn = createEl('button', { className: 'text-slate-400 hover:text-indigo-600' });
  editBtn.appendChild(createIcon('edit-2', 'w-3.5 h-3.5'));
  editBtn.onclick = onEdit;

  const deleteBtn = createEl('button', { className: 'text-slate-400 hover:text-rose-500' });
  deleteBtn.appendChild(createIcon('trash-2', 'w-3.5 h-3.5'));
  deleteBtn.onclick = onDelete;

  actions.appendChild(payBtn);
  actions.appendChild(starBtn);
  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  middle.appendChild(amount);
  middle.appendChild(category);
  middle.appendChild(status);
  middle.appendChild(actions);

  block.appendChild(left);
  block.appendChild(hiddenDesktopDesc);
  block.appendChild(middle);
  return block;
}

export function createHistoryRow(data, { onEdit, onDelete }) {
  const block = createEl('div', { className: 'flex justify-between items-center p-3 bg-white rounded-xl border border-slate-200' });

  const left = createEl('div', { className: 'flex items-center space-x-2' });
  const iconWrap = createEl('div', {
    className: `w-8 h-8 flex items-center justify-center rounded-lg ${data.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`,
  });
  iconWrap.appendChild(createIcon(data.categoryIcon, 'w-4 h-4'));

  const body = createEl('div', { className: 'overflow-hidden' });
  const header = createEl('div', { className: 'flex items-center space-x-1 flex-wrap' });
  header.appendChild(createEl('span', { className: 'font-bold text-slate-800 text-xs', text: data.categoryName }));
  header.appendChild(createEl('span', { className: 'bg-slate-100 text-slate-500 px-1 py-0.5 rounded text-[8px] font-bold', text: data.accountName || 'เงินสด' }));
  body.appendChild(header);

  if (data.barcodeNote) {
    body.appendChild(createEl('span', { className: 'text-[9px] text-indigo-500 block mt-0.5 truncate', text: data.barcodeNote }));
  }
  body.appendChild(createEl('span', { className: 'text-[8px] text-slate-400 block', text: data.date }));

  left.appendChild(iconWrap);
  left.appendChild(body);

  const right = createEl('div', { className: 'flex flex-col items-end space-y-1.5 shrink-0' });
  right.appendChild(createEl('span', {
    className: `font-bold text-sm ${data.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`,
    text: `${data.type === 'income' ? '+' : '-'}฿${data.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
  }));

  const actions = createEl('div', { className: 'flex space-x-1' });
  const editBtn = createEl('button', { className: 'p-1 bg-slate-100 text-slate-500 rounded' });
  editBtn.appendChild(createIcon('edit-2', 'w-3 h-3'));
  editBtn.onclick = onEdit;

  const deleteBtn = createEl('button', { className: 'p-1 bg-slate-100 text-rose-500 rounded' });
  deleteBtn.appendChild(createIcon('trash-2', 'w-3 h-3'));
  deleteBtn.onclick = onDelete;

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);
  right.appendChild(actions);

  block.appendChild(left);
  block.appendChild(right);
  return block;
}
