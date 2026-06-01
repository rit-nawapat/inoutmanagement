const GOOGLE_SHEET_API_URL = import.meta.env.VITE_GOOGLE_SHEET_API_URL;

let currentPage = 'add';
let currentType = 'spent';
let expression = '0';
let isEvaluated = false;
let html5QrcodeScanner = null;
let currentSlipRefNo = "";
let currentScannedBarcode = "";
let editModeId = null;

const thaiMonths = {
    'ม.ค.': 0, 'ก.พ.': 1, 'มี.ค.': 2, 'เม.ย.': 3, 'พ.ค.': 4, 'มิ.ย.': 5,
    'ก.ค.': 6, 'ส.ค.': 7, 'ก.ย.': 8, 'ต.ค.': 9, 'พ.ย.': 10, 'ธ.ค.': 11,
    'มกราคม': 0, 'กุมภาพันธ์': 1, 'มีนาคม': 2, 'เมษายน': 3, 'พฤษภาคม': 4, 'มิถุนายน': 5,
    'กรกฎาคม': 6, 'สิงหาคม': 7, 'กันยายน': 8, 'ตุลาคม': 9, 'พฤศจิกายน': 10, 'ธันวาคม': 11
};

const categories = {
    spent: [
        { id: 'food', name: 'อาหาร', icon: 'utensils' }, { id: 'beverage', name: 'เครื่องดื่ม', icon: 'coffee' },
        { id: 'grocery', name: 'ของใช้', icon: 'shopping-cart' }, { id: 'transport', name: 'เดินทาง', icon: 'car' },
        { id: 'entertainment', name: 'บันเทิง', icon: 'clapperboard' }, { id: 'bills', name: 'บิล/ค่าไฟ', icon: 'receipt' },
        { id: 'travel', name: 'เที่ยว', icon: 'palmtree' }, { id: 'other_exp', name: 'อื่นๆ', icon: 'help-circle' }
    ],
    income: [
        { id: 'salary', name: 'เงินเดือน', icon: 'briefcase' }, { id: 'bonus', name: 'โบนัส', icon: 'gift' },
        { id: 'investment', name: 'ลงทุน', icon: 'trending-up' }, { id: 'other_inc', name: 'อื่นๆ', icon: 'sparkles' }
    ]
};
const accounts = [
    { id: 'cash', name: 'เงินสด', icon: 'banknote' }, { id: 'credit', name: 'บัตรเครดิต', icon: 'credit-card' },
    { id: 'spaylater', name: 'SPayLater', icon: 'zap' }, { id: 'qrscan', name: 'สแกนจ่าย', icon: 'scan' }, { id: 'promptpay', name: 'พร้อมเพย์', icon: 'smartphone' }
];

let selectedCategory = categories.spent[0].id;
let selectedAccount = accounts[0].id;

function setLocalDatetime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('tx-date').value = now.toISOString().slice(0, 16);
}

function formatCurrencyInput(input) {
    let value = input.value.replace(/,/g, '');
    let number = parseFloat(value);
    if (isNaN(number)) { input.value = ''; return; }
    let parts = value.split('.');
    parts[0] = parseInt(parts[0] || 0).toLocaleString('en-US');
    input.value = parts.join('.');
}

function parseDateTimeFromOCR(ocrText) {
    const cleanText = ocrText.replace(/\s+/g, ' ');
    
    // Match Thai format: 02 มิ.ย. 2569 - 05:28 or 02 มิ.ย. 69 05:28 or 02 มิถุนายน 2569 05:28
    const thaiDateRegex = /(\d{1,2})\s*([ก-ฮ\.]+)\s*(\d{2,4})\s*(?:-|เวลา)?\s*(\d{2}:\d{2})/;
    const thaiDateMatch = cleanText.match(thaiDateRegex);
    if (thaiDateMatch) {
        const day = parseInt(thaiDateMatch[1]);
        const monthStr = thaiDateMatch[2];
        let year = parseInt(thaiDateMatch[3]);
        const time = thaiDateMatch[4];
        
        if (year < 100) year += 2000;
        if (year > 2500) year -= 543; // Convert B.E. to A.D.
        
        const monthIndex = thaiMonths[monthStr] !== undefined ? thaiMonths[monthStr] : 0;
        const [hours, minutes] = time.split(':');
        const d = new Date(year, monthIndex, day, parseInt(hours), parseInt(minutes));
        if (!isNaN(d.getTime())) {
            d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
            return d.toISOString().slice(0, 16);
        }
    }

    // Match English / standard format: DD/MM/YYYY HH:MM or DD-MM-YYYY HH:MM or YYYY-MM-DD HH:MM
    const engDateRegex = /(\d{2})[\/\.-](\d{2})[\/\.-](\d{4}|\d{2})\s+(\d{2}:\d{2})/;
    const engDateMatch = cleanText.match(engDateRegex);
    if (engDateMatch) {
        const day = parseInt(engDateMatch[1]);
        const month = parseInt(engDateMatch[2]) - 1;
        let year = parseInt(engDateMatch[3]);
        const time = engDateMatch[4];
        if (year < 100) year += 2000;
        const [hours, minutes] = time.split(':');
        const d = new Date(year, month, day, parseInt(hours), parseInt(minutes));
        if (!isNaN(d.getTime())) {
            d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
            return d.toISOString().slice(0, 16);
        }
    }
    return null;
}

