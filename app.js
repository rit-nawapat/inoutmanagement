import { createApiClient } from './src/api-client.mjs';
import { stateStore } from './src/state-store.mjs';
import { initSyncQueue, syncQueueInstance } from './src/sync-queue.mjs';
import {
    loadCurrentProfileId,
    loadSavedProfiles,
    getHistoryStorageKey,
    getRecurringStorageKey,
    loadRecurringItems,
    isDraftTransactionDateFresh,
    saveCurrentProfileId,
    saveSavedProfiles,
    saveRecurringItems,
    loadBudgetGroups,
    saveBudgetGroups,
} from './src/core.mjs';
import { createEl, setText, nextFrame } from './src/dom-helpers.mjs';
import { createIcon } from './src/render-helpers.mjs';
import { hideModal, showModal } from './src/modal-helpers.mjs';
import {
    accounts,
    categories,
    formatCurrencyInput,
    guessAccountForCategory,
    renderAccounts as renderAccountsService,
    renderCategories as renderCategoriesService,
} from './src/catalog-service.mjs';
import { setButtonLoading, setDialogConfirmLoading } from './src/button-helpers.mjs';
import { applyConfirmDialogPreset, resolveConfirmDialog, showConfirmDialog } from './src/confirm-dialog.mjs';
import { buildEditDraft } from './src/transaction-service.mjs';

// Profile service
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

// Flow service
import {
    executeDeleteFlow,
    saveTransactionFlow,
    syncDataFromSheetFlow,
} from './src/flow-service.mjs';

// Recurring service
import {
    closeRecurringModal as closeRecurringModalService,
    cancelRecurringPayment as cancelRecurringPaymentService,
    deleteRecurringItem as deleteRecurringItemService,
    executeDeleteRecurring as executeDeleteRecurringService,
    openRecurringModal as openRecurringModalService,
    payRecurringItem as payRecurringItemService,
    saveRecurringItem as saveRecurringItemService,
    toggleFavRecurring as toggleFavRecurringService,
} from './src/recurring-service.mjs';

// App state & UI state
import { appState } from './src/app-state.mjs';
import { uiState } from './src/ui-state.mjs';

// Ledger service
import {
    getRecurringItems as getRecurringItemsService,
    renderHistory as renderHistoryService,
    renderRecurringList as renderRecurringListService,
    updateDashboard as updateDashboardService,
    updateRecurringSummary as updateRecurringSummaryService,
    renderUpcomingForecast,
} from './src/ledger-service.mjs';

// Budget service
import {
    initBudgetUi,
    renderBudgetSummary,
    renderBudgetSelector,
    populateBudgetSelectOptions,
    renderManageBudgetGroupsList,
    calculateRemainingBalances,
    openManageBudgetGroupsModal,
    closeManageBudgetGroupsModal,
    cancelBudgetGroupEdit,
    saveBudgetGroup,
    onRequireBudgetGroupChooser,
    closeBudgetChooserModal,
    confirmPayRecurringWithBudget,
} from './src/budget-service.mjs';

// Debt service
import {
    initDebtUi,
    renderDebtPage,
    openDebtPaymentModal,
    closeDebtPaymentModal,
    submitDebtPayment,
    openDebtAdjustmentModal,
    closeDebtAdjustmentModal,
    submitDebtAdjustment,
} from './src/debt-service.mjs';

// Calculator service
import {
    initCalculatorUi,
    handleCalculatorKeyboardInput,
    pressClearAll,
    pressQuickPrice,
    pressKey,
    pressOp,
    pressClear,
    calculate,
} from './src/calculator-service.mjs';

// OCR service
import {
    showScannedNote,
    autoSelectCategoryByName,
} from './src/ocr-service.mjs';

const GOOGLE_SHEET_API_URL = import.meta.env.VITE_GOOGLE_SHEET_PROXY_URL || import.meta.env.VITE_GOOGLE_SHEET_API_URL;
const apiClient = createApiClient(GOOGLE_SHEET_API_URL);
initSyncQueue(apiClient, stateStore);

let currentUserProfileId = loadCurrentProfileId(localStorage);
let allProfiles = loadSavedProfiles(localStorage);
let allBudgetGroups = loadBudgetGroups(localStorage, currentUserProfileId);
let syncInFlight = null;
let lastSyncAt = 0;
const AUTO_SYNC_MIN_INTERVAL_MS = 15000;

// Load state store initial cache and sync variables
stateStore.set('profiles', allProfiles, true);
if (currentUserProfileId) {
    stateStore.set('txHistory', appState.txHistory, true);
    stateStore.set('budgetGroups', allBudgetGroups, true);
    stateStore.set('recurringItems', loadRecurringItems(localStorage, currentUserProfileId), true);
}

// Keep variables in sync with state store
stateStore.subscribe('budgetGroups:updated', (groups) => {
    allBudgetGroups = groups;
});
stateStore.subscribe('profiles:updated', (profiles) => {
    allProfiles = profiles;
});

const selectedImageState = { base64: null, mimeType: null, fileName: null };

// Initialize UI Services with App Context
initDebtUi({
    get accounts() { return accounts; },
    currentUserProfileId: () => currentUserProfileId,
    getHistoryKey,
    get appState() { return appState; },
    get localStorage() { return localStorage; },
    syncQueueInstance: () => syncQueueInstance,
    apiClient,
    showToast,
    updateDashboard,
    renderDebt,
    renderHistory
});

initCalculatorUi({
    get uiState() { return uiState; },
    saveDraft
});

initBudgetUi({
    allBudgetGroups: () => allBudgetGroups,
    currentUserProfileId: () => currentUserProfileId,
    saveBudgetGroups,
    get localStorage() { return localStorage; },
    updateDashboard,
    syncQueueInstance: () => syncQueueInstance,
    showToast,
    apiClient,
    showConfirmDialog,
    setButtonLoading,
    nextFrame,
    lucide
});

// -------------------------------------------------------------
// Getters
// -------------------------------------------------------------
function getHistoryKey() { return getHistoryStorageKey(currentUserProfileId); }
function getRecurringKey() { return getRecurringStorageKey(currentUserProfileId); }
function getRecurringItems() { return getRecurringItemsService(localStorage, currentUserProfileId); }

