// Центральный реестр DOM-элементов и безопасное навешивание событий.
export const dom = {
  app: document.getElementById("app"),
  viewMain: document.getElementById("viewMain"),
  viewHistory: document.getElementById("viewHistory"),
  viewSettings: document.getElementById("viewSettings"),
  statusBadge: document.getElementById("statusBadge"),
  statusTitle: document.getElementById("statusTitle"),
  statusHint: document.getElementById("statusHint"),
  domainValue: document.getElementById("domainValue"),
  sourceValue: document.getElementById("sourceValue"),
  checkedAt: document.getElementById("checkedAt"),
  recommendationsList: document.getElementById("recommendationsList"),
  riskLevel: document.getElementById("riskLevel"),
  refreshBtn: document.getElementById("refreshBtn"),
  openSettingsBtn: document.getElementById("openSettingsBtn"),
  openHistoryBtn: document.getElementById("openHistoryBtn"),
  closeHistoryBtn: document.getElementById("closeHistoryBtn"),
  closeSettingsBtn: document.getElementById("closeSettingsBtn"),
  historyList: document.getElementById("historyList"),
  historyEmpty: document.getElementById("historyEmpty"),
  clearHistoryBtn: document.getElementById("clearHistoryBtn"),
  autoCheckInput: document.getElementById("autoCheckInput"),
  alertInput: document.getElementById("alertInput"),
  themeToggle: document.getElementById("themeToggle"),
  languageSelect: document.getElementById("languageSelect"),
  historyRetentionSelect: document.getElementById("historyRetentionSelect"),
  compactModeToggle: document.getElementById("compactModeToggle"),
  settingsStatus: document.getElementById("settingsStatus"),
  whitelistForm: document.getElementById("whitelistForm"),
  whitelistInput: document.getElementById("whitelistInput"),
  whitelistList: document.getElementById("whitelistList"),
  quickAddBtn: document.getElementById("quickAddBtn"),
  manualForm: document.getElementById("manualForm"),
  manualInput: document.getElementById("manualInput"),
  manualHint: document.getElementById("manualHint"),
  statsTrusted: document.getElementById("statsTrusted"),
  statsAlert: document.getElementById("statsAlert"),
  statsWhitelist: document.getElementById("statsWhitelist")
};

export const safeAddEvent = (element, event, handler) => {
  if (!element) return;
  element.addEventListener(event, handler);
};
