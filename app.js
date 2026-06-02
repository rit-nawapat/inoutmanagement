import { createApiClient } from './src/api-client.mjs';
import {
    loadCurrentProfileId,
    loadSavedProfiles,
    getHistoryStorageKey,
    getRecurringStorageKey,
    loadRecurringItems,
    saveCurrentProfileId,
    saveSavedProfiles,
    saveRecurringItems,
} from './src/core.mjs';
import { createEl, setText } from './src/dom-helpers.mjs';
import { createIcon } from './src/render-helpers.mjs';
import {
    accounts,
    categories,
    formatCurrencyInput,
    guessAccountForCategory,
    renderAccounts as renderAccountsService,
    renderCategories as renderCategoriesService,
} from './src/catalog-service.mjs';
import { setButtonLoading, setDialogConfirmLoading } from './src/button-helpers.mjs';
import { applyConfirmDialogPreset } from './src/confirm-dialog.mjs';
import {
    backspaceCalculator,
    calculateCalculator,
    clearCalculator,
    inputDigitCalculator,
    inputOperatorCalculator,
    quickPriceCalculator,
    resetCalculatorScanState,
} from './src/calculator-service.mjs';
import { analyzeSlipText } from './src/ocr-service.mjs';
import {
    buildEditDraft,
} from './src/transaction-service.mjs';
import {
    closeProfileModal as closeProfileModalService,
    closeProfileSelection as closeProfileSelectionService,
    deleteCurrentEditingProfile as deleteCurrentEditingProfileService,
    executeDeleteProfile as executeDeleteProfileService,
    handleProfileImageSelect as handleProfileImageSelectService,
    openProfileModal as openProfileModalService,
    renderProfileGrid as renderProfileGridService,
    saveProfileData as saveProfileDataService,
    showProfileSelection as showProfileSelectionService,
    updateActiveProfileUI as updateActiveProfileUIService,
} from './src/profile-service.mjs';
import {
    executeDeleteFlow,
    saveTransactionFlow,
    selectProfileFlow,
    syncDataFromSheetFlow,
} from './src/flow-service.mjs';
import {
    closeRecurringModal as closeRecurringModalService,
    deleteRecurringItem as deleteRecurringItemService,
    executeDeleteRecurring as executeDeleteRecurringService,
    openRecurringModal as openRecurringModalService,
    payRecurringItem as payRecurringItemService,
    saveRecurringItem as saveRecurringItemService,
    toggleFavRecurring as toggleFavRecurringService,
} from './src/recurring-service.mjs';
import { appState } from './src/app-state.mjs';
import { uiState } from './src/ui-state.mjs';
import {
    getRecurringItems as getRecurringItemsService,
    renderHistory as renderHistoryService,
    renderRecurringList as renderRecurringListService,
    updateDashboard as updateDashboardService,
    updateRecurringSummary as updateRecurringSummaryService,
} from './src/ledger-service.mjs';

const GOOGLE_SHEET_API_URL = import.meta.env.VITE_GOOGLE_SHEET_PROXY_URL || import.meta.env.VITE_GOOGLE_SHEET_API_URL;
const apiClient = createApiClient(GOOGLE_SHEET_API_URL);

// -------------------------------------------------------------
// ระบบ Profile (Netflix Style)
// -------------------------------------------------------------
let currentUserProfileId = loadCurrentProfileId(localStorage);
let allProfiles = loadSavedProfiles(localStorage);

const selectedImageState = { base64: null, mimeType: null, fileName: null };

function getHistoryKey() { return getHistoryStorageKey(currentUserProfileId); }
function getRecurringKey() { return getRecurringStorageKey(currentUserProfileId); }
function getRecurringItems() { return getRecurringItemsService(localStorage, currentUserProfileId); }
function updateDashboard() { updateDashboardService(appState.txHistory); }
function updateRecurringSummary() { updateRecurringSummaryService(appState.txHistory, localStorage, currentUserProfileId); }
function renderRecurringList() {
    renderRecurringListService({
        storage: localStorage,
        profileId: currentUserProfileId,
        onPay: payRecurringItem,
        onToggleFav: toggleFavRecurring,
        onEdit: openRecurringModal,
        onDelete: deleteRecurringItem,
    });
}
function renderHistory() {
    renderHistoryService({
        txHistory: appState.txHistory,
        onEdit: editTransaction,
        onDelete: deleteTransaction,
    });
}