// -------------------------------------------------------------
// Selectors & UI Update Functions
// -------------------------------------------------------------
function selectBudgetGroup(groupId) {
    uiState.selectedBudgetGroupId = groupId;
    renderBudgetSelector({
        groups: allBudgetGroups,
        txHistory: appState.txHistory,
        selectedBudgetGroupId: uiState.selectedBudgetGroupId,
        onSelect: selectBudgetGroup,
        doc: document,
        lucide: lucide
    });
    renderBudgetSelector({
        groups: allBudgetGroups,
        txHistory: appState.txHistory,
        selectedBudgetGroupId: uiState.selectedBudgetGroupId,
        onSelect: selectBudgetGroup,
        containerId: 'tx-budget-group-grid-modal',
        doc: document,
        lucide: lucide
    });
    updateCompactSelectionSummary();
    closeBudgetSelectorModal();
    saveDraft();
}

function updateCompactSelectionSummary() {
    const accountLabel = document.getElementById('tx-account-summary-text');
    const budgetLabel = document.getElementById('tx-budget-summary-text');
    const budgetButton = document.getElementById('tx-budget-summary-row');
    const selectedAccount = accounts.find((acc) => acc.id === uiState.selectedAccount);
    const calculatedGroups = calculateRemainingBalances(allBudgetGroups, appState.txHistory);
    const selectedGroup = calculatedGroups.find((group) => group && group.id != null && String(group.id) === String(uiState.selectedBudgetGroupId));

    if (accountLabel) setText(accountLabel, selectedAccount?.name || 'เลือกช่องทาง');
    if (budgetLabel) setText(budgetLabel, selectedGroup?.name || 'ไม่ใช้กระเป๋า');

    const budgetSection = document.getElementById('tx-budget-group-section');
    if (budgetSection) {
        budgetSection.classList.toggle('hidden', appState.currentType !== 'spent');
    }
}

function openAccountSelectorModal() {
    showModal('account-selector-modal');
}

function closeAccountSelectorModal() {
    hideModal('account-selector-modal');
}

function openBudgetSelectorModal() {
    if (appState.currentType !== 'spent') return;
    showModal('budget-selector-modal');
}

function closeBudgetSelectorModal() {
    hideModal('budget-selector-modal');
}

function updateDashboard() {
    updateDashboardService(appState.txHistory);
    renderBudgetSummary({
        groups: allBudgetGroups,
        txHistory: appState.txHistory,
        doc: document,
        lucide: lucide
    });
    renderBudgetSelector({
        groups: allBudgetGroups,
        txHistory: appState.txHistory,
        selectedBudgetGroupId: uiState.selectedBudgetGroupId,
        onSelect: selectBudgetGroup,
        doc: document,
        lucide: lucide
    });
    renderBudgetSelector({
        groups: allBudgetGroups,
        txHistory: appState.txHistory,
        selectedBudgetGroupId: uiState.selectedBudgetGroupId,
        onSelect: selectBudgetGroup,
        containerId: 'tx-budget-group-grid-modal',
        doc: document,
        lucide: lucide
    });
    renderUpcomingForecast({
        txHistory: appState.txHistory,
        storage: localStorage,
        profileId: currentUserProfileId,
        accounts: accounts,
        doc: document,
        lucide: lucide
    });
    updateCompactSelectionSummary();
}

function updateRecurringSummary() { updateRecurringSummaryService(appState.txHistory, localStorage, currentUserProfileId); }
function renderRecurringList() {
    renderRecurringListService({
        storage: localStorage,
        profileId: currentUserProfileId,
        onPay: payRecurringItem,
        onCancelPay: (id) => cancelRecurringPayment(id),
        onToggleFav: toggleFavRecurring,
        onEdit: openRecurringModal,
        onDelete: deleteRecurringItem,
        budgetGroups: allBudgetGroups,
    });
}
function renderDebt() {
    renderDebtPage({
        txHistory: appState.txHistory,
        accounts: accounts,
        onPayDebt: openDebtPaymentModal,
        onAdjustDebt: openDebtAdjustmentModal,
        onSpendDebt: (acc) => {
            switchPage('add');
            setType('spent');
            setAccountTab('debt');
            // Select the specific debt account (credit vs spaylater)
            uiState.selectedAccount = acc.id;
            renderAccounts();
            saveDraft();
        },
        doc: document,
        lucide: lucide
    });
}
function renderHistory() {
    renderHistoryService({
        txHistory: appState.txHistory,
        onEdit: editTransaction,
        onDelete: deleteTransaction,
        storage: localStorage,
        profileId: currentUserProfileId,
    });
}

// -------------------------------------------------------------
// ระบบ Profile (Netflix Style) UI Wrappers
// -------------------------------------------------------------
function setProfileSelectionLoading(isLoading) {
    const loadingBlock = document.getElementById('profile-loading-block');
    const profileGrid = document.getElementById('profile-grid-container');
    const profileSyncIndicator = document.getElementById('profile-sync-indicator');
    const profileSyncIndicatorText = document.getElementById('profile-sync-indicator-text');
    const hasProfiles = allProfiles.length > 0;
    if (loadingBlock) loadingBlock.classList.toggle('hidden', !isLoading || hasProfiles);
    if (profileGrid) profileGrid.classList.toggle('hidden', isLoading && !hasProfiles);
    if (profileSyncIndicator) profileSyncIndicator.classList.toggle('hidden', !isLoading || !hasProfiles);
    setText(profileSyncIndicatorText, isLoading ? 'ตรวจสอบล่าสุด' : '');
}

async function initProfileSystem() {
    renderProfileGrid();
    setProfileSelectionLoading(true);

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
    finally {
        setProfileSelectionLoading(false);
    }
}

