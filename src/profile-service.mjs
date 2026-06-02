import { createEl, setText } from './dom-helpers.mjs';
import { createIcon } from './render-helpers.mjs';
import { renderImagePreview, setModalTitle, showModal, hideModal } from './modal-helpers.mjs';

const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'/%3E%3Ccircle cx='12' cy='7' r='4'/%3E%3C/svg%3E";
const ACTIVE_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'/%3E%3Ccircle cx='12' cy='7' r='4'/%3E%3C/svg%3E";

export function renderProfileGrid({ container, allProfiles, currentUserProfileId, onSelectProfile, onOpenProfileModal, lucide = globalThis.lucide }) {
  if (!container) return;
  container.replaceChildren();

  allProfiles.forEach((profile) => {
    const div = createEl('div', { className: 'flex flex-col items-center space-y-3 cursor-pointer group' });
    const card = createEl('div', {
      className: `relative w-24 h-24 md:w-32 md:h-32 rounded-2xl overflow-hidden border-2 ${currentUserProfileId === profile.id ? 'border-indigo-500' : 'border-transparent group-hover:border-slate-500'} transition-colors`,
    });
    const image = createEl('img', {
      className: 'w-full h-full object-cover bg-slate-800',
      attrs: { src: profile.imageUrl || DEFAULT_AVATAR },
    });
    image.onclick = () => onSelectProfile?.(profile.id);

    const button = createEl('button', {
      className: 'absolute top-2 right-2 p-1.5 bg-black/60 rounded-lg text-white hover:bg-indigo-600 transition-colors',
    });
    button.onclick = (event) => {
      event.stopPropagation();
      onOpenProfileModal?.(profile.id);
    };
    button.appendChild(createIcon('edit-2', 'w-3 h-3 md:w-4 md:h-4'));

    const label = createEl('span', { className: 'text-slate-300 font-bold text-xs md:text-sm group-hover:text-white' });
    setText(label, profile.name);

    card.appendChild(image);
    card.appendChild(button);
    div.appendChild(card);
    div.appendChild(label);
    container.appendChild(div);
  });

  const addDiv = createEl('div', { className: 'flex flex-col items-center space-y-3 cursor-pointer group' });
  addDiv.onclick = () => onOpenProfileModal?.(null);
  const addCard = createEl('div', {
    className: 'w-24 h-24 md:w-32 md:h-32 rounded-2xl border-2 border-slate-700 flex items-center justify-center group-hover:bg-slate-800 transition-colors',
  });
  addCard.appendChild(createIcon('plus', 'w-10 h-10 text-slate-500 group-hover:text-white'));
  addDiv.appendChild(addCard);
  addDiv.appendChild(createEl('span', {
    className: 'text-slate-500 font-bold text-xs md:text-sm group-hover:text-white',
    text: 'เพิ่มผู้ใช้',
  }));
  container.appendChild(addDiv);

  lucide?.createIcons?.();
}

export function updateActiveProfileUI({ currentUserProfileId, allProfiles, document = globalThis.document }) {
  if (!currentUserProfileId) return;
  const profile = allProfiles.find((p) => p.id === currentUserProfileId);
  if (!profile) return;

  const mImg = document.getElementById('active-profile-img-mobile');
  const mName = document.getElementById('active-profile-name-mobile');
  const dImg = document.getElementById('active-profile-img-desktop');
  const dName = document.getElementById('active-profile-name-desktop');

  if (mImg) mImg.src = profile.imageUrl || ACTIVE_AVATAR;
  if (mName) mName.innerText = profile.name;
  if (dImg) dImg.src = profile.imageUrl || ACTIVE_AVATAR;
  if (dName) dName.innerText = profile.name;
}

export function showProfileSelection({ document = globalThis.document, currentUserProfileId, allProfiles, renderProfileGrid }) {
  document.getElementById('page-profile-selection').classList.remove('hidden');
  const closeBtn = document.getElementById('btn-close-profile-selection');
  if (currentUserProfileId && closeBtn) closeBtn.classList.remove('hidden');
  else if (closeBtn) closeBtn.classList.add('hidden');
  renderProfileGrid();
}

export function closeProfileSelection({ document = globalThis.document }) {
  document.getElementById('page-profile-selection').classList.add('hidden');
}