// เรียกเมื่อเริ่มแอป
async function initProfileSystem() {
    renderProfileGrid();

    // ถ้ายังไม่มีโปรไฟล์ที่เลือก ให้แสดงหน้าเลือกโปรไฟล์
    if (!currentUserProfileId) {
        showProfileSelection();
    } else {
        document.getElementById('page-profile-selection').classList.add('hidden');
        updateActiveProfileUI();
    }

    // โหลดข้อมูลโปรไฟล์จากคลาวด์เบื้องหลัง
    try {
        const data = await apiClient.getJson();
        if (data && data.profiles) {
            allProfiles = data.profiles;
            saveSavedProfiles(localStorage, allProfiles);
            renderProfileGrid();
            updateActiveProfileUI();
        }
    } catch (e) { console.error("Profile sync error"); }
}

function showProfileSelection() {
    showProfileSelectionService({
        currentUserProfileId,
        allProfiles,
        renderProfileGrid,
    });
}

function closeProfileSelection() {
    closeProfileSelectionService({});
}

function renderProfileGrid() {
    renderProfileGridService({
        container: document.getElementById('profile-grid-container'),
        allProfiles,
        currentUserProfileId,
        onSelectProfile: selectProfile,
        onOpenProfileModal: openProfileModal,
    });
}

function selectProfile(id) {
    currentUserProfileId = id;
    saveCurrentProfileId(localStorage, currentUserProfileId);
    document.getElementById('page-profile-selection').classList.add('hidden');
    updateActiveProfileUI();
    appState.txHistory = JSON.parse(localStorage.getItem(getHistoryKey()) || '[]');
    updateDashboard();
    if (appState.currentPage === 'history') renderHistory();
    if (appState.currentPage === 'list') { renderRecurringList(); updateRecurringSummary(); }
    showToast(`เข้าสู่ระบบ: ${allProfiles.find(p => p.id === id)?.name}`, 'success');
    syncDataFromSheet();
}

function updateActiveProfileUI() {
    updateActiveProfileUIService({ currentUserProfileId, allProfiles });
}

function openProfileModal(id) {
    openProfileModalService({
        id,
        allProfiles,
        selectedImageState,
    });
}

function deleteCurrentEditingProfile() {
    deleteCurrentEditingProfileService({
        closeProfileModalFn: closeProfileModal,
        triggerResetConfirm,
    });
}

async function executeDeleteProfile(id) {
    allProfiles = await executeDeleteProfileService({
        id,
        allProfiles,
        currentUserProfileId,
        setCurrentUserProfileId: (value) => { currentUserProfileId = value; },
        saveSavedProfiles,
        saveCurrentProfileId,
        appState,
        updateDashboardFn: updateDashboard,
        renderProfileGridFn: renderProfileGrid,
        showProfileSelectionFn: showProfileSelection,
        showToast,
        apiClient,
    });
}

function closeProfileModal() { closeProfileModalService({}); }

function handleProfileImageSelect(event) {
    handleProfileImageSelectService({ event, selectedImageState });
}

async function saveProfileData() {
    await saveProfileDataService({
        allProfiles,
        currentUserProfileId,
        selectedImageState,
        apiClient,
        saveSavedProfiles,
        updateActiveProfileUIFn: updateActiveProfileUI,
        renderProfileGridFn: renderProfileGrid,
        closeProfileModalFn: closeProfileModal,
        showToast,
    });
}

appState.txHistory = JSON.parse(localStorage.getItem(getHistoryKey()) || localStorage.getItem('my_tx_history') || '[]');

const thaiMonths = {
    'ม.ค.': 0, 'ก.พ.': 1, 'มี.ค.': 2, 'เม.ย.': 3, 'พ.ค.': 4, 'มิ.ย.': 5,
    'ก.ค.': 6, 'ส.ค.': 7, 'ก.ย.': 8, 'ต.ค.': 9, 'พ.ย.': 10, 'ธ.ค.': 11,
    'มกราคม': 0, 'กุมภาพันธ์': 1, 'มีนาคม': 2, 'เมษายน': 3, 'พฤษภาคม': 4, 'มิถุนายน': 5,
    'กรกฎาคม': 6, 'สิงหาคม': 7, 'กันยายน': 8, 'ตุลาคม': 9, 'พฤศจิกายน': 10, 'ธันวาคม': 11
};