function showProfileSelection() { showProfileSelectionService({ currentUserProfileId, allProfiles, renderProfileGrid }); }
function closeProfileSelection() { closeProfileSelectionService({}); }
function renderProfileGrid() { renderProfileGridService({ container: document.getElementById('profile-grid-container'), allProfiles, currentUserProfileId, onSelectProfile: selectProfile, onOpenProfileModal: openProfileModal }); }
function selectProfile(id) {
    currentUserProfileId = id; saveCurrentProfileId(localStorage, currentUserProfileId);
    document.getElementById('page-profile-selection').classList.add('hidden'); updateActiveProfileUI();
    const history = JSON.parse(localStorage.getItem(getHistoryKey()) || '[]');
    const budget = loadBudgetGroups(localStorage, currentUserProfileId);
    const recurring = loadRecurringItems(localStorage, currentUserProfileId);
    stateStore.set('txHistory', history, true); stateStore.set('budgetGroups', budget, true); stateStore.set('recurringItems', recurring, true);
    allBudgetGroups = budget; appState.txHistory = history;
    updateDashboard(); if (appState.currentPage === 'history') renderHistory();
    if (appState.currentPage === 'list') { renderRecurringList(); updateRecurringSummary(); }
    showToast(`เข้าสู่ระบบ: ${allProfiles.find(p => p.id === id)?.name}`, 'success'); syncDataFromSheet({ force: true });
}
function updateActiveProfileUI() { updateActiveProfileUIService({ currentUserProfileId, allProfiles }); }
function openProfileModal(id) { openProfileModalService({ id, allProfiles, selectedImageState }); }
function openActiveProfileSettings() { openProfileModal(currentUserProfileId); }
function deleteCurrentEditingProfile() { deleteCurrentEditingProfileService({ closeProfileModalFn: closeProfileModal, triggerResetConfirm }); }
async function executeDeleteProfile(id) { allProfiles = await executeDeleteProfileService({ id, allProfiles, currentUserProfileId, setCurrentUserProfileId: (value) => { currentUserProfileId = value; }, saveSavedProfiles, saveCurrentProfileId, appState, updateDashboardFn: updateDashboard, renderProfileGridFn: renderProfileGrid, showProfileSelectionFn: showProfileSelection, showToast, apiClient }); }
function closeProfileModal() { closeProfileModalService({}); }
function handleProfileImageSelect(event) { handleProfileImageSelectService({ event, selectedImageState }); }
async function saveProfileData() { await saveProfileDataService({ allProfiles, currentUserProfileId, selectedImageState, apiClient, saveSavedProfiles, updateActiveProfileUIFn: updateActiveProfileUI, renderProfileGridFn: renderProfileGrid, closeProfileModalFn: closeProfileModal, showToast }); }

