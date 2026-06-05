import { createEl } from './dom-helpers.mjs';
import { createIcon } from './render-helpers.mjs';

export const colorClasses = {
  indigo: { bg: 'bg-indigo-50 border-indigo-100 text-indigo-700', border: 'border-indigo-200', text: 'text-indigo-700', fill: 'bg-indigo-600 hover:bg-indigo-700' },
  orange: { bg: 'bg-orange-50 border-orange-100 text-orange-700', border: 'border-orange-200', text: 'text-orange-700', fill: 'bg-orange-600 hover:bg-orange-700' },
  emerald: { bg: 'bg-emerald-50 border-emerald-100 text-emerald-700', border: 'border-emerald-200', text: 'text-emerald-700', fill: 'bg-emerald-600 hover:bg-emerald-700' },
  blue: { bg: 'bg-blue-50 border-blue-100 text-blue-700', border: 'border-blue-200', text: 'text-blue-700', fill: 'bg-blue-600 hover:bg-blue-700' },
  rose: { bg: 'bg-rose-50 border-rose-100 text-rose-700', border: 'border-rose-200', text: 'text-rose-700', fill: 'bg-rose-600 hover:bg-rose-700' },
  amber: { bg: 'bg-amber-50 border-amber-100 text-amber-700', border: 'border-amber-200', text: 'text-amber-700', fill: 'bg-amber-600 hover:bg-amber-700' },
  purple: { bg: 'bg-purple-50 border-purple-100 text-purple-700', border: 'border-purple-200', text: 'text-purple-700', fill: 'bg-purple-600 hover:bg-purple-700' },
  teal: { bg: 'bg-teal-50 border-teal-100 text-teal-700', border: 'border-teal-200', text: 'text-teal-700', fill: 'bg-teal-600 hover:bg-teal-700' },
};

let ctx = {};
let currentEditingBudgetGroup = null;
let pendingPayRecurringItemCallback = null;

export function initBudgetUi(context) {
  ctx = context;
}

export function getColorClasses(colorName) {
  const name = colorName?.replace('bg-', '')?.split('-')?.[0] || 'indigo';
  return colorClasses[name] || colorClasses.indigo;
}

export function calculateRemainingBalances(groups, txHistory) {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  groups.forEach((g) => {
    g.remaining = g.budget;
    g.spent = 0;
  });

  txHistory.forEach((tx) => {
    if (tx.type === 'spent' && tx.isoDate && tx.budgetGroupId) {
      const txDate = new Date(tx.isoDate);
      if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
        const amount = parseFloat(tx.amount) || 0;
        const group = groups.find((g) => g.id.toString() === tx.budgetGroupId.toString());
        if (group) {
          group.remaining -= amount;
          group.spent += amount;

          if (group.parentId) {
            const parent = groups.find((p) => p.id.toString() === group.parentId.toString());
            if (parent) {
              parent.remaining -= amount;
              parent.spent += amount;
            }
          }
        }
      }
    }
  });

  return groups;
}