export function openProfileModal({
  id,
  allProfiles,
  document = globalThis.document,
  selectedImageState,
  showModalFn = showModal,
}) {
  selectedImageState.base64 = null;
  selectedImageState.mimeType = null;
  selectedImageState.fileName = null;
  document.getElementById('profile-image-input').value = '';

  const btnDelete = document.getElementById('btn-delete-profile');
  if (id) {
    setModalTitle('profile-modal-title', 'แก้ไขโปรไฟล์');
    btnDelete.classList.remove('hidden');
    const p = allProfiles.find((x) => x.id === id);
    document.getElementById('profile-id-input').value = p.id;
    document.getElementById('profile-name-input').value = p.name;
    document.getElementById('profile-old-image-url').value = p.imageUrl || '';
    renderImagePreview(document.getElementById('profile-image-preview'), p.imageUrl, 'user');
  } else {
    setModalTitle('profile-modal-title', 'เพิ่มโปรไฟล์ใหม่');
    btnDelete.classList.add('hidden');
    document.getElementById('profile-id-input').value = `user_${Date.now()}`;
    document.getElementById('profile-name-input').value = '';
    document.getElementById('profile-old-image-url').value = '';
    renderImagePreview(document.getElementById('profile-image-preview'), null, 'camera');
  }

  showModalFn('profile-edit-modal');
}

export function closeProfileModal({ hideModalFn = hideModal, document = globalThis.document }) {
  hideModalFn('profile-edit-modal');
}

export function deleteCurrentEditingProfile({ document = globalThis.document, closeProfileModalFn, triggerResetConfirm }) {
  const id = document.getElementById('profile-id-input').value;
  closeProfileModalFn();
  triggerResetConfirm('delete_profile', id);
}

export function handleProfileImageSelect({ event, selectedImageState, document = globalThis.document }) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement('canvas');
      const MAX_SIZE = 300;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        }
      } else if (height > MAX_SIZE) {
        width *= MAX_SIZE / height;
        height = MAX_SIZE;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
      renderImagePreview(document.getElementById('profile-image-preview'), dataUrl, 'user');
      selectedImageState.base64 = dataUrl.split(',')[1];
      selectedImageState.mimeType = 'image/jpeg';
      const originalName = file.name || 'profile';
      const extIndex = originalName.lastIndexOf('.');
      const baseName = extIndex !== -1 ? originalName.substring(0, extIndex) : originalName;
      selectedImageState.fileName = `${baseName}.jpg`;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

export async function saveProfileData({
  document = globalThis.document,
  allProfiles,
  currentUserProfileId,
  selectedImageState,
  apiClient,
  saveSavedProfiles,
  updateActiveProfileUIFn,
  renderProfileGridFn,
  closeProfileModalFn,
  showToast,
}) {
  const id = document.getElementById('profile-id-input').value;
  const name = document.getElementById('profile-name-input').value.trim();
  const oldImageUrl = document.getElementById('profile-old-image-url').value;

  if (!name) { showToast('กรุณาระบุชื่อโปรไฟล์', 'error'); return; }

  const payload = { action: 'save_profile', profileId: id, name, oldImageUrl, imageBase64: selectedImageState.base64, mimeType: selectedImageState.mimeType, fileName: selectedImageState.fileName };
  const result = await apiClient.postJson(payload);
  if (result.status === 'Success') {
    const existingIndex = allProfiles.findIndex((p) => p.id === id);
    const newProfile = { id, name, imageUrl: result.imageUrl };
    if (existingIndex > -1) allProfiles[existingIndex] = newProfile; else allProfiles.push(newProfile);
    saveSavedProfiles(localStorage, allProfiles);
    if (currentUserProfileId === id) updateActiveProfileUIFn();
    renderProfileGridFn();
    closeProfileModalFn();
    showToast('บันทึกโปรไฟล์สำเร็จ', 'success');
  } else {
    showToast('เกิดข้อผิดพลาดในการบันทึก', 'error');
  }
}

export async function executeDeleteProfile({
  id,
  allProfiles,
  currentUserProfileId,
  setCurrentUserProfileId,
  saveSavedProfiles,
  saveCurrentProfileId,
  appState,
  updateDashboardFn,
  renderProfileGridFn,
  showProfileSelectionFn,
  showToast,
  apiClient,
}) {
  allProfiles = allProfiles.filter((p) => p.id !== id);
  saveSavedProfiles(localStorage, allProfiles);
  if (currentUserProfileId === id) {
    setCurrentUserProfileId(null);
    saveCurrentProfileId(localStorage, null);
    appState.txHistory = [];
    updateDashboardFn();
  }
  renderProfileGridFn();
  if (!currentUserProfileId) showProfileSelectionFn();
  showToast('ลบโปรไฟล์สำเร็จ', 'success');
  try { await apiClient.postJson({ action: 'delete_profile', profileId: id }, { expectJson: false }); } catch {}
  return allProfiles;
}