// -------------------------------------------------------------
// รายการประจำ Wrappers
// -------------------------------------------------------------
function openRecurringModal(id = null) {
    openRecurringModalService({
        id,
        categories,
        accounts,
        budgetGroups: allBudgetGroups,
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

async function cancelRecurringPayment(id) {
    await cancelRecurringPaymentService({
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
        budgetGroups: allBudgetGroups,
        saveBudgetGroupsFn: saveBudgetGroups,
        showConfirmDialogFn: showConfirmDialog,
    });
}

function deleteRecurringItem(id) {
    deleteRecurringItemService({ id, triggerResetConfirm });
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
        budgetGroups: allBudgetGroups,
        saveBudgetGroupsFn: saveBudgetGroups,
        onRequireBudgetGroupChooser,
        showConfirmDialogFn: showConfirmDialog,
    });
}

function quickAddRecurring(key) {
    const defaultNames = {
        rent: { name: 'ค่าเช่าบ้าน', categoryId: 'bills', desc: 'ทุกสิ้นเดือน' },
        electricity: { name: 'ค่าไฟ', categoryId: 'electricity', desc: 'ทุกสิ้นเดือน' },
        water: { name: 'ค่าน้ำ', categoryId: 'water', desc: 'ทุกสิ้นเดือน' },
        internet: { name: 'ค่าเน็ต', categoryId: 'internet', desc: 'ทุกสิ้นเดือน' },
        phone: { name: 'ค่าโทรศัพท์', categoryId: 'bills', desc: 'ทุกสิ้นเดือน' },
        car: { name: 'ค่ารถ', categoryId: 'transport', desc: 'ทุกสิ้นเดือน' }
    };
    
    const def = defaultNames[key] || { name: 'รายการใหม่', categoryId: 'bills', desc: 'ทุกสิ้นเดือน' };
    
    openRecurringModal();
    
    setTimeout(() => {
        const nameEl = document.getElementById('req-name');
        const descEl = document.getElementById('req-desc');
        const catEl = document.getElementById('req-category');
        if (nameEl) nameEl.value = def.name;
        if (descEl) descEl.value = def.desc;
        if (catEl) catEl.value = def.categoryId;
    }, 50);
}

// -------------------------------------------------------------
// App routing & Tabs
// -------------------------------------------------------------
appState.txHistory = JSON.parse(localStorage.getItem(getHistoryKey()) || localStorage.getItem('my_tx_history') || '[]');

uiState.selectedCategory = categories.spent[0].id;
uiState.selectedAccount = accounts[0].id;

let isDateManuallyChanged = false;
let isUpdatingProgrammatically = false;

function setLocalDatetime() {
    isUpdatingProgrammatically = true;
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const txDate = document.getElementById('tx-date');
    if (txDate) {
        txDate.value = now.toISOString().slice(0, 16);
        txDate.dispatchEvent(new Event('change', { bubbles: true }));
    }
    isDateManuallyChanged = false;
    isUpdatingProgrammatically = false;
}

let touchStartX = 0, touchEndX = 0;
const pageOrder = ['dashboard', 'list', 'add', 'debt', 'history'];

function isStandalonePwa() {
    return Boolean(
        window.matchMedia?.('(display-mode: standalone)')?.matches ||
        window.navigator?.standalone
    );
}

const mainTouchZone = document.getElementById('main-touch-zone');
if (mainTouchZone) {
    mainTouchZone.addEventListener('touchstart', (e) => {
        if (e.target.closest('#category-grid') || e.target.closest('#account-grid') || e.target.closest('#qr-reader') || e.target.closest('input') || e.target.closest('button')) return;
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    mainTouchZone.addEventListener('touchend', (e) => {
        if (e.target.closest('#category-grid') || e.target.closest('#account-grid') || e.target.closest('#qr-reader') || e.target.closest('input') || e.target.closest('button')) return;
        touchEndX = e.changedTouches[0].screenX;
        let distance = touchEndX - touchStartX;
        if (distance > 75 && pageOrder.indexOf(appState.currentPage) > 0) { switchPage(pageOrder[pageOrder.indexOf(appState.currentPage) - 1]); }
        else if (distance < -75 && pageOrder.indexOf(appState.currentPage) < pageOrder.length - 1) { switchPage(pageOrder[pageOrder.indexOf(appState.currentPage) + 1]); }
    }, { passive: true });
} else {
    console.error("Warning: Element #main-touch-zone not found in DOM.");
}

function setupStandalonePullToRefresh() {
    const mainContent = document.getElementById('main-content-scroll');
    if (!mainContent) return;

    let startY = 0;
    let pullDistance = 0;
    let isPulling = false;
    let isRefreshing = false;

    const canUsePullToRefresh = () => window.innerWidth <= 767 && isStandalonePwa();
    const resetPullVisual = () => {
        mainContent.style.transition = 'transform 180ms ease';
        mainContent.style.transform = 'translateY(0px)';
        window.setTimeout(() => {
            mainContent.style.transition = '';
        }, 180);
    };

    mainContent.addEventListener('touchstart', (event) => {
        if (!canUsePullToRefresh() || isRefreshing) return;
        if (mainContent.scrollTop > 0) return;
        if (event.target.closest('button, input, textarea, select, dialog, [role="dialog"]')) return;
        startY = event.touches[0]?.clientY || 0;
        pullDistance = 0;
        isPulling = false;
    }, { passive: true });

    mainContent.addEventListener('touchmove', (event) => {
        if (!canUsePullToRefresh() || isRefreshing || !startY) return;
        if (mainContent.scrollTop > 0) return;

        const currentY = event.touches[0]?.clientY || 0;
        const deltaY = currentY - startY;
        if (deltaY <= 0) return;

        isPulling = true;
        pullDistance = Math.min(88, deltaY * 0.42);
        mainContent.style.transition = 'none';
        mainContent.style.transform = `translateY(${pullDistance}px)`;
        event.preventDefault();
    }, { passive: false });

    mainContent.addEventListener('touchend', async () => {
        if (!isPulling) {
            startY = 0;
            return;
        }

        const shouldRefresh = pullDistance >= 56;
        startY = 0;
        isPulling = false;

        if (!shouldRefresh) {
            resetPullVisual();
            return;
        }

        isRefreshing = true;
        mainContent.style.transition = 'transform 180ms ease';
        mainContent.style.transform = 'translateY(32px)';

        try {
            await syncDataFromSheet({ force: true });
            showToast('รีเฟรชข้อมูลล่าสุดแล้ว', 'success');
        } catch (error) {
            console.error('Pull-to-refresh failed:', error);
            showToast('รีเฟรชไม่สำเร็จ', 'error');
        } finally {
            pullDistance = 0;
            resetPullVisual();
            window.setTimeout(() => {
                isRefreshing = false;
            }, 180);
        }
    }, { passive: true });
}

function switchPage(pageId) {
    appState.currentPage = pageId;
    syncViewportMetrics();
    document.body.classList.toggle('is-add-page', pageId === 'add');
    pageOrder.forEach(p => { const target = document.getElementById(`page-${p}`); if (target) { target.classList.add('hidden'); target.classList.remove('flex'); } });
    const currentView = document.getElementById(`page-${pageId}`);
    if (currentView) { currentView.classList.remove('hidden'); currentView.classList.add('flex'); }
    const mainContent = document.getElementById('main-content-scroll');
    if (mainContent) {
        mainContent.classList.toggle('overflow-hidden', pageId === 'add');
        mainContent.classList.toggle('overflow-visible', pageId !== 'add');
    }
    if (pageId === 'add') scrollMainContentToTop();
    if (pageId === 'add' && !uiState.editModeId && !isDateManuallyChanged) {
        setLocalDatetime();
    }

    document.getElementById('mobile-title').innerText = { dashboard: 'หน้าแรก', list: 'ลิสต์ประจำ', add: 'บันทึกรายการ', history: 'ประวัติธุรกรรม', debt: 'จัดการหนี้สิน' }[pageId];

    pageOrder.forEach(p => {
        if (p === 'add') {
            const btmAdd = document.getElementById(`bottom-nav-add`);
            if (btmAdd) {
                if (p === pageId) {
                    btmAdd.classList.add('ring-4', 'ring-indigo-300');
                } else {
                    btmAdd.classList.remove('ring-4', 'ring-indigo-300');
                }
            }
        } else {
            const btm = document.getElementById(`bottom-nav-${p}`);
            if (btm) btm.className = p === pageId ? "flex flex-col items-center justify-center space-y-1 text-indigo-600 w-12" : "flex flex-col items-center justify-center space-y-1 text-slate-400 w-12";
        }
        
        const side = document.getElementById(`side-nav-${p}`);
        if (side) side.className = p === pageId ? "w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white" : "w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-slate-200";
    });

    if (pageId === 'history') renderHistory();
    if (pageId === 'dashboard') updateDashboard();
    if (pageId === 'list') { renderRecurringList(); updateRecurringSummary(); }
    if (pageId === 'debt') renderDebt();
}

function scrollMainContentToTop() {
    const mainContent = document.getElementById('main-content-scroll');
    mainContent?.scrollTo?.({ top: 0, behavior: 'auto' });
    if (typeof window !== 'undefined') window.scrollTo?.({ top: 0, behavior: 'auto' });
}

function syncViewportMetrics() {
    const root = document.documentElement;
    const viewportHeight = Math.round(window.visualViewport?.height || window.innerHeight || root.clientHeight);
    const headerHeight = Math.ceil(document.getElementById('mobile-app-header')?.getBoundingClientRect().height || 54);
    const navHeight = Math.ceil(document.getElementById('bottom-nav')?.getBoundingClientRect().height || 74);
    const contentHeight = Math.max(320, viewportHeight - headerHeight - navHeight);

    root.style.setProperty('--app-height', `${viewportHeight}px`);
    root.style.setProperty('--mobile-header-height', `${headerHeight}px`);
    root.style.setProperty('--mobile-nav-height', `${navHeight}px`);
    root.style.setProperty('--content-height', `${contentHeight}px`);
}

function setupViewportMetricListeners() {
    syncViewportMetrics();
    window.addEventListener('resize', syncViewportMetrics);
    window.addEventListener('orientationchange', () => setTimeout(syncViewportMetrics, 250));
    window.visualViewport?.addEventListener?.('resize', syncViewportMetrics);
    window.visualViewport?.addEventListener?.('scroll', syncViewportMetrics);
}

function setType(type) {
    appState.currentType = type;
    document.getElementById('tab-spent').className = type === 'spent' ? "flex-1 py-1 text-[10px] font-bold rounded-full bg-white text-slate-800 shadow-sm" : "flex-1 py-1 text-[10px] font-bold rounded-full text-slate-400";
    document.getElementById('tab-income').className = type === 'income' ? "flex-1 py-1 text-[10px] font-bold rounded-full bg-white text-slate-800 shadow-sm" : "flex-1 py-1 text-[10px] font-bold rounded-full text-slate-400";
    
    const budgetCard = document.getElementById('tx-budget-group-section');
    if (budgetCard) {
        if (type === 'spent') {
            budgetCard.classList.remove('hidden');
            budgetCard.classList.add('md:block');
        } else {
            budgetCard.classList.add('hidden');
        }
    }

    updateCompactSelectionSummary();
    uiState.selectedCategory = categories[type][0].id; renderCategories();
    saveDraft();
}

function renderCategories() {
    renderCategoriesService({
        currentType: appState.currentType,
        selectedCategory: uiState.selectedCategory,
        selectedAccount: uiState.selectedAccount,
        txHistory: appState.txHistory,
        onSelectCategory: (id) => {
            uiState.selectedCategory = id;
            renderCategories();
            saveDraft();
        },
        onGuessAccount: guessAccountForCategory,
        onSelectAccount: (id) => {
            uiState.selectedAccount = id;
            renderAccounts();
            saveDraft();
        },
        onAccountGuessed: (id) => {},
        doc: document,
        lucide: lucide
    });
}

function renderAccounts() {
    renderAccountsService({
        selectedAccount: uiState.selectedAccount,
        accountTab: uiState.accountTab,
        showAllAccounts: true,
        onSelectAccount: (id) => {
            uiState.selectedAccount = id;
            renderAccounts();
            saveDraft();
        },
        doc: document,
        lucide: lucide
    });
    renderAccountsService({
        selectedAccount: uiState.selectedAccount,
        accountTab: uiState.accountTab,
        showAllAccounts: true,
        containerId: 'account-grid-modal',
        onSelectAccount: (id) => {
            uiState.selectedAccount = id;
            renderAccounts();
            closeAccountSelectorModal();
            saveDraft();
        },
        doc: document,
        lucide: lucide
    });
    updateCompactSelectionSummary();
}

function setAccountTab(tab) {
    uiState.accountTab = tab;
    
    const tabMoney = document.getElementById('tab-acc-money');
    const tabDebt = document.getElementById('tab-acc-debt');
    if (tabMoney && tabDebt) {
        if (tab === 'money') {
            tabMoney.className = "flex-1 py-1 text-[9px] font-bold rounded-full bg-white text-slate-800 shadow-sm cursor-pointer";
            tabDebt.className = "flex-1 py-1 text-[9px] font-bold rounded-full text-slate-400 cursor-pointer";
        } else {
            tabDebt.className = "flex-1 py-1 text-[9px] font-bold rounded-full bg-white text-slate-800 shadow-sm cursor-pointer";
            tabMoney.className = "flex-1 py-1 text-[9px] font-bold rounded-full text-slate-400 cursor-pointer";
        }
    }
    
    uiState.selectedAccount = tab === 'money' ? 'cash' : 'credit';
    renderAccounts();
    saveDraft();
}

// -------------------------------------------------------------
// Sync & Transaction Lifecycle Wrappers
// -------------------------------------------------------------
async function syncDataFromSheet({ force = false } = {}) {
    const now = Date.now();
    if (!force && now - lastSyncAt < AUTO_SYNC_MIN_INTERVAL_MS) return;
    lastSyncAt = now;

    if (syncInFlight) return syncInFlight;

    syncInFlight = (async () => {
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
        } finally {
            syncInFlight = null;
        }
    })();

    return syncInFlight;
}

let lastFocusSyncAt = 0;
function setupAutoSyncListeners() {
    const handleFocusSync = () => {
        const now = Date.now();
        if (now - lastFocusSyncAt > 3000) {
            lastFocusSyncAt = now;
            syncDataFromSheet({ force: true });
        }
    };

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            handleFocusSync();
            if (appState.currentPage === 'add' && !uiState.editModeId && !isDateManuallyChanged) {
                setLocalDatetime();
            }
        }
    });

    window.addEventListener('focus', () => {
        handleFocusSync();
        if (appState.currentPage === 'add' && !uiState.editModeId && !isDateManuallyChanged) {
            setLocalDatetime();
        }
    });
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
            budgetGroups: allBudgetGroups,
            saveBudgetGroupsFn: saveBudgetGroups,
            getHistoryKey,
            updateDashboardFn: updateDashboard,
            renderHistoryFn: renderHistory,
            renderRecurringListFn: renderRecurringList,
            updateRecurringSummaryFn: updateRecurringSummary,
            showToast,
            apiClient,
            document,
            display,
            setLocalDatetime,
        });
        clearDraft();
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
    
    const displayEl = document.getElementById('display');
    if (displayEl) displayEl.innerText = uiState.expression;
    const displayInputEl = document.getElementById('display-input');
    if (displayInputEl) displayInputEl.value = uiState.expression;
    
    uiState.currentSlipRefNo = tx.slipRefNo || "";
    const txDate = document.getElementById('tx-date');
    if (txDate) {
        txDate.value = draft.isoDate;
        txDate.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    if (tx.budgetGroupId) {
        selectBudgetGroup(tx.budgetGroupId);
    } else {
        selectBudgetGroup('');
    }
    
    renderCategories(); renderAccounts(); switchPage('add');
}