function parseRefNoFromOCR(ocrText) {
    const cleanText = ocrText.replace(/\s+/g, ' ');
    const refRegex = /(?:เลขที่อ้างอิง|รหัสอ้างอิง|เลขที่รายการ|ref(?:\.?\s*no)?|trans(?:\.?\s*id)?|transaction\s*id)[\s\S]{0,15}?([A-Za-z0-9\-]{8,25})/i;
    const refMatch = cleanText.match(refRegex);
    if (refMatch) {
        return refMatch[1].trim();
    }
    return null;
}

function checkDuplicateSlip(refNo) {
    if (!refNo) return false;
    const history = JSON.parse(localStorage.getItem('my_tx_history') || '[]');
    return history.find(tx => tx.slipRefNo === refNo);
}

function guessCategoryFromText(ocrText) {
    const text = ocrText.toLowerCase();
    const mappings = [
        {
            categoryId: 'bills',
            keywords: ['ไฟ', 'น้ำ', 'เน็ต', 'อินเทอร์เน็ต', 'โทรศัพท์', 'มือถือ', 'ส่วนกลาง', 'บ้าน', 'คอนโด', 'บัตร', 'ประกัน', 'งวด', 'เช่า', 'bill', 'electric', 'water', 'internet', 'wifi', 'phone', 'condo', 'card', 'insurance']
        },
        {
            categoryId: 'transport',
            keywords: ['รถ', 'น้ำมัน', 'ทางด่วน', 'บีทีเอส', 'bts', 'mrt', 'แท็กซี่', 'taxi', 'car', 'gas', 'fuel', 'toll', 'ปตท', 'ptt', 'shell', 'bangchak', 'บางจาก', 'เชลล์']
        },
        {
            categoryId: 'food',
            keywords: ['อาหาร', 'ข้าว', 'กิน', 'ชาบู', 'หมูกระทะ', 'บุฟเฟต์', 'food', 'shabu', 'buffet', 'lunch', 'dinner', 'kfc', 'mcdonald', 'ร้านอาหาร', 'ก๋วยเตี๋ยว', 'คาเฟ่', 'coffee', 'starbucks', 'ส้มตำ', 'ชาไข่มุก']
        },
        {
            categoryId: 'beverage',
            keywords: ['กาแฟ', 'ชา', 'นม', 'น้ำดื่ม', 'เบียร์', 'เหล้า', 'coffee', 'tea', 'drink', 'beverage', 'beer']
        },
        {
            categoryId: 'grocery',
            keywords: ['ของใช้', 'สบู่', 'ยาสีฟัน', 'แชมพู', 'ซื้อของ', 'ห้าง', 'โลตัส', 'เซเว่น', 'grocery', 'shopping', 'supermarket', '7-eleven', '7-11', 'lotus', 'bigc', 'big c', 'makro', 'tops', 'cj']
        },
        {
            categoryId: 'entertainment',
            keywords: ['บันเทิง', 'หนัง', 'เน็ตฟลิกส์', 'netflix', 'youtube', 'disney', 'spotify', 'เกม', 'game', 'movie', 'sf', 'major']
        },
        {
            categoryId: 'travel',
            keywords: ['เที่ยว', 'ตั๋ว', 'บิน', 'เครื่องบิน', 'โรงแรม', 'travel', 'hotel', 'flight', 'trip']
        }
    ];

    for (const mapping of mappings) {
        const matched = mapping.keywords.some(keyword => text.includes(keyword));
        if (matched) return mapping.categoryId;
    }
    return null;
}

