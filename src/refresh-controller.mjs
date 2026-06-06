const DEFAULT_EXCLUDED_SELECTOR = 'button, input, textarea, select, dialog, [role="dialog"]';

function emitState(onStateChange, state) {
  if (typeof onStateChange === 'function') {
    onStateChange({ ...state });
  }
}

export function createRefreshController({
  scrollElement,
  canRefresh = () => true,
  refresh,
  onStateChange,
  onError,
  threshold = 56,
  maxPull = 88,
  pullResistance = 0.42,
  resetDelayMs = 180,
  excludedSelector = DEFAULT_EXCLUDED_SELECTOR,
} = {}) {
  if (!scrollElement) {
    throw new Error('createRefreshController requires scrollElement');
  }
  if (typeof refresh !== 'function') {
    throw new Error('createRefreshController requires refresh');
  }

  let startY = null;
  let pullDistance = 0;
  let isPulling = false;
  let isRefreshing = false;
  let resetTimer = null;

  const publish = (phase, overrides = {}) => {
    emitState(onStateChange, {
      phase,
      visible: phase !== 'idle',
      distance: pullDistance,
      canRelease: pullDistance >= threshold,
      ...overrides,
    });
  };

  const reset = () => {
    if (resetTimer) {
      globalThis.clearTimeout(resetTimer);
      resetTimer = null;
    }
    startY = null;
    pullDistance = 0;
    isPulling = false;
    publish('idle', { visible: false, distance: 0, canRelease: false });
  };

  const scheduleReset = () => {
    if (resetDelayMs <= 0) {
      reset();
      return;
    }
    resetTimer = globalThis.setTimeout(reset, resetDelayMs);
  };

  const shouldStart = (event) => {
    if (isRefreshing || !canRefresh()) return false;
    if (scrollElement.scrollTop > 0) return false;
    return !event.target?.closest?.(excludedSelector);
  };

  const onTouchStart = (event) => {
    if (!shouldStart(event)) return;
    if (resetTimer) {
      globalThis.clearTimeout(resetTimer);
      resetTimer = null;
    }
    startY = event.touches?.[0]?.clientY ?? null;
    pullDistance = 0;
    isPulling = false;
  };

  const onTouchMove = (event) => {
    if (isRefreshing || startY === null || !canRefresh()) return;
    if (scrollElement.scrollTop > 0) return;

    const currentY = event.touches?.[0]?.clientY || 0;
    const deltaY = currentY - startY;
    if (deltaY <= 0) return;

    isPulling = true;
    pullDistance = Math.min(maxPull, deltaY * pullResistance);
    publish(pullDistance >= threshold ? 'ready' : 'pulling');
    event.preventDefault?.();
  };

  const onTouchEnd = async () => {
    if (!isPulling) {
      startY = null;
      return;
    }

    const shouldRefresh = pullDistance >= threshold;
    startY = null;
    isPulling = false;

    if (!shouldRefresh) {
      reset();
      return;
    }

    isRefreshing = true;
    publish('refreshing', { canRelease: true });

    try {
      await refresh();
    } catch (error) {
      publish('error', { error, visible: true });
      if (typeof onError === 'function') onError(error);
    } finally {
      isRefreshing = false;
      pullDistance = 0;
      scheduleReset();
    }
  };

  scrollElement.addEventListener('touchstart', onTouchStart, { passive: true });
  scrollElement.addEventListener('touchmove', onTouchMove, { passive: false });
  scrollElement.addEventListener('touchend', onTouchEnd, { passive: true });
  scrollElement.addEventListener('touchcancel', reset, { passive: true });
  publish('idle', { visible: false, distance: 0, canRelease: false });

  return {
    reset,
    destroy() {
      if (resetTimer) globalThis.clearTimeout(resetTimer);
      scrollElement.removeEventListener('touchstart', onTouchStart);
      scrollElement.removeEventListener('touchmove', onTouchMove);
      scrollElement.removeEventListener('touchend', onTouchEnd);
      scrollElement.removeEventListener('touchcancel', reset);
    },
  };
}