function deleteTransaction(id) { triggerResetConfirm('delete_item', id); }

async function executeDelete(id) {
    await executeDeleteFlow({
        id,
        appState,
        currentUserProfileId,
        budgetGroups: allBudgetGroups,
        getHistoryKey,
        updateDashboardFn: updateDashboard,
        renderHistoryFn: renderHistory,
        renderRecurringListFn: renderRecurringList,
        updateRecurringSummaryFn: updateRecurringSummary,
        renderDebtFn: renderDebt,
        showToast,
        apiClient,
    });
}

// -------------------------------------------------------------
// Toast & Dialog Alerts
// -------------------------------------------------------------
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container'); const toast = document.createElement('div');
    toast.className = `${type === 'success' ? 'bg-slate-900 text-white' : 'bg-rose-600 text-white'} w-full flex items-center space-x-2 px-3 py-2 rounded-lg shadow-xl text-[10px] font-bold pointer-events-auto`;
    toast.appendChild(createIcon(type === 'success' ? 'check-circle' : 'alert-circle', 'w-3 h-3'));
    const text = createEl('span', { className: 'truncate' });
    setText(text, message);
    toast.appendChild(text);
    container.appendChild(toast); lucide.createIcons(); setTimeout(() => { toast.remove(); }, type === 'success' ? 2500 : 2000);
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

    onConfirmCallback = async (isConfirmed) => {
        if (isConfirmed) {
            if (type === 'all') { 
                appState.txHistory = []; uiState.expression = '0'; display.innerText = uiState.expression; 
                const displayInput = document.getElementById('display-input');
                if (displayInput) displayInput.value = uiState.expression; 
                localStorage.setItem(getHistoryKey(), JSON.stringify(appState.txHistory)); 
                updateDashboard(); if (appState.currentPage === 'history') renderHistory(); 
                showToast('ล้างข้อมูลสำเร็จ', 'success'); 
            }
            else if (type === 'delete_item') { await executeDelete(id); }
            else if (type === 'delete_recurring') { await executeDeleteRecurring(id); }
            else if (type === 'switch_profile') { 
                currentUserProfileId = null;
                saveCurrentProfileId(localStorage, null);
                appState.txHistory = [];
                allBudgetGroups = [];
                uiState.expression = '0';
                display.innerText = uiState.expression;
                const displayInput = document.getElementById('display-input');
                if (displayInput) displayInput.value = uiState.expression;
                updateDashboard();
                showProfileSelection(); 
            }
            else if (type === 'delete_profile') { await executeDeleteProfile(id); }
        }
    };
}

