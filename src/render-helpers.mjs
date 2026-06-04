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

export function createRecurringRow(item, { isPaidThisMonth, budgetGroups = [], onPay, onCancelPay, onToggleFav, onEdit, onDelete }) {
  const block = createEl('div', {
    className: `bg-white border border-slate-200 rounded-3xl p-4 shadow-sm flex flex-col space-y-3 ${isPaidThisMonth ? 'ring-1 ring-slate-100' : ''}`,
  });

  // Top row: Icon, Name, Desc, Amount
  const topRow = createEl('div', { className: 'flex items-center justify-between' });
  const leftWrap = createEl('div', { className: 'flex items-center space-x-3' });
  
  const colorWrap = createEl('div', {
    className: `w-10 h-10 flex items-center justify-center rounded-2xl ${item.color} shrink-0 shadow-sm`,
  });
  colorWrap.appendChild(createIcon(item.icon, 'w-5 h-5'));
  leftWrap.appendChild(colorWrap);

  const leftText = createEl('div');
  leftText.appendChild(createEl('h4', { className: 'font-extrabold text-slate-800 text-[14px] leading-tight', text: item.name }));
  
  const matchedG = (budgetGroups || []).find((g) => g.id.toString() === item.defaultBudgetGroupId?.toString());
  const budgetInfo = matchedG ? ` • งบ: ${matchedG.name}` : '';
  leftText.appendChild(createEl('p', { className: 'text-[10px] text-slate-400 mt-0.5 font-bold', text: `${item.desc}${budgetInfo}` }));
  leftWrap.appendChild(leftText);
  topRow.appendChild(leftWrap);

  const amountWrap = createEl('div', { className: 'text-right' });
  amountWrap.appendChild(createEl('div', {
    className: `font-extrabold text-lg ${isPaidThisMonth ? 'text-slate-500' : 'text-rose-600'}`,
    text: `฿${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  }));
  amountWrap.appendChild(createEl('div', {
    className: 'text-[9px] font-bold text-slate-400 mt-0.5',
    text: isPaidThisMonth ? 'จ่ายแล้วเดือนนี้' : 'ยอดตั้งต้น',
  }));
  topRow.appendChild(amountWrap);
  block.appendChild(topRow);

  // Bottom row: Actions
  const actionsRow = createEl('div', { className: 'flex items-center justify-between pt-3 border-t border-slate-100 mt-2' });
  
  const leftActions = createEl('div', { className: 'flex items-center space-x-2' });
  
  const starBtn = createEl('button', { className: 'p-2 rounded-full hover:bg-slate-50 cursor-pointer transition-transform active:scale-90' });
  starBtn.appendChild(createIcon('star', `w-4 h-4 ${item.fav ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`));
  starBtn.onclick = onToggleFav;
  leftActions.appendChild(starBtn);

  const editBtn = createEl('button', { className: 'p-2 rounded-full hover:bg-slate-50 text-slate-400 hover:text-indigo-600 cursor-pointer transition-transform active:scale-90' });
  editBtn.appendChild(createIcon('edit-2', 'w-4 h-4'));
  editBtn.onclick = onEdit;
  leftActions.appendChild(editBtn);

  const deleteBtn = createEl('button', { className: 'p-2 rounded-full hover:bg-slate-50 text-slate-400 hover:text-rose-500 cursor-pointer transition-transform active:scale-90' });
  deleteBtn.appendChild(createIcon('trash-2', 'w-4 h-4'));
  deleteBtn.onclick = onDelete;
  leftActions.appendChild(deleteBtn);
  
  actionsRow.appendChild(leftActions);

  const payBtn = createEl('button', {
    className: isPaidThisMonth
      ? 'bg-amber-50 text-amber-700 border border-amber-200 px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer hover:bg-amber-100'
      : 'bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:bg-emerald-700 flex items-center space-x-1.5 cursor-pointer',
  });
  payBtn.appendChild(createIcon(isPaidThisMonth ? 'rotate-ccw' : 'check-circle', 'w-4 h-4'));
  payBtn.appendChild(createEl('span', { text: isPaidThisMonth ? 'ยกเลิกจ่าย' : 'จ่ายบิล' }));
  payBtn.onclick = isPaidThisMonth ? onCancelPay : onPay;

  actionsRow.appendChild(payBtn);
  block.appendChild(actionsRow);

  return block;
}

export function createHistoryRow(data, { onEdit, onDelete }) {
  const block = createEl('div', { className: 'flex justify-between items-center p-3 bg-white rounded-xl border border-slate-200' });

  const left = createEl('div', { className: 'flex items-center space-x-2' });
  let iconBgClass = 'bg-rose-50 text-rose-600';
  if (data.type === 'income') iconBgClass = 'bg-emerald-50 text-emerald-600';
  else if (data.type === 'debt_payment') iconBgClass = 'bg-blue-50 text-blue-600';
  else if (data.type === 'debt_adjustment') iconBgClass = 'bg-slate-100 text-slate-600';

  const iconWrap = createEl('div', {
    className: `w-8 h-8 flex items-center justify-center rounded-lg ${iconBgClass}`,
  });
  iconWrap.appendChild(createIcon(data.categoryIcon, 'w-4 h-4'));

  const body = createEl('div', { className: 'overflow-hidden' });
  const header = createEl('div', { className: 'flex items-center space-x-1 flex-wrap gap-1' });
  header.appendChild(createEl('span', { className: 'font-bold text-slate-800 text-xs', text: data.categoryName }));
  header.appendChild(createEl('span', { className: 'bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[8px] font-bold', text: data.accountName || 'เงินสด' }));
  
  if (data.budgetGroupName) {
    header.appendChild(createEl('span', {
      className: 'bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded text-[8px] font-bold',
      text: data.budgetGroupName,
    }));
  }
  body.appendChild(header);

  if (data.barcodeNote) {
    body.appendChild(createEl('span', { className: 'text-[9px] text-indigo-500 block mt-0.5 truncate', text: data.barcodeNote }));
  }
  body.appendChild(createEl('span', { className: 'text-[8px] text-slate-400 block', text: data.date }));

  left.appendChild(iconWrap);
  left.appendChild(body);

  const right = createEl('div', { className: 'flex flex-col items-end space-y-1.5 shrink-0' });
  
  let amountClass = 'text-rose-600';
  let amountSign = '-';
  if (data.type === 'income') { amountClass = 'text-emerald-600'; amountSign = '+'; }
  else if (data.type === 'debt_payment') { amountClass = 'text-blue-600'; amountSign = ''; }
  else if (data.type === 'debt_adjustment') { amountClass = 'text-slate-600'; amountSign = ''; }

  right.appendChild(createEl('span', {
    className: `font-bold text-sm ${amountClass}`,
    text: `${amountSign}฿${data.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
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