function processSlipOCR(fileInput) {
    const file = fileInput.files[0];
    if (!file) return;
    showToast('กำลังแกะข้อมูลจากสลิป...', 'success');
    
    Tesseract.recognize(file, 'tha+eng').then(({ data: { text } }) => {
        let detectedAmount = 0;
        
        // 1. Extract Amount
        const moneyRegex = /(?:จำนวนเงิน|ยอดโอน|บาท|amt|amount)[\s\S]{0,15}?([0-9,]+\.[0-9]{2})/i;
        let match = text.replace(/ /g, '').match(moneyRegex);
        if (match && match[1]) {
            detectedAmount = parseFloat(match[1].replace(/,/g, ''));
        } else {
            const genericAmountRegex = /\b([0-9,]+\.[0-9]{2})\b/g;
            let allAmounts = []; let m;
            while ((m = genericAmountRegex.exec(text.replace(/ /g, ''))) !== null) {
                let val = parseFloat(m[1].replace(/,/g, '')); 
                if (!isNaN(val) && val > 0) allAmounts.push(val);
            }
            if (allAmounts.length > 0) {
                detectedAmount = Math.max(...allAmounts);
            }
        }

        if (detectedAmount > 0) {
            playScanSuccessSound();
            expression = detectedAmount.toString(); 
            display.innerText = expression;
            
            // 2. Parse Date and Time
            const parsedDate = parseDateTimeFromOCR(text);
            if (parsedDate) {
                document.getElementById('tx-date').value = parsedDate;
                showToast('ปรับปรุงวันที่และเวลาตามสลิป', 'success');
            }
            
            // 3. Parse Reference Number & Check Duplicate
            const refNo = parseRefNoFromOCR(text);
            currentSlipRefNo = refNo || "";
            if (refNo) {
                const duplicateTx = checkDuplicateSlip(refNo);
                if (duplicateTx) {
                    showToast(`⚠️ สลิปซ้ำ! เคยบันทึกแล้วเมื่อ ${duplicateTx.date} ยอด ฿${duplicateTx.amount}`, 'error');
                } else {
                    showToast(`เลขอ้างอิงสลิป: ${refNo}`, 'success');
                }
            }

            // 4. Smart Category Guessing
            const guessedCatId = guessCategoryFromText(text);
            if (guessedCatId) {
                selectedCategory = guessedCatId;
                renderCategories();
            }

            // 5. AUTO-SELECT BANK PAYMENT CHANNEL
            selectedAccount = 'qrscan';
            renderAccounts();
            
            currentScannedBarcode = refNo ? `สลิปโอนเงิน (Ref: ${refNo})` : "สลิปโอนเงิน (OCR)"; 
            document.getElementById('scanned-note').innerHTML = `<i data-lucide="file-text" class="w-3 h-3 inline-block"></i> ฿${detectedAmount} ${refNo ? `[${refNo.slice(-6)}]` : ''}`; 
            document.getElementById('scanned-note').classList.remove('hidden'); 
            lucide.createIcons();
            
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
    if (distance > 75 && pageOrder.indexOf(currentPage) > 0) { stopQRScanner(); switchPage(pageOrder[pageOrder.indexOf(currentPage) - 1]); }
    else if (distance < -75 && pageOrder.indexOf(currentPage) < pageOrder.length - 1) { stopQRScanner(); switchPage(pageOrder[pageOrder.indexOf(currentPage) + 1]); }
}, { passive: true });

function switchPage(pageId) {
    currentPage = pageId;
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
    currentType = type;
    document.getElementById('tab-spent').className = type === 'spent' ? "flex-1 py-1 text-[10px] font-bold rounded-full bg-white text-slate-800 shadow-sm" : "flex-1 py-1 text-[10px] font-bold rounded-full text-slate-400";
    document.getElementById('tab-income').className = type === 'income' ? "flex-1 py-1 text-[10px] font-bold rounded-full bg-white text-slate-800 shadow-sm" : "flex-1 py-1 text-[10px] font-bold rounded-full text-slate-400";
    selectedCategory = categories[type][0].id; renderCategories();
}

function guessAccountForCategory(categoryId) {
    const categoryObj = (categories.spent.find(c => c.id === categoryId) || categories.income.find(c => c.id === categoryId));
    if (!categoryObj) return null;

    const history = JSON.parse(localStorage.getItem('my_tx_history') || '[]');
    const matchingTx = history.filter(tx => tx.categoryName === categoryObj.name && tx.type === 'spent');
    
    if (matchingTx.length > 0) {
        const counts = {};
        matchingTx.forEach(tx => {
            const acc = accounts.find(a => a.name === tx.accountName);
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
    
    // Fallback guesses if no history
    if (categoryId === 'food' || categoryId === 'beverage') {
        return 'qrscan';
    } else if (categoryId === 'bills') {
        return 'promptpay';
    } else if (categoryId === 'grocery' || categoryId === 'travel' || categoryId === 'entertainment') {
        return 'credit';
    }
    return null;
}

function renderCategories() {
    const grid = document.getElementById('category-grid'); grid.innerHTML = '';
    categories[currentType].forEach(cat => {
        const isSelected = cat.id === selectedCategory; const item = document.createElement('div');
        item.className = "flex-shrink-0 flex flex-col items-center cursor-pointer snap-start min-w-[50px]";
        item.onclick = () => { 
            selectedCategory = cat.id; 
            renderCategories(); 
            if (currentType === 'spent') {
                const guessedAccId = guessAccountForCategory(cat.id);
                if (guessedAccId && guessedAccId !== selectedAccount) {
                    selectedAccount = guessedAccId;
                    renderAccounts();
                    showToast(`เดาช่องทางจ่าย: ${accounts.find(a => a.id === guessedAccId).name}`, 'success');
                }
            }
        };
        item.innerHTML = `<div class="w-10 h-10 flex items-center justify-center rounded-xl border ${isSelected ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-500'}"><i data-lucide="${cat.icon}" class="w-4 h-4"></i></div><span class="text-[9px] font-bold mt-1 ${isSelected ? 'text-indigo-600' : 'text-slate-500'}">${cat.name}</span>`;
        grid.appendChild(item);
    }); lucide.createIcons();
}

function renderAccounts() {
    const grid = document.getElementById('account-grid'); grid.innerHTML = '';
    accounts.forEach(acc => {
        const isSelected = acc.id === selectedAccount; const item = document.createElement('div');
        item.className = "flex-shrink-0 snap-start"; item.onclick = () => { selectedAccount = acc.id; renderAccounts(); };
        item.innerHTML = `<div class="flex items-center space-x-1 py-1.5 px-3 rounded-lg text-[9px] font-bold border ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-500'}"><i data-lucide="${acc.icon}" class="w-3 h-3"></i><span>${acc.name}</span></div>`;
        grid.appendChild(item);
    }); lucide.createIcons();
}

const display = document.getElementById('display');
function pressClearAll() { expression = '0'; isEvaluated = false; display.innerText = expression; }
function pressQuickPrice(value) { calculate(); let c = parseFloat(expression); if (isNaN(c) || isEvaluated) { c = 0; isEvaluated = false; } expression = (c + value).toString(); display.innerText = expression; }
function pressKey(key) { if (expression === '0' || isEvaluated) { expression = key === '.' ? '0.' : key; isEvaluated = false; } else { const s = expression.split(/[\+\-\*\/]/); if (key === '.' && s[s.length - 1].includes('.')) return; expression += key; } display.innerText = expression; }
function pressOp(op) { const l = expression.trim().slice(-1); if (['+', '-', '*', '/'].includes(l)) { expression = expression.slice(0, -1) + op; } else { expression += op; } isEvaluated = false; display.innerText = expression; }
function pressClear() { expression = expression.length > 1 ? expression.slice(0, -1) : '0'; display.innerText = expression; }
function calculate() { try { if (!expression) return; expression = Number(new Function(`return ${expression}`)().toFixed(2)).toString(); display.innerText = expression; isEvaluated = true; } catch (e) { display.innerText = '0'; expression = '0'; } }

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

function toggleQRScanner() {
    const wrapper = document.getElementById('qr-reader-wrapper');
    if (wrapper.classList.contains('hidden')) {
        wrapper.classList.remove('hidden'); document.getElementById('scan-text').innerText = "ปิดกล้อง";
        
        // Pass video constraints for continuous focus inside Html5QrcodeScanner config!
        html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", { 
            fps: 15, 
            qrbox: { width: 250, height: 150 },
            videoConstraints: {
                focusMode: "continuous",
                advanced: [{ focusMode: "continuous" }, { autofocus: true }]
            }
        }, false);
        
        html5QrcodeScanner.render((decodedText) => {
            playScanSuccessSound();
            if (decodedText.startsWith("000201")) {
                const amountMatch = decodedText.match(/54\d{2}(\d+\.\d{2})/);
                if (amountMatch && amountMatch[1]) {
                    let slipAmount = parseFloat(amountMatch[1]); expression = slipAmount.toString(); display.innerText = expression;
                    currentScannedBarcode = "สลิปพร้อมเพย์ (QR)"; 
                    document.getElementById('scanned-note').innerHTML = `<i data-lucide="qr-code" class="w-3 h-3 inline-block"></i> ฿${slipAmount}`; 
                    document.getElementById('scanned-note').classList.remove('hidden'); 
                    lucide.createIcons(); 
                    
                    selectedAccount = 'qrscan';
                    renderAccounts();
                    
                    showToast(`พบยอด ฿${slipAmount} และเลือกช่องสแกนจ่ายออโต้`, 'success'); 
                    toggleQRScanner(); 
                    return;
                }
            }
            
            showToast("กำลังค้นหาข้อมูลสินค้า...", "success");
            fetch(`https://world.openfoodfacts.org/api/v2/product/${decodedText}.json`).then(res => res.json()).then(data => {
                let pName = (data.status === 1 && data.product) ? (data.product.product_name_th || data.product.product_name) : null;
                currentScannedBarcode = pName || `รหัส: ${decodedText}`; 
                document.getElementById('scanned-note').innerHTML = `<i data-lucide="package" class="w-3 h-3 inline-block"></i> ${currentScannedBarcode}`; 
                document.getElementById('scanned-note').classList.remove('hidden'); 
                lucide.createIcons();
                showToast(`พบสินค้า: ${pName || decodedText}`, 'success');
            }).catch(() => {
                currentScannedBarcode = `รหัส: ${decodedText}`; 
                document.getElementById('scanned-note').innerHTML = `<i data-lucide="search" class="w-3 h-3 inline-block"></i> ${decodedText}`; 
                document.getElementById('scanned-note').classList.remove('hidden'); 
                lucide.createIcons();
                showToast(`พบรหัสสินค้า: ${decodedText}`, 'success');
            }); 
            toggleQRScanner();
        }, (error) => { });
    } else { stopQRScanner(); }
}

function stopQRScanner() { 
    const wrapper = document.getElementById('qr-reader-wrapper'); 
    if (!wrapper.classList.contains('hidden')) { 
        wrapper.classList.add('hidden'); 
        document.getElementById('scan-text').innerText = "กล้อง"; 
        if (html5QrcodeScanner) { 
            html5QrcodeScanner.clear(); 
            html5QrcodeScanner = null; 
        } 
    } 
}


// ----------------------------------------------------------------------
// ⭐️ ระบบ "รายการประจำ" ตรวจสอบสถานะเดือนต่อเดือน ⭐️
// ----------------------------------------------------------------------

function getRecurringItems() { return JSON.parse(localStorage.getItem('my_recurring_list') || '[]'); }

function updateRecurringSummary() {
    const history = JSON.parse(localStorage.getItem('my_tx_history') || '[]');
    const recurring = getRecurringItems();
    const currentMonth = new Date().getMonth(); const currentYear = new Date().getFullYear();
    let thisMonthIncome = 0;

    history.forEach(tx => {
        if (tx.type === 'income' && tx.isoDate) {
            let txDate = new Date(tx.isoDate);
            if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) thisMonthIncome += tx.amount;
        }
    });

    let totalRecurring = recurring.reduce((sum, item) => sum + item.amount, 0);
    let remain = thisMonthIncome - totalRecurring;

    document.getElementById('req-dash-income').innerText = `฿${thisMonthIncome.toLocaleString()}`;
    document.getElementById('req-dash-spent').innerText = `฿${totalRecurring.toLocaleString()}`;
    document.getElementById('req-dash-remain').innerText = `฿${remain.toLocaleString()}`;
}

function renderRecurringList() {
    const container = document.getElementById('recurring-list-container'); container.innerHTML = '';
    let items = getRecurringItems();

    if (items.length === 0) {
        container.innerHTML = `<div class="text-center py-8 text-slate-400"><i data-lucide="list-x" class="w-6 h-6 mx-auto mb-1 opacity-50"></i><p class="text-[10px]">ยังไม่มีรายการประจำ</p></div>`; lucide.createIcons(); return;
    }

    const currentMonthStr = new Date().toISOString().slice(0, 7);

    items.forEach(item => {
        const isPaidThisMonth = item.lastPaidMonth === currentMonthStr;
        const statusBadge = isPaidThisMonth
            ? `<span class="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[9px] font-bold">จ่ายแล้ว</span>`
            : `<span class="bg-amber-50 text-amber-600 px-2 py-0.5 rounded text-[9px] font-bold">ยังไม่จ่าย</span>`;

        const payBtn = isPaidThisMonth
            ? `<button disabled class="bg-slate-100 text-slate-400 px-2.5 py-1.5 rounded-lg text-[9px] font-bold shadow-none flex items-center gap-1 cursor-not-allowed mr-1"><i data-lucide="check-circle" class="w-3 h-3"></i> จ่ายแล้ว</button>`
            : `<button onclick="payRecurringItem(${item.id})" class="bg-emerald-50 text-emerald-600 px-2.5 py-1.5 rounded-lg text-[9px] font-bold shadow-sm hover:bg-emerald-100 flex items-center gap-1 cursor-pointer mr-1"><i data-lucide="check-circle" class="w-3 h-3"></i> จ่าย</button>`;

        const starColor = item.fav ? 'text-amber-400 fill-amber-400' : 'text-slate-300';
        const block = document.createElement('div');
        block.className = `flex flex-col md:grid md:grid-cols-12 md:items-center justify-between p-3 md:px-6 md:py-2 border-b border-slate-100 gap-2 ${isPaidThisMonth ? 'bg-slate-50 opacity-80' : 'bg-white'}`;

        block.innerHTML = `
            <div class="flex items-center space-x-2 md:col-span-3">
                <div class="w-8 h-8 flex items-center justify-center rounded-full ${item.color} shrink-0"><i data-lucide="${item.icon}" class="w-4 h-4"></i></div>
                <div><h4 class="font-bold text-slate-800 text-xs leading-tight">${item.name}</h4><p class="text-[9px] text-slate-400 mt-0.5">${item.desc}</p></div>
            </div>
            <div class="hidden md:block text-[10px] font-medium text-slate-500 col-span-2 text-center">${item.desc}</div>
            <div class="flex items-center justify-between md:contents">
                <div class="font-bold ${isPaidThisMonth ? 'text-slate-500' : 'text-rose-600'} text-xs md:col-span-2 md:text-right w-20 md:w-auto">${item.amount.toLocaleString()} ฿</div>
                <div class="hidden md:flex justify-center col-span-2"><span class="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[9px] font-bold">${item.category}</span></div>
                <div class="hidden md:flex justify-center col-span-1">${statusBadge}</div>
                <div class="flex items-center space-x-1.5 md:col-span-2 md:justify-end">
                    ${payBtn}
                    <button onclick="toggleFavRecurring(${item.id})" class="cursor-pointer active:scale-90 transition-transform"><i data-lucide="star" class="w-3.5 h-3.5 ${starColor}"></i></button>
                    <button onclick="openRecurringModal(${item.id})" class="text-slate-400 hover:text-indigo-600"><i data-lucide="edit-2" class="w-3.5 h-3.5"></i></button>
                    <button onclick="deleteRecurringItem(${item.id})" class="text-slate-400 hover:text-rose-500"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                </div>
            </div>
        `;
        container.appendChild(block);
    });
    lucide.createIcons();
}

function autoSelectCategoryByName(name) {
    if (!name) return;
    name = name.toLowerCase().trim();
    
    const mappings = [
        {
            categoryId: 'bills',
            keywords: ['ไฟ', 'น้ำ', 'เน็ต', 'อินเทอร์เน็ต', 'โทรศัพท์', 'มือถือ', 'ส่วนกลาง', 'บ้าน', 'คอนโด', 'บัตร', 'ประกัน', 'งวด', 'เช่า', 'bill', 'electric', 'water', 'internet', 'wifi', 'phone', 'condo', 'card', 'insurance']
        },
        {
            categoryId: 'transport',
            keywords: ['รถ', 'น้ำมัน', 'ทางด่วน', 'บีทีเอส', 'bts', 'mrt', 'แท็กซี่', 'taxi', 'car', 'gas', 'fuel', 'toll']
        },
        {
            categoryId: 'food',
            keywords: ['อาหาร', 'ข้าว', 'กิน', 'ชาบู', 'หมูกระทะ', 'บุฟเฟต์', 'food', 'shabu', 'buffet', 'lunch', 'dinner']
        },
        {
            categoryId: 'beverage',
            keywords: ['กาแฟ', 'ชา', 'นม', 'น้ำดื่ม', 'เบียร์', 'เหล้า', 'คาเฟ่', 'coffee', 'tea', 'milk', 'drink', 'beverage', 'beer', 'cafe']
        },
        {
            categoryId: 'grocery',
            keywords: ['ของใช้', 'สบู่', 'ยาสีฟัน', 'แชมพู', 'ซื้อของ', 'ห้าง', 'โลตัส', 'เซเว่น', 'grocery', 'shopping', 'supermarket']
        },
        {
            categoryId: 'entertainment',
            keywords: ['บันเทิง', 'หนัง', 'เน็ตฟลิกส์', 'netflix', 'youtube', 'disney', 'spotify', 'เกม', 'game', 'movie']
        },
        {
            categoryId: 'travel',
            keywords: ['เที่ยว', 'ตั๋ว', 'บิน', 'เครื่องบิน', 'โรงแรม', 'travel', 'hotel', 'flight', 'trip']
        }
    ];

    for (const mapping of mappings) {
        const matched = mapping.keywords.some(keyword => name.includes(keyword));
        if (matched) {
            const selectEl = document.getElementById('req-category');
            if (selectEl) {
                selectEl.value = mapping.categoryId;
            }
            break;
        }
    }
}

function openRecurringModal(id = null) {
    document.getElementById('req-category').innerHTML = categories.spent.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    document.getElementById('req-account').innerHTML = accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');

    if (id) {
        document.getElementById('req-modal-title').innerText = "แก้ไขรายการประจำ";
        const item = getRecurringItems().find(i => i.id === id);
        document.getElementById('req-id').value = item.id;
        document.getElementById('req-name').value = item.name;
        document.getElementById('req-desc').value = item.desc;
        document.getElementById('req-amount').value = item.amount.toLocaleString();
        document.getElementById('req-category').value = item.categoryId;
        document.getElementById('req-account').value = item.accountId || accounts[0].id;
    } else {
        document.getElementById('req-modal-title').innerText = "เพิ่มรายการประจำ";
        document.getElementById('req-id').value = ""; document.getElementById('req-name').value = "";
        document.getElementById('req-desc').value = "ทุกสิ้นเดือน"; document.getElementById('req-amount').value = "";
    }
    document.getElementById('recurring-modal').classList.remove('hidden');
}
function closeRecurringModal() { document.getElementById('recurring-modal').classList.add('hidden'); }

function saveRecurringItem() {
    const id = document.getElementById('req-id').value;
    const name = document.getElementById('req-name').value;
    const desc = document.getElementById('req-desc').value;
    const rawAmount = document.getElementById('req-amount').value.replace(/,/g, '');
    const amount = parseFloat(rawAmount);
    const categoryId = document.getElementById('req-category').value;
    const accountId = document.getElementById('req-account').value;

    if (!name || isNaN(amount) || amount <= 0) { showToast('ข้อมูลไม่ครบถ้วน', 'error'); return; }

    const matchedCat = categories.spent.find(c => c.id === categoryId);
    const matchedAcc = accounts.find(a => a.id === accountId);
    const colorMap = { 'utensils': 'bg-orange-100 text-orange-600', 'coffee': 'bg-amber-100 text-amber-600', 'shopping-cart': 'bg-emerald-100 text-emerald-600', 'car': 'bg-blue-100 text-blue-600', 'clapperboard': 'bg-purple-100 text-purple-600', 'receipt': 'bg-rose-100 text-rose-600', 'palmtree': 'bg-teal-100 text-teal-600', 'help-circle': 'bg-slate-100 text-slate-600' };

    let items = getRecurringItems();
    let lastPaidMonth = "";
    if (id) { lastPaidMonth = items.find(i => i.id == id).lastPaidMonth || ""; }

    const newItem = {
        id: id ? parseInt(id) : Date.now(), name, desc, amount, categoryId, accountId,
        icon: matchedCat.icon, category: matchedCat.name, account: matchedAcc.name,
        color: colorMap[matchedCat.icon] || 'bg-slate-100 text-slate-600',
        fav: id ? items.find(i => i.id == id).fav : false,
        lastPaidMonth: lastPaidMonth
    };

    if (id) { const index = items.findIndex(i => i.id == id); items[index] = newItem; } else { items.unshift(newItem); }
    localStorage.setItem('my_recurring_list', JSON.stringify(items));
    closeRecurringModal(); renderRecurringList(); updateRecurringSummary(); showToast('บันทึกรายการสำเร็จ', 'success');

    // ยิงเข้า Sheet แผ่น 'Recurring'
    fetch(GOOGLE_SHEET_API_URL, {
        method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ sheetName: 'Recurring', action: id ? 'edit' : 'add', ...newItem })
    });
}

