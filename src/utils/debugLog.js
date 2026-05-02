export function isDebugEnabled() {
  try {
    // 在浏览器控制台执行：localStorage.setItem('debug.activityPlan', '1')
    return localStorage.getItem('debug.activityPlan') === '1';
  } catch {
    return false;
  }
}

export function debugLog(...args) {
  if (!isDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.log('[activityPlan]', ...args);
}