uiState.selectedCategory = categories.spent[0].id;
uiState.selectedAccount = accounts[0].id;

function setLocalDatetime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('tx-date').value = now.toISOString().slice(0, 16);
}

function processSlipOCR(fileInput) {
    const file = fileInput.files[0];
    if (!file) return;
    showToast('กำลังแกะข้อมูลจากสลิป...', 'success');

    Tesseract.recognize(file, 'tha+eng').then(({ data: { text } }) => {
        const {
            detectedAmount,
            parsedDate,
            refNo,
            guessedCategoryId,
            duplicateTx,
        } = analyzeSlipText(text, appState.txHistory);

        if (detectedAmount > 0) {
            playScanSuccessSound();
            uiState.expression = detectedAmount.toString();
            display.innerText = uiState.expression;

            if (parsedDate) {
                document.getElementById('tx-date').value = parsedDate;
                showToast('ปรับปรุงวันที่และเวลาตามสลิป', 'success');
            }

            uiState.currentSlipRefNo = refNo || "";
            if (refNo) {
                if (duplicateTx) {
                    showToast(`⚠️ สลิปซ้ำ! เคยบันทึกแล้วเมื่อ ${duplicateTx.date} ยอด ฿${duplicateTx.amount}`, 'error');
                } else {
                    showToast(`เลขอ้างอิงสลิป: ${refNo}`, 'success');
                }
            }

            if (guessedCategoryId) {
                uiState.selectedCategory = guessedCategoryId;
                renderCategories();
            }

            uiState.selectedAccount = 'qrscan';
            renderAccounts();

            uiState.currentScannedBarcode = refNo ? `สลิปโอนเงิน (Ref: ${refNo})` : "สลิปโอนเงิน (OCR)";
            showScannedNote('file-text', `฿${detectedAmount} ${refNo ? `[${refNo.slice(-6)}]` : ''}`.trim());

            showToast(`สแกนสลิปสำเร็จ ยอด ฿${detectedAmount}`, 'success');
        } else {
            showToast('ไม่พบยอดเงิน กรุณาพิมพ์ระบุเอง', 'error');
        }
    }).catch(err => {
        showToast('สแกนไม่สำเร็จ หรือรูปภาพไม่ชัดเจน', 'error');
    }).finally(() => {
        fileInput.value = "";
    });
}

let touchStartX = 0, touchEndX = 0;
const pageOrder = ['dashboard', 'list', 'add', 'history'];

document.getElementById('main-touch-zone').addEventListener('touchstart', (e) => {
    if (e.target.closest('#category-grid') || e.target.closest('#account-grid') || e.target.closest('#qr-reader') || e.target.closest('input') || e.target.closest('button')) return;
    touchStartX = e.changedTouches[0].screenX;
}, { passive: true });

document.getElementById('main-touch-zone').addEventListener('touchend', (e) => {
    if (e.target.closest('#category-grid') || e.target.closest('#account-grid') || e.target.closest('#qr-reader') || e.target.closest('input') || e.target.closest('button')) return;
    touchEndX = e.changedTouches[0].screenX;
    let distance = touchEndX - touchStartX;
    if (distance > 75 && pageOrder.indexOf(appState.currentPage) > 0) { switchPage(pageOrder[pageOrder.indexOf(appState.currentPage) - 1]); }
    else if (distance < -75 && pageOrder.indexOf(appState.currentPage) < pageOrder.length - 1) { switchPage(pageOrder[pageOrder.indexOf(appState.currentPage) + 1]); }
}, { passive: true });

