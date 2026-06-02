import { calculateExpression } from './core.mjs';

export function clearCalculator(uiState) {
  uiState.expression = '0';
  uiState.isEvaluated = false;
}

export function quickPriceCalculator(uiState, value) {
  calculateCalculator(uiState);
  let current = parseFloat(uiState.expression);
  if (Number.isNaN(current) || uiState.isEvaluated) {
    current = 0;
    uiState.isEvaluated = false;
  }
  uiState.expression = (current + value).toString();
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