function deleteRecurringItem(id) { triggerResetConfirm('delete_recurring', id); }
function executeDeleteRecurring(id) {
    let items = getRecurringItems(); items = items.filter(i => i.id !== id);
    localStorage.setItem('my_recurring_list', JSON.stringify(items));
    renderRecurringList(); updateRecurringSummary(); showToast('ลบแล้ว', 'success');
    fetch(GOOGLE_SHEET_API_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ sheetName: 'Recurring', action: 'delete', id: id }) });
}
function toggleFavRecurring(id) { let items = getRecurringItems(); const item = items.find(i => i.id === id); if (item) { item.fav = !item.fav; localStorage.setItem('my_recurring_list', JSON.stringify(items)); renderRecurringList(); } }

function payRecurringItem(id) {
    let items = getRecurringItems();
    const item = items.find(i => i.id === id);
    if (!item) return;

    const currentMonthStr = new Date().toISOString().slice(0, 7);
    if (item.lastPaidMonth === currentMonthStr) { showToast('จ่ายไปแล้วเดือนนี้', 'error'); return; }

    item.lastPaidMonth = currentMonthStr;
    const index = items.findIndex(i => i.id === id);
    items[index] = item;
    localStorage.setItem('my_recurring_list', JSON.stringify(items));

    const matchedCat = categories.spent.find(c => c.id === item.categoryId) || categories.spent[0];
    const matchedAcc = accounts.find(a => a.id === item.accountId) || accounts[0];

    const transactionRecord = {
        id: Date.now(), type: 'spent', categoryName: item.name, accountName: matchedAcc.name, amount: item.amount, barcodeNote: 'รายจ่ายประจำ: ' + item.desc,
        date: new Date().toLocaleString('th-TH'), isoDate: new Date().toISOString().slice(0, 16), action: 'add', sheetName: 'Sheet1'
    };

    let currentHistory = JSON.parse(localStorage.getItem('my_tx_history') || '[]');
    currentHistory.unshift({ ...transactionRecord, categoryIcon: matchedCat.icon, accountIcon: matchedAcc.icon });
    currentHistory.sort((a, b) => new Date(b.isoDate) - new Date(a.isoDate));
    localStorage.setItem('my_tx_history', JSON.stringify(currentHistory));

    updateDashboard(); updateRecurringSummary(); renderRecurringList();
    showToast(`จ่าย ${item.name} สำเร็จ`, 'success');

    // บันทึกลง Sheet1 (ประวัติการใช้จ่าย)
    fetch(GOOGLE_SHEET_API_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(transactionRecord) });
    // อัปเดตสถานะในหน้า Recurring
    fetch(GOOGLE_SHEET_API_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ sheetName: 'Recurring', action: 'edit', ...item }) });
}

