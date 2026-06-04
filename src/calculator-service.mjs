import { calculateExpression } from './core.mjs';

let ctx = {};

export function initCalculatorUi(context) {
  ctx = context;
}

export function clearCalculator(uiState) {
  uiState.expression = '0';
  uiState.isEvaluated = false;
}

export function quickPriceCalculator(uiState, value) {
  calculateCalculator(uiState);
  let current = parseFloat(uiState.expression);
  if (Number.isNaN(current)) {
    current = 0;
  }
  uiState.expression = (current + value).toString();
  uiState.isEvaluated = true;
}

export function inputDigitCalculator(uiState, key) {
  if (uiState.expression === '0' || uiState.isEvaluated) {
    uiState.expression = key === '.' ? '0.' : key;
    uiState.isEvaluated = false;
    return;
  }

  const segments = uiState.expression.split(/[\+\-\*\/]/);
  if (key === '.' && segments[segments.length - 1].includes('.')) return;
  uiState.expression += key;
}

export function inputOperatorCalculator(uiState, op) {
  const lastChar = uiState.expression.trim().slice(-1);
  if (['+', '-', '*', '/'].includes(lastChar)) {
    uiState.expression = uiState.expression.slice(0, -1) + op;
  } else {
    uiState.expression += op;
  }
  uiState.isEvaluated = false;
}

export function backspaceCalculator(uiState) {
  uiState.expression = uiState.expression.length > 1 ? uiState.expression.slice(0, -1) : '0';
}

export function calculateCalculator(uiState) {
  if (!uiState.expression) return;
  uiState.expression = calculateExpression(uiState.expression);
  uiState.isEvaluated = true;
}

export function resetCalculatorScanState(uiState) {
  uiState.currentScannedBarcode = '';
  uiState.currentSlipRefNo = '';
}

export function handleCalculatorKeyboardInput(uiState, key) {
  if (/^[0-9]$/.test(key)) {
    inputDigitCalculator(uiState, key);
    return true;
  }

  if (key === '.' || key === ',') {
    inputDigitCalculator(uiState, '.');
    return true;
  }

  if (key === '+' || key === '-' || key === '*' || key === '/') {
    inputOperatorCalculator(uiState, key);
    return true;
  }

  if (key === 'Enter' || key === '=') {
    calculateCalculator(uiState);
    return true;
  }

  if (key === 'Backspace') {
    backspaceCalculator(uiState);
    return true;
  }

  if (key === 'Delete' || key === 'Escape') {
    clearCalculator(uiState);
    return true;
  }

  return false;
}

export function pressClearAll(doc = globalThis.document) {
  clearCalculator(ctx.uiState);
  const display = doc.getElementById('display');
  if (display) display.innerText = ctx.uiState.expression;

  resetCalculatorScanState(ctx.uiState);
  const noteEl = doc.getElementById('scanned-note');
  if (noteEl) {
      noteEl.classList.add('hidden');
      noteEl.replaceChildren();
  }
  ctx.saveDraft();
}

export function pressQuickPrice(value, doc = globalThis.document) {
  quickPriceCalculator(ctx.uiState, value);
  const display = doc.getElementById('display');
  if (display) display.innerText = ctx.uiState.expression;
  ctx.saveDraft();
}

export function pressKey(key, doc = globalThis.document) {
  inputDigitCalculator(ctx.uiState, key);
  const display = doc.getElementById('display');
  if (display) display.innerText = ctx.uiState.expression;
  ctx.saveDraft();
}

export function pressOp(op, doc = globalThis.document) {
  inputOperatorCalculator(ctx.uiState, op);
  const display = doc.getElementById('display');
  if (display) display.innerText = ctx.uiState.expression;
  ctx.saveDraft();
}

export function pressClear(doc = globalThis.document) {
  backspaceCalculator(ctx.uiState);
  const display = doc.getElementById('display');
  if (display) display.innerText = ctx.uiState.expression;

  if (ctx.uiState.expression === '0') {
      resetCalculatorScanState(ctx.uiState);
      const noteEl = doc.getElementById('scanned-note');
      if (noteEl) {
          noteEl.classList.add('hidden');
          noteEl.replaceChildren();
      }
  }
  ctx.saveDraft();
}

export function calculate(doc = globalThis.document) {
  try {
      calculateCalculator(ctx.uiState);
      const display = doc.getElementById('display');
      if (display) display.innerText = ctx.uiState.expression;
  } catch (e) {
      const display = doc.getElementById('display');
      if (display) display.innerText = '0';
      ctx.uiState.expression = '0';
  }
  ctx.saveDraft();
}

export function playScanSuccessSound(win = globalThis.window) {
  try {
      const audioCtx = new (win.AudioContext || win.webkitAudioContext)();
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
