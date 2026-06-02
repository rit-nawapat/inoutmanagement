const PRESETS = {
  switch_profile: {
    title: 'ออกจากระบบ?',
    desc: 'ต้องการออกจากโปรไฟล์ปัจจุบันเพื่อสลับผู้ใช้งานใช่หรือไม่?',
    btnText: 'ออกจากระบบ',
    btnClass: 'flex-1 bg-slate-900 text-white py-2.5 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors',
    iconWrapperClass: 'flex items-center space-x-3 text-slate-800',
    iconBgClass: 'bg-slate-100 p-2 rounded-xl',
  },
  delete_profile: {
    title: 'ลบโปรไฟล์นี้?',
    desc: 'ชื่อและรูปจะถูกลบออก (แต่ข้อมูลรายรับรายจ่ายใน Sheet จะยังอยู่เพื่อความปลอดภัย)',
    btnText: 'ยืนยันลบ',
    btnClass: 'flex-1 bg-rose-600 text-white py-2.5 rounded-lg cursor-pointer hover:bg-rose-700 transition-colors',
    iconWrapperClass: 'flex items-center space-x-3 text-rose-600',
    iconBgClass: 'bg-rose-50 p-2 rounded-xl',
  },
  default: {
    title: 'ยืนยันการลบ?',
    desc: (type) => (type === 'all' ? 'ข้อมูลธุรกรรมในโปรไฟล์นี้จะถูกล้างทั้งหมด' : 'ต้องการลบรายการนี้ใช่หรือไม่?'),
    btnText: (type) => (type === 'all' ? 'ล้างข้อมูล' : 'ยืนยันลบ'),
    btnClass: 'flex-1 bg-rose-600 text-white py-2.5 rounded-lg cursor-pointer hover:bg-rose-700 transition-colors',
    iconWrapperClass: 'flex items-center space-x-3 text-rose-600',
    iconBgClass: 'bg-rose-50 p-2 rounded-xl',
  },
};

export function getConfirmDialogPreset(type = 'all') {
  const preset = PRESETS[type] || PRESETS.default;
  return {
    title: preset.title,
    desc: typeof preset.desc === 'function' ? preset.desc(type) : preset.desc,
    btnText: typeof preset.btnText === 'function' ? preset.btnText(type) : preset.btnText,
    btnClass: preset.btnClass,
    iconWrapperClass: preset.iconWrapperClass,
    iconBgClass: preset.iconBgClass,
  };
}

export function applyConfirmDialogPreset(elements, type = 'all') {
  const preset = getConfirmDialogPreset(type);
  const { title, desc, btn, iconWrapper, iconBg } = elements;

  if (title) title.innerText = preset.title;
  if (desc) desc.innerText = preset.desc;
  if (btn) {
    btn.innerText = preset.btnText;
    btn.className = preset.btnClass;
  }
  if (iconWrapper) iconWrapper.className = preset.iconWrapperClass;
  if (iconBg) iconBg.className = preset.iconBgClass;

  return preset;
}