// --- บันทึก, ลบ และสรุปผลประวัติประมวลผลดั้งเดิม ---
function updateDashboard() {
    const logData = JSON.parse(localStorage.getItem('my_tx_history') || '[]');
    let i = 0, s = 0;
    logData.forEach(e => { if (e.type === 'income') i += e.amount; if (e.type === 'spent') s += e.amount; });
    document.getElementById('dash-income').innerText = `฿${i.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    document.getElementById('dash-spent').innerText = `฿${s.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    document.getElementById('dash-balance').innerText = `฿${(i - s).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function saveTransaction() {
    calculate(); const finalVal = parseFloat(expression); if (isNaN(finalVal) || finalVal <= 0) { showToast('กรุณากรอกยอด', 'error'); return; }
    const matchedCat = categories[currentType].find(c => c.id === selectedCategory); const matchedAcc = accounts.find(a => a.id === selectedAccount);
    const inputDate = new Date(document.getElementById('tx-date').value);

    const transactionRecord = {
        id: editModeId || Date.now(), type: currentType, categoryName: matchedCat ? matchedCat.name : 'อื่นๆ', accountName: matchedAcc ? matchedAcc.name : 'เงินสด',
        amount: finalVal, barcodeNote: currentScannedBarcode, slipRefNo: currentSlipRefNo, date: inputDate.toLocaleString('th-TH'), isoDate: document.getElementById('tx-date').value,
        action: editModeId ? 'edit' : 'add', sheetName: 'Sheet1'
    };

    let currentHistory = JSON.parse(localStorage.getItem('my_tx_history') || '[]');
    if (editModeId) { const index = currentHistory.findIndex(t => t.id === editModeId); if (index > -1) currentHistory[index] = { ...transactionRecord, categoryIcon: matchedCat.icon, accountIcon: matchedAcc.icon }; }
    else { currentHistory.unshift({ ...transactionRecord, categoryIcon: matchedCat.icon, accountIcon: matchedAcc.icon }); }

    localStorage.setItem('my_tx_history', JSON.stringify(currentHistory));
    expression = '0'; currentScannedBarcode = ""; currentSlipRefNo = ""; display.innerText = expression; document.getElementById('scanned-note').classList.add('hidden'); editModeId = null; setLocalDatetime();
    updateDashboard(); showToast('บันทึกสำเร็จ', 'success');

    fetch(GOOGLE_SHEET_API_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(transactionRecord) });
}

function editTransaction(id) {
    const history = JSON.parse(localStorage.getItem('my_tx_history') || '[]'); const tx = history.find(t => t.id === id); if (!tx) return;
    editModeId = id; setType(tx.type); selectedCategory = categories[tx.type].find(c => c.name === tx.categoryName)?.id || categories[tx.type][0].id;
    selectedAccount = accounts.find(a => a.name === tx.accountName)?.id || accounts[0].id; expression = tx.amount.toString(); display.innerText = expression;
    currentSlipRefNo = tx.slipRefNo || "";
    document.getElementById('tx-date').value = tx.isoDate || new Date().toISOString().slice(0, 16); renderCategories(); renderAccounts(); switchPage('add');
}

function deleteTransaction(id) { triggerResetConfirm('delete_item', id); }
function executeDelete(id) {
    let history = JSON.parse(localStorage.getItem('my_tx_history') || '[]'); history = history.filter(t => t.id !== id);
    localStorage.setItem('my_tx_history', JSON.stringify(history)); updateDashboard(); renderHistory();
    fetch(GOOGLE_SHEET_API_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'delete', id: id, sheetName: 'Sheet1' }) });
}

function renderHistory() {
    const listSection = document.getElementById('history-list'); const storedHistory = JSON.parse(localStorage.getItem('my_tx_history') || '[]'); document.getElementById('history-count').innerText = `${storedHistory.length} รายการ`; listSection.innerHTML = '';
    if (storedHistory.length === 0) { listSection.innerHTML = `<div class="text-center py-10 text-slate-400"><i data-lucide="folder-open" class="w-6 h-6 mx-auto mb-1"></i><span class="text-[10px]">ยังไม่พบประวัติ</span></div>`; lucide.createIcons(); return; }
    storedHistory.forEach(data => {
        const block = document.createElement('div'); block.className = "flex justify-between items-center p-3 bg-white rounded-xl border border-slate-200";
        block.innerHTML = `
            <div class="flex items-center space-x-2">
                <div class="w-8 h-8 flex items-center justify-center rounded-lg ${data.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}"><i data-lucide="${data.categoryIcon}" class="w-4 h-4"></i></div>
                <div class="overflow-hidden">
                    <div class="flex items-center space-x-1 flex-wrap"><span class="font-bold text-slate-800 text-xs">${data.categoryName}</span><span class="bg-slate-100 text-slate-500 px-1 py-0.5 rounded text-[8px] font-bold">${data.accountName || 'เงินสด'}</span></div>
                    ${data.barcodeNote ? `<span class="text-[9px] text-indigo-500 block mt-0.5 truncate">${data.barcodeNote}</span>` : ''}
                    <span class="text-[8px] text-slate-400 block">${data.date}</span>
                </div>
            </div>
            <div class="flex flex-col items-end space-y-1.5 shrink-0">
                <span class="font-bold text-sm ${data.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}">${data.type === 'income' ? '+' : '-'}฿${data.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                <div class="flex space-x-1">
                    <button onclick="editTransaction(${data.id})" class="p-1 bg-slate-100 text-slate-500 rounded"><i data-lucide="edit-2" class="w-3 h-3"></i></button>
                    <button onclick="deleteTransaction(${data.id})" class="p-1 bg-slate-100 text-rose-500 rounded"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
                </div>
            </div>
        `;
        listSection.appendChild(block);
    });
    lucide.createIcons();
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container'); const toast = document.createElement('div');
    toast.className = `${type === 'success' ? 'bg-slate-900 text-white' : 'bg-rose-600 text-white'} w-full flex items-center space-x-2 px-3 py-2 rounded-lg shadow-xl text-[10px] font-bold pointer-events-auto`;
    toast.innerHTML = `<i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}" class="w-3 h-3"></i> <span class="truncate">${message}</span>`;
    container.appendChild(toast); lucide.createIcons(); setTimeout(() => { toast.remove(); }, 1500);
}

let onConfirmCallback = null;
function triggerResetConfirm(type = 'all', id = null) {
    document.getElementById('custom-confirm-dialog').classList.remove('hidden');
    onConfirmCallback = (isConfirmed) => {
        if (isConfirmed) {
            if (type === 'all') { localStorage.removeItem('my_tx_history'); expression = '0'; display.innerText = expression; updateDashboard(); if (currentPage === 'history') renderHistory(); showToast('ล้างข้อมูล', 'success'); }
            else if (type === 'delete_item') { executeDelete(id); }
            else if (type === 'delete_recurring') { executeDeleteRecurring(id); }
        }
    };
}
function closeConfirmDialog(result) { document.getElementById('custom-confirm-dialog').classList.add('hidden'); if (onConfirmCallback) { onConfirmCallback(result); onConfirmCallback = null; } }

document.addEventListener('DOMContentLoaded', () => { lucide.createIcons(); setLocalDatetime(); renderCategories(); renderAccounts(); updateDashboard(); switchPage('add'); });

// Expose functions globally for HTML inline event handlers
window.switchPage = switchPage;
window.triggerResetConfirm = triggerResetConfirm;
window.setType = setType;
window.processSlipOCR = processSlipOCR;
window.toggleQRScanner = toggleQRScanner;
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