async function closeConfirmDialog(result) {
    if (result && onConfirmCallback) {
        const btn = document.getElementById('confirm-btn-action');
        const loadingState = setDialogConfirmLoading(btn);
        try {
            await onConfirmCallback(result);
        } catch (error) {
            console.error("Error in confirm callback:", error);
            showToast("เกิดข้อผิดพลาดในการดำเนินการ", "error");
        } finally {
            loadingState?.restore();
        }
    } else if (!result && onConfirmCallback) {
        try {
            await onConfirmCallback(result);
        } catch (error) {
            console.error("Error in cancel callback:", error);
        }
    }
    resolveConfirmDialog(result);
    onConfirmCallback = null;
}

// -------------------------------------------------------------
// UI State & Draft Preservation
// -------------------------------------------------------------
function saveDraft() {
    const draft = {
        savedAt: new Date().toISOString(),
        expression: uiState.expression,
        selectedCategory: uiState.selectedCategory,
        selectedAccount: uiState.selectedAccount,
        selectedBudgetGroupId: uiState.selectedBudgetGroupId,
        currentSlipRefNo: uiState.currentSlipRefNo,
        currentScannedBarcode: uiState.currentScannedBarcode,
        txDate: document.getElementById('tx-date')?.value,
        isDateManuallyChanged: isDateManuallyChanged,
    };
    if (stateStore) {
        stateStore.set('uiState', { ...stateStore.get('uiState'), draftTransaction: draft }, true);
    }
    localStorage.setItem('app_draft_transaction', JSON.stringify(draft));
}

function loadDraft() {
    try {
        const draftStr = localStorage.getItem('app_draft_transaction');
        if (draftStr) {
            const draft = JSON.parse(draftStr);
            uiState.expression = draft.expression || '0';
            uiState.selectedCategory = draft.selectedCategory || categories.spent[0].id;
            uiState.selectedAccount = draft.selectedAccount || accounts[0].id;
            uiState.selectedBudgetGroupId = draft.selectedBudgetGroupId || '';
            uiState.currentSlipRefNo = draft.currentSlipRefNo || '';
            uiState.currentScannedBarcode = draft.currentScannedBarcode || '';
            const txDate = document.getElementById('tx-date');
            if (draft.txDate && txDate && isDraftTransactionDateFresh(draft.savedAt)) {
                isUpdatingProgrammatically = true;
                txDate.value = draft.txDate;
                txDate.dispatchEvent(new Event('change', { bubbles: true }));
                isDateManuallyChanged = draft.isDateManuallyChanged || false;
                isUpdatingProgrammatically = false;
            }
            
            // Re-render UI
            const displayEl = document.getElementById('display');
            if (displayEl) displayEl.innerText = uiState.expression;
            const displayInputEl = document.getElementById('display-input');
            if (displayInputEl) displayInputEl.value = uiState.expression;
            renderCategories();
            renderAccounts();
            selectBudgetGroup(uiState.selectedBudgetGroupId);
            if (uiState.currentScannedBarcode) {
                showScannedNote('file-text', uiState.currentScannedBarcode);
            }
        }
    } catch (e) {
        console.error('Failed to load draft:', e);
    }
}

function clearDraft() {
    localStorage.removeItem('app_draft_transaction');
    if (stateStore) {
        stateStore.set('uiState', { ...stateStore.get('uiState'), draftTransaction: null }, true);
    }
}