export function renderBudgetSummary({
  groups,
  txHistory,
  doc = globalThis.document,
  containerId = 'dashboard-budget-container',
  lucide = globalThis.lucide,
} = {}) {
  const container = doc.getElementById(containerId);
  if (!container) return;

  container.replaceChildren();

  const calculated = calculateRemainingBalances(groups, txHistory);
  const activeGroups = calculated.filter((g) => !g.isArchived);

  if (activeGroups.length === 0) {
    const empty = createEl('div', {
      className: 'flex flex-col items-center justify-center py-10 px-6 bg-gradient-to-br from-indigo-50 via-white to-purple-50 rounded-3xl border border-indigo-100 shadow-sm relative overflow-hidden'
    });

    // Decorative background circles
    const circle1 = createEl('div', { className: 'absolute top-0 right-0 w-32 h-32 bg-indigo-200 rounded-full blur-[40px] opacity-40 -translate-y-1/2 translate-x-1/2' });
    const circle2 = createEl('div', { className: 'absolute bottom-0 left-0 w-28 h-28 bg-purple-200 rounded-full blur-[40px] opacity-40 translate-y-1/2 -translate-x-1/2' });
    empty.appendChild(circle1);
    empty.appendChild(circle2);

    const iconContainer = createEl('div', { className: 'bg-white p-4 rounded-2xl shadow-sm mb-4 border border-indigo-50 z-10' });
    iconContainer.appendChild(createIcon('wallet', 'w-8 h-8 text-indigo-500'));
    empty.appendChild(iconContainer);

    const title = createEl('h4', { className: 'text-sm font-extrabold text-slate-800 mb-2 z-10 tracking-tight', text: 'เริ่มจัดการกระเป๋าเงิน' });
    const subtitle = createEl('p', { className: 'text-[11px] text-slate-500 text-center mb-6 max-w-[240px] z-10 leading-relaxed', text: 'สร้างกระเป๋าเงินหลักและเงินย่อยเพื่อจัดสรรงบประมาณของคุณให้เป็นระเบียบยิ่งขึ้น' });
    empty.appendChild(title);
    empty.appendChild(subtitle);

    const createBtn = createEl('button', {
      className: 'relative z-10 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all hover:-translate-y-0.5 active:scale-95 cursor-pointer',
      text: ' จัดการกระเป๋าเงิน'
    });
    createBtn.prepend(createIcon('settings', 'w-4 h-4'));
    createBtn.onclick = () => globalThis.window?.openManageBudgetGroupsModal?.();
    empty.appendChild(createBtn);

    container.appendChild(empty);
    lucide?.createIcons?.();
    return;
  }

  const header = createEl('div', { className: 'flex justify-between items-center px-1 shrink-0 mb-1' });
  header.appendChild(createEl('h3', { className: 'text-xs font-bold text-slate-500 uppercase tracking-wide', text: 'สรุปยอดเงินแต่ละกระเป๋า' }));
  const manageBtn = createEl('button', {
    className: 'text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 px-3 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm',
    text: 'จัดการกลุ่ม'
  });
  manageBtn.onclick = () => globalThis.window?.openManageBudgetGroupsModal?.();
  manageBtn.prepend(createIcon('settings', 'w-3 h-3'));
  header.appendChild(manageBtn);
  container.appendChild(header);

  // Separate parent and children
  const parents = activeGroups.filter((g) => !g.parentId).sort((a, b) => (a.order || 0) - (b.order || 0));
  const children = activeGroups.filter((g) => g.parentId);

  parents.forEach((parent) => {
    const pColor = getColorClasses(parent.color);
    const parentSpent = parent.spent || 0;
    const parentBudget = parent.budget || 0;
    const parentPct = parentBudget > 0 ? Math.max(0, Math.min(Math.round((parent.remaining / parentBudget) * 100), 100)) : 0;

    const card = createEl('div', {
      className: 'bg-white border border-slate-200 rounded-3xl p-4 space-y-3 shadow-sm transition-all hover:border-slate-300 hover:shadow-md mt-3',
    });

    const cardHeader = createEl('div', { className: 'flex justify-between items-start' });
    const nameWrap = createEl('div', { className: 'min-w-0 flex items-start gap-2' });

    // Add color dot for parent
    const colorDot = createEl('div', { className: `w-3 h-3 rounded-full mt-1 shrink-0 ${pColor.fill.split(' ')[0]}` });
    nameWrap.appendChild(colorDot);

    const nameTextWrap = createEl('div', { className: 'min-w-0' });
    nameTextWrap.appendChild(createEl('span', { className: 'text-[13px] font-extrabold text-slate-800 truncate block', text: parent.name }));
    nameTextWrap.appendChild(createEl('span', { className: 'text-[10px] text-slate-400 font-bold block mt-0.5', text: 'กระเป๋าหลัก' }));
    nameWrap.appendChild(nameTextWrap);
    cardHeader.appendChild(nameWrap);

    const amountWrap = createEl('div', { className: 'text-right' });
    amountWrap.appendChild(createEl('span', {
      className: `text-[15px] font-extrabold ${parent.remaining < 0 ? 'text-rose-600' : 'text-slate-800'} block`,
      text: `฿${parent.remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    }));
    amountWrap.appendChild(createEl('span', { className: 'text-[10px] text-slate-400 font-bold block mt-0.5', text: `ใช้ไป ฿${parentSpent.toLocaleString()} / ฿${parentBudget.toLocaleString()}` }));
    cardHeader.appendChild(amountWrap);
    card.appendChild(cardHeader);

    // Progress Bar
    const progressTrack = createEl('div', { className: 'w-full h-2.5 bg-slate-100 rounded-full overflow-hidden' });
    progressTrack.appendChild(createEl('div', {
      className: `h-full rounded-full transition-all duration-500 ${parent.remaining < 0 ? 'bg-rose-500' : pColor.fill}`,
      attrs: { style: `width: ${parentPct}%` },
    }));
    card.appendChild(progressTrack);

    // Render children for this parent
    const childGroups = children.filter((c) => c.parentId.toString() === parent.id.toString()).sort((a, b) => (a.order || 0) - (b.order || 0));
    if (childGroups.length > 0) {
      const childContainer = createEl('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100 pt-4 mt-2' });

      childGroups.forEach((child) => {
        const cColor = getColorClasses(child.color);
        const childSpent = child.spent || 0;
        const childBudget = child.budget || 0;
        const childPct = childBudget > 0 ? Math.max(0, Math.min(Math.round((child.remaining / childBudget) * 100), 100)) : 0;

        const childBlock = createEl('div', { className: 'bg-slate-50/80 border border-slate-100 rounded-2xl p-3 space-y-2 hover:bg-slate-50 transition-colors' });

        const childHeader = createEl('div', { className: 'flex justify-between items-center' });
        const childNameWrap = createEl('div', { className: 'flex items-center gap-1.5 truncate' });

        // Add color dot for child
        const childDot = createEl('div', { className: `w-2 h-2 rounded-full shrink-0 ${cColor.fill.split(' ')[0]}` });
        childNameWrap.appendChild(childDot);
        childNameWrap.appendChild(createEl('span', { className: 'text-[11px] font-bold text-slate-700 truncate', text: child.name }));

        childHeader.appendChild(childNameWrap);
        childHeader.appendChild(createEl('span', {
          className: `text-[11px] font-extrabold ${child.remaining < 0 ? 'text-rose-600' : 'text-slate-800'}`,
          text: `฿${child.remaining.toLocaleString()}`,
        }));
        childBlock.appendChild(childHeader);

        // Micro progress bar
        const miniProgressTrack = createEl('div', { className: 'w-full h-1.5 bg-slate-200 rounded-full overflow-hidden' });
        miniProgressTrack.appendChild(createEl('div', {
          className: `h-full rounded-full ${child.remaining < 0 ? 'bg-rose-500' : cColor.fill}`,
          attrs: { style: `width: ${childPct}%` },
        }));
        childBlock.appendChild(miniProgressTrack);

        childBlock.appendChild(createEl('div', {
          className: 'text-[9px] text-slate-400 font-semibold text-right',
          text: `ใช้ไป ฿${childSpent.toLocaleString()} จาก ฿${childBudget.toLocaleString()}`,
        }));

        childContainer.appendChild(childBlock);
      });

      card.appendChild(childContainer);
    }

    container.appendChild(card);
  });

  lucide?.createIcons?.();
}

export function renderBudgetSelector({
  groups,
  txHistory,
  selectedBudgetGroupId,
  onSelect,
  doc = globalThis.document,
  containerId = 'tx-budget-group-grid',
  lucide = globalThis.lucide,
} = {}) {
  const container = doc.getElementById(containerId);
  if (!container) return;

  container.replaceChildren();

  // Load and calculate dynamic remaining balances
  const calculated = calculateRemainingBalances(groups, txHistory);
  const activeGroups = calculated.filter((g) => !g.isArchived);

  if (activeGroups.length === 0) {
    const emptyMsg = createEl('div', { className: 'text-[10px] font-medium text-slate-400 py-1.5 px-2' });
    emptyMsg.innerText = 'ยังไม่มีกระเป๋าให้เลือก';
    container.appendChild(emptyMsg);
    return;
  }

  // Add the default "รวมทั้งหมด" option first
  const noGroupSelected = !selectedBudgetGroupId;
  const allChip = createEl('div', { className: 'flex-shrink-0 snap-start' });
  allChip.onclick = () => onSelect?.('');
  const allPill = createEl('div', {
    className: `flex items-center space-x-1.5 max-md:py-1 max-md:px-2 md:py-2 md:px-3.5 max-md:rounded-xl md:rounded-xl text-[10px] md:text-[10px] lg:text-xs lg:py-2.5 lg:px-4.5 font-bold border transition-colors cursor-pointer ${noGroupSelected
        ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
        : 'bg-white max-md:border-slate-100 md:border-slate-200 text-slate-500 hover:bg-slate-50 max-md:shadow-sm'
      }`,
  });
  allPill.appendChild(createIcon('wallet', 'max-md:w-3.5 max-md:h-3.5 md:w-3.5 md:h-3.5'));
  allPill.appendChild(createEl('span', { text: 'ไม่ใช้กระเป๋า' }));
  allChip.appendChild(allPill);
  container.appendChild(allChip);

  activeGroups.forEach((group) => {
    const isSelected = group.id.toString() === selectedBudgetGroupId?.toString();
    const isChild = !!group.parentId;
    const gColor = getColorClasses(group.color);

    const chip = createEl('div', { className: 'flex-shrink-0 snap-start' });
    chip.onclick = () => onSelect?.(group.id.toString());

    const pill = createEl('div', {
      className: `flex items-center space-x-1.5 max-md:py-1 max-md:px-2 md:py-2 md:px-3.5 max-md:rounded-xl md:rounded-xl text-[10px] md:text-[10px] lg:text-xs lg:py-2.5 lg:px-4.5 font-bold border transition-all cursor-pointer ${isSelected
          ? `${gColor.fill.split(' ')[0]} border-transparent text-white shadow-sm scale-105`
          : `bg-white max-md:border-slate-100 md:border-slate-200 text-slate-600 hover:bg-slate-50 max-md:shadow-sm`
        }`,
    });

    const prefix = isChild ? '└ ' : '';
    pill.appendChild(createIcon(isChild ? 'chevron-right' : 'folder', 'max-md:w-3.5 max-md:h-3.5 md:w-3 md:h-3 opacity-80'));
    pill.appendChild(createEl('span', { text: `${prefix}${group.name} (฿${group.remaining.toLocaleString()})` }));
    chip.appendChild(pill);
    container.appendChild(chip);
  });

  lucide?.createIcons?.();
}

export function populateBudgetSelectOptions(selectEl, groups, selectedValue = '') {
  if (!selectEl) return;

  selectEl.replaceChildren();

  // First default option
  const defaultOpt = createEl('option', { text: 'ไม่มี (ไม่ใช้ระบบคุมงบ)' });
  defaultOpt.value = '';
  if (!selectedValue) defaultOpt.selected = true;
  selectEl.appendChild(defaultOpt);

  const activeGroups = groups.filter((g) => !g.isArchived);
  activeGroups.forEach((group) => {
    const opt = createEl('option', {
      text: `${group.parentId ? '   └ ' : ''}${group.name} (฿${group.budget.toLocaleString()})`,
    });
    opt.value = group.id.toString();
    if (group.id.toString() === selectedValue?.toString()) opt.selected = true;
    selectEl.appendChild(opt);
  });
}

export function renderManageBudgetGroupsList({
  groups,
  onEdit,
  onArchive,
  onDelete,
  doc = globalThis.document,
  containerId = 'budget-groups-list',
  lucide = globalThis.lucide,
} = {}) {
  const container = doc.getElementById(containerId);
  if (!container) return;

  container.replaceChildren();

  if (groups.length === 0) {
    const empty = createEl('div', { className: 'text-center py-6 text-slate-400 text-[10px]', text: 'ยังไม่มีกลุ่มกระเป๋า' });
    container.appendChild(empty);
    return;
  }

  // Sort: parents first, then children, then archived at the end
  const sorted = [...groups].sort((a, b) => {
    if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1;
    if (!a.parentId && b.parentId) return -1;
    if (a.parentId && !b.parentId) return 1;
    return (a.order || 0) - (b.order || 0);
  });

  sorted.forEach((group) => {
    const isChild = !!group.parentId;
    const gColor = getColorClasses(group.color);

    const row = createEl('div', {
      className: `flex items-center justify-between p-2.5 rounded-xl border ${group.isArchived
          ? 'bg-slate-50 border-slate-100 opacity-60'
          : 'bg-white border-slate-200 shadow-sm'
        } gap-2`,
    });

    const left = createEl('div', { className: 'flex items-center space-x-2 min-w-0 flex-1' });
    const bullet = createEl('div', {
      className: `w-3 h-3 rounded-full ${gColor.fill.split(' ')[0]} shrink-0`,
    });
    left.appendChild(bullet);

    const textWrap = createEl('div', { className: 'min-w-0 flex-1' });
    textWrap.appendChild(createEl('h5', {
      className: `text-xs font-bold truncate ${isChild ? 'pl-2 text-slate-600' : 'text-slate-800'}`,
      text: `${isChild ? '└ ' : ''}${group.name}`,
    }));
    textWrap.appendChild(createEl('p', {
      className: 'text-[8px] text-slate-400 font-bold block mt-0.5',
      text: `ยอดเงินตั้งต้น: ฿${group.budget.toLocaleString()} ${group.isArchived ? '(เก็บถาวร)' : ''}`,
    }));
    left.appendChild(textWrap);
    row.appendChild(left);

    // Actions
    const actions = createEl('div', { className: 'flex items-center space-x-1.5 shrink-0' });

    const editBtn = createEl('button', {
      className: 'p-1 text-slate-400 hover:text-indigo-600 cursor-pointer transition-colors',
      title: 'แก้ไข',
    });
    editBtn.onclick = () => onEdit?.(group);
    editBtn.appendChild(createIcon('edit-2', 'w-3 h-3'));
    actions.appendChild(editBtn);

    const archiveBtn = createEl('button', {
      className: `p-1 cursor-pointer transition-colors ${group.isArchived ? 'text-indigo-600 hover:text-indigo-800' : 'text-slate-400 hover:text-amber-600'}`,
      title: group.isArchived ? 'เปิดใช้งานใหม่' : 'เก็บถาวร',
    });
    archiveBtn.onclick = () => onArchive?.(group.id);
    archiveBtn.appendChild(createIcon(group.isArchived ? 'folder-open' : 'archive', 'w-3 h-3'));
    actions.appendChild(archiveBtn);

    const deleteBtn = createEl('button', {
      className: 'p-1 text-slate-400 hover:text-rose-600 cursor-pointer transition-colors',
      title: 'ลบ',
    });
    deleteBtn.onclick = () => onDelete?.(group.id);
    deleteBtn.appendChild(createIcon('trash-2', 'w-3 h-3'));
    actions.appendChild(deleteBtn);

    row.appendChild(actions);
    container.appendChild(row);
  });

  lucide?.createIcons?.();
}

export function openManageBudgetGroupsModal(doc = globalThis.document) {
  const modal = doc.getElementById('manage-budget-groups-modal');
  if (modal) {
      modal.classList.remove('hidden');
  }
  renderManageBudgetGroupsList({
      groups: ctx.allBudgetGroups(),
      onEdit: (group) => {
          currentEditingBudgetGroup = group;
          doc.getElementById('budget-group-id').value = group.id;
          doc.getElementById('budget-group-name').value = group.name;
          doc.getElementById('budget-group-amount').value = group.budget.toLocaleString();
          doc.getElementById('budget-group-parent').value = group.parentId || '';
          doc.getElementById('budget-group-color').value = group.color || 'indigo';
          doc.getElementById('budget-group-form-title').innerText = 'แก้ไขกลุ่มกระเป๋า';
          doc.getElementById('btn-cancel-budget-group').classList.remove('hidden');
      },
      onArchive: async (groupId) => {
          const index = ctx.allBudgetGroups().findIndex(g => g.id.toString() === groupId.toString());
          if (index > -1) {
              ctx.allBudgetGroups()[index].isArchived = !ctx.allBudgetGroups()[index].isArchived;
              ctx.saveBudgetGroups(ctx.localStorage, ctx.currentUserProfileId(), ctx.allBudgetGroups());
              openManageBudgetGroupsModal(doc);
              ctx.updateDashboard();
              if (ctx.syncQueueInstance()) {
                  ctx.syncQueueInstance().enqueue({
                      sheetName: ctx.currentUserProfileId() + '_Budget',
                      action: 'edit',
                      ...ctx.allBudgetGroups()[index]
                  });
                  ctx.showToast('ซ่อน/แสดงกลุ่มกระเป๋าสำเร็จ', 'success');
              } else {
                  ctx.apiClient.postJson({
                      sheetName: ctx.currentUserProfileId() + '_Budget',
                      action: 'edit',
                      ...ctx.allBudgetGroups()[index]
                  }, { expectJson: false })
                  .then(() => ctx.showToast('ซ่อน/แสดงกลุ่มกระเป๋าสำเร็จ', 'success'))
                  .catch(() => ctx.showToast('ทำรายการในเครื่องสำเร็จ แต่เชื่อมต่อชีทล้มเหลว', 'error'));
              }
          }
      },
      onDelete: async (groupId) => {
          const confirmDel = await ctx.showConfirmDialog({
              type: 'default',
              title: 'ยืนยันการลบกลุ่มกระเป๋า?',
              desc: 'ยืนยันการลบกลุ่มกระเป๋านี้หรือไม่? (ข้อมูลธุรกรรมจะไม่ถูกลบ)',
              btnText: 'ยืนยันลบ',
          });
          if (!confirmDel) return;

          const index = ctx.allBudgetGroups().findIndex(g => g.id.toString() === groupId.toString());
          if (index > -1) {
              ctx.allBudgetGroups().splice(index, 1);
              ctx.saveBudgetGroups(ctx.localStorage, ctx.currentUserProfileId(), ctx.allBudgetGroups());
              openManageBudgetGroupsModal(doc);
              ctx.updateDashboard();
              if (ctx.syncQueueInstance()) {
                  ctx.syncQueueInstance().enqueue({
                      sheetName: ctx.currentUserProfileId() + '_Budget',
                      action: 'delete',
                      id: groupId
                  });
                  ctx.showToast('ลบกลุ่มกระเป๋าสำเร็จ', 'success');
              } else {
                  ctx.apiClient.postJson({
                      sheetName: ctx.currentUserProfileId() + '_Budget',
                      action: 'delete',
                      id: groupId
                  }, { expectJson: false })
                  .then(() => ctx.showToast('ลบกลุ่มกระเป๋าสำเร็จ', 'success'))
                  .catch(() => ctx.showToast('ลบในเครื่องสำเร็จ แต่เชื่อมต่อชีทล้มเหลว', 'error'));
              }
          }
      },
      doc,
      lucide: ctx.lucide
  });
}

export function closeManageBudgetGroupsModal(doc = globalThis.document) {
  const modal = doc.getElementById('manage-budget-groups-modal');
  if (modal) {
      modal.classList.add('hidden');
  }
  cancelBudgetGroupEdit(doc);
}

export function cancelBudgetGroupEdit(doc = globalThis.document) {
  currentEditingBudgetGroup = null;
  doc.getElementById('budget-group-id').value = '';
  doc.getElementById('budget-group-name').value = '';
  doc.getElementById('budget-group-amount').value = '';
  doc.getElementById('budget-group-parent').value = '';
  doc.getElementById('budget-group-color').value = 'indigo';
  doc.getElementById('budget-group-form-title').innerText = 'เพิ่มกลุ่มกระเป๋าใหม่';
  doc.getElementById('btn-cancel-budget-group').classList.add('hidden');
}

export async function saveBudgetGroup(doc = globalThis.document) {
  const idVal = doc.getElementById('budget-group-id').value;
  const name = doc.getElementById('budget-group-name').value;
  const rawAmount = doc.getElementById('budget-group-amount').value.replace(/,/g, '');
  const budget = parseFloat(rawAmount);
  const parentId = doc.getElementById('budget-group-parent').value || null;
  const color = doc.getElementById('budget-group-color').value;

  if (!name || Number.isNaN(budget) || budget < 0) {
      ctx.showToast('กรุณาระบุชื่อและยอดเงินในกระเป๋าให้ครบถ้วน', 'error');
      return;
  }

  const btn = doc.getElementById('btn-save-budget-group');
  const loadingState = ctx.setButtonLoading(btn, { label: 'กำลังบันทึก...', iconClass: 'w-4 h-4' });
  await ctx.nextFrame();

  const isEdit = !!idVal;
  const id = isEdit ? parseInt(idVal, 10) : Date.now();
  const newGroup = {
      id,
      name,
      budget,
      remaining: budget,
      parentId,
      color,
      order: isEdit ? ctx.allBudgetGroups().find(g => g.id.toString() === idVal).order : ctx.allBudgetGroups().length,
      isArchived: isEdit ? ctx.allBudgetGroups().find(g => g.id.toString() === idVal).isArchived : false
  };

  if (isEdit) {
      const index = ctx.allBudgetGroups().findIndex(g => g.id.toString() === idVal);
      ctx.allBudgetGroups()[index] = newGroup;
  } else {
      ctx.allBudgetGroups().push(newGroup);
  }

  ctx.saveBudgetGroups(ctx.localStorage, ctx.currentUserProfileId(), ctx.allBudgetGroups());
  cancelBudgetGroupEdit(doc);
  openManageBudgetGroupsModal(doc);
  ctx.updateDashboard();
  
  if (ctx.syncQueueInstance()) {
      ctx.syncQueueInstance().enqueue({
          sheetName: ctx.currentUserProfileId() + '_Budget',
          action: isEdit ? 'edit' : 'add',
          ...newGroup
      });
      ctx.showToast('บันทึกกลุ่มกระเป๋าสำเร็จ', 'success');
  } else {
      ctx.apiClient.postJson({
          sheetName: ctx.currentUserProfileId() + '_Budget',
          action: isEdit ? 'edit' : 'add',
          ...newGroup
      }, { expectJson: false })
      .then(() => ctx.showToast('บันทึกกลุ่มกระเป๋าสำเร็จ', 'success'))
      .catch(() => ctx.showToast('บันทึกในเครื่องสำเร็จ แต่เชื่อมต่อชีทล้มเหลว', 'error'));
  }
  
  loadingState?.restore();
}

export function onRequireBudgetGroupChooser(item, callback, doc = globalThis.document) {
  pendingPayRecurringItemCallback = callback;
  const chooserSelect = doc.getElementById('chooser-budget-group');
  if (chooserSelect) {
      populateBudgetSelectOptions(chooserSelect, ctx.allBudgetGroups());
  }
  doc.getElementById('budget-chooser-modal').classList.remove('hidden');
}

export function closeBudgetChooserModal(doc = globalThis.document) {
  doc.getElementById('budget-chooser-modal').classList.add('hidden');
  pendingPayRecurringItemCallback = null;
}

export function confirmPayRecurringWithBudget(doc = globalThis.document) {
  const chooserSelect = doc.getElementById('chooser-budget-group');
  const selectedGroupId = chooserSelect?.value || '';
  if (pendingPayRecurringItemCallback) {
      pendingPayRecurringItemCallback(selectedGroupId);
  }
  closeBudgetChooserModal(doc);
}
