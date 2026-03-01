export function getStoredDashboardTab(storageKey, fallbackTab, allowedTabs) {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return fallbackTab;
  return allowedTabs.includes(saved) ? saved : fallbackTab;
}

export function persistDashboardTab(storageKey, activeTab) {
  localStorage.setItem(storageKey, activeTab);
}