function updateSyncStatusUI() {
    const queue = syncQueueInstance ? syncQueueInstance.getQueue() : [];
    const count = queue.length;
    
    const desktopEl = document.getElementById('sync-status-desktop');
    const mobileEl = document.getElementById('sync-status-mobile');
    if (!desktopEl || !mobileEl) return;
    
    if (count > 0) {
        const dotHtml = `<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span><span>รอซิงค์ ${count} รายการ</span>`;
        desktopEl.innerHTML = dotHtml;
        desktopEl.className = "flex items-center space-x-1.5 text-[10px] text-amber-400 font-bold mt-0.5";
        
        const mobileDotHtml = `<span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span><span>รอซิงค์ ${count}</span>`;
        mobileEl.innerHTML = mobileDotHtml;
        mobileEl.className = "flex items-center space-x-1 text-[9px] text-amber-400 font-bold mt-0.5";
    } else {
        const dotHtml = `<span class="w-2 h-2 rounded-full bg-emerald-400"></span><span>ซิงค์สำเร็จ</span>`;
        desktopEl.innerHTML = dotHtml;
        desktopEl.className = "flex items-center space-x-1.5 text-[10px] text-emerald-400 font-bold mt-0.5";
        
        const mobileDotHtml = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span><span>ซิงค์สำเร็จ</span>`;
        mobileEl.innerHTML = mobileDotHtml;
        mobileEl.className = "flex items-center space-x-1 text-[9px] text-emerald-400 font-bold mt-0.5";
    }
}

// -------------------------------------------------------------
// App Initialization
// -------------------------------------------------------------
const display = document.getElementById('display');

document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    setupViewportMetricListeners();
    setupStandalonePullToRefresh();
    
    const txDate = document.getElementById('tx-date');
    if (txDate) {
        const updateMobileDateText = () => {
            const val = txDate.value;
            if (!val) return;
            const d = new Date(val);
            if (isNaN(d.getTime())) return;
            
            const now = new Date();
            const todayStr = now.toDateString();
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            const yesterdayStr = yesterday.toDateString();
            
            const dayNames = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
            const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
            
            let dateText = '';
            if (d.toDateString() === todayStr) {
                dateText = 'วันนี้';
            } else if (d.toDateString() === yesterdayStr) {
                dateText = 'เมื่อวาน';
            } else {
                dateText = `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]}`;
            }
            
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            
            const mobileDateTextEl = document.getElementById('selected-date-text-mobile');
            if (mobileDateTextEl) {
                mobileDateTextEl.innerText = `${dateText} ${hours}:${minutes}`;
            }
        };
        const handleDateChange = () => {
            updateMobileDateText();
            if (!isUpdatingProgrammatically) {
                isDateManuallyChanged = true;
            }
        };
        txDate.addEventListener('input', handleDateChange);
        txDate.addEventListener('change', handleDateChange);
        updateMobileDateText();
    }

    setLocalDatetime();

    window.setInterval(() => {
        const txDate = document.getElementById('tx-date');
        if (txDate && appState.currentPage === 'add' && !uiState.editModeId && !isDateManuallyChanged && document.activeElement !== txDate) {
            setLocalDatetime();
        }
    }, 20000);
    renderCategories();
    renderAccounts();
    updateDashboard();
    switchPage('add');
    setupAutoSyncListeners();
    
    const displayInputEl = document.getElementById('display-input');
    if (displayInputEl) {
        displayInputEl.addEventListener('focus', (e) => {
            if (e.target.value === '0') {
                e.target.select();
            }
        });
        displayInputEl.addEventListener('input', (e) => {
            let val = e.target.value.replace(/[^0-9.]/g, '');
            val = val.replace(/^0+([0-9])/, '$1');
            const parts = val.split('.');
            if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
            if (val === '') val = '0';
            e.target.value = val;
            uiState.expression = val;
            const displayEl = document.getElementById('display');
            if (displayEl) displayEl.innerText = uiState.expression;
            saveDraft();
        });
        displayInputEl.addEventListener('blur', (e) => {
            if (uiState.expression.endsWith('.')) {
                uiState.expression = uiState.expression.slice(0, -1);
                e.target.value = uiState.expression;
                const displayEl = document.getElementById('display');
                if (displayEl) displayEl.innerText = uiState.expression;
            }
        });
    }
    
    // Auto sync on success
    stateStore.subscribe('sync:success', () => {
        syncDataFromSheet({ force: true });
        updateSyncStatusUI();
    });

    stateStore.subscribe('sync:started', () => {
         const desktopEl = document.getElementById('sync-status-desktop');
         const mobileEl = document.getElementById('sync-status-mobile');
         if (desktopEl && mobileEl) {
             desktopEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span><span>กำลังซิงค์...</span>`;
             desktopEl.className = "flex items-center space-x-1.5 text-[10px] text-indigo-400 font-bold mt-0.5";
             
             mobileEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span><span>กำลังซิงค์...</span>`;
             mobileEl.className = "flex items-center space-x-1 text-[9px] text-indigo-400 font-bold mt-0.5";
         }
    });

    stateStore.subscribe('sync:failed', () => {
         updateSyncStatusUI();
    });

    stateStore.subscribe('sync:queued', () => {
        updateSyncStatusUI();
    });

    // Physical keyboard and Numpad support for calculator
    document.addEventListener('keydown', (e) => {
        if (appState.currentPage !== 'add') return;
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
            return;
        }
        const handled = handleCalculatorKeyboardInput(uiState, e.key);
        if (handled) {
            e.preventDefault();
            const displayEl = document.getElementById('display');
            if (displayEl) displayEl.innerText = uiState.expression;
            const displayInputEl = document.getElementById('display-input');
            if (displayInputEl) displayInputEl.value = uiState.expression;
            saveDraft();
        }
    });

    await initProfileSystem();
    loadDraft();
    updateSyncStatusUI();
    
    if (currentUserProfileId) {
        await syncDataFromSheet({ force: true });
    }
});

// Expose functions globally for HTML inline event handlers
window.switchPage = switchPage;
window.triggerResetConfirm = triggerResetConfirm;
window.setType = setType;
window.openRecurringModal = openRecurringModal;
window.closeRecurringModal = closeRecurringModal;
window.saveRecurringItem = saveRecurringItem;
window.deleteRecurringItem = deleteRecurringItem;
window.toggleFavRecurring = toggleFavRecurring;
window.payRecurringItem = payRecurringItem;
window.quickAddRecurring = quickAddRecurring;
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
window.setAccountTab = setAccountTab;
window.openAccountSelectorModal = openAccountSelectorModal;
window.closeAccountSelectorModal = closeAccountSelectorModal;
window.openBudgetSelectorModal = openBudgetSelectorModal;
window.closeBudgetSelectorModal = closeBudgetSelectorModal;

window.showProfileSelection = showProfileSelection;
window.selectProfile = selectProfile;
window.openProfileModal = openProfileModal;
window.openActiveProfileSettings = openActiveProfileSettings;
window.closeProfileModal = closeProfileModal;
window.handleProfileImageSelect = handleProfileImageSelect;
window.saveProfileData = saveProfileData;
window.closeProfileSelection = closeProfileSelection;
window.deleteCurrentEditingProfile = deleteCurrentEditingProfile;

window.openManageBudgetGroupsModal = openManageBudgetGroupsModal;
window.closeManageBudgetGroupsModal = closeManageBudgetGroupsModal;
window.cancelBudgetGroupEdit = cancelBudgetGroupEdit;
window.saveBudgetGroup = saveBudgetGroup;
window.closeBudgetChooserModal = closeBudgetChooserModal;
window.confirmPayRecurringWithBudget = confirmPayRecurringWithBudget;

// Debt service exposure
window.openDebtPaymentModal = openDebtPaymentModal;
window.closeDebtPaymentModal = closeDebtPaymentModal;
window.submitDebtPayment = submitDebtPayment;
window.openDebtAdjustmentModal = openDebtAdjustmentModal;
window.closeDebtAdjustmentModal = closeDebtAdjustmentModal;
window.submitDebtAdjustment = submitDebtAdjustment;

let pickerDates = [];

function openCupertinoDatePicker() {
    const txDate = document.getElementById('tx-date');
    if (!txDate) return;
    
    const currentVal = txDate.value;
    const date = currentVal ? new Date(currentVal) : new Date();
    
    const modal = document.getElementById('cupertino-datepicker-modal');
    const panel = document.getElementById('cupertino-datepicker-panel');
    if (modal && panel) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        modal.offsetHeight; // force reflow
        modal.classList.remove('opacity-0');
        panel.classList.remove('translate-y-full');
    }
    
    initCupertinoPickerWheels(date);
}

function initCupertinoPickerWheels(currentDate) {
    const wheelDate = document.getElementById('wheel-date');
    const wheelHour = document.getElementById('wheel-hour');
    const wheelMinute = document.getElementById('wheel-minute');
    const wheelAmpm = document.getElementById('wheel-ampm');
    
    if (!wheelDate || !wheelHour || !wheelMinute || !wheelAmpm) return;
    
    wheelDate.innerHTML = '';
    pickerDates = [];
    
    const now = new Date();
    const todayStr = now.toDateString();
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();
    
    const dayNames = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
    const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    
    let activeDateIndex = 0;
    
    for (let i = -60; i <= 7; i++) {
        const d = new Date();
        d.setDate(now.getDate() + i);
        pickerDates.push(d);
        
        let text = '';
        if (d.toDateString() === todayStr) {
            text = 'วันนี้';
        } else if (d.toDateString() === yesterdayStr) {
            text = 'เมื่อวาน';
        } else {
            text = `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]}`;
        }
        
        const el = document.createElement('div');
        el.className = 'h-[44px] flex items-center justify-center snap-center shrink-0 transition-all duration-100';
        el.innerText = text;
        wheelDate.appendChild(el);
        
        if (d.getDate() === currentDate.getDate() && 
            d.getMonth() === currentDate.getMonth() && 
            d.getFullYear() === currentDate.getFullYear()) {
            activeDateIndex = pickerDates.length - 1;
        }
    }
    
    wheelHour.innerHTML = '';
    const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString());
    hours.forEach(h => {
        const el = document.createElement('div');
        el.className = 'h-[44px] flex items-center justify-center snap-center shrink-0 transition-all duration-100';
        el.innerText = h;
        wheelHour.appendChild(el);
    });
    
    let currentHour24 = currentDate.getHours();
    let isPM = currentHour24 >= 12;
    let currentHour12 = currentHour24 % 12;
    if (currentHour12 === 0) currentHour12 = 12;
    let activeHourIndex = currentHour12 - 1;
    let activeAmpmIndex = isPM ? 1 : 0;
    
    wheelMinute.innerHTML = '';
    const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
    minutes.forEach(m => {
        const el = document.createElement('div');
        el.className = 'h-[44px] flex items-center justify-center snap-center shrink-0 transition-all duration-100';
        el.innerText = m;
        wheelMinute.appendChild(el);
    });
    let activeMinuteIndex = currentDate.getMinutes();
    
    wheelAmpm.innerHTML = '';
    ['AM', 'PM'].forEach(ap => {
        const el = document.createElement('div');
        el.className = 'h-[44px] flex items-center justify-center snap-center shrink-0 transition-all duration-100';
        el.innerText = ap;
        wheelAmpm.appendChild(el);
    });
    
    setupWheelScroll([wheelDate, wheelHour, wheelMinute, wheelAmpm], 
                     [activeDateIndex, activeHourIndex, activeMinuteIndex, activeAmpmIndex]);
}

function setupWheelScroll(columns, activeIndices) {
    columns.forEach((col, idx) => {
        col.onscroll = () => {
            const scrollTop = col.scrollTop;
            const selectedIndex = Math.round(scrollTop / 44);
            const items = col.children;
            for (let i = 0; i < items.length; i++) {
                const distance = Math.abs(i - selectedIndex);
                if (distance === 0) {
                    items[i].style.opacity = '1';
                    items[i].style.fontWeight = '700';
                    items[i].style.transform = 'scale(1.08)';
                } else if (distance === 1) {
                    items[i].style.opacity = '0.55';
                    items[i].style.fontWeight = '500';
                    items[i].style.transform = 'scale(0.96)';
                } else if (distance === 2) {
                    items[i].style.opacity = '0.25';
                    items[i].style.fontWeight = '400';
                    items[i].style.transform = 'scale(0.88)';
                } else {
                    items[i].style.opacity = '0.1';
                    items[i].style.fontWeight = '400';
                    items[i].style.transform = 'scale(0.8)';
                }
            }
        };
        
        setTimeout(() => {
            col.scrollTop = activeIndices[idx] * 44;
            col.onscroll();
        }, 100);
    });
}

function closeCupertinoDatePicker(saveChanges = false) {
    if (saveChanges) {
        const wheelDate = document.getElementById('wheel-date');
        const wheelHour = document.getElementById('wheel-hour');
        const wheelMinute = document.getElementById('wheel-minute');
        const wheelAmpm = document.getElementById('wheel-ampm');
        
        if (wheelDate && wheelHour && wheelMinute && wheelAmpm) {
            const dateIdx = Math.round(wheelDate.scrollTop / 44);
            const hourIdx = Math.round(wheelHour.scrollTop / 44);
            const minuteIdx = Math.round(wheelMinute.scrollTop / 44);
            const ampmIdx = Math.round(wheelAmpm.scrollTop / 44);
            
            const selectedDate = pickerDates[dateIdx] || new Date();
            const selectedHour12 = hourIdx + 1;
            const selectedMinute = minuteIdx;
            const isPM = ampmIdx === 1;
            
            let selectedHour24 = selectedHour12;
            if (isPM) {
                if (selectedHour12 < 12) selectedHour24 += 12;
            } else {
                if (selectedHour12 === 12) selectedHour24 = 0;
            }
            
            const finalDate = new Date(selectedDate);
            finalDate.setHours(selectedHour24);
            finalDate.setMinutes(selectedMinute);
            
            const year = finalDate.getFullYear();
            const month = String(finalDate.getMonth() + 1).padStart(2, '0');
            const day = String(finalDate.getDate()).padStart(2, '0');
            const hours = String(finalDate.getHours()).padStart(2, '0');
            const minutes = String(finalDate.getMinutes()).padStart(2, '0');
            
            const txDate = document.getElementById('tx-date');
            if (txDate) {
                txDate.value = `${year}-${month}-${day}T${hours}:${minutes}`;
                txDate.dispatchEvent(new Event('input', { bubbles: true }));
                txDate.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }
    
    const modal = document.getElementById('cupertino-datepicker-modal');
    const panel = document.getElementById('cupertino-datepicker-panel');
    if (modal && panel) {
        modal.classList.add('opacity-0');
        panel.classList.add('translate-y-full');
        setTimeout(() => {
            modal.classList.remove('flex');
            modal.classList.add('hidden');
        }, 300);
    }
}

function triggerDatePicker() {
    openCupertinoDatePicker();
}

window.triggerDatePicker = triggerDatePicker;
window.closeCupertinoDatePicker = closeCupertinoDatePicker;