function switchPage(pageId) {
    appState.currentPage = pageId;
    pageOrder.forEach(p => { const target = document.getElementById(`page-${p}`); if (target) { target.classList.add('hidden'); target.classList.remove('flex'); } });
    const currentView = document.getElementById(`page-${pageId}`);
    if (currentView) { currentView.classList.remove('hidden'); currentView.classList.add('flex'); }

    document.getElementById('mobile-title').innerText = { dashboard: 'หน้าแรก', list: 'ลิสต์ประจำ', add: 'บันทึกรายการ', history: 'ประวัติธุรกรรม' }[pageId];

    pageOrder.forEach(p => {
        const btm = document.getElementById(`bottom-nav-${p}`);
        if (btm) btm.className = p === pageId ? "flex flex-col items-center justify-center space-y-0.5 text-indigo-600 flex-1" : "flex flex-col items-center justify-center space-y-0.5 text-slate-400 flex-1";
        const side = document.getElementById(`side-nav-${p}`);
        if (side) side.className = p === pageId ? "w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white" : "w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-slate-200";
    });

    if (pageId === 'history') renderHistory();
    if (pageId === 'dashboard') updateDashboard();
    if (pageId === 'list') { renderRecurringList(); updateRecurringSummary(); }
}

function setType(type) {
    appState.currentType = type;
    document.getElementById('tab-spent').className = type === 'spent' ? "flex-1 py-1 text-[10px] font-bold rounded-full bg-white text-slate-800 shadow-sm" : "flex-1 py-1 text-[10px] font-bold rounded-full text-slate-400";
    document.getElementById('tab-income').className = type === 'income' ? "flex-1 py-1 text-[10px] font-bold rounded-full bg-white text-slate-800 shadow-sm" : "flex-1 py-1 text-[10px] font-bold rounded-full text-slate-400";
    uiState.selectedCategory = categories[type][0].id; renderCategories();
}

function renderCategories() {
    renderCategoriesService({
        currentType: appState.currentType,
        selectedCategory: uiState.selectedCategory,
        selectedAccount: uiState.selectedAccount,
        txHistory: appState.txHistory,
        onSelectCategory: (categoryId) => {
            uiState.selectedCategory = categoryId;
            renderCategories();
        },
        onSelectAccount: (accountId) => {
            uiState.selectedAccount = accountId;
            renderAccounts();
        },
        onGuessAccount: (categoryId, txHistory) => guessAccountForCategory(categoryId, txHistory),
        onAccountGuessed: (accountId) => {
            const accountName = accounts.find((a) => a.id === accountId)?.name;
            if (accountName) showToast(`เดาช่องทางจ่าย: ${accountName}`, 'success');
        },
    });
}

function renderAccounts() {
    renderAccountsService({
        selectedAccount: uiState.selectedAccount,
        onSelectAccount: (accountId) => {
            uiState.selectedAccount = accountId;
            renderAccounts();
        },
    });
}

const display = document.getElementById('display');

function showScannedNote(iconName, message) {
    const noteEl = document.getElementById('scanned-note');
    if (!noteEl) return;

    noteEl.replaceChildren();
    noteEl.appendChild(createIcon(iconName, 'w-3 h-3 inline-block'));
    noteEl.appendChild(document.createTextNode(` ${message}`));
    noteEl.classList.remove('hidden');
    lucide.createIcons();
}

function pressClearAll() {
    clearCalculator(uiState);
    display.innerText = uiState.expression;

    // เคลียร์ข้อมูลสแกนเมื่อกด C
    resetCalculatorScanState(uiState);
    const noteEl = document.getElementById('scanned-note');
    if (noteEl) {
        noteEl.classList.add('hidden');
        noteEl.replaceChildren();
    }
}

function pressQuickPrice(value) { quickPriceCalculator(uiState, value); display.innerText = uiState.expression; }
function pressKey(key) { inputDigitCalculator(uiState, key); display.innerText = uiState.expression; }
function pressOp(op) { inputOperatorCalculator(uiState, op); display.innerText = uiState.expression; }

function pressClear() {
    backspaceCalculator(uiState);
    display.innerText = uiState.expression;

    // ถ้ากดปุ่ม ⌫ ลบจนเหลือ 0 ให้เคลียร์ข้อมูลสแกนทิ้งด้วย
    if (uiState.expression === '0') {
        resetCalculatorScanState(uiState);
        const noteEl = document.getElementById('scanned-note');
        if (noteEl) {
            noteEl.classList.add('hidden');
            noteEl.replaceChildren();
        }
    }
}

function calculate() {
    try {
        calculateCalculator(uiState);
        display.innerText = uiState.expression;
    } catch (e) {
        display.innerText = '0';
        uiState.expression = '0';
    }
}

function playScanSuccessSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
        oscillator.stop(audioCtx.currentTime + 0.12);
    } catch (e) {
        console.error("Failed to play scan sound:", e);
    }
}

function autoSelectCategoryByName(name) {
    if (!name) return;
    name = name.toLowerCase().trim();

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
            const selectEl = document.getElementById('req-category');
            if (selectEl) { selectEl.value = mapping.categoryId; }
            break;
        }
    }
}

function openRecurringModal(id = null) {
    openRecurringModalService({
        id,
        categories,
        accounts,
        getRecurringItems,
    });
}
function closeRecurringModal() { closeRecurringModalService({}); }

async function saveRecurringItem() {
    await saveRecurringItemService({
        categories,
        accounts,
        currentUserProfileId,
        getRecurringItems,
        saveRecurringItems,
        closeRecurringModalFn: closeRecurringModal,
        renderRecurringListFn: renderRecurringList,
        updateRecurringSummaryFn: updateRecurringSummary,
        apiClient,
        showToast,
        setButtonLoading,
    });
}

function deleteRecurringItem(id) { deleteRecurringItemService({ id, triggerResetConfirm }); }

async function executeDeleteRecurring(id) {
    await executeDeleteRecurringService({
        id,
        currentUserProfileId,
        getRecurringItems,
        saveRecurringItems,
        renderRecurringListFn: renderRecurringList,
        updateRecurringSummaryFn: updateRecurringSummary,
        showToast,
        apiClient,
    });
}

function toggleFavRecurring(id) {
    toggleFavRecurringService({
        id,
        currentUserProfileId,
        getRecurringItems,
        saveRecurringItems,
        renderRecurringListFn: renderRecurringList,
    });
}

async function payRecurringItem(id) {
    await payRecurringItemService({
        id,
        currentUserProfileId,
        getRecurringItems,
        saveRecurringItems,
        updateDashboardFn: updateDashboard,
        updateRecurringSummaryFn: updateRecurringSummary,
        renderRecurringListFn: renderRecurringList,
        showToast,
        apiClient,
        appState,
        categories,
        accounts,
        getHistoryKey,
    });
}

// ----------------------------------------------------------------------
// ซิงค์และประมวลผลข้อมูล (Memory-based)
// ----------------------------------------------------------------------

async function syncDataFromSheet() {
    try {
        await syncDataFromSheetFlow({
            apiClient,
            currentUserProfileId,
            categories,
            accounts,
            saveRecurringItems,
            getHistoryKey,
            updateDashboardFn: updateDashboard,
            renderHistoryFn: renderHistory,
            renderRecurringListFn: renderRecurringList,
            updateRecurringSummaryFn: updateRecurringSummary,
            appState,
        });
    } catch (error) {
        console.error("Sync Error (ใช้งานโหมด Offline):", error);
    }
}

async function saveTransaction() {
    const btn = document.getElementById('btn-save');
    const loadingState = setButtonLoading(btn, { label: 'กำลังบันทึก...', iconClass: 'w-4 h-4' });
    try {
        await saveTransactionFlow({
            uiState,
            appState,
            currentUserProfileId,
            categories,
            accounts,
            getHistoryKey,
            updateDashboardFn: updateDashboard,
            renderHistoryFn: renderHistory,
            showToast,
            apiClient,
            document,
            display,
            setLocalDatetime,
        });
    } finally {
        loadingState?.restore();
    }
}

function editTransaction(id) {
    const tx = appState.txHistory.find(t => t.id === id); if (!tx) return;
    const draft = buildEditDraft({
        tx,
        currentType: tx.type,
        categories,
        accounts,
    });
    uiState.editModeId = draft.editModeId;
    setType(tx.type);
    uiState.selectedCategory = draft.selectedCategory;
    uiState.selectedAccount = draft.selectedAccount;
    uiState.expression = draft.expression;
    display.innerText = uiState.expression;
    uiState.currentSlipRefNo = tx.slipRefNo || "";
    document.getElementById('tx-date').value = draft.isoDate;
    renderCategories(); renderAccounts(); switchPage('add');
}

function deleteTransaction(id) { triggerResetConfirm('delete_item', id); }

async function executeDelete(id) {
    await executeDeleteFlow({
        id,
        appState,
        currentUserProfileId,
        getHistoryKey,
        updateDashboardFn: updateDashboard,
        renderHistoryFn: renderHistory,
        showToast,
        apiClient,
    });
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container'); const toast = document.createElement('div');
    toast.className = `${type === 'success' ? 'bg-slate-900 text-white' : 'bg-rose-600 text-white'} w-full flex items-center space-x-2 px-3 py-2 rounded-lg shadow-xl text-[10px] font-bold pointer-events-auto`;
    toast.appendChild(createIcon(type === 'success' ? 'check-circle' : 'alert-circle', 'w-3 h-3'));
    const text = createEl('span', { className: 'truncate' });
    setText(text, message);
    toast.appendChild(text);
    container.appendChild(toast); lucide.createIcons(); setTimeout(() => { toast.remove(); }, 1500);
}

let onConfirmCallback = null;
function triggerResetConfirm(type = 'all', id = null) {
    document.getElementById('custom-confirm-dialog').classList.remove('hidden');
    applyConfirmDialogPreset({
        title: document.getElementById('confirm-title'),
        desc: document.getElementById('confirm-desc'),
        btn: document.getElementById('confirm-btn-action'),
        iconWrapper: document.getElementById('confirm-icon-wrapper'),
        iconBg: document.getElementById('confirm-icon-bg'),
    }, type);

    // ผูก Callback เป็น Async
    onConfirmCallback = async (isConfirmed) => {
        if (isConfirmed) {
            if (type === 'all') { appState.txHistory = []; uiState.expression = '0'; display.innerText = uiState.expression; localStorage.setItem(getHistoryKey(), JSON.stringify(appState.txHistory)); updateDashboard(); if (appState.currentPage === 'history') renderHistory(); showToast('ล้างข้อมูลสำเร็จ', 'success'); }
            else if (type === 'delete_item') { await executeDelete(id); }
            else if (type === 'delete_recurring') { await executeDeleteRecurring(id); }
            else if (type === 'switch_profile') { showProfileSelection(); }
            else if (type === 'delete_profile') { await executeDeleteProfile(id); }
        }
    };
}

async function closeConfirmDialog(result) {
    const dialog = document.getElementById('custom-confirm-dialog');
    if (result && onConfirmCallback) {
        const btn = document.getElementById('confirm-btn-action');
        const loadingState = setDialogConfirmLoading(btn);

        await onConfirmCallback(result); // รอให้ลบเสร็จ

        loadingState?.restore();
    } else if (!result && onConfirmCallback) {
        onConfirmCallback(result);
    }
    dialog.classList.add('hidden');
    onConfirmCallback = null;
}

document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    setLocalDatetime();
    renderCategories();
    renderAccounts();
    updateDashboard();
    switchPage('add');
    await initProfileSystem();
    if (currentUserProfileId) {
        await syncDataFromSheet();
    }
});

// Expose functions globally for HTML inline event handlers
window.switchPage = switchPage;
window.triggerResetConfirm = triggerResetConfirm;
window.setType = setType;
window.processSlipOCR = processSlipOCR;
window.openRecurringModal = openRecurringModal;
window.closeRecurringModal = closeRecurringModal;
window.saveRecurringItem = saveRecurringItem;
window.deleteRecurringItem = deleteRecurringItem;
window.toggleFavRecurring = toggleFavRecurring;
window.payRecurringItem = payRecurringItem;
window.pressClearAll = pressClearAll;
window.pressQuickPrice = pressQuickPrice;
window.pressKey = pressKey;
window.pressOp = pressOp;
window.pressClear = pressClear;
window.calculate = calculate;
window.saveTransaction = saveTransaction;
window.editTransaction = editTransaction;
window.deleteTransaction = deleteTransaction;
window.closeConfirmDialog = closeConfirmDialog;
window.autoSelectCategoryByName = autoSelectCategoryByName;
window.formatCurrencyInput = formatCurrencyInput;

// อย่าลืม Expose ฟังก์ชันใหม่ใส่บรรทัดล่างสุดด้วย
window.showProfileSelection = showProfileSelection;
window.selectProfile = selectProfile;
window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;
window.handleProfileImageSelect = handleProfileImageSelect;
window.saveProfileData = saveProfileData;
window.closeProfileSelection = closeProfileSelection;
window.deleteCurrentEditingProfile = deleteCurrentEditingProfile;
