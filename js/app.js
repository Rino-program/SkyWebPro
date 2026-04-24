/**
 * SkyWebPro — app.js  v1.0
 */

const S = {
  session: null, myProfile: null,
  tab: 'home', homeSubTab: 'following', notifSubTab: 'all', searchTab: 'posts', profileSubTab: 'posts',
  replyTarget: null, pendingImgs: [], quickPendingImgs: [], deleteTarget: null,
  cursors: {}, loading: {},
  activeConvoId: null,
  cachedNotifs: [],
  statsRange: 'week',
  navChordActive: false,
  navChordTimer: null,
  dmStartDid: null,
  trendCategory: 'all',
  searchComposing: false,
  isMobileView: false,
  isTabletView: false,
  isLandscape: false,
  isTouch: false,
  dmConvos: [],
  lastUnreadCount: -1,
  notifFilterMode: 'all',
};

const C = window.SKYWEBPRO_CONST || {};
const QUICK_NOTE_KEY = C.QUICK_NOTE_KEY || 'skywebpro_quick_note_v1';
const QUICK_NOTE_LIST_KEY = C.QUICK_NOTE_LIST_KEY || 'skywebpro_quick_note_list_v1';
const THEME_KEY = C.THEME_KEY || 'skywebpro_theme_v1';
const APP_MAX_IMAGE_BYTES = Number(C.APP_MAX_IMAGE_BYTES || 1000000);
const RIGHT_PANEL_PREFS_KEY = C.RIGHT_PANEL_PREFS_KEY || 'skywebpro_right_panel_prefs_v1';
const POST_HISTORY_KEY = C.POST_HISTORY_KEY || 'skywebpro_post_history_v1';
const SEARCH_HISTORY_KEY = C.SEARCH_HISTORY_KEY || 'skywebpro_search_history_v1';
const COMPOSE_CACHE_KEY = C.COMPOSE_CACHE_KEY || 'skywebpro_compose_cache_v1';
const UI_PREFS_KEY = C.UI_PREFS_KEY || 'skywebpro_ui_prefs_v1';
const EXPERIENCE_PREFS_KEY = C.EXPERIENCE_PREFS_KEY || 'skywebpro_experience_prefs_v1';
const ACTIVITY_STATS_KEY = C.ACTIVITY_STATS_KEY || 'skywebpro_activity_stats_v1';
const HOME_PINNED_QUERY_KEY = C.HOME_PINNED_QUERY_KEY || 'skywebpro_home_pinned_query_v1';
const SCROLL_POSITIONS_KEY = C.SCROLL_POSITIONS_KEY || 'skywebpro_scroll_positions_v1';
const QUICK_POST_WIDTH_KEY = C.QUICK_POST_WIDTH_KEY || 'skywebpro_quick_post_width_v1';
const FEED_WIDTH_PREFS_KEY = C.FEED_WIDTH_PREFS_KEY || 'skywebpro_feed_width_prefs_v1';
const NOTIF_POLL_MS_KEY = C.NOTIF_POLL_MS_KEY || 'skywebpro_notif_poll_ms_v1';
const TOAST_DURATION_MS_KEY = C.TOAST_DURATION_MS_KEY || 'skywebpro_toast_duration_ms_v1';
const STARTUP_TAB_MODE_KEY = C.STARTUP_TAB_MODE_KEY || 'skywebpro_startup_tab_mode_v1';
const IMAGE_AUTOLOAD_MODE_KEY = C.IMAGE_AUTOLOAD_MODE_KEY || 'skywebpro_image_autoload_mode_v1';
const POST_DENSITY_KEY = C.POST_DENSITY_KEY || 'skywebpro_post_density_v1';
const FONT_SCALE_KEY = C.FONT_SCALE_KEY || 'skywebpro_font_scale_v1';
const READING_WIDTH_KEY = C.READING_WIDTH_KEY || 'skywebpro_reading_width_v1';
const SHORTCUT_PREFS_KEY = C.SHORTCUT_PREFS_KEY || 'skywebpro_shortcut_prefs_v1';
const SHORTCUTS_ENABLED_KEY = C.SHORTCUTS_ENABLED_KEY || 'skywebpro_shortcuts_enabled_v1';
const INACTIVITY_TIMEOUT_MIN_KEY = C.INACTIVITY_TIMEOUT_MIN_KEY || 'skywebpro_inactivity_timeout_min_v1';
const PERF_METRICS_KEY = C.PERF_METRICS_KEY || 'skywebpro_perf_metrics_v1';
const PINNED_QUERIES_KEY = C.PINNED_QUERIES_KEY || 'skywebpro_pinned_queries_v1';
const REPLY_TEMPLATE_KEY = C.REPLY_TEMPLATE_KEY || 'skywebpro_reply_template_v1';
const POST_QUEUE_KEY = C.POST_QUEUE_KEY || 'skywebpro_post_queue_v1';
const DM_READ_STATE_KEY = C.DM_READ_STATE_KEY || 'skywebpro_dm_read_state_v1';
const LOG_LEVEL_KEY = C.LOG_LEVEL_KEY || 'skywebpro_log_level_v1';
const CONNECTION_MODE_PREF_KEY = 'skywebpro_connection_mode_v1';
const CONNECTION_PROXY_BASE_PREF_KEY = 'skywebpro_connection_proxy_base_v1';
const ADVANCED_MODE_KEY = 'skywebpro_advanced_mode_v1';
const ADVANCED_MODE_CODE = 'skyproxy-open';
const ADMIN_REPORT_HANDLE = C.ADMIN_REPORT_HANDLE || 'rino-program.bsky.social';
const LOGIN_CONSOLE_MAX_LINES = Number(C.LOGIN_CONSOLE_MAX_LINES || 200);
const POST_TEXT_MAX_CHARS = 300;
const POST_WARN_THRESHOLD = 30;
const DEFAULT_SHORTCUT_PREFS = C.DEFAULT_SHORTCUT_PREFS || {
  showHelp: '?',
  focusSearch: '/',
  focusCompose: 'c',
  navPrefix: 'g',
};
const SETTINGS_EXPORT_KEYS = [
  THEME_KEY,
  UI_PREFS_KEY,
  EXPERIENCE_PREFS_KEY,
  RIGHT_PANEL_PREFS_KEY,
  FEED_WIDTH_PREFS_KEY,
  QUICK_POST_WIDTH_KEY,
  HOME_PINNED_QUERY_KEY,
  NOTIF_POLL_MS_KEY,
  TOAST_DURATION_MS_KEY,
  IMAGE_AUTOLOAD_MODE_KEY,
  INACTIVITY_TIMEOUT_MIN_KEY,
  POST_DENSITY_KEY,
  FONT_SCALE_KEY,
  READING_WIDTH_KEY,
  SHORTCUT_PREFS_KEY,
  SHORTCUTS_ENABLED_KEY,
  SEARCH_HISTORY_KEY,
  QUICK_NOTE_KEY,
  QUICK_NOTE_LIST_KEY,
  CONNECTION_MODE_PREF_KEY,
  CONNECTION_PROXY_BASE_PREF_KEY,
  'skywebpro_drafts_v1',
];
const APP_MEMORY_STORAGE = new Map();
const APP_FETCH_CACHE = new Map();
const NORMALIZED_STORE = {
  posts: new Map(),
  profiles: new Map(),
};
const SCROLL_POSITIONS = new Map();
const NOTIF_SUBJECT_CACHE = new Map();
let SEARCH_ABORT_CONTROLLER = null;
const MODAL_LAST_FOCUS = new Map();
let FEED_WIDTH_APPLY_LOCK = false;

function safeStorageGet(key) {
  try { return localStorage.getItem(key); }
  catch { return APP_MEMORY_STORAGE.has(key) ? APP_MEMORY_STORAGE.get(key) : null; }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    APP_MEMORY_STORAGE.set(key, value);
    return true;
  } catch {
    APP_MEMORY_STORAGE.set(key, value);
    return false;
  }
}

function isAdvancedModeEnabled() {
  return String(safeStorageGet(ADVANCED_MODE_KEY) || '') === '1';
}

function setAdvancedModeEnabled(enabled) {
  safeStorageSet(ADVANCED_MODE_KEY, enabled ? '1' : '0');
  syncAdvancedModeUi();
  return enabled;
}

function clearAdvancedMode() {
  safeStorageSet(ADVANCED_MODE_KEY, '0');
  if (typeof setConnectionMode === 'function') setConnectionMode('direct');
  else safeStorageSet(CONNECTION_MODE_PREF_KEY, 'direct');
  syncAdvancedModeUi();
}

function syncAdvancedModeUi() {
  const enabled = isAdvancedModeEnabled();
  if (!enabled) {
    if (typeof setConnectionMode === 'function') setConnectionMode('direct');
    else safeStorageSet(CONNECTION_MODE_PREF_KEY, 'direct');
  }
  document.querySelectorAll('[data-advanced-only]').forEach(el => {
    if (!(el instanceof HTMLElement)) return;
    el.classList.toggle('hidden', !enabled);
  });
}

function getSafeConnectionConfig() {
  if (typeof getConnectionConfig === 'function') {
    try { return getConnectionConfig(); } catch {}
  }
  const modeRaw = String(safeStorageGet(CONNECTION_MODE_PREF_KEY) || 'direct').toLowerCase();
  const mode = modeRaw === 'proxy' ? 'proxy' : 'direct';
  const proxyBase = String(safeStorageGet(CONNECTION_PROXY_BASE_PREF_KEY) || '').trim();
  const pubBase = mode === 'proxy' ? (proxyBase ? `${proxyBase.replace(/\/+$/, '')}/xrpc` : '') : 'https://bsky.social/xrpc';
  const chatBase = mode === 'proxy' ? (proxyBase ? `${proxyBase.replace(/\/+$/, '')}/xrpc` : '') : 'https://api.bsky.chat/xrpc';
  return { mode, proxyBase, pubBase, chatBase };
}

function syncConnectionModeUi() {
  let cfg = getSafeConnectionConfig();
  if (!isAdvancedModeEnabled() && cfg.mode === 'proxy') {
    if (typeof setConnectionMode === 'function') setConnectionMode('direct');
    else safeStorageSet(CONNECTION_MODE_PREF_KEY, 'direct');
    cfg = getSafeConnectionConfig();
  }
  const isProxy = cfg.mode === 'proxy';

  const loginMode = document.getElementById('login-connection-mode');
  const loginProxy = document.getElementById('login-proxy-base');
  const loginHint = document.getElementById('login-connection-hint');
  if (loginMode) loginMode.value = cfg.mode;
  if (loginProxy) {
    loginProxy.value = cfg.proxyBase || '';
    loginProxy.disabled = !isProxy;
  }
  if (loginHint) {
    if (isProxy) {
      loginHint.textContent = cfg.proxyBase
        ? `現在: XServer経由 (${cfg.proxyBase})`
        : '現在: XServer経由（URL未設定）';
    } else {
      loginHint.textContent = '現在: 直通モード';
    }
  }

  const settingsMode = document.getElementById('settings-connection-mode');
  const settingsProxy = document.getElementById('settings-proxy-base');
  const settingsState = document.getElementById('settings-connection-state');
  if (settingsMode) settingsMode.value = cfg.mode;
  if (settingsProxy) {
    settingsProxy.value = cfg.proxyBase || '';
    settingsProxy.disabled = !isProxy;
  }
  if (settingsState) {
    settingsState.textContent = isProxy
      ? (cfg.proxyBase ? `XServer経由: ${cfg.proxyBase}` : 'XServer経由: URL未設定')
      : '直通: bsky.social / api.bsky.chat';
  }

  syncAdvancedModeUi();
}

function applyConnectionModeFromUi(source = 'settings') {
  const modeEl = source === 'login'
    ? document.getElementById('login-connection-mode')
    : document.getElementById('settings-connection-mode');
  const proxyEl = source === 'login'
    ? document.getElementById('login-proxy-base')
    : document.getElementById('settings-proxy-base');
  const mode = String(modeEl?.value || 'direct').toLowerCase() === 'proxy' ? 'proxy' : 'direct';
  const proxyBase = String(proxyEl?.value || '').trim();

  if (typeof setConnectionMode === 'function') setConnectionMode(mode);
  else safeStorageSet(CONNECTION_MODE_PREF_KEY, mode);

  if (typeof setProxyBaseUrl === 'function') setProxyBaseUrl(proxyBase);
  else safeStorageSet(CONNECTION_PROXY_BASE_PREF_KEY, proxyBase);

  syncConnectionModeUi();

  if (typeof clearFetchCache === 'function') {
    try { clearFetchCache(); } catch {}
  }

  const cfg = getSafeConnectionConfig();
  if (cfg.mode === 'proxy' && !cfg.proxyBase) {
    return { ok: false, message: 'XServerベースURLを設定してください。' };
  }
  return { ok: true, message: '' };
}

function cacheKey(parts) {
  return parts.map(v => String(v ?? '')).join('::');
}

function normalizeProfile(profile) {
  const key = String(profile?.did || profile?.handle || '');
  if (!key) return profile;
  const prev = NORMALIZED_STORE.profiles.get(key) || {};
  const next = { ...prev, ...profile };
  NORMALIZED_STORE.profiles.set(key, next);
  return next;
}

function normalizePost(post) {
  const key = String(post?.uri || '');
  if (!key) return post;
  const prev = NORMALIZED_STORE.posts.get(key) || {};
  const next = { ...prev, ...post, author: normalizeProfile(post?.author || {}) };
  NORMALIZED_STORE.posts.set(key, next);
  return next;
}

function normalizeFeedRows(rows) {
  return (Array.isArray(rows) ? rows : []).map(item => {
    if (!item?.post) return item;
    return { ...item, post: normalizePost(item.post) };
  });
}

function getCachedData(key, ttlMs) {
  const hit = APP_FETCH_CACHE.get(key);
  if (!hit) return null;
  if ((Date.now() - hit.at) > ttlMs) {
    APP_FETCH_CACHE.delete(key);
    return null;
  }
  return hit.data;
}

async function fetchWithLocalCache(key, ttlMs, fetcher) {
  const cached = getCachedData(key, ttlMs);
  if (cached) return cached;
  const data = await fetcher();
  APP_FETCH_CACHE.set(key, { at: Date.now(), data });
  return data;
}

function clearFetchCache(prefix = '') {
  if (!prefix) {
    APP_FETCH_CACHE.clear();
    return;
  }
  [...APP_FETCH_CACHE.keys()].forEach(k => {
    if (k.startsWith(prefix)) APP_FETCH_CACHE.delete(k);
  });
}

function getLogLevel() {
  const raw = String(safeStorageGet(LOG_LEVEL_KEY) || 'info');
  return ['debug', 'info', 'warn', 'error'].includes(raw) ? raw : 'info';
}

function shouldLog(level) {
  const order = { debug: 10, info: 20, warn: 30, error: 40 };
  const current = order[getLogLevel()] || 20;
  const target = order[String(level || 'info')] || 20;
  return target >= current;
}

function appLog(level, ...args) {
  if (!shouldLog(level)) return;
  const fn = console[level] || console.log;
  fn(...args);
}

function getPostQueue() {
  try {
    const raw = JSON.parse(safeStorageGet(POST_QUEUE_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function savePostQueue(list) {
  safeStorageSet(POST_QUEUE_KEY, JSON.stringify(Array.isArray(list) ? list : []));
}

function enqueuePost(payload) {
  const list = getPostQueue();
  list.push({
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: new Date().toISOString(),
    ...payload,
  });
  savePostQueue(list.slice(-20));
}

function getDmReadState() {
  try {
    const raw = JSON.parse(safeStorageGet(DM_READ_STATE_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function setDmReadState(convoId, isRead) {
  const map = getDmReadState();
  map[String(convoId || '')] = !!isRead;
  safeStorageSet(DM_READ_STATE_KEY, JSON.stringify(map));
}

function getVisibleModals() {
  return [...document.querySelectorAll('.modal-overlay')].filter(m => !m.classList.contains('hidden'));
}

function getTopVisibleModal() {
  const visible = getVisibleModals();
  if (!visible.length) return null;
  return visible[visible.length - 1];
}

function getFocusableElements(root) {
  if (!root) return [];
  const nodes = root.querySelectorAll('a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])');
  return [...nodes].filter(el => !el.classList.contains('hidden') && el.offsetParent !== null);
}

function openModalById(id, focusSelector = '') {
  const modal = document.getElementById(id);
  if (!modal) return;
  if (modal.classList.contains('hidden')) {
    const active = document.activeElement;
    if (active && active instanceof HTMLElement) MODAL_LAST_FOCUS.set(id, active);
  }
  modal.classList.remove('hidden');
  if (focusSelector) {
    const target = modal.querySelector(focusSelector);
    if (target && target instanceof HTMLElement) {
      target.focus();
      return;
    }
  }
  const firstFocusable = getFocusableElements(modal)[0];
  if (firstFocusable) firstFocusable.focus();
  else {
    modal.setAttribute('tabindex', '-1');
    modal.focus();
  }
}

function closeModalById(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('hidden');
  const prev = MODAL_LAST_FOCUS.get(id);
  MODAL_LAST_FOCUS.delete(id);
  if (prev && prev.isConnected && prev instanceof HTMLElement) {
    prev.focus();
  }
}

function trapFocusInTopModal(e) {
  if (e.key !== 'Tab') return false;
  const modal = getTopVisibleModal();
  if (!modal) return false;
  const focusables = getFocusableElements(modal);
  if (!focusables.length) {
    e.preventDefault();
    modal.focus();
    return true;
  }
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;
  if (e.shiftKey) {
    if (active === first || !modal.contains(active)) {
      e.preventDefault();
      last.focus();
      return true;
    }
    return false;
  }
  if (active === last || !modal.contains(active)) {
    e.preventDefault();
    first.focus();
    return true;
  }
  return false;
}

function closeTopVisibleModal() {
  const modal = getTopVisibleModal();
  if (!modal) return false;
  const id = modal.id;
  if (id === 'quick-post-modal') {
    closeQuickPostModal();
    return true;
  }
  if (id === 'delete-modal') {
    closeModalById('delete-modal');
    S.deleteTarget = null;
    return true;
  }
  if (id === 'image-viewer-modal') {
    closeImageViewer();
    return true;
  }
  if (id === 'logout-action-modal') {
    closeLogoutActionModal();
    return true;
  }
  if (id === 'shortcuts-modal') {
    closeShortcutsModal();
    return true;
  }
  if (id === 'dm-start-modal') {
    closeDmStartModal();
    return true;
  }
  if (id === 'home-pinned-modal') {
    closePinnedModal();
    return true;
  }
  if (id === 'search-ime-modal') {
    closeSearchImeModal();
    return true;
  }
  closeModalById(id);
  return true;
}

function syncSubTabsAria() {
  document.querySelectorAll('.sub-tabs').forEach(group => {
    group.setAttribute('role', 'tablist');
    group.querySelectorAll('.sub-tab').forEach(tab => {
      const active = tab.classList.contains('active');
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.setAttribute('tabindex', active ? '0' : '-1');
    });
  });
}

function syncIconButtonAriaLabels() {
  document.querySelectorAll('button').forEach(btn => {
    if (btn.getAttribute('aria-label')) return;
    const hasText = String(btn.textContent || '').trim().length > 0;
    if (hasText) return;
    const title = String(btn.getAttribute('title') || '').trim();
    if (title) btn.setAttribute('aria-label', title);
  });
}

function syncExplicitAriaLabels() {
  document.querySelectorAll('.refresh-btn').forEach(btn => {
    if (btn.getAttribute('aria-label')) return;
    const target = String(btn.dataset.target || '').trim();
    const label = target ? `${target}を更新` : '更新';
    btn.setAttribute('aria-label', label);
  });
  document.querySelectorAll('.icon-btn').forEach(btn => {
    if (btn.getAttribute('aria-label')) return;
    const title = String(btn.getAttribute('title') || '').trim();
    btn.setAttribute('aria-label', title || '操作ボタン');
  });
}

function normalizeShortcutKey(value, fallback = '') {
  const raw = String(value || '').trim();
  if (!raw) return String(fallback || '').toLowerCase();
  return raw[0].toLowerCase();
}

function sanitizeShortcutPrefs(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    showHelp: normalizeShortcutKey(src.showHelp, DEFAULT_SHORTCUT_PREFS.showHelp),
    focusSearch: normalizeShortcutKey(src.focusSearch, DEFAULT_SHORTCUT_PREFS.focusSearch),
    focusCompose: normalizeShortcutKey(src.focusCompose, DEFAULT_SHORTCUT_PREFS.focusCompose),
    navPrefix: normalizeShortcutKey(src.navPrefix, DEFAULT_SHORTCUT_PREFS.navPrefix),
  };
}

function hasDuplicateShortcutPrefs(prefs) {
  const values = [prefs.showHelp, prefs.focusSearch, prefs.focusCompose, prefs.navPrefix].filter(Boolean);
  return new Set(values).size !== values.length;
}

function getShortcutPrefs() {
  try {
    return sanitizeShortcutPrefs(JSON.parse(safeStorageGet(SHORTCUT_PREFS_KEY) || 'null'));
  } catch {
    return { ...DEFAULT_SHORTCUT_PREFS };
  }
}

function getActiveShortcutPrefs() {
  const active = window.__skywebproShortcutPrefs;
  if (active && typeof active === 'object') return sanitizeShortcutPrefs(active);
  return getShortcutPrefs();
}

function getShortcutsEnabled() {
  const raw = safeStorageGet(SHORTCUTS_ENABLED_KEY);
  if (raw === null) return true;
  return raw !== '0';
}

function applyShortcutsEnabledState(enabled) {
  const on = !!enabled;
  window.__skywebproShortcutsEnabled = on;
  const ids = [
    'settings-shortcut-help',
    'settings-shortcut-search',
    'settings-shortcut-compose',
    'settings-shortcut-nav',
    'settings-shortcut-reset',
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = !on;
  });
}

function setShortcutsEnabled(enabled) {
  safeStorageSet(SHORTCUTS_ENABLED_KEY, enabled ? '1' : '0');
  applyShortcutsEnabledState(enabled);
}

function syncShortcutsEnabledUi() {
  const toggle = document.getElementById('settings-shortcuts-enabled');
  if (!toggle) return;
  toggle.checked = getShortcutsEnabled();
}

function onShortcutsEnabledChange() {
  const toggle = document.getElementById('settings-shortcuts-enabled');
  if (!toggle) return;
  setShortcutsEnabled(!!toggle.checked);
  showToast(toggle.checked ? 'ショートカット操作を有効化しました' : 'ショートカット操作を無効化しました', 'success', 1500);
}

function syncShortcutHintUi() {
  const prefs = getActiveShortcutPrefs();
  const help = document.getElementById('shortcut-help-key');
  const search = document.getElementById('shortcut-search-key');
  const compose = document.getElementById('shortcut-compose-key');
  const nav = document.getElementById('shortcut-nav-prefix-key');
  if (help) help.textContent = prefs.showHelp;
  if (search) search.textContent = prefs.focusSearch;
  if (compose) compose.textContent = prefs.focusCompose;
  if (nav) nav.textContent = prefs.navPrefix;
}

function setShortcutPrefs(prefs) {
  const next = sanitizeShortcutPrefs(prefs);
  safeStorageSet(SHORTCUT_PREFS_KEY, JSON.stringify(next));
  window.__skywebproShortcutPrefs = next;
  syncShortcutHintUi();
}

function syncShortcutPrefsUi() {
  const prefs = getShortcutPrefs();
  const help = document.getElementById('settings-shortcut-help');
  const search = document.getElementById('settings-shortcut-search');
  const compose = document.getElementById('settings-shortcut-compose');
  const nav = document.getElementById('settings-shortcut-nav');
  if (help) help.value = prefs.showHelp;
  if (search) search.value = prefs.focusSearch;
  if (compose) compose.value = prefs.focusCompose;
  if (nav) nav.value = prefs.navPrefix;
}

function onShortcutPrefsChange() {
  if (!getShortcutsEnabled()) return;
  const help = document.getElementById('settings-shortcut-help');
  const search = document.getElementById('settings-shortcut-search');
  const compose = document.getElementById('settings-shortcut-compose');
  const nav = document.getElementById('settings-shortcut-nav');
  if (!help || !search || !compose || !nav) return;
  const next = sanitizeShortcutPrefs({
    showHelp: help.value,
    focusSearch: search.value,
    focusCompose: compose.value,
    navPrefix: nav.value,
  });
  if (hasDuplicateShortcutPrefs(next)) {
    showToast('ショートカットが重複しています。別のキーを指定してください。', 'error', 2200);
    syncShortcutPrefsUi();
    return;
  }
  setShortcutPrefs(next);
  syncShortcutPrefsUi();
  showToast('ショートカットを更新しました', 'success', 1400);
}

function resetShortcutPrefs() {
  if (!getShortcutsEnabled()) return;
  setShortcutPrefs(DEFAULT_SHORTCUT_PREFS);
  syncShortcutPrefsUi();
  showToast('ショートカットを既定値に戻しました', 'success', 1400);
}

function getImageAutoloadMode() {
  const mode = String(safeStorageGet(IMAGE_AUTOLOAD_MODE_KEY) || 'always');
  return mode === 'wifi' ? 'wifi' : 'always';
}

function setImageAutoloadMode(mode) {
  const next = mode === 'wifi' ? 'wifi' : 'always';
  safeStorageSet(IMAGE_AUTOLOAD_MODE_KEY, next);
  window.__skywebproImageAutoLoadMode = next;
}

function syncImageAutoloadUi() {
  const sel = document.getElementById('settings-image-autoload');
  if (!sel) return;
  sel.value = getImageAutoloadMode();
}

function onImageAutoloadModeChange() {
  const sel = document.getElementById('settings-image-autoload');
  if (!sel) return;
  setImageAutoloadMode(sel.value);
  showToast('画像自動読み込み設定を変更しました', 'success', 1400);
}

function getNotifPollMs() {
  const raw = Number(safeStorageGet(NOTIF_POLL_MS_KEY) || 30000);
  const allowed = [15000, 30000, 60000, 120000, 300000];
  return allowed.includes(raw) ? raw : 30000;
}

function setNotifPollMs(ms) {
  const allowed = [15000, 30000, 60000, 120000, 300000];
  const v = Number(ms);
  safeStorageSet(NOTIF_POLL_MS_KEY, String(allowed.includes(v) ? v : 30000));
}

function getStartupTabMode() {
  const mode = String(safeStorageGet(STARTUP_TAB_MODE_KEY) || 'auto');
  return mode === 'manual' ? 'manual' : 'auto';
}

function setStartupTabMode(mode) {
  const next = mode === 'manual' ? 'manual' : 'auto';
  safeStorageSet(STARTUP_TAB_MODE_KEY, next);
}

function syncStartupTabModeUi() {
  const sel = document.getElementById('settings-startup-tab-mode');
  if (!sel) return;
  sel.value = getStartupTabMode();
}

function onStartupTabModeChange() {
  const sel = document.getElementById('settings-startup-tab-mode');
  if (!sel) return;
  setStartupTabMode(sel.value);
  showToast('起動時タブ設定を変更しました', 'success', 1400);
}

function getInactivityTimeoutMinutes() {
  const raw = Number(safeStorageGet(INACTIVITY_TIMEOUT_MIN_KEY) || 0);
  const allowed = [0, 15, 30, 60];
  return allowed.includes(raw) ? raw : 0;
}

function setInactivityTimeoutMinutes(minutes) {
  const v = Number(minutes);
  const allowed = [0, 15, 30, 60];
  const next = allowed.includes(v) ? v : 0;
  safeStorageSet(INACTIVITY_TIMEOUT_MIN_KEY, String(next));
}

function syncInactivityTimeoutUi() {
  const sel = document.getElementById('settings-inactivity-timeout');
  if (!sel) return;
  sel.value = String(getInactivityTimeoutMinutes());
}

let inactivityTimer = null;
function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = null;
  const min = getInactivityTimeoutMinutes();
  if (!S.session || min <= 0) return;
  inactivityTimer = setTimeout(() => {
    showToast('一定時間操作がなかったためログアウトしました', 'info', 2600);
    handleLogout();
  }, min * 60 * 1000);
}

function onInactivityTimeoutChange() {
  const sel = document.getElementById('settings-inactivity-timeout');
  if (!sel) return;
  setInactivityTimeoutMinutes(sel.value);
  resetInactivityTimer();
  showToast('自動ログアウト設定を変更しました', 'success', 1400);
}

function getReadingWidthMode() {
  const raw = Number(safeStorageGet(READING_WIDTH_KEY) || 64);
  return [56, 64, 72].includes(raw) ? raw : 64;
}

function applyReadingWidthMode(ch) {
  document.documentElement.style.setProperty('--reading-max-ch', `${ch}ch`);
}

function setReadingWidthMode(ch) {
  const next = [56, 64, 72].includes(Number(ch)) ? Number(ch) : 64;
  safeStorageSet(READING_WIDTH_KEY, String(next));
  applyReadingWidthMode(next);
}

function syncReadingWidthUi() {
  const sel = document.getElementById('settings-reading-width');
  if (!sel) return;
  sel.value = String(getReadingWidthMode());
}

function onReadingWidthModeChange() {
  const sel = document.getElementById('settings-reading-width');
  if (!sel) return;
  setReadingWidthMode(sel.value);
  showToast('1行あたり文字数目安を変更しました', 'success', 1400);
}

function getThemeMode() {
  const mode = String(safeStorageGet(THEME_KEY) || 'light');
  return ['light', 'dark', 'ocean', 'forest'].includes(mode) ? mode : 'light';
}

function syncThemeUi() {
  const sel = document.getElementById('settings-theme-mode');
  if (sel) sel.value = getThemeMode();
}

function onThemeModeChange() {
  const sel = document.getElementById('settings-theme-mode');
  if (!sel) return;
  applyTheme(sel.value);
  showToast('テーマを変更しました', 'success', 1400);
}

function getFontScaleMode() {
  const mode = String(safeStorageGet(FONT_SCALE_KEY) || 'normal');
  if (mode === 'small' || mode === 'large') return mode;
  return 'normal';
}

function applyFontScaleMode(mode) {
  const root = document.documentElement;
  if (!root) return;
  root.classList.remove('font-scale-small', 'font-scale-large');
  if (mode === 'small') root.classList.add('font-scale-small');
  else if (mode === 'large') root.classList.add('font-scale-large');
}

function setFontScaleMode(mode) {
  const next = mode === 'small' || mode === 'large' ? mode : 'normal';
  safeStorageSet(FONT_SCALE_KEY, next);
  applyFontScaleMode(next);
}

function syncFontScaleUi() {
  const sel = document.getElementById('settings-font-scale');
  if (!sel) return;
  sel.value = getFontScaleMode();
}

function onFontScaleModeChange() {
  const sel = document.getElementById('settings-font-scale');
  if (!sel) return;
  setFontScaleMode(sel.value);
  showToast('文字サイズを変更しました', 'success', 1400);
}

function getPostDensityMode() {
  const mode = String(safeStorageGet(POST_DENSITY_KEY) || 'normal');
  return mode === 'compact' ? 'compact' : 'normal';
}

function setPostDensityMode(mode) {
  const next = mode === 'compact' ? 'compact' : 'normal';
  safeStorageSet(POST_DENSITY_KEY, next);
  applyPostDensityMode(next);
}

function applyPostDensityMode(mode) {
  const root = document.body;
  if (!root) return;
  root.classList.toggle('density-compact', mode === 'compact');
}

function syncPostDensityUi() {
  const sel = document.getElementById('settings-post-density');
  if (!sel) return;
  sel.value = getPostDensityMode();
}

function onPostDensityModeChange() {
  const sel = document.getElementById('settings-post-density');
  if (!sel) return;
  setPostDensityMode(sel.value);
  showToast('投稿カード密度を変更しました', 'success', 1400);
}

function getToastDurationMs() {
  const raw = Number(safeStorageGet(TOAST_DURATION_MS_KEY) || 3500);
  const allowed = [2000, 3500, 5000, 8000];
  return allowed.includes(raw) ? raw : 3500;
}

function setToastDurationMs(ms) {
  const v = Number(ms);
  const allowed = [2000, 3500, 5000, 8000];
  const next = allowed.includes(v) ? v : 3500;
  safeStorageSet(TOAST_DURATION_MS_KEY, String(next));
  window.__skywebproToastDurationMs = next;
}

function syncToastDurationUi() {
  const sel = document.getElementById('settings-toast-duration');
  if (!sel) return;
  sel.value = String(getToastDurationMs());
}

function onToastDurationChange() {
  const sel = document.getElementById('settings-toast-duration');
  if (!sel) return;
  setToastDurationMs(sel.value);
  showToast('トースト表示時間を変更しました', 'success', 1400);
}

function buildSettingsExportPayload() {
  const data = {};
  SETTINGS_EXPORT_KEYS.forEach(key => {
    const value = safeStorageGet(key);
    if (value !== null && value !== undefined) data[key] = value;
  });
  return {
    app: 'SkyWebPro',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}

function downloadTextFile(fileName, text, mimeType = 'application/json') {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportSettingsToFile() {
  const payload = buildSettingsExportPayload();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  downloadTextFile(`skywebpro-settings-${stamp}.json`, JSON.stringify(payload, null, 2));
  showToast('設定をエクスポートしました', 'success', 1500);
}

function applyImportedSettings() {
  applySavedTheme();
  syncThemeUi();
  applySavedUiPrefs();
  syncSubTabUi();
  syncExperienceUi();
  applyRightPanelPrefs();
  applyQuickPostWidth(getQuickPostWidth());
  applyFeedWidthPrefs();
  syncPinnedUi();
  syncNotifPollUi();
  syncToastDurationUi();
  syncStartupTabModeUi();
  syncInactivityTimeoutUi();
  syncFontScaleUi();
  syncReadingWidthUi();
  syncPostDensityUi();
  syncShortcutsEnabledUi();
  setShortcutsEnabled(getShortcutsEnabled());
  syncImageAutoloadUi();
  syncShortcutPrefsUi();
  setShortcutPrefs(getShortcutPrefs());
  setImageAutoloadMode(getImageAutoloadMode());
  setToastDurationMs(getToastDurationMs());
  setFontScaleMode(getFontScaleMode());
  setReadingWidthMode(getReadingWidthMode());
  setPostDensityMode(getPostDensityMode());
  if (S.session) {
    stopNotifPoll();
    startNotifPoll();
    resetInactivityTimer();
  }
  renderSearchHistory();
  renderQuickNoteList();
}

async function importSettingsFromFile(file) {
  if (!file) return;
  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    showToast('JSONの解析に失敗しました', 'error');
    return;
  }
  const data = parsed?.data;
  if (!data || typeof data !== 'object') {
    showToast('設定ファイルの形式が不正です', 'error');
    return;
  }
  let applied = 0;
  SETTINGS_EXPORT_KEYS.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(data, key) && typeof data[key] === 'string') {
      safeStorageSet(key, data[key]);
      applied += 1;
    }
  });
  applyImportedSettings();
  showToast(`設定を読み込みました (${applied}件)`, 'success', 1800);
}

function syncNotifPollUi() {
  const sel = document.getElementById('settings-notif-interval');
  if (!sel) return;
  sel.value = String(getNotifPollMs());
      renderComposeHashtagSuggestions();
}

function onNotifPollIntervalChange() {
  const sel = document.getElementById('settings-notif-interval');
  if (!sel) return;
  setNotifPollMs(sel.value);
  if (S.session) {
    stopNotifPoll();
    startNotifPoll();
  }
  showToast('通知更新間隔を変更しました', 'success', 1600);
}

function toUserErrorMessage(err, fallback = '処理に失敗しました') {
  const msg = String(err?.message || '').trim();
  if (!msg) return fallback;
  if (err?.name === 'AbortError') return '';
  if (/failed to fetch|networkerror|fetch failed|network request/i.test(msg)) return '通信に失敗しました。接続状況を確認して再試行してください。';
  if (/session_expired|期限切れ|再ログイン/i.test(msg)) return 'セッション期限切れです。再ログインしてください。';
  if (/\(401\)|401/.test(msg)) return '認証エラーです。ログイン情報を確認してください。';
  if (/\(403\)|403/.test(msg)) return '権限がありません。設定またはアクセス権を確認してください。';
  if (/\(429\)|429/.test(msg)) return 'リクエストが多すぎます。少し待ってから再試行してください。';
  return msg;
}

function showErrorToast(err, fallback = '処理に失敗しました') {
  if (err?.code === 'SESSION_EXPIRED' || /session_expired|期限切れ/.test(String(err?.message || ''))) {
    if (typeof setReloginReason === 'function') setReloginReason('session_expired');
    handleLogout({ preserveCompose: true });
    const message = 'セッション期限切れです。入力内容は保持しました。再ログインしてください。';
    showToast(message, 'error', 3200);
    return;
  }
  const message = toUserErrorMessage(err, fallback);
  if (message) showToast(message, 'error');
}

function backupFailedPostToDraft(text, imageCount = 0, meta = '') {
  const body = String(text || '').trim();
  if (!body) return false;
  const imageNote = imageCount > 0 ? `\n\n[メモ] 画像 ${imageCount} 枚は再添付が必要です。` : '';
  const metaNote = meta ? `\n\n[メモ] ${meta}` : '';
  saveDraft(`${body}${imageNote}${metaNote}`);
  return true;
}

function sanitizeSensitiveText(text) {
  const src = String(text || '');
  return src
    .replace(/([A-Za-z0-9_\-]{4,})-([A-Za-z0-9_\-]{4,})-([A-Za-z0-9_\-]{4,})-([A-Za-z0-9_\-]{4,})/g, '****-****-****-****')
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s]+/ig, '$1***')
    .replace(/(refreshJwt|accessJwt|password)\s*[:=]\s*["'][^"']+["']/ig, '$1="***"');
}

function formatLogArg(v) {
  if (v instanceof Error) return sanitizeSensitiveText(v.stack || v.message);
  if (typeof v === 'string') return sanitizeSensitiveText(v);
  try { return sanitizeSensitiveText(JSON.stringify(v)); } catch { return sanitizeSensitiveText(String(v)); }
}

function appendLoginConsole(level, args) {
  if (!shouldLog(level)) return;
  const out = document.getElementById('login-console-output');
  if (!out) return;
  const ts = new Date().toLocaleTimeString('ja-JP', { hour12: false });
  const text = args.map(formatLogArg).join(' ');
  const line = `[${ts}] ${level.toUpperCase()} ${text}`;
  const lines = (out.textContent || '').split('\n').filter(Boolean);
  lines.push(line);
  out.textContent = lines.slice(-LOGIN_CONSOLE_MAX_LINES).join('\n');
  out.scrollTop = out.scrollHeight;
}

function installLoginConsoleCapture() {
  if (window.__skywebproLoginConsoleInstalled) return;
  window.__skywebproLoginConsoleInstalled = true;

  ['log', 'info', 'warn', 'error'].forEach(level => {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      original(...args);
      appendLoginConsole(level, args);
    };
  });

  window.addEventListener('error', ev => {
    appendLoginConsole('error', [ev.message || 'window error']);
  });
  window.addEventListener('unhandledrejection', ev => {
    appendLoginConsole('error', ['unhandledrejection', ev.reason]);
  });
}

function clearLoginConsole() {
  const out = document.getElementById('login-console-output');
  if (!out) return;
  out.textContent = '[SkyWebPro] login console cleared';
}

// =============================================
//  レスポンシブ判定
// =============================================
function updateViewportState() {
  const w = window.innerWidth, h = window.innerHeight;
  S.isMobileView = w < 768;
  S.isTabletView = w >= 768 && w < 1024;
  S.isLandscape = h < w && h < 600;
  S.isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

function initViewportListener() {
  updateViewportState();
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(updateViewportState, 250);
  });
  window.addEventListener('orientationchange', () => {
    updateViewportState();
  });
}

// =============================================
//  スクロール位置管理
// =============================================
function saveScrollPosition(tabName, subTab = '') {
  const key = `${tabName}:${subTab}`;
  const el = document.querySelector('.main-content');
  if (el) SCROLL_POSITIONS.set(key, el.scrollTop);
}

function restoreScrollPosition(tabName, subTab = '') {
  const key = `${tabName}:${subTab}`;
  const pos = SCROLL_POSITIONS.get(key) || 0;
  const el = document.querySelector('.main-content');
  if (el) {
    setTimeout(() => { el.scrollTop = pos; }, 50);
  }
}

function clearScrollPositions() {
  SCROLL_POSITIONS.clear();
}

function getQuickPostWidth() {
  const raw = Number(safeStorageGet(QUICK_POST_WIDTH_KEY) || 520);
  if (!Number.isFinite(raw)) return 520;
  return Math.min(860, Math.max(360, raw));
}

function applyQuickPostWidth(width) {
  const w = Math.min(860, Math.max(360, Number(width) || 520));
  const card = document.querySelector('#quick-post-modal .quick-post-card');
  const range = document.getElementById('quick-post-width');
  const label = document.getElementById('quick-post-width-value');
  if (card) {
    card.style.width = `min(${w}px, calc(100vw - 24px))`;
    card.style.maxWidth = `${w}px`;
  }
  if (range) range.value = String(w);
  if (label) label.textContent = `${w}px`;
  safeStorageSet(QUICK_POST_WIDTH_KEY, String(w));
}

function getFeedWidthPrefs() {
  const base = { enabled: false, width: 680 };
  try {
    const raw = JSON.parse(safeStorageGet(FEED_WIDTH_PREFS_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return base;
    return {
      enabled: raw.enabled === true,
      width: Math.min(1100, Math.max(560, Number(raw.width || 680))),
    };
  } catch {
    return base;
  }
}

function saveFeedWidthPrefs(next) {
  safeStorageSet(FEED_WIDTH_PREFS_KEY, JSON.stringify(next));
}

function applyFeedWidth(width) {
  const w = Math.min(1100, Math.max(560, Number(width) || 680));
  document.documentElement.style.setProperty('--main-content-max', `${w}px`);
  const range = document.getElementById('settings-feed-width');
  const label = document.getElementById('settings-feed-width-value');
  if (range) range.value = String(w);
  if (label) label.textContent = `${w}px`;
}

function applyFeedWidthPrefs() {
  const p = getFeedWidthPrefs();
  applyFeedWidth(p.width);
  const enabledInput = document.getElementById('settings-enable-feed-width');
  const range = document.getElementById('settings-feed-width');
  const applyBtn = document.getElementById('settings-feed-width-apply');
  const resizer = document.getElementById('main-width-resizer');
  if (enabledInput) enabledInput.checked = p.enabled;
  if (range) range.disabled = !p.enabled || FEED_WIDTH_APPLY_LOCK;
  if (applyBtn) applyBtn.disabled = !p.enabled || FEED_WIDTH_APPLY_LOCK;
  if (resizer) resizer.classList.toggle('hidden', !p.enabled || S.isMobileView || S.isTabletView);
}

function onFeedWidthSettingsChange() {
  const enabled = !!document.getElementById('settings-enable-feed-width')?.checked;
  const width = Number(document.getElementById('settings-feed-width')?.value || 680);
  saveFeedWidthPrefs({ enabled, width });
  applyFeedWidthPrefs();
}

function applyFeedWidthWithLock() {
  if (FEED_WIDTH_APPLY_LOCK) return;
  const enabled = !!document.getElementById('settings-enable-feed-width')?.checked;
  if (!enabled) return;
  const range = document.getElementById('settings-feed-width');
  const width = Number(range?.value || 680);
  const curr = getFeedWidthPrefs();
  applyFeedWidth(width);
  saveFeedWidthPrefs({ ...curr, enabled: true, width });
  FEED_WIDTH_APPLY_LOCK = true;
  applyFeedWidthPrefs();
  setTimeout(() => {
    FEED_WIDTH_APPLY_LOCK = false;
    applyFeedWidthPrefs();
  }, 500);
}

function initMainWidthResizer() {
  const resizer = document.getElementById('main-width-resizer');
  if (!resizer) return;
  let dragging = false;

  const onMove = (clientX) => {
    const minX = 560 + parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sw'));
    const maxX = 1100 + parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sw'));
    const clamped = Math.min(maxX, Math.max(minX, clientX));
    const nextWidth = Math.round((clamped - parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sw'))) / 10) * 10;
    applyFeedWidth(nextWidth);
    const curr = getFeedWidthPrefs();
    saveFeedWidthPrefs({ ...curr, width: nextWidth });
  };

  resizer.addEventListener('mousedown', (e) => {
    if (!getFeedWidthPrefs().enabled) return;
    dragging = true;
    resizer.classList.add('dragging');
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    onMove(e.clientX);
  });

  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    resizer.classList.remove('dragging');
  });
}

// =============================================
//  console.error のポップアップ表示
// =============================================
(function () {
  const _origError = console.error.bind(console);
  console.error = function (...args) {
    _origError(...args);
    const text = args.map(formatLogArg).join(' ').trim();
    if (!text || typeof showToast !== 'function') return;
    const looksUserError = /認証|権限|失敗|期限切れ|通信|投稿|検索|取得|送信/.test(text);
    showToast(looksUserError ? text : '予期しないエラーが発生しました。詳細はログを確認してください。', 'error', 4200);
  };
})();

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.update().catch(() => {});

    const requestActivation = () => {
      if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    };

    requestActivation();
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed') requestActivation();
      });
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (window.__skywebproSwRefreshing) return;
      window.__skywebproSwRefreshing = true;
      window.location.reload();
    });
  }).catch(() => {});
}

// =============================================
//  初期化
// =============================================
async function init() {
  installLoginConsoleCapture();
  initViewportListener();
  applySavedTheme();
  setToastDurationMs(getToastDurationMs());
  setImageAutoloadMode(getImageAutoloadMode());
  setFontScaleMode(getFontScaleMode());
  setReadingWidthMode(getReadingWidthMode());
  setPostDensityMode(getPostDensityMode());
  setShortcutsEnabled(getShortcutsEnabled());
  setShortcutPrefs(getShortcutPrefs());
  syncConnectionModeUi();
  const sess = loadSession();
  applySavedUiPrefs();
  syncExperienceUi();
  syncSubTabUi();
  if (sess) {
    S.session = sess;
    showApp();
    await loadMyProfile();
    restoreComposeCache();
    const bootTab = getAdaptiveBootTab();
    switchTab(bootTab);
    await loadTab(bootTab);
    startNotifPoll();
    resetInactivityTimer();
    flushQueuedPosts();
  } else {
    showLogin();
    const reason = typeof takeReloginReason === 'function' ? takeReloginReason() : '';
    const errEl = document.getElementById('login-error');
    if (errEl && reason === 'storage_version_mismatch') {
      errEl.textContent = 'バージョン不一致を検出したため、安全のため再ログインしてください。';
      errEl.classList.remove('hidden');
      openModalById('migration-wizard-modal', '#migration-wizard-close');
    }
    if (errEl && reason === 'session_expired_policy') {
      errEl.textContent = 'セッション保存期限（7日）を超えたため再ログインが必要です。';
      errEl.classList.remove('hidden');
    }
    if (errEl && reason === 'session_expired') {
      errEl.textContent = 'セッション期限切れです。作業内容はローカルに保持されています。再ログインしてください。';
      errEl.classList.remove('hidden');
    }
  }
  renderSearchHistory();
  renderComposeHashtagSuggestions();
  syncPinnedUi();
  syncSubTabsAria();
  syncIconButtonAriaLabels();
  syncExplicitAriaLabels();
  applyQuickPostWidth(getQuickPostWidth());
  applyFeedWidthPrefs();
  syncNotifPollUi();
  syncToastDurationUi();
  syncStartupTabModeUi();
  syncInactivityTimeoutUi();
  syncThemeUi();
  syncFontScaleUi();
  syncReadingWidthUi();
  syncPostDensityUi();
  syncShortcutsEnabledUi();
  syncImageAutoloadUi();
  syncShortcutPrefsUi();
  syncReplyTemplateUi();
  initMainWidthResizer();
  initLoadMoreObserver();
  bindAll();
  registerServiceWorker();
}

function getUiPrefs() {
  const base = { tab: 'home', homeSubTab: 'following', notifSubTab: 'all', searchTab: 'posts', profileSubTab: 'posts' };
  try {
    const raw = JSON.parse(safeStorageGet(UI_PREFS_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return base;
    return {
      tab: typeof raw.tab === 'string' ? raw.tab : base.tab,
      homeSubTab: ['discover', 'following', 'pinned'].includes(raw.homeSubTab) ? raw.homeSubTab : 'following',
      notifSubTab: ['all', 'mention', 'unread', 'nonfollowers'].includes(raw.notifSubTab) ? raw.notifSubTab : 'all',
      searchTab: ['posts', 'users', 'latest', 'trends'].includes(raw.searchTab) ? raw.searchTab : 'posts',
      profileSubTab: ['posts', 'replies', 'media', 'likes'].includes(raw.profileSubTab) ? raw.profileSubTab : 'posts',
    };
  } catch {
    return base;
  }
}

function getExperiencePrefs() {
  const base = { japanMode: true, japanTrends: true, personalize: true };
  try {
    const raw = JSON.parse(safeStorageGet(EXPERIENCE_PREFS_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return base;
    return {
      japanMode: raw.japanMode !== false,
      japanTrends: raw.japanTrends !== false,
      personalize: raw.personalize !== false,
    };
  } catch {
    return base;
  }
}

function saveExperiencePrefs(next) {
  safeStorageSet(EXPERIENCE_PREFS_KEY, JSON.stringify(next));
}

function syncExperienceUi() {
  const p = getExperiencePrefs();
  const japanMode = document.getElementById('settings-japan-mode');
  const japanTrends = document.getElementById('settings-japan-trends');
  const personalize = document.getElementById('settings-personalize');
  if (japanMode) japanMode.checked = p.japanMode;
  if (japanTrends) japanTrends.checked = p.japanTrends;
  if (personalize) personalize.checked = p.personalize;
}

function handleExperienceSettingsChange() {
  const next = {
    japanMode: !!document.getElementById('settings-japan-mode')?.checked,
    japanTrends: !!document.getElementById('settings-japan-trends')?.checked,
    personalize: !!document.getElementById('settings-personalize')?.checked,
  };
  saveExperiencePrefs(next);
  renderSearchHistory();
  if (S.tab === 'search' && S.searchTab === 'trends') execSearch('');
}

function getActivityStats() {
  const base = { home: 0, search: 0, dm: 0, notifications: 0, profile: 0, posts: 0, updatedAt: Date.now() };
  try {
    const raw = JSON.parse(safeStorageGet(ACTIVITY_STATS_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return base;
    return {
      home: Number(raw.home || 0),
      search: Number(raw.search || 0),
      dm: Number(raw.dm || 0),
      notifications: Number(raw.notifications || 0),
      profile: Number(raw.profile || 0),
      posts: Number(raw.posts || 0),
      updatedAt: Number(raw.updatedAt || Date.now()),
    };
  } catch {
    return base;
  }
}

function incActivity(key) {
  const s = getActivityStats();
  if (typeof s[key] !== 'number') return;
  s[key] += 1;
  s.updatedAt = Date.now();
  safeStorageSet(ACTIVITY_STATS_KEY, JSON.stringify(s));
}

function getAdaptiveBootTab() {
  if (getStartupTabMode() === 'manual') return getBootTab();
  const exp = getExperiencePrefs();
  if (!exp.personalize) return getBootTab();
  const st = getActivityStats();
  const entries = [
    ['home', st.home],
    ['search', st.search],
    ['dm', st.dm],
    ['notifications', st.notifications],
    ['profile', st.profile],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0] || getBootTab();
}

function getPinnedHomeQuery() {
  const list = getPinnedHomeQueries();
  return list[0] || 'Bluesky 日本';
}

function getPinnedHomeQueries() {
  try {
    const arr = JSON.parse(safeStorageGet(PINNED_QUERIES_KEY) || '[]');
    if (Array.isArray(arr) && arr.length) {
      return arr
        .map(v => String(v || '').trim())
        .filter(Boolean)
        .slice(0, 5);
    }
  } catch {}
  const legacy = String(safeStorageGet(HOME_PINNED_QUERY_KEY) || '').trim();
  return [legacy || 'Bluesky 日本'];
}

function setPinnedHomeQueries(queries) {
  const list = (Array.isArray(queries) ? queries : [])
    .map(v => String(v || '').trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 5);
  const fallback = list.length ? list : ['Bluesky 日本'];
  safeStorageSet(PINNED_QUERIES_KEY, JSON.stringify(fallback));
  safeStorageSet(HOME_PINNED_QUERY_KEY, fallback[0]);
  syncPinnedUi();
}

function syncPinnedUi() {
  const list = getPinnedHomeQueries();
  const q = list[0] || 'Bluesky 日本';
  const btn = document.getElementById('home-pinned-subtab');
  const edit = document.getElementById('home-pinned-edit');
  if (btn) btn.title = `固定検索: ${list.join(', ')}`;
  if (edit) edit.title = `固定語を変更（現在: ${q}）`;
}

function openPinnedModal() {
  const inp = document.getElementById('home-pinned-input');
  const st = document.getElementById('home-pinned-status');
  const list = getPinnedHomeQueries();
  if (inp) inp.value = list.join(', ');
  if (st) {
    const current = list.length > 0 ? list.join(' / ') : '（未設定）';
    st.innerHTML = `<strong>現在の設定:</strong> ${escapeHtml(current)}<br><small>カンマ区切りで複数登録可能（最大5件、各80文字以内）</small>`;
  }
  openModalById('home-pinned-modal', '#home-pinned-input');
  inp?.focus();
  inp?.select();
}

function closePinnedModal() {
  closeModalById('home-pinned-modal');
}

function savePinnedModal() {
  const inp = document.getElementById('home-pinned-input');
  const list = String(inp?.value || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean)
    .slice(0, 5);
  if (!list.length) {
    document.getElementById('home-pinned-status').textContent = '固定語を入力してください';
    return;
  }
  setPinnedHomeQueries(list);
  closePinnedModal();
  if (S.homeSubTab === 'pinned') {
    document.getElementById('home-feed').innerHTML = '';
    loadHome();
  }
  showToast('固定検索ワードを保存しました（最大5件）', 'success');
}

function openSearchImeModal() {
  const ta = document.getElementById('search-ime-text');
  const inp = document.getElementById('search-input');
  if (ta) ta.value = String(inp?.value || '');
  openModalById('search-ime-modal', '#search-ime-text');
  ta?.focus();
}

function closeSearchImeModal() {
  closeModalById('search-ime-modal');
}

function applySearchImeInput() {
  const ta = document.getElementById('search-ime-text');
  const inp = document.getElementById('search-input');
  const term = String(ta?.value || '').trim();
  if (!inp) return;
  inp.value = term;
  closeSearchImeModal();
  updateSearchClearButton();
  if (term) execSearch(term);
}

function applyJapanSearchHint(term) {
  const q = String(term || '').trim();
  const exp = getExperiencePrefs();
  if (!exp.japanMode || !q) return q;
  if (/\blang\s*:/i.test(q)) return q;
  return `${q} lang:ja`;
}

function linkifyPlainText(text) {
  const src = String(text || '');
  const escaped = escapeHtml(src);
  return escaped.replace(/(https?:\/\/[^\s<]+)/g, m => {
    const safe = sanitizeHttpUrl(m);
    if (!safe) return m;
    return `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${escapeHtml(m)}</a>`;
  });
}

function isLikelyJapaneseTag(tag) {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(String(tag || ''));
}

function getSmartSearchSuggestions() {
  const exp = getExperiencePrefs();
  if (!exp.personalize) return [];
  const h = new Date().getHours();
  const timeSet = h < 11 ? ['おはよう', '通勤', '朝ニュース'] : h < 18 ? ['ランチ', '仕事', '日本'] : ['お疲れさま', '夜ごはん', '今日の振り返り'];
  const jpSet = exp.japanMode ? ['Bluesky日本', 'lang:ja'] : [];
  return [...timeSet, ...jpSet].slice(0, 5);
}

function buildComposeHashtagSuggestions(text) {
  const t = String(text || '').toLowerCase();
  const map = [
    ['ai', '#AI'],
    ['開発', '#開発メモ'],
    ['javascript', '#JavaScript'],
    ['python', '#Python'],
    ['bluesky', '#BlueskyJP'],
    ['ニュース', '#ニュース'],
    ['日記', '#日記'],
    ['勉強', '#学習記録'],
  ];
  const suggestions = map.filter(([k]) => t.includes(k)).map(([, tag]) => tag);
  return [...new Set(suggestions)].slice(0, 4);
}

function renderComposeHashtagSuggestions() {
  const host = document.getElementById('compose-hashtag-suggestions');
  const ta = document.getElementById('compose-text');
  if (!host || !ta) return;
  const tags = buildComposeHashtagSuggestions(ta.value);
  if (!tags.length) {
    host.innerHTML = '';
    return;
  }
  host.innerHTML = tags.map(tag => `<button class="search-chip smart" type="button" data-hashtag-insert="${escapeHtml(tag)}">候補: ${escapeHtml(tag)}</button>`).join('');
}

function getPerfMetrics() {
  try {
    const raw = JSON.parse(safeStorageGet(PERF_METRICS_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function trackPerfMetric(name, ms) {
  const metrics = getPerfMetrics();
  const key = String(name || 'unknown');
  const val = Math.max(0, Math.round(Number(ms) || 0));
  const curr = Array.isArray(metrics[key]) ? metrics[key] : [];
  metrics[key] = [...curr.slice(-29), { at: Date.now(), ms: val }];
  safeStorageSet(PERF_METRICS_KEY, JSON.stringify(metrics));
}

function detectTrendCategory(tag) {
  const s = String(tag || '').toLowerCase();
  if (/news|速報|地震|選挙|政治|経済|事件/.test(s)) return 'news';
  if (/tech|ai|dev|program|開発|技術|python|javascript/.test(s)) return 'tech';
  if (/anime|music|movie|ドラマ|アニメ|ゲーム|配信/.test(s)) return 'ent';
  if (/料理|ごはん|子育て|暮らし|健康|旅行|日記/.test(s)) return 'life';
  return 'all';
}

function setTrendCategory(cat) {
  S.trendCategory = ['all', 'news', 'tech', 'ent', 'life'].includes(cat) ? cat : 'all';
  document.querySelectorAll('#trend-category-tabs [data-trend-cat]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.trendCat === S.trendCategory);
  });
  if (S.searchTab === 'trends') execSearch('');
}

function getDmIncomingPolicy(profile) {
  return String(profile?.associated?.chat?.allowIncoming || '').toLowerCase();
}

function canStartDmWithProfile(profile) {
  if (!profile?.did || profile.did === S.session?.did) return false;
  const policy = getDmIncomingPolicy(profile);
  if (!policy || policy === 'none') return false;
  if (policy === 'all') return true;
  if (policy === 'following') return !!profile.viewer?.followedBy;
  if (policy === 'mutuals') return !!profile.viewer?.followedBy && !!profile.viewer?.following;
  return false;
}

function saveUiPrefs() {
  const next = {
    tab: S.tab,
    homeSubTab: S.homeSubTab,
    notifSubTab: S.notifSubTab,
    searchTab: S.searchTab,
    profileSubTab: S.profileSubTab,
  };
  safeStorageSet(UI_PREFS_KEY, JSON.stringify(next));
}

function applySavedUiPrefs() {
  const p = getUiPrefs();
  S.tab = p.tab;
  S.homeSubTab = p.homeSubTab;
  S.notifSubTab = p.notifSubTab;
  S.searchTab = p.searchTab;
  S.profileSubTab = p.profileSubTab;
}

function syncSubTabUi() {
  document.querySelectorAll('#tab-home .sub-tab').forEach(b => b.classList.toggle('active', b.dataset.sub === S.homeSubTab));
  document.querySelectorAll('#tab-notifications .sub-tab').forEach(b => b.classList.toggle('active', b.dataset.sub === S.notifSubTab));
  document.querySelectorAll('#tab-search .sub-tab').forEach(b => b.classList.toggle('active', b.dataset.sub === S.searchTab));
  document.querySelectorAll('#tab-profile .sub-tab').forEach(b => b.classList.toggle('active', b.dataset.sub === S.profileSubTab));
  syncSubTabsAria();
}

function getBootTab() {
  const allowed = new Set(['home', 'notifications', 'search', 'dm', 'lists', 'profile', 'settings']);
  return allowed.has(S.tab) ? S.tab : 'home';
}

function cacheComposeState() {
  const ta = document.getElementById('compose-text');
  const restriction = document.getElementById('reply-restriction');
  if (!ta || !restriction) return;
  const payload = {
    text: ta.value || '',
    restriction: restriction.value || 'everybody',
    ts: Date.now(),
  };
  safeStorageSet(COMPOSE_CACHE_KEY, JSON.stringify(payload));
}

function restoreComposeCache() {
  const ta = document.getElementById('compose-text');
  const restriction = document.getElementById('reply-restriction');
  if (!ta || !restriction) return;
  try {
    const raw = JSON.parse(safeStorageGet(COMPOSE_CACHE_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return;
    const txt = String(raw.text || '');
    if (txt) {
      ta.value = txt;
      showToast('前回の入力を復元しました', 'info', 2400);
    }
    if (typeof raw.restriction === 'string') restriction.value = raw.restriction;
    updateCharCount();
  } catch {}
}

function clearComposeCache() {
  safeStorageSet(COMPOSE_CACHE_KEY, JSON.stringify({ text: '', restriction: 'everybody', ts: Date.now() }));
}

function getSearchHistory() {
  try {
    const raw = JSON.parse(safeStorageGet(SEARCH_HISTORY_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter(v => typeof v === 'string' && v.trim()).map(v => v.trim()).slice(0, 8);
  } catch {
    return [];
  }
}

function saveSearchHistoryItem(q) {
  const text = String(q || '').trim();
  if (!text) return;
  const curr = getSearchHistory();
  const next = [text, ...curr.filter(v => v !== text)].slice(0, 8);
  safeStorageSet(SEARCH_HISTORY_KEY, JSON.stringify(next));
  renderSearchHistory();
}

function clearSearchHistory() {
  safeStorageSet(SEARCH_HISTORY_KEY, JSON.stringify([]));
  renderSearchHistory();
}

function renderSearchHistory() {
  const wrap = document.getElementById('search-recent-wrap');
  const list = document.getElementById('search-recent-list');
  if (!wrap || !list) return;
  const q = (document.getElementById('search-input')?.value || '').trim();
  const hist = getSearchHistory();
  const smart = getSmartSearchSuggestions();
  if ((!hist.length && !smart.length) || q) {
    wrap.classList.add('hidden');
    list.innerHTML = '';
    return;
  }
  wrap.classList.remove('hidden');
  const histHtml = hist.map(item => `<button class="search-chip" data-search-item="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join('');
  const smartHtml = smart
    .filter(item => !hist.includes(item))
    .map(item => `<button class="search-chip smart" data-search-item="${escapeHtml(item)}">おすすめ: ${escapeHtml(item)}</button>`)
    .join('');
  list.innerHTML = `${smartHtml}${histHtml}`;
}

function updateSearchClearButton() {
  const q = (document.getElementById('search-input')?.value || '').trim();
  const btn = document.getElementById('search-clear-btn');
  if (!btn) return;
  btn.classList.toggle('hidden', !q);
}

function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('quick-post-fab')?.classList.add('hidden');
  document.getElementById('right-mini-panel')?.classList.add('hidden');
  document.getElementById('right-panel-mini-btn')?.classList.add('hidden');
  document.getElementById('quick-post-modal')?.classList.add('hidden');
}
function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('quick-post-fab')?.classList.remove('hidden');
  initRightPanel();
}

function getRightPanelPrefs() {
  const base = { notes: true, actions: true, stats: true, visible: true, collapsed: false, mini: false };
  try {
    const p = JSON.parse(safeStorageGet(RIGHT_PANEL_PREFS_KEY) || 'null');
    if (!p || typeof p !== 'object') return base;
    return {
      notes: p.notes !== false,
      actions: p.actions !== false,
      stats: p.stats !== false,
      visible: p.visible !== false,
      collapsed: p.collapsed === true,
      mini: p.mini === true,
    };
  } catch {
    return base;
  }
}

function saveRightPanelPrefs(next) {
  safeStorageSet(RIGHT_PANEL_PREFS_KEY, JSON.stringify(next));
}

function applyRightPanelPrefs() {
  const p = getRightPanelPrefs();
  const panel = document.getElementById('right-mini-panel');
  const miniLauncher = document.getElementById('right-panel-mini-btn');
  const toggleBtn = document.getElementById('right-panel-toggle');
  const cfgNotes = document.getElementById('cfg-show-notes');
  const cfgActions = document.getElementById('cfg-show-actions');
  const cfgStats = document.getElementById('cfg-show-stats');
  const showDeckInput = document.getElementById('settings-show-control-deck');
  const notes = document.getElementById('right-widget-notes');
  const actions = document.getElementById('right-widget-actions');
  const stats = document.getElementById('right-widget-stats');
  if (panel) {
    panel.classList.toggle('hidden', !p.visible || !!p.mini);
    panel.classList.toggle('collapsed', !!p.collapsed);
  }
  if (miniLauncher) miniLauncher.classList.toggle('hidden', !p.visible || !p.mini);
  if (toggleBtn) toggleBtn.textContent = p.collapsed ? '開く' : 'たたむ';
  if (cfgNotes) cfgNotes.checked = p.notes;
  if (cfgActions) cfgActions.checked = p.actions;
  if (cfgStats) cfgStats.checked = p.stats;
  if (showDeckInput) showDeckInput.checked = p.visible;
  if (notes) notes.classList.toggle('hidden', !p.notes);
  if (actions) actions.classList.toggle('hidden', !p.actions);
  if (stats) stats.classList.toggle('hidden', !p.stats);
}

function onRightPanelConfigChange() {
  const curr = getRightPanelPrefs();
  const next = {
    notes: !!document.getElementById('cfg-show-notes')?.checked,
    actions: !!document.getElementById('cfg-show-actions')?.checked,
    stats: !!document.getElementById('cfg-show-stats')?.checked,
    visible: curr.visible !== false,
    collapsed: curr.collapsed === true,
    mini: curr.mini === true,
  };
  saveRightPanelPrefs(next);
  applyRightPanelPrefs();
}

function setRightPanelVisible(visible) {
  const curr = getRightPanelPrefs();
  saveRightPanelPrefs({ ...curr, visible: !!visible, mini: visible ? curr.mini : false });
  applyRightPanelPrefs();
}

function toggleRightPanelCollapsed() {
  const curr = getRightPanelPrefs();
  saveRightPanelPrefs({ ...curr, collapsed: !curr.collapsed, visible: true, mini: false });
  applyRightPanelPrefs();
}

function setRightPanelMini(mini) {
  const curr = getRightPanelPrefs();
  saveRightPanelPrefs({ ...curr, mini: !!mini, visible: true, collapsed: false });
  applyRightPanelPrefs();
}

function openRightPanelFromMini() {
  setRightPanelMini(false);
  applyRightPanelPrefs();
}

function onSettingsControlDeckChange() {
  const visible = !!document.getElementById('settings-show-control-deck')?.checked;
  setRightPanelVisible(visible);
}

function initRightPanel() {
  loadQuickNote();
  applyRightPanelPrefs();
  switchInsightRange(S.statsRange);
  refreshRightStats();
}

async function reportToAdmin() {
  const ta = document.getElementById('compose-text');
  if (!ta) return;
  switchTab('home');
  ta.value = `@${ADMIN_REPORT_HANDLE} \n不具合報告: `;
  updateCharCount();
  try {
    const data = await withAuth(() => apiGetAuthorFeed(ADMIN_REPORT_HANDLE, 'posts_no_replies', null));
    const target = data.feed?.[0]?.post;
    if (target?.uri && target?.cid) {
      setReply(target.uri, target.cid, ADMIN_REPORT_HANDLE);
      showToast('管理者の最新投稿への返信で報告できます', 'success');
    } else {
      cancelReply();
      showToast('返信先を取得できなかったためメンション形式で報告できます', 'info');
    }
  } catch {
    cancelReply();
    showToast('返信先の取得に失敗したためメンション形式で報告できます', 'info');
  }
  document.getElementById('compose-area')?.scrollIntoView({ behavior: 'smooth' });
  ta.focus();
}

function insertIntoCompose(textToInsert) {
  const ta = document.getElementById('compose-text');
  if (!ta) return;
  const add = String(textToInsert || '').trim();
  if (!add) return;
  const next = ta.value ? `${ta.value}\n${add}` : add;
  ta.value = next;
  updateCharCount();
  cacheComposeState();
  switchTab('home');
  document.getElementById('compose-area')?.scrollIntoView({ behavior: 'smooth' });
  ta.focus();
}

function quickInsertTime() {
  const now = new Date();
  const t = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  insertIntoCompose(`🕒 ${t}`);
}

function quickInsertDate() {
  const now = new Date();
  const d = now.toLocaleDateString('ja-JP');
  insertIntoCompose(`📅 ${d}`);
}

function quickClearCompose() {
  const ta = document.getElementById('compose-text');
  if (!ta) return;
  ta.value = '';
  updateCharCount();
  renderComposeHashtagSuggestions();
  cacheComposeState();
}

function switchInsightRange(range) {
  S.statsRange = range === 'month' ? 'month' : 'week';
  const weekBtn = document.getElementById('insight-range-week');
  const monthBtn = document.getElementById('insight-range-month');
  if (weekBtn) weekBtn.classList.toggle('active', S.statsRange === 'week');
  if (monthBtn) monthBtn.classList.toggle('active', S.statsRange === 'month');
  refreshRightStats();
}

function getPostHistory() {
  try {
    const raw = JSON.parse(safeStorageGet(POST_HISTORY_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(v => v && typeof v.ts === 'number' && typeof v.len === 'number')
      .map(v => ({ ts: v.ts, len: Math.max(0, v.len), imgs: Math.max(0, Number(v.imgs || 0)) }))
      .sort((a, b) => a.ts - b.ts);
  } catch {
    return [];
  }
}

function savePostHistory(list) {
  safeStorageSet(POST_HISTORY_KEY, JSON.stringify(list.slice(-1000)));
}

function logPostActivity(text, imageCount) {
  const len = [...String(text || '')].length;
  const now = Date.now();
  const cutoff = now - (370 * 24 * 60 * 60 * 1000);
  const next = getPostHistory().filter(v => v.ts >= cutoff);
  next.push({ ts: now, len, imgs: Math.max(0, Number(imageCount || 0)) });
  savePostHistory(next);
}

function getInsightsFromHistory(range) {
  const days = range === 'month' ? 30 : 7;
  const start = Date.now() - (days * 24 * 60 * 60 * 1000);
  const hist = getPostHistory().filter(v => v.ts >= start);
  const totalPosts = hist.length;
  const totalChars = hist.reduce((sum, v) => sum + v.len, 0);
  const avgChars = totalPosts ? Math.round(totalChars / totalPosts) : 0;
  const postsPerDay = (totalPosts / days).toFixed(1);
  const bins = {
    '深夜 (0-5)': 0,
    '朝 (6-11)': 0,
    '昼 (12-17)': 0,
    '夜 (18-23)': 0,
  };
  hist.forEach(v => {
    const h = new Date(v.ts).getHours();
    if (h <= 5) bins['深夜 (0-5)'] += 1;
    else if (h <= 11) bins['朝 (6-11)'] += 1;
    else if (h <= 17) bins['昼 (12-17)'] += 1;
    else bins['夜 (18-23)'] += 1;
  });
  return { totalPosts, avgChars, postsPerDay, bins };
}

function renderTimeDistribution() {
  const host = document.getElementById('stat-time-distribution');
  if (!host) return;
  const { totalPosts, bins } = getInsightsFromHistory(S.statsRange);
  const rows = Object.entries(bins).map(([label, count]) => {
    const ratio = totalPosts ? Math.round((count / totalPosts) * 100) : 0;
    return `
      <div class="time-dist-row">
        <span class="time-dist-label">${escapeHtml(label)}</span>
        <div class="time-dist-bar"><i style="width:${ratio}%"></i></div>
        <strong class="time-dist-value">${ratio}%</strong>
      </div>`;
  }).join('');
  host.innerHTML = rows;
}

function refreshRightStats() {
  const homeCards = document.querySelectorAll('#home-feed .post-card').length;
  const unreadBadge = document.getElementById('notif-badge');
  const unread = unreadBadge && !unreadBadge.classList.contains('hidden') ? unreadBadge.textContent : '0';
  const drafts = getDrafts().length;
  const notes = getQuickNoteList().length;
  const composeLen = [...(document.getElementById('compose-text')?.value || '')].length;
  const imgCount = S.pendingImgs.length;
  const insight = getInsightsFromHistory(S.statsRange);
  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(val);
  };
  setText('stat-post-total', insight.totalPosts);
  setText('stat-posts-per-day', insight.postsPerDay);
  setText('stat-avg-length', insight.avgChars);
  setText('stat-home-count', homeCards);
  setText('stat-unread-count', unread || 0);
  setText('stat-draft-count', drafts);
  setText('stat-note-count', notes);
  setText('stat-compose-count', composeLen);
  setText('stat-image-count', imgCount);
  renderTimeDistribution();
}

function applyTheme(mode) {
  const html = document.documentElement;
  if (!html) return;
  const next = ['light', 'dark', 'ocean', 'forest'].includes(mode) ? mode : 'light';
  if (next === 'light') html.removeAttribute('data-theme');
  else html.setAttribute('data-theme', next);
  safeStorageSet(THEME_KEY, next);
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.textContent = next === 'dark' ? 'ライトへ' : 'ダークへ';
  syncThemeUi();
}

function applySavedTheme() {
  applyTheme(getThemeMode());
}

function toggleThemeMode() {
  const mode = getThemeMode();
  applyTheme(mode === 'dark' ? 'light' : 'dark');
}

function getStoredSessionAccounts() {
  if (typeof listSessions !== 'function') return [];
  try {
    const rows = listSessions();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function syncAccountSwitcherUi() {
  const sel = document.getElementById('settings-account-switch-select');
  if (!sel) return;

  const sessions = getStoredSessionAccounts();
  const activeDid = String(S.session?.did || '');
  sel.innerHTML = '';

  if (!sessions.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '保存済みアカウントなし';
    sel.appendChild(opt);
    sel.disabled = true;
    return;
  }

  sessions.forEach(acc => {
    const opt = document.createElement('option');
    opt.value = String(acc.did || '');
    const handle = String(acc.handle || 'unknown');
    const suffix = acc.isActive ? '（現在）' : '';
    opt.textContent = `@${handle} ${suffix}`.trim();
    sel.appendChild(opt);
  });

  if (activeDid && sessions.some(acc => acc.did === activeDid)) {
    sel.value = activeDid;
  }
  sel.disabled = sessions.length <= 1;
}

async function switchActiveAccountAndRefresh(did) {
  if (typeof switchSession !== 'function') throw new Error('アカウント切り替え機能が利用できません');
  const next = switchSession(did);
  if (!next) throw new Error('指定したアカウントへ切り替えできませんでした');

  S.session = next;
  S.myProfile = null;
  clearFetchCache();
  stopNotifPoll();
  Object.keys(S.cursors).forEach(k => delete S.cursors[k]);
  document.querySelectorAll('.feed').forEach(f => { f.innerHTML = ''; });

  await loadMyProfile();
  restoreComposeCache();
  const bootTab = getAdaptiveBootTab();
  switchTab(bootTab);
  await loadTab(bootTab);
  startNotifPoll();
  resetInactivityTimer();
  syncAccountSwitcherUi();
}

async function handleSettingsAccountSwitch() {
  const sel = document.getElementById('settings-account-switch-select');
  const did = String(sel?.value || '').trim();
  if (!did) {
    showToast('切り替え先アカウントを選択してください', 'warn', 1800);
    return;
  }
  if (did === String(S.session?.did || '')) {
    showToast('既にこのアカウントを使用中です', 'info', 1400);
    return;
  }

  try {
    await switchActiveAccountAndRefresh(did);
    showToast('アカウントを切り替えました', 'success', 1500);
  } catch (e) {
    showToast(toUserErrorMessage(e, 'アカウント切り替えに失敗しました'), 'error');
  }
}

async function handleSettingsAddAccount() {
  const handleEl = document.getElementById('settings-add-account-handle');
  const passEl = document.getElementById('settings-add-account-password');
  const btn = document.getElementById('settings-add-account-btn');
  const rawHandle = String(handleEl?.value || '').replace(/^@/, '').trim();
  const rawPass = String(passEl?.value || '').trim();

  if (!rawHandle || !rawPass) {
    showToast('追加するアカウントのハンドルとアプリパスワードを入力してください', 'warn', 2200);
    return;
  }

  const sessions = getStoredSessionAccounts();
  if (sessions.some(acc => String(acc.handle || '').toLowerCase() === rawHandle.toLowerCase())) {
    showToast('このアカウントは既に保存されています', 'info', 1800);
    return;
  }

  setLoading(btn, true);
  try {
    const sess = await apiLogin(rawHandle, rawPass);
    saveSession(sess, { setActive: false });
    if (handleEl) handleEl.value = '';
    if (passEl) passEl.value = '';
    syncAccountSwitcherUi();
    showToast('アカウントを追加しました。必要なときに切り替えて利用できます', 'success', 1800);
  } catch (e) {
    showToast(toUserErrorMessage(e, 'アカウント追加に失敗しました'), 'error');
  } finally {
    setLoading(btn, false);
  }
}

async function loadMyProfile() {
  try {
    const p = await withAuth(() => apiGetProfile());
    S.myProfile = p;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const setSrc = (id, val) => { const el = document.getElementById(id); if (el) el.src = val||''; };
    setSrc('user-avatar', p.avatar);
    setSrc('compose-avatar', p.avatar);
    set('user-displayname', p.displayName || p.handle);
    set('user-handle', `@${p.handle}`);
    set('prof-displayname', p.displayName || p.handle);
    set('prof-handle', `@${p.handle}`);
    const desc = document.getElementById('prof-desc');
    if (desc) desc.innerHTML = linkifyPlainText(p.description || '');
    set('prof-following', p.followsCount || 0);
    set('prof-followers', p.followersCount || 0);
    set('prof-posts', p.postsCount || 0);
    const banner = document.getElementById('prof-banner-img');
    if (banner) {
      if (p.banner) {
        banner.style.backgroundImage = `url(${p.banner})`;
        banner.style.backgroundSize = 'cover';
        banner.style.backgroundRepeat = 'no-repeat';
        banner.style.backgroundPosition = 'center center';
      } else {
        banner.style.backgroundImage = '';
        banner.style.backgroundSize = '';
        banner.style.backgroundRepeat = '';
        banner.style.backgroundPosition = '';
      }
    }
    const av = document.getElementById('prof-avatar-img');
    if (av) av.src = p.avatar || '';
    // 編集フォーム
    const dn = document.getElementById('edit-displayname');
    const dc = document.getElementById('edit-description');
    if (dn) dn.value = p.displayName || '';
    if (dc) dc.value = p.description || '';
    // 設定ページ
    const sh = document.getElementById('settings-handle');
    if (sh) sh.textContent = `@${p.handle}`;
    syncAccountSwitcherUi();
  } catch(e) { console.error('プロフィール取得失敗:', e); }
}

// =============================================
//  タブ
// =============================================
function switchTab(tab) {
  S.tab = tab;
  if (['home', 'search', 'dm', 'notifications', 'profile'].includes(tab)) incActivity(tab);
  saveUiPrefs();
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.mobile-nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-section').forEach(s => {
    const isActive = s.id === `tab-${tab}`;
    s.classList.toggle('active', isActive);
    s.classList.toggle('hidden', !isActive);
  });
  if (tab === 'notifications') {
    document.getElementById('notif-badge').classList.add('hidden');
    updateNotifLiveRegion(0);
    apiUpdateNotificationSeen();
  }
  if (tab === 'search') {
    updateSearchClearButton();
    renderSearchHistory();
    document.getElementById('trend-category-tabs')?.classList.toggle('hidden', S.searchTab !== 'trends');
    if (S.searchTab === 'trends') execSearch('');
  }
  const feedIds = { home:'home-feed', notifications:'notif-feed', search:'search-feed', dm:'dm-list', lists:'lists-feed', profile:'profile-feed' };
  const feedId = feedIds[tab];
  const feedEl = feedId ? document.getElementById(feedId) : null;
  if (feedEl && feedEl.childElementCount === 0) {
    loadTab(tab);
  } else if (tab === 'home') {
    refreshHomeDiff();
  } else if (tab === 'notifications') {
    refreshNotifDiff();
  }
}

async function refreshHomeDiff() {
  const feed = document.getElementById('home-feed');
  if (!feed || !feed.children.length) return;
  try {
    let data;
    if (S.homeSubTab === 'discover') data = await withAuth(() => apiGetDiscover(null));
    else if (S.homeSubTab === 'pinned') {
      const q = applyJapanSearchHint(getPinnedHomeQueries().map(v => `(${v})`).join(' OR ') || getPinnedHomeQuery());
      data = await withAuth(() => apiSearchPosts(q, null, 'latest'));
    } else data = await withAuth(() => apiGetTimeline(null));
    const rows = normalizeFeedRows(S.homeSubTab === 'pinned' ? (data.posts || []).map(p => ({ post: p })) : (data.feed || []));
    const existingUris = new Set([...feed.querySelectorAll('.post-card[data-uri]')].map(el => el.dataset.uri));
    const newcomers = rows.filter(r => !existingUris.has(String(r.post?.uri || ''))).slice(0, 5);
    if (!newcomers.length) return;
    const myDid = S.session?.did;
    const frag = document.createDocumentFragment();
    newcomers.reverse().forEach(item => {
      const box = document.createElement('div');
      box.innerHTML = renderPostCard(item, myDid);
      while (box.lastChild) frag.insertBefore(box.lastChild, frag.firstChild);
    });
    feed.insertBefore(frag, feed.firstChild);
  } catch {}
}

async function refreshNotifDiff() {
  if (S.tab !== 'notifications') return;
  try {
    const data = await withAuth(() => apiGetNotifications(null));
    const latest = await enrichNotificationsWithSubjectPreview(data.notifications || []);
    const existing = new Set((S.cachedNotifs || []).map(n => `${n.indexedAt}::${n.author?.did || ''}::${n.reason || ''}`));
    const newcomers = latest.filter(n => !existing.has(`${n.indexedAt}::${n.author?.did || ''}::${n.reason || ''}`));
    if (!newcomers.length) return;
    S.cachedNotifs = [...newcomers, ...(S.cachedNotifs || [])];
    renderNotifList();
  } catch {}
}

async function loadTab(tab) {
  if (S.loading[tab]) return; S.loading[tab] = true;
  const t0 = performance.now();
  try {
    if (tab === 'home')          await loadHome();
    else if (tab === 'notifications') await loadNotifications();
    else if (tab === 'search')   { if (S.searchTab === 'trends') await execSearch(''); }
    else if (tab === 'profile')  await loadProfile();
    else if (tab === 'lists')    await loadLists();
    else if (tab === 'dm')       await loadDM();
    else if (tab === 'settings') { /* 設定タブは静的HTML */ }
  } catch(e) { showErrorToast(e, '読み込みに失敗しました。'); }
  finally {
    trackPerfMetric(`tab:${tab}`, performance.now() - t0);
    S.loading[tab] = false;
  }
}

async function reloadTab(tab) {
  S.cursors[tab] = null;
  const feedMap = { home:'home-feed', notifications:'notif-feed', profile:'profile-feed', lists:'lists-feed', dm:'dm-list' };
  const el = feedMap[tab] ? document.getElementById(feedMap[tab]) : null;
  if (el) el.innerHTML = '';
  await loadTab(tab);
}

// =============================================
//  ホーム
// =============================================
async function loadHome() {
  const feed = document.getElementById('home-feed');
  renderHomeTrendSidecard();
  feed.innerHTML = renderFeedSkeleton(4);
  let data;
  const pinned = getPinnedHomeQueries();
  const mergedPinnedQuery = pinned.map(q => `(${q})`).join(' OR ');
  const key = cacheKey(['home', S.homeSubTab, 'first', mergedPinnedQuery]);
  if (S.homeSubTab === 'discover') data = await fetchWithLocalCache(key, 20000, () => withAuth(() => apiGetDiscover(null)));
  else if (S.homeSubTab === 'pinned') {
    const q = applyJapanSearchHint(mergedPinnedQuery || getPinnedHomeQuery());
    data = await fetchWithLocalCache(key, 20000, () => withAuth(() => apiSearchPosts(q, null, 'latest')));
  }
  else data = await fetchWithLocalCache(key, 20000, () => withAuth(() => apiGetTimeline(null)));
  S.cursors['home'] = data.cursor || null;
  feed.innerHTML = '';
  const rows = normalizeFeedRows(S.homeSubTab === 'pinned' ? (data.posts || []).map(p => ({ post: p })) : (data.feed || []));
  if (!rows.length) {
    const msg = S.homeSubTab === 'pinned' ? `固定検索「${escapeHtml(getPinnedHomeQuery())}」に一致する投稿がありません` : 'タイムラインに投稿がありません';
    feed.innerHTML = renderEmpty(msg, 'home', { action: 'search', label: '検索する' });
    return;
  }
  const myDid = S.session?.did;
  rows.forEach(item => appendCards(feed, renderPostCard(item, myDid)));
  if (data.cursor) addLoadMoreBtn(feed, 'home');
}

async function renderHomeTrendSidecard() {
  const host = document.getElementById('home-trend-sidecard');
  if (!host) return;
  host.innerHTML = '<div class="right-mini-status">話題を読み込み中...</div>';
  try {
    const data = await withAuth(() => apiGetTrendingTopics(5));
    const topics = (data?.topics || data?.trends || []).slice(0, 5);
    if (!topics.length) {
      host.innerHTML = '<div class="right-mini-status">話題はありません</div>';
      return;
    }
    host.innerHTML = topics.map(t => {
      const raw = String(t.topic || t.name || t.tag || '').replace(/^#?/, '#');
      return `<button class="search-chip" type="button" data-trend-tag="${escapeHtml(raw.replace(/^#/, ''))}">${escapeHtml(raw)}</button>`;
    }).join('');
  } catch {
    host.innerHTML = '<div class="right-mini-status">話題の取得に失敗しました</div>';
  }
}

function switchHomeSubTab(sub) {
  S.homeSubTab = sub; S.cursors['home'] = null;
  saveUiPrefs();
  document.querySelectorAll('#tab-home .sub-tab').forEach(b => b.classList.toggle('active', b.dataset.sub === sub));
  document.getElementById('home-feed').innerHTML = '';
  loadTab('home');
}

// =============================================
//  通知
// =============================================
async function loadNotifications() {
  const feed = document.getElementById('notif-feed');
  feed.innerHTML = renderSpinner();
  const data = await fetchWithLocalCache(cacheKey(['notifications', 'first']), 12000, () => withAuth(() => apiGetNotifications(null)));
  S.cachedNotifs = await enrichNotificationsWithSubjectPreview(data.notifications || []);
  S.cursors['notifications'] = data.cursor || null;
  renderNotifList();
}

function getNotifSubjectUri(n) {
  return String(n?.reasonSubject || n?.record?.subject?.uri || n?.record?.reply?.parent?.uri || '').trim();
}

async function fetchNotifSubjectText(uri) {
  if (!uri) return '';
  if (NOTIF_SUBJECT_CACHE.has(uri)) return NOTIF_SUBJECT_CACHE.get(uri);
  try {
    const data = await withAuth(() => apiGetPostThread(uri, 0));
    const text = String(data?.thread?.post?.record?.text || '').trim();
    const preview = text.slice(0, 120);
    NOTIF_SUBJECT_CACHE.set(uri, preview);
    return preview;
  } catch {
    NOTIF_SUBJECT_CACHE.set(uri, '');
    return '';
  }
}

async function enrichNotificationsWithSubjectPreview(list) {
  const notifications = Array.isArray(list) ? list : [];
  const targetUris = [...new Set(notifications.map(getNotifSubjectUri).filter(Boolean))];
  if (!targetUris.length) return notifications;
  await Promise.all(targetUris.map(uri => fetchNotifSubjectText(uri)));
  return notifications.map(n => {
    const uri = getNotifSubjectUri(n);
    if (!uri) return n;
    return { ...n, subjectTextPreview: NOTIF_SUBJECT_CACHE.get(uri) || '' };
  });
}

function switchNotifSubTab(sub) {
  S.notifSubTab = sub;
  S.notifFilterMode = sub === 'nonfollowers' ? 'nonfollowers' : 'all';
  saveUiPrefs();
  document.querySelectorAll('#tab-notifications .sub-tab').forEach(b => b.classList.toggle('active', b.dataset.sub === sub));
  renderNotifList();
}

function markNotificationsAsReadLocal({ reason = '', subject = '', indexedAt = '', authorDid = '' } = {}) {
  const r = String(reason || '').trim();
  const s = String(subject || '').trim();
  const i = String(indexedAt || '').trim();
  const a = String(authorDid || '').trim();
  S.cachedNotifs = (S.cachedNotifs || []).map(n => {
    const nr = String(n.reason || '').trim();
    const ns = getNotifSubjectUri(n);
    const ni = String(n.indexedAt || '').trim();
    const na = String(n.author?.did || '').trim();
    const byGroup = s ? (nr === r && ns === s) : false;
    const bySingle = !s && nr === r && ni === i && na === a;
    return byGroup || bySingle ? { ...n, isRead: true } : n;
  });
}

function renderNotifList() {
  const feed = document.getElementById('notif-feed');
  feed.innerHTML = '';
  let list = S.cachedNotifs;
  if (S.notifSubTab === 'unread') list = list.filter(n => !n.isRead);
  if (S.notifSubTab === 'mention') list = list.filter(n => n.reason === 'mention' || n.reason === 'reply');
  if (S.notifSubTab === 'nonfollowers') {
    list = list.filter(n => {
      const actors = Array.isArray(n.groupedAuthors) && n.groupedAuthors.length ? n.groupedAuthors : [n.author].filter(Boolean);
      return actors.some(a => !a?.viewer?.following);
    });
  }
  list = groupNotificationsByReasonAndSubject(list);
  if (!list.length) { feed.innerHTML = renderEmpty('通知はありません', 'notifications', { action: 'home', label: 'ホームを見る' }); return; }
  list.forEach(n => appendCards(feed, renderNotifCard(n)));
  if (S.cursors['notifications']) addLoadMoreBtn(feed, 'notifications');
}

function groupNotificationsByReasonAndSubject(list) {
  const notifications = Array.isArray(list) ? list : [];
  const grouped = [];
  const map = new Map();

  notifications.forEach(n => {
    const reason = String(n?.reason || '');
    const subjectUri = getNotifSubjectUri(n);
    const canGroup = !!subjectUri;
    const key = canGroup ? `${reason}::${subjectUri}` : `single::${String(n?.indexedAt || '')}::${String(n?.author?.did || '')}`;

    if (!canGroup || !map.has(key)) {
      const seed = {
        ...n,
        groupedCount: 1,
        groupedAuthors: n?.author ? [n.author] : [],
      };
      if (canGroup) map.set(key, seed);
      grouped.push(seed);
      return;
    }

    const acc = map.get(key);
    acc.groupedCount += 1;
    acc.isRead = !!(acc.isRead && n.isRead);
    const accTime = new Date(acc.indexedAt || 0).getTime();
    const nTime = new Date(n.indexedAt || 0).getTime();
    if (nTime > accTime) {
      acc.indexedAt = n.indexedAt;
      if (n.record) acc.record = n.record;
    }

    const did = n?.author?.did;
    if (did && !acc.groupedAuthors.some(a => a?.did === did)) acc.groupedAuthors.push(n.author);
  });

  grouped.sort((a, b) => new Date(b.indexedAt || 0).getTime() - new Date(a.indexedAt || 0).getTime());
  // If multiple grouped cards point to the same post, keep only the newest one.
  const subjectSeen = new Set();
  const deduped = [];
  grouped.forEach(n => {
    const subjectUri = String(getNotifSubjectUri(n) || '').trim();
    if (!subjectUri) {
      deduped.push(n);
      return;
    }
    if (subjectSeen.has(subjectUri)) return;
    subjectSeen.add(subjectUri);
    deduped.push(n);
  });
  return deduped;
}

// =============================================
//  プロフィール（自分）
// =============================================
async function loadProfile() {
  const feed = document.getElementById('profile-feed');
  feed.innerHTML = renderSpinner();
  const actor = S.myProfile?.handle || S.session?.handle;
  const tab = S.profileSubTab;
  const data = await fetchWithLocalCache(cacheKey(['profile', actor, tab, 'first']), 30000, () => {
    if (tab === 'likes') return withAuth(() => apiGetActorLikes(actor, null));
    const filter = tab === 'replies' ? 'posts_with_replies' : tab === 'media' ? 'posts_with_media' : 'posts_no_replies';
    return withAuth(() => apiGetAuthorFeed(actor, filter, null));
  });
  S.cursors['profile'] = data.cursor || null;
  feed.innerHTML = '';
  const rows = normalizeFeedRows(data.feed || []);
  if (!rows.length) {
    const msg = tab === 'likes' ? 'いいねがありません' : tab === 'media' ? 'メディア投稿がありません' : tab === 'replies' ? '返信投稿がありません' : '投稿がありません';
    feed.innerHTML = renderEmpty(msg, 'profile', { action: 'home', label: 'ホームを見る' });
    return;
  }
  const myDid = S.session?.did;
  rows.forEach(item => appendCards(feed, renderPostCard(item, myDid)));
  if (data.cursor) addLoadMoreBtn(feed, 'profile');
  renderProfileRecentSearches();
}

function renderProfileRecentSearches() {
  const host = document.getElementById('profile-recent-searches');
  if (!host) return;
  const list = getSearchHistory();
  if (!list.length) {
    host.innerHTML = '<div class="right-mini-status">最近の検索はありません</div>';
    return;
  }
  host.innerHTML = list.slice(0, 6).map(q =>
    `<button class="search-chip" type="button" data-search-item="${escapeHtml(q)}">${escapeHtml(q)}</button>`
  ).join('');
}

function switchProfileSubTab(sub) {
  S.profileSubTab = ['posts', 'replies', 'media', 'likes'].includes(sub) ? sub : 'posts';
  S.cursors.profile = null;
  saveUiPrefs();
  document.querySelectorAll('#tab-profile .sub-tab').forEach(b => b.classList.toggle('active', b.dataset.sub === S.profileSubTab));
  document.getElementById('profile-feed').innerHTML = '';
  loadProfile();
}

// =============================================
//  他人のプロフィール表示（スライドイン）
// =============================================
async function openUserProfile(handleOrDid) {
  const panel = document.getElementById('user-profile-panel');
  const content = document.getElementById('user-profile-content');
  panel.classList.remove('hidden');
  content.innerHTML = renderSpinner();

  try {
    const profile = await withAuth(() => apiGetProfile(handleOrDid));
    const canDm = canStartDmWithProfile(profile);
    content.innerHTML = renderProfilePanel(profile, { canDm });

    // 投稿を読み込む
    const feedEl = document.getElementById('user-profile-feed');
    if (feedEl) {
      feedEl.innerHTML = renderSpinner();
      const data = await withAuth(() => apiGetAuthorFeed(profile.handle, 'posts_no_replies', null));
      feedEl.innerHTML = '';
      if (!data.feed?.length) { feedEl.innerHTML = renderEmpty('投稿がありません'); return; }
      const myDid = S.session?.did;
      normalizeFeedRows(data.feed || []).forEach(item => appendCards(feedEl, renderPostCard(item, myDid)));
    }
  } catch(e) {
    content.innerHTML = renderEmpty(`プロフィールの取得に失敗しました: ${e.message}`);
  }
}

async function startDmWithDid(did) {
  const targetDid = String(did || '').trim();
  if (!targetDid) return;
  try {
    const data = await withAuth(() => apiGetOrCreateConvoWithMember(targetDid));
    const convoId = data?.convo?.id || data?.convoId;
    if (!convoId) throw new Error('DM会話の作成に失敗しました');
    switchTab('dm');
    await loadDM();
    await openConvo(convoId);
    showToast('DMを開始しました', 'success');
  } catch (e) {
    showErrorToast(e, 'DM開始に失敗しました');
  }
}

function openDmStartModal() {
  const input = document.getElementById('dm-start-handle');
  const status = document.getElementById('dm-start-status');
  S.dmStartDid = null;
  if (status) status.textContent = '';
  if (input) input.value = '';
  openModalById('dm-start-modal', '#dm-start-handle');
  input?.focus();
}

function closeDmStartModal() {
  closeModalById('dm-start-modal');
}

async function resolveDmStartHandle() {
  const input = document.getElementById('dm-start-handle');
  const status = document.getElementById('dm-start-status');
  const raw = String(input?.value || '').replace(/^@/, '').trim();
  S.dmStartDid = null;
  if (!raw) {
    if (status) status.textContent = 'ハンドルを入力してください';
    return null;
  }
  if (status) status.textContent = '確認中...';
  let profile;
  try {
    profile = await withAuth(() => apiGetProfile(raw));
  } catch (e) {
    if (status) status.textContent = e.message || 'ユーザー取得に失敗しました';
    return null;
  }
  if (!canStartDmWithProfile(profile)) {
    if (status) {
      const policy = getDmIncomingPolicy(profile);
      if (policy === 'following') status.textContent = 'このユーザーは「フォロワーのみDM可」です。相手にフォローされると開始できます。';
      else if (policy === 'mutuals') status.textContent = 'このユーザーは「相互フォローのみDM可」です。双方フォロー後に開始できます。';
      else status.textContent = 'このユーザーは新規DMに対応していません';
    }
    return null;
  }
  S.dmStartDid = profile.did;
  if (status) status.textContent = `開始可能: @${profile.handle}`;
  return profile.did;
}

async function submitDmStart() {
  const did = S.dmStartDid || await resolveDmStartHandle();
  if (!did) return;
  closeDmStartModal();
  await startDmWithDid(did);
}

function closeUserProfile() {
  document.getElementById('user-profile-panel').classList.add('hidden');
  document.getElementById('user-profile-content').innerHTML = '';
}

// =============================================
//  スレッド（返信の折り畳み表示）
// =============================================
async function toggleReplies(uri, containerEl, btn) {
  if (!containerEl.classList.contains('hidden')) {
    containerEl.classList.add('hidden');
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`;
    return;
  }

  btn.innerHTML = renderSpinner().replace('28','15');
  try {
    const data = await withAuth(() => apiGetPostThread(uri, 6));
    const thread = data.thread;
    const myDid = S.session?.did;
    const topLevelChunkSize = 3;
    containerEl.innerHTML = '';

    if (!thread.replies?.length) {
      containerEl.innerHTML = '<div class="no-replies">返信はありません</div>';
    } else {
      const visibleReplies = thread.replies.slice(0, topLevelChunkSize);
      const restReplies = thread.replies.slice(topLevelChunkSize);
      visibleReplies.forEach(reply => {
        appendCards(containerEl, renderThreadNode(reply, myDid, 1));
      });
      if (restReplies.length) {
        const moreContainer = document.createElement('div');
        moreContainer.className = 'more-replies-container';
        restReplies.forEach(reply => {
          appendCards(moreContainer, `<div class="more-reply-item hidden">${renderThreadNode(reply, myDid, 1)}</div>`);
        });
        containerEl.appendChild(moreContainer);
        appendCards(containerEl, `<div class="thread-more"><button class="show-more-replies-btn" data-count="${restReplies.length}" data-step="${topLevelChunkSize}">他 ${restReplies.length} 件の返信を表示</button></div>`);
      }
    }
    containerEl.classList.remove('hidden');
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>`;
  } catch(e) {
    showErrorToast(e, '返信の読み込みに失敗しました。');
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`;
  }
}

// =============================================
//  リスト
// =============================================
async function loadLists() {
  const feed = document.getElementById('lists-feed');
  feed.innerHTML = renderSpinner();
  const data = await withAuth(() => apiGetLists());
  feed.innerHTML = '';
  if (!data.lists?.length) { feed.innerHTML = renderEmpty('リストがありません'); return; }
  data.lists.forEach(list => {
    appendCards(feed, `<div class="list-card">
      <div class="list-card-info">
        <div class="list-card-name">${escapeHtml(list.name)}</div>
        ${list.description ? `<div class="list-card-desc">${escapeHtml(list.description.slice(0,60))}</div>` : ''}
        <div class="list-card-count">${list.listItemCount||0}人</div>
      </div>
      <button class="btn-sm" data-list-uri="${escapeHtml(list.uri)}" data-list-name="${escapeHtml(list.name)}">フィードを見る</button>
    </div>`);
  });
}

async function openListFeed(listUri, listName) {
  const container = document.getElementById('list-feed-container');
  const feed = document.getElementById('list-feed');
  const title = document.getElementById('list-feed-title');
  if (title) title.textContent = listName;
  container.classList.remove('hidden');
  feed.innerHTML = renderSpinner();
  try {
    const data = await withAuth(() => apiGetListFeed(listUri, null));
    feed.innerHTML = '';
    if (!data.feed?.length) { feed.innerHTML = renderEmpty(); return; }
    const myDid = S.session?.did;
    data.feed.forEach(item => appendCards(feed, renderPostCard(item, myDid)));
  } catch(e) { feed.innerHTML = renderEmpty(e.message); }
}

// =============================================
//  DM
// =============================================
async function loadDM() {
  const list = document.getElementById('dm-list');
  list.innerHTML = renderSpinner();
  try {
    const data = await withAuth(() => apiGetConversations(null));
    S.dmConvos = Array.isArray(data.convos) ? data.convos : [];
    renderDmConversationList();
  } catch(e) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">💬</div>
      <div style="font-size:.85rem;line-height:1.7">${escapeHtml(e.message)}</div>
      ${e.message.includes('アプリパスワード') ? `<a href="https://bsky.app/settings/app-passwords" target="_blank" style="margin-top:8px;display:inline-block">アプリパスワードを再発行する↗</a>` : ''}
    </div>`;
  }
}

function renderDmConversationList() {
  const list = document.getElementById('dm-list');
  if (!list) return;
  const readMap = getDmReadState();
  const term = String(document.getElementById('dm-search-input')?.value || '').trim().toLowerCase();
  list.innerHTML = '';
  if (!S.dmConvos.length) {
    list.innerHTML = renderEmpty('DMはありません', 'dm');
    return;
  }
  const filtered = S.dmConvos.filter(c => {
    if (!term) return true;
    const other = (c.members || []).find(m => m.did !== S.session?.did) || {};
    const source = [
      String(other.displayName || ''),
      String(other.handle || ''),
      String(c.lastMessage?.text || ''),
    ].join(' ').toLowerCase();
    return source.includes(term);
  });
  if (!filtered.length) {
    list.innerHTML = renderEmpty('条件に一致するDMがありません', 'dm');
    return;
  }
  filtered.forEach(c => {
      const other = (c.members||[]).find(m => m.did !== S.session?.did);
      if (!other) return;
      const localRead = readMap[String(c.id)] === true;
      const unreadCount = Number(c.unreadCount || 0);
      const effectiveUnread = localRead ? 0 : unreadCount;
      appendCards(list, `<div class="dm-convo-card" data-convo-id="${escapeHtml(c.id)}">
        <img class="dm-avatar" src="${escapeHtml(other.avatar||'')}" alt="" onerror="this.src=''"/>
        <div class="dm-info">
          <div class="dm-name">${escapeHtml(other.displayName||other.handle)}</div>
          <div class="dm-preview">${c.lastMessage?.text ? escapeHtml(c.lastMessage.text.slice(0,40)) : ''}</div>
        </div>
        ${(effectiveUnread)>0 ? `<span class="dm-badge">${effectiveUnread}</span>` : ''}
        <button class="btn-sm" type="button" data-dm-toggle-read="${escapeHtml(c.id)}">${effectiveUnread > 0 ? '既読にする' : '未読にする'}</button>
      </div>`);
    });
}

async function openConvo(convoId) {
  S.activeConvoId = convoId;
  setDmReadState(convoId, true);
  renderDmConversationList();
  document.getElementById('dm-chat-panel').classList.remove('hidden');
  const msgs = document.getElementById('dm-messages');
  msgs.innerHTML = renderSpinner();
  const t0 = performance.now();
  try {
    const data = await withAuth(() => apiGetMessages(convoId, null));
    const list = (data.messages||[]).reverse();
    msgs.innerHTML = '';
    list.forEach(m => {
      const mine = m.sender?.did === S.session?.did;
      appendCards(msgs, `<div class="dm-msg ${mine?'mine':'theirs'}">
        <div class="dm-bubble">${escapeHtml(m.text||'')}</div>
        <div class="dm-msg-time">${formatTime(m.sentAt)}</div>
      </div>`);
    });
    msgs.scrollTop = 9999;
    trackPerfMetric('dm:open', performance.now() - t0);
  } catch(e) { msgs.innerHTML = renderEmpty(e.message); }
}

async function sendDM() {
  const inp = document.getElementById('dm-input');
  const text = inp.value.trim();
  if (!text || !S.activeConvoId) return;
  if (hasSensitiveLeakPattern(text)) {
    const ok = window.confirm('秘密情報らしき文字列を検出しました。送信を続行しますか？');
    if (!ok) return;
  }
  inp.value = '';
  try { await withAuth(() => apiSendMessage(S.activeConvoId, text)); incActivity('dm'); await openConvo(S.activeConvoId); }
  catch(e) { showErrorToast(e, 'DM送信に失敗しました。'); }
}

function hasSensitiveLeakPattern(text) {
  const src = String(text || '');
  const rules = [
    /[A-Za-z0-9_\-]{4,}-[A-Za-z0-9_\-]{4,}-[A-Za-z0-9_\-]{4,}-[A-Za-z0-9_\-]{4,}/,
    /bearer\s+[A-Za-z0-9._\-]+/i,
    /(api[-_]?key|secret|token|password)\s*[:=]\s*\S+/i,
  ];
  return rules.some(re => re.test(src));
}

function toggleDmReadStateById(convoId) {
  const id = String(convoId || '').trim();
  if (!id) return;
  const convo = S.dmConvos.find(c => String(c.id) === id);
  const currentUnread = Number(convo?.unreadCount || 0);
  const map = getDmReadState();
  const currentlyRead = map[id] === true || currentUnread === 0;
  setDmReadState(id, !currentlyRead);
  renderDmConversationList();
}

function handleDmImageScaffold() {
  showToast('DM画像送信は準備中です。まずはテキスト送信をご利用ください。', 'info', 2600);
}

// =============================================
//  検索
// =============================================
let searchTimer = null;
let searchIdleHandle = null;

function runWhenIdle(fn, timeout = 220) {
  if (typeof window.requestIdleCallback === 'function') {
    searchIdleHandle = window.requestIdleCallback(fn, { timeout });
  } else {
    searchIdleHandle = setTimeout(fn, Math.min(timeout, 180));
  }
}

function cancelIdleSearch() {
  if (!searchIdleHandle) return;
  if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(searchIdleHandle);
  else clearTimeout(searchIdleHandle);
  searchIdleHandle = null;
}

function handleSearchInput(q) {
  clearTimeout(searchTimer);
  cancelIdleSearch();
  updateSearchClearButton();
  if (!q.trim()) {
    document.getElementById('search-feed').innerHTML = '';
    renderSearchHistory();
    return;
  }
  renderSearchHistory();
  searchTimer = setTimeout(() => {
    runWhenIdle(() => execSearch(q.trim()), 300);
  }, 360);
}

function switchSearchTab(sub) {
  S.searchTab = sub;
  saveUiPrefs();
  document.querySelectorAll('#tab-search .sub-tab').forEach(b => b.classList.toggle('active', b.dataset.sub === sub));
  document.getElementById('trend-category-tabs')?.classList.toggle('hidden', sub !== 'trends');
  const q = document.getElementById('search-input').value.trim();
  if (sub === 'trends') {
    execSearch('');
    return;
  }
  if (q) execSearch(q);
}

async function execSearch(q) {
  const term = String(q || '').trim();
  if (!term && S.searchTab !== 'trends') return;
  if (SEARCH_ABORT_CONTROLLER) SEARCH_ABORT_CONTROLLER.abort();
  SEARCH_ABORT_CONTROLLER = new AbortController();
  const signal = SEARCH_ABORT_CONTROLLER.signal;
  const feed = document.getElementById('search-feed');
  feed.innerHTML = renderSpinner();
  try {
    if (S.searchTab === 'posts' || S.searchTab === 'latest') {
      const sort = S.searchTab === 'latest' ? 'latest' : 'top';
      const query = applyJapanSearchHint(term);
      const data = await withAuth(() => apiSearchPosts(query, null, sort, signal));
      feed.innerHTML = '';
      if (!data.posts?.length) { feed.innerHTML = renderEmpty('投稿が見つかりません', 'search', { action: 'search-latest', label: '最新で再検索' }); return; }
      const myDid = S.session?.did;
      data.posts.forEach(p => appendCards(feed, renderPostCard({ post: p }, myDid)));
      incActivity('search');
    } else if (S.searchTab === 'users') {
      const data = await withAuth(() => apiSearchActors(term, null, signal));
      feed.innerHTML = '';
      if (!data.actors?.length) { feed.innerHTML = renderEmpty('ユーザーが見つかりません', 'search', { action: 'search-posts', label: '投稿を検索' }); return; }
      data.actors.forEach(a => appendCards(feed, renderUserCard(a, true, canStartDmWithProfile(a))));
      incActivity('search');
    } else if (S.searchTab === 'trends') {
      const data = await withAuth(() => apiGetTrendingTopics(30, signal));
      const rawTopics = data?.topics || data?.trends || [];
      const exp = getExperiencePrefs();
      let topics = rawTopics;
      if (exp.japanTrends) {
        const jp = rawTopics.filter(t => isLikelyJapaneseTag(t.topic || t.name || t.tag || ''));
        topics = jp.length ? jp : rawTopics;
      }
      if (S.trendCategory !== 'all') {
        topics = topics.filter(t => detectTrendCategory(t.topic || t.name || t.tag || '') === S.trendCategory);
      }
      feed.innerHTML = '';
      if (!topics.length) { feed.innerHTML = renderEmpty('トレンドが見つかりません', 'search', { action: 'trend-all', label: 'カテゴリを全て表示' }); return; }
      topics.forEach(t => {
        const tag = String(t.topic || t.name || t.tag || '').replace(/^#?/, '#');
        const count = Number(t.postCount || t.posts || 0);
        const score = Number(t.displayName || t.score || 0);
        appendCards(feed, `<div class="trend-card">
          <div class="trend-main">
            <div class="trend-tag">${escapeHtml(tag || '#trend')}</div>
            <div class="trend-meta">${count > 0 ? `${count.toLocaleString()} posts` : ''}${score > 0 ? ` ・ score ${score}` : ''}</div>
          </div>
          <button class="btn-sm" data-trend-tag="${escapeHtml(tag.replace(/^#/, ''))}">検索</button>
        </div>`);
      });
    }
    if (term) saveSearchHistoryItem(term);
  } catch(e) {
    if (e?.name === 'AbortError') return;
    feed.innerHTML = renderEmpty(toUserErrorMessage(e, '検索に失敗しました'));
  }
}

// =============================================
//  投稿
// =============================================
function updateCharCount() {
  const t = document.getElementById('compose-text').value;
  const r = POST_TEXT_MAX_CHARS - [...t].length;
  const el = document.getElementById('char-count');
  const btn = document.getElementById('post-btn');
  el.textContent = r;
  el.className = 'char-count' + (r <= POST_WARN_THRESHOLD ? ' warn' : '') + (r < 0 ? ' danger' : '');
  if (btn) btn.disabled = r < 0;
}

function getReplyTemplate() {
  const raw = String(safeStorageGet(REPLY_TEMPLATE_KEY) || 'everybody');
  const allowed = ['everybody', 'following', 'followers', 'mentionedUsers', 'nobody'];
  return allowed.includes(raw) ? raw : 'everybody';
}

function setReplyTemplate(value) {
  const allowed = ['everybody', 'following', 'followers', 'mentionedUsers', 'nobody'];
  const next = allowed.includes(String(value || '')) ? String(value) : 'everybody';
  safeStorageSet(REPLY_TEMPLATE_KEY, next);
  const mainSel = document.getElementById('reply-restriction');
  const quickSel = document.getElementById('quick-post-restriction');
  const tplSel = document.getElementById('reply-template-select');
  if (mainSel) mainSel.value = next;
  if (quickSel) quickSel.value = next;
  if (tplSel) tplSel.value = next;
}

function syncReplyTemplateUi() {
  setReplyTemplate(getReplyTemplate());
}

function handleImageSelect(e) {
  const files = Array.from(e.target.files);
  const rem = 4 - S.pendingImgs.length;
  const validImages = files.filter(f => f.type.startsWith('image/'));
  const sizeOk = validImages.filter(f => f.size <= APP_MAX_IMAGE_BYTES);
  const rejected = validImages.length - sizeOk.length;
  S.pendingImgs.push(...sizeOk.slice(0, rem));
  if (rejected > 0) showToast(`2MBを超える画像を ${rejected} 枚除外しました`, 'info');
  if (sizeOk.length > rem) showToast(`画像は最大4枚です。${Math.max(0,rem)}枚追加しました。`, 'info');
  renderPreviews();
  refreshRightStats();
  e.target.value = '';
}

function handleComposeImagePaste(e) {
  const clipboard = e.clipboardData;
  const items = Array.from(clipboard?.items || []);
  const images = items
    .filter(item => item && item.kind === 'file' && String(item.type || '').startsWith('image/'))
    .map(item => item.getAsFile())
    .filter(Boolean);
  if (!images.length) return;

  e.preventDefault();
  const rem = 4 - S.pendingImgs.length;
  const sizeOk = images.filter(f => f.size <= APP_MAX_IMAGE_BYTES);
  const rejected = images.length - sizeOk.length;
  S.pendingImgs.push(...sizeOk.slice(0, rem));

  if (rejected > 0) showToast(`2MBを超える画像を ${rejected} 枚除外しました`, 'info');
  if (sizeOk.length > rem) showToast(`画像は最大4枚です。${Math.max(0, rem)}枚追加しました。`, 'info');
  renderPreviews();
  refreshRightStats();
}

function handleQuickImageSelect(e) {
  const files = Array.from(e.target.files);
  const rem = 4 - S.quickPendingImgs.length;
  const validImages = files.filter(f => f.type.startsWith('image/'));
  const sizeOk = validImages.filter(f => f.size <= APP_MAX_IMAGE_BYTES);
  const rejected = validImages.length - sizeOk.length;
  S.quickPendingImgs.push(...sizeOk.slice(0, rem));
  if (rejected > 0) showToast(`2MBを超える画像を ${rejected} 枚除外しました`, 'info');
  if (sizeOk.length > rem) showToast(`画像は最大4枚です。${Math.max(0,rem)}枚追加しました。`, 'info');
  renderQuickPreviews();
  e.target.value = '';
}

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function renderImageAssist(target) {
  const isQuick = target === 'quick';
  const imgs = isQuick ? S.quickPendingImgs : S.pendingImgs;
  const box = document.getElementById(isQuick ? 'quick-image-assist' : 'image-assist');
  const textEl = document.getElementById(isQuick ? 'quick-image-assist-text' : 'image-assist-text');
  if (!box || !textEl) return;
  if (!imgs.length) {
    box.classList.add('hidden');
    textEl.textContent = '画像未選択';
    return;
  }
  const total = imgs.reduce((sum, f) => sum + Number(f.size || 0), 0);
  const max = imgs.reduce((m, f) => Math.max(m, Number(f.size || 0)), 0);
  const remain = Math.max(0, 4 - imgs.length);
  box.classList.remove('hidden');
  textEl.textContent = `枚数 ${imgs.length}/4 ・ 合計 ${formatBytes(total)} ・ 最大 ${formatBytes(max)} ・ 残り ${remain} 枚`;
}

function renderPreviews() {
  const area = document.getElementById('image-preview-area');
  if (!S.pendingImgs.length) {
    area.classList.add('hidden');
    area.innerHTML = '';
    renderImageAssist('main');
    return;
  }
  area.classList.remove('hidden');
  area.innerHTML = S.pendingImgs.map((f, i) => `
    <div class="preview-thumb">
      <img src="${URL.createObjectURL(f)}" alt=""/>
      <button class="preview-rm" data-i="${i}">✕</button>
    </div>`).join('');
  area.querySelectorAll('.preview-rm').forEach(b => b.addEventListener('click', () => {
    S.pendingImgs.splice(+b.dataset.i, 1);
    renderPreviews();
    refreshRightStats();
  }));
  renderImageAssist('main');
}

function renderQuickPreviews() {
  const area = document.getElementById('quick-post-preview');
  if (!area) return;
  if (!S.quickPendingImgs.length) {
    area.classList.add('hidden');
    area.innerHTML = '';
    renderImageAssist('quick');
    return;
  }
  area.classList.remove('hidden');
  area.innerHTML = S.quickPendingImgs.map((f, i) => `
    <div class="preview-thumb">
      <img src="${URL.createObjectURL(f)}" alt=""/>
      <button class="preview-rm" data-qi="${i}">✕</button>
    </div>`).join('');
  area.querySelectorAll('.preview-rm').forEach(b => b.addEventListener('click', () => {
    S.quickPendingImgs.splice(+b.dataset.qi, 1);
    renderQuickPreviews();
  }));
  renderImageAssist('quick');
}

function setReply(uri, cid, handle) {
  S.replyTarget = { uri, cid, rootUri: uri, rootCid: cid, handle };
  document.getElementById('reply-ctx').classList.remove('hidden');
  document.getElementById('reply-to-text').textContent = `@${handle} への返信`;
  document.getElementById('compose-text').focus();
  withAuth(() => apiGetPostThread(uri, 0)).then(d => {
    const root = d.thread?.root?.post;
    if (root) { S.replyTarget.rootUri = root.uri; S.replyTarget.rootCid = root.cid; }
  }).catch(() => {});
}

function cancelReply() {
  S.replyTarget = null;
  document.getElementById('reply-ctx').classList.add('hidden');
}

function isOfflineLikeError(err) {
  const msg = String(err?.message || '').toLowerCase();
  return !navigator.onLine || /network|failed to fetch|fetch failed|timeout|timed out/.test(msg);
}

async function flushQueuedPosts() {
  if (!S.session || !navigator.onLine) return;
  const list = getPostQueue();
  if (!list.length) return;
  const remain = [];
  for (const item of list) {
    try {
      await withAuth(() => apiPost(item.text || '', [], item.replyTarget || null, item.restriction || 'everybody'));
    } catch (e) {
      remain.push(item);
      appLog('warn', 'queued post retry failed', e);
    }
  }
  savePostQueue(remain);
  if (remain.length !== list.length) {
    showToast(`オフラインキュー ${list.length - remain.length} 件を送信しました`, 'success', 2200);
    clearFetchCache('home::');
    clearFetchCache('profile::');
    if (S.tab === 'home') reloadTab('home');
  }
}

async function handlePost() {
  const ta   = document.getElementById('compose-text');
  const text = ta.value.trim();
  const btn  = document.getElementById('post-btn');
  const restriction = document.getElementById('reply-restriction').value;
  if (!text && !S.pendingImgs.length) { showToast('テキストまたは画像を入力してください', 'error'); return; }
  if ([...text].length > POST_TEXT_MAX_CHARS) { showToast(`${POST_TEXT_MAX_CHARS}文字以内にしてください`, 'error'); return; }
  setLoading(btn, true);
  try {
    await withAuth(() => apiPost(text, S.pendingImgs, S.replyTarget, restriction));
    logPostActivity(text, S.pendingImgs.length);
    clearFetchCache('home::');
    clearFetchCache('profile::');
    incActivity('posts');
    ta.value = ''; S.pendingImgs = []; renderPreviews(); cancelReply(); updateCharCount(); renderComposeHashtagSuggestions();
    clearComposeCache();
    showToast('投稿しました！', 'success');
    reloadTab('home');
    if (S.tab === 'profile') reloadTab('profile');
    refreshRightStats();
  } catch(e) {
    if (e?.code === 'IMAGE_UPLOAD_PARTIAL_FAILURE') {
      const count = Array.isArray(e.failedUploads) ? e.failedUploads.length : 1;
      showToast(`画像 ${count} 枚のアップロードに失敗しました。再試行してください。`, 'error');
      return;
    }
    if (isOfflineLikeError(e)) {
      enqueuePost({ text, restriction, replyTarget: S.replyTarget || null, source: 'compose' });
      showToast('オフラインのため投稿をキューに保存しました。オンライン復帰後に自動送信します。', 'info', 2600);
      return;
    }
    const backedUp = backupFailedPostToDraft(text, S.pendingImgs.length, '投稿失敗時の自動退避');
    showErrorToast(e, backedUp ? '投稿に失敗したため、本文を下書きに保存しました。' : '投稿に失敗しました。');
  }
  finally { setLoading(btn, false); }
}

function updateQuickPostCount() {
  const t = document.getElementById('quick-post-text')?.value || '';
  const r = POST_TEXT_MAX_CHARS - [...t].length;
  const el = document.getElementById('quick-post-count');
  const btn = document.getElementById('quick-post-submit');
  if (!el) return;
  el.textContent = r;
  el.className = 'char-count' + (r <= POST_WARN_THRESHOLD ? ' warn' : '') + (r < 0 ? ' danger' : '');
  if (btn) btn.disabled = r < 0;
}

function openQuickPostModal() {
  const ta = document.getElementById('quick-post-text');
  if (!ta) return;
  openModalById('quick-post-modal', '#quick-post-text');
  ta.focus();
  renderQuickPreviews();
  renderImageAssist('quick');
  updateQuickPostCount();
}

function closeQuickPostModal() {
  const ta = document.getElementById('quick-post-text');
  if (ta) ta.value = '';
  S.quickPendingImgs = [];
  renderQuickPreviews();
  renderImageAssist('quick');
  updateQuickPostCount();
  closeModalById('quick-post-modal');
}

async function handleQuickPost() {
  const ta = document.getElementById('quick-post-text');
  const btn = document.getElementById('quick-post-submit');
  const text = ta?.value.trim() || '';
  const restriction = document.getElementById('quick-post-restriction')?.value || 'everybody';
  if (!text && !S.quickPendingImgs.length) { showToast('テキストまたは画像を入力してください', 'error'); return; }
  if ([...text].length > POST_TEXT_MAX_CHARS) { showToast(`${POST_TEXT_MAX_CHARS}文字以内にしてください`, 'error'); return; }
  setLoading(btn, true);
  try {
    await withAuth(() => apiPost(text, S.quickPendingImgs, null, restriction));
    logPostActivity(text, S.quickPendingImgs.length);
    clearFetchCache('home::');
    clearFetchCache('profile::');
    incActivity('posts');
    closeQuickPostModal();
    showToast('投稿しました！', 'success');
    await reloadTab('home');
    refreshRightStats();
  } catch (e) {
    if (e?.code === 'IMAGE_UPLOAD_PARTIAL_FAILURE') {
      const count = Array.isArray(e.failedUploads) ? e.failedUploads.length : 1;
      showToast(`画像 ${count} 枚のアップロードに失敗しました。再試行してください。`, 'error');
      return;
    }
    if (isOfflineLikeError(e)) {
      enqueuePost({ text, restriction, replyTarget: null, source: 'quick' });
      showToast('オフラインのため投稿をキューに保存しました。オンライン復帰後に自動送信します。', 'info', 2600);
      return;
    }
    const backedUp = backupFailedPostToDraft(text, S.quickPendingImgs.length, 'クイック投稿失敗時の自動退避');
    showErrorToast(e, backedUp ? '投稿に失敗したため、本文を下書きに保存しました。' : '投稿に失敗しました。');
  } finally {
    setLoading(btn, false);
  }
}

function handleExternalLinkGuard(e) {
  const link = e.target.closest('a[href]');
  if (!link) return;
  try {
    const url = new URL(link.href, window.location.href);
    if (!/^https?:$/i.test(url.protocol)) return;
    if (url.origin === window.location.origin) return;
    if (link.dataset.skipConfirm === '1') return;
    const ok = window.confirm(`外部サイトへ移動します。\n${url.hostname}\n続行しますか？`);
    if (!ok) {
      e.preventDefault();
      e.stopPropagation();
    }
  } catch {
    // Ignore malformed URLs.
  }
}

function loadQuickNote() {
  const inp = document.getElementById('quick-note-input');
  const status = document.getElementById('quick-note-status');
  if (!inp || !status) return;
  const saved = safeStorageGet(QUICK_NOTE_KEY) || '';
  inp.value = saved;
  status.textContent = saved ? '保存済みメモを読み込みました' : '未保存';
  renderQuickNoteList();
  refreshRightStats();
}

function saveQuickNote() {
  const inp = document.getElementById('quick-note-input');
  const status = document.getElementById('quick-note-status');
  if (!inp || !status) return;
  const text = (inp.value || '').trim();
  safeStorageSet(QUICK_NOTE_KEY, text);
  if (text) {
    const curr = getQuickNoteList();
    const next = [text, ...curr.filter(v => v !== text)].slice(0, 8);
    safeStorageSet(QUICK_NOTE_LIST_KEY, JSON.stringify(next));
  }
  renderQuickNoteList();
  status.textContent = '保存しました';
  refreshRightStats();
}

function getQuickNoteList() {
  try {
    const raw = JSON.parse(safeStorageGet(QUICK_NOTE_LIST_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter(v => typeof v === 'string' && v.trim()).slice(0, 8);
  } catch {
    return [];
  }
}

function renderQuickNoteList() {
  const listEl = document.getElementById('quick-note-list');
  if (!listEl) return;
  const list = getQuickNoteList();
  if (!list.length) {
    listEl.innerHTML = '';
    return;
  }
  listEl.innerHTML = list.map((text, idx) => `
    <div class="quick-note-item" data-note-index="${idx}">
      <div class="quick-note-text">${escapeHtml(text)}</div>
      <button class="btn-sm quick-note-use" data-note-action="use" data-note-index="${idx}">使う</button>
      <button class="btn-sm quick-note-delete" data-note-action="delete" data-note-index="${idx}">削除</button>
    </div>
  `).join('');
}

function useQuickNoteByIndex(index) {
  const list = getQuickNoteList();
  const text = list[index] || '';
  if (!text) return;
  const inp = document.getElementById('quick-note-input');
  if (inp) inp.value = text;
  insertQuickNoteToCompose();
}

function deleteQuickNoteByIndex(index) {
  const list = getQuickNoteList();
  if (index < 0 || index >= list.length) return;
  list.splice(index, 1);
  safeStorageSet(QUICK_NOTE_LIST_KEY, JSON.stringify(list));
  renderQuickNoteList();
  refreshRightStats();
}

function insertQuickNoteToCompose() {
  const inp = document.getElementById('quick-note-input');
  const ta = document.getElementById('compose-text');
  if (!inp || !ta) return;
  const note = (inp.value || '').trim();
  if (!note) { showToast('メモが空です', 'info'); return; }
  const next = ta.value ? `${ta.value}\n${note}` : note;
  ta.value = next;
  updateCharCount();
  cacheComposeState();
  switchTab('home');
  document.getElementById('compose-area')?.scrollIntoView({ behavior: 'smooth' });
  ta.focus();
  showToast('メモを本文へ貼り付けました', 'success');
  refreshRightStats();
}

// 引用リポスト投稿
async function handleQuotePost(btn) {
  const { quoteUri, quoteCid, rkey } = btn.dataset;
  const ta = document.querySelector(`#qc-${rkey} .quote-compose-ta`);
  const text = ta?.value.trim() || '';
  setLoading(btn, true);
  try {
    await withAuth(() => apiPost(text, [], null, null, quoteUri, quoteCid));
    showToast('引用投稿しました！', 'success');
    const qc = document.getElementById(`qc-${rkey}`);
    if (qc) qc.classList.add('hidden');
    if (ta) ta.value = '';
    reloadTab('home');
  } catch(e) {
    const backedUp = backupFailedPostToDraft(text, 0, `引用投稿失敗: ${quoteUri || ''}`);
    showErrorToast(e, backedUp ? '引用投稿に失敗したため、本文を下書きに保存しました。' : '引用投稿に失敗しました。');
  }
  finally { setLoading(btn, false); }
}

// 下書き
function saveDraftAndClear() {
  const text = document.getElementById('compose-text').value.trim();
  if (!text) { showToast('テキストを入力してください', 'error'); return; }
  saveDraft(text);
  document.getElementById('compose-text').value = '';
  updateCharCount();
  cacheComposeState();
  showToast('下書きを保存しました', 'success');
}

function toggleDrafts() {
  const panel = document.getElementById('drafts-panel');
  const isHidden = panel.classList.toggle('hidden');
  if (!isHidden) renderDraftsPanel();
}

function renderDraftsPanel() {
  const list = document.getElementById('drafts-list');
  const drafts = getDrafts();
  if (!drafts.length) { list.innerHTML = '<div class="draft-empty">下書きがありません</div>'; return; }
  list.innerHTML = drafts.map(d => `
    <div class="draft-item">
      <div class="draft-text">${escapeHtml(d.text.slice(0,60))}${d.text.length>60?'…':''}</div>
      <div class="draft-time">${formatTime(d.savedAt)}</div>
      <div class="draft-actions">
        <button class="btn-sm" data-draft-id="${d.id}" data-draft-action="use">使用</button>
        <button class="btn-sm danger" data-draft-id="${d.id}" data-draft-action="del">削除</button>
      </div>
    </div>`).join('');
}

// =============================================
//  いいね・リポスト
// =============================================
async function handleLike(btn) {
  const { uri, cid, likeUri } = btn.dataset;
  const liked = btn.classList.contains('active');
  const countEl = btn.querySelector('.act-count');
  const count = parseInt(countEl?.textContent || '0');
  btn.classList.toggle('active', !liked);
  const svg = btn.querySelector('svg');
  if (svg) svg.setAttribute('fill', liked ? 'none' : 'currentColor');
  if (countEl) countEl.textContent = liked ? Math.max(0, count - 1) : count + 1;
  try {
    if (liked) { await withAuth(() => apiUnlike(likeUri)); btn.dataset.likeUri = ''; }
    else { const r = await withAuth(() => apiLike(uri, cid)); btn.dataset.likeUri = r.uri || ''; }
  } catch(e) {
    btn.classList.toggle('active', liked);
    if (svg) svg.setAttribute('fill', liked ? 'currentColor' : 'none');
    if (countEl) countEl.textContent = count;
    showErrorToast(e, 'いいね処理に失敗しました。');
  }
}

async function handleRepost(btn) {
  const { uri, cid, repostUri } = btn.dataset;
  const reposted = btn.classList.contains('active');
  const countEl = btn.querySelector('.act-count');
  const count = parseInt(countEl?.textContent || '0');
  btn.classList.toggle('active', !reposted);
  if (countEl) countEl.textContent = reposted ? Math.max(0, count - 1) : count + 1;
  try {
    if (reposted) { await withAuth(() => apiUnrepost(repostUri)); btn.dataset.repostUri = ''; showToast('リポストを解除しました'); }
    else { const r = await withAuth(() => apiRepost(uri, cid)); btn.dataset.repostUri = r.uri || ''; showToast('リポストしました', 'success'); }
  } catch(e) {
    btn.classList.toggle('active', reposted);
    if (countEl) countEl.textContent = count;
    showErrorToast(e, 'リポスト処理に失敗しました。');
  }
}

async function handleFollowToggle(btn) {
  const { did, followUri } = btn.dataset;
  const following = btn.classList.contains('following');
  btn.disabled = true;
  try {
    if (following) { await withAuth(() => apiUnfollow(followUri)); btn.classList.remove('following'); btn.textContent = 'フォロー'; btn.dataset.followUri = ''; }
    else { const r = await withAuth(() => apiFollow(did)); btn.classList.add('following'); btn.textContent = 'フォロー中'; btn.dataset.followUri = r.uri || ''; }
  } catch(e) { showErrorToast(e, 'フォロー操作に失敗しました。'); }
  finally { btn.disabled = false; }
}

// =============================================
//  削除
// =============================================
function openDeleteModal(uri) { S.deleteTarget = uri; openModalById('delete-modal', '#delete-cancel-btn'); }

async function confirmDelete() {
  if (!S.deleteTarget) return;
  const btn = document.getElementById('delete-confirm-btn');
  btn.disabled = true; btn.textContent = '削除中…';
  try {
    await withAuth(() => apiDeletePost(S.deleteTarget));
    document.querySelectorAll(`.post-card[data-uri="${CSS.escape(S.deleteTarget)}"]`).forEach(card => {
      card.style.transition = 'opacity .3s,transform .3s';
      card.style.opacity = '0'; card.style.transform = 'translateX(20px)';
      setTimeout(() => card.remove(), 300);
    });
    clearFetchCache('profile::'); 
    clearFetchCache('home::');
    showToast('削除しました', 'success');
    document.getElementById('delete-modal').classList.add('hidden'); S.deleteTarget = null;
  } catch(e) { showErrorToast(e, '削除に失敗しました。'); }
  finally { btn.disabled = false; btn.textContent = '削除する'; }
}

// =============================================
//  画像ビューア
// =============================================
let currentImages = []; let currentImageIndex = 0; let imageViewerZoomed = false;
function openImageViewer(images, startIndex = 0) {
  if (!Array.isArray(images) || !images.length) return;
  currentImages = images;
  currentImageIndex = Math.max(0, Math.min(startIndex, images.length - 1));
  imageViewerZoomed = false;
  showImageAtIndex(currentImageIndex);
  document.getElementById('image-viewer-modal').classList.remove('hidden');
}
function closeImageViewer() { document.getElementById('image-viewer-modal').classList.add('hidden'); currentImages = []; currentImageIndex = 0; imageViewerZoomed = false; resetImageViewerZoom(); }
function showImageAtIndex(idx) {
  if (idx < 0 || idx >= currentImages.length) return;
  currentImageIndex = idx;
  const img = currentImages[idx];
  const fullsize = typeof img === 'string' ? img : (img.fullsize || img.thumb || '');
  const alt = typeof img === 'object' ? (img.alt || '') : '';
  const imgEl = document.getElementById('image-viewer-img');
  if (!imgEl) return;
  imgEl.style.width = '';
  imgEl.style.height = '';
  imgEl.src = fullsize;
  imgEl.alt = alt;
  const openLink = document.getElementById('image-viewer-open');
  if (openLink) openLink.href = fullsize;
  const counter = document.getElementById('image-viewer-counter');
  if (counter) counter.textContent = `${currentImageIndex + 1} / ${currentImages.length}`;
  const nav = document.getElementById('image-viewer-nav');
  if (nav) nav.classList.toggle('hidden', currentImages.length <= 1);
}
function navigateImageViewer(dir) { imageViewerZoomed = false; resetImageViewerZoom(); showImageAtIndex(currentImageIndex + dir); }
function resetImageViewerZoom() { const img = document.getElementById('image-viewer-img'); if (img) img.style.transform = ''; }

// =============================================
//  プロフィール編集
// =============================================
async function handleProfileSave() {
  const btn = document.getElementById('profile-save-btn');
  setLoading(btn, true);
  try {
    await withAuth(() => apiUpdateProfile({
      displayName: document.getElementById('edit-displayname').value.trim(),
      description: document.getElementById('edit-description').value.trim(),
      avatarFile:  document.getElementById('edit-avatar-file').files[0] || null,
      bannerFile:  document.getElementById('edit-banner-file').files[0] || null,
    }));
    showToast('プロフィールを更新しました', 'success');
    await loadMyProfile();
    document.getElementById('profile-feed').innerHTML = '';
    if (S.tab === 'profile') loadTab('profile');
  } catch(e) { showErrorToast(e, 'プロフィール更新に失敗しました。'); }
  finally { setLoading(btn, false); }
}

// =============================================
//  もっと読む
// =============================================
async function handleLoadMore(btn) {
  const tab = btn.dataset.tab;
  if (S.loading[tab]) return;
  S.loading[tab] = true;
  btn.textContent = '読み込み中…'; btn.disabled = true;
  const feedMap = { home:'home-feed', notifications:'notif-feed', profile:'profile-feed' };
  const feed = feedMap[tab] ? document.getElementById(feedMap[tab]) : null;
  try {
    const cursor = S.cursors[tab];
    const myDid  = S.session?.did;
    if (tab === 'home') {
      const data = S.homeSubTab === 'discover'
        ? await withAuth(() => apiGetDiscover(cursor))
        : S.homeSubTab === 'pinned'
          ? await withAuth(() => apiSearchPosts(applyJapanSearchHint(getPinnedHomeQuery()), cursor, 'latest'))
          : await withAuth(() => apiGetTimeline(cursor));
      btn.remove();
      const rows = normalizeFeedRows(S.homeSubTab === 'pinned' ? (data.posts || []).map(p => ({ post: p })) : (data.feed || []));
      rows.forEach(i => appendCards(feed, renderPostCard(i, myDid)));
      S.cursors[tab] = data.cursor || null;
      if (data.cursor) addLoadMoreBtn(feed, tab);
    } else if (tab === 'profile') {
      const actor = S.myProfile?.handle;
      let data;
      if (S.profileSubTab === 'likes') {
        data = await withAuth(() => apiGetActorLikes(actor, cursor));
      } else {
        const filter = S.profileSubTab === 'replies' ? 'posts_with_replies' : S.profileSubTab === 'media' ? 'posts_with_media' : 'posts_no_replies';
        data = await withAuth(() => apiGetAuthorFeed(actor, filter, cursor));
      }
      btn.remove();
      normalizeFeedRows(data.feed || []).forEach(i => appendCards(feed, renderPostCard(i, myDid)));
      S.cursors[tab] = data.cursor || null;
      if (data.cursor) addLoadMoreBtn(feed, tab);
    } else if (tab === 'notifications') {
      const data = await withAuth(() => apiGetNotifications(cursor));
      const appended = await enrichNotificationsWithSubjectPreview(data.notifications || []);
      S.cachedNotifs = [...S.cachedNotifs, ...appended];
      S.cursors[tab] = data.cursor || null;
      btn.remove();
      renderNotifList();
    }
  } catch(e) { showErrorToast(e, '追加読み込みに失敗しました。'); btn.textContent = 'もっと読み込む'; btn.disabled = false; }
  finally { S.loading[tab] = false; }
}

let loadMoreObserver = null;
function initLoadMoreObserver() {
  if (!('IntersectionObserver' in window)) return;
  if (loadMoreObserver) return;
  loadMoreObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const btn = entry.target;
      if (!(btn instanceof HTMLElement)) return;
      if (btn.dataset.autoLoading === '1') return;
      btn.dataset.autoLoading = '1';
      handleLoadMore(btn).finally(() => {
        btn.dataset.autoLoading = '0';
      });
    });
  }, { rootMargin: '160px 0px 200px 0px', threshold: 0.01 });

  const observeButtons = () => {
    document.querySelectorAll('.load-more-btn').forEach(btn => loadMoreObserver.observe(btn));
  };
  observeButtons();
  const mo = new MutationObserver(() => observeButtons());
  mo.observe(document.body, { childList: true, subtree: true });
}

// =============================================
//  通知ポーリング
// =============================================
let notifInterval = null;
function updateNotifLiveRegion(count) {
  const n = Number(count || 0);
  if (S.lastUnreadCount === n) return;
  S.lastUnreadCount = n;
  const region = document.getElementById('notif-live-region');
  if (!region) return;
  region.textContent = n > 0 ? `未読通知が ${n} 件あります` : '未読通知はありません';
}

async function checkNotif() {
  try {
    const d = await withAuth(() => apiGetUnreadCount());
    const n = d.count || 0;
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    if (n > 0) { badge.textContent = n > 99 ? '99+' : n; badge.classList.remove('hidden'); }
    else badge.classList.add('hidden');
    updateNotifLiveRegion(n);
  } catch {}
}
function startNotifPoll() {
  stopNotifPoll();
  if (document.hidden) return;
  checkNotif();
  notifInterval = setInterval(() => {
    if (document.hidden) return;
    checkNotif();
  }, getNotifPollMs());
}
function stopNotifPoll()  { clearInterval(notifInterval); notifInterval = null; }

function handleVisibilityForNotifPoll() {
  if (!S.session) return;
  if (document.hidden) {
    stopNotifPoll();
    return;
  }
  startNotifPoll();
}

function openLogoutActionModal() {
  openModalById('logout-action-modal', '#logout-action-cancel');
}

function closeLogoutActionModal() {
  closeModalById('logout-action-modal');
}

function confirmAndLogout() {
  const ok = window.confirm('ログアウトしますか？\nローカルのセッション情報を削除します。');
  if (!ok) return;
  closeLogoutActionModal();
  handleLogout();
}

function tryClosePageOnly() {
  closeLogoutActionModal();
  window.close();
  setTimeout(() => {
    if (!window.closed) {
      showToast('このページを閉じられませんでした。ブラウザのタブを閉じてください。', 'info', 4500);
    }
  }, 120);
}

function handleSidebarLogoutClick() {
  openLogoutActionModal();
}

function handleSettingsLogoutClick() {
  const ok = window.confirm('ログアウトしますか？\nローカルのセッション情報を削除します。');
  if (!ok) return;
  handleLogout();
}

async function handleLogout(options = {}) {
  const preserveCompose = options?.preserveCompose === true;
  if (typeof removeSession === 'function') removeSession(String(S.session?.did || ''));
  else clearSession();
  const remainingAccounts = (typeof listSessions === 'function')
    ? listSessions().length
    : 0;
  const nextSess = loadSession();
  S.session = null;
  S.myProfile = null;
  if (remainingAccounts <= 0) clearAdvancedMode();
  if (!preserveCompose) clearComposeCache();
  clearFetchCache();
  stopNotifPoll();
  clearTimeout(inactivityTimer);
  inactivityTimer = null;
  document.querySelectorAll('.feed').forEach(f => f.innerHTML = '');
  Object.keys(S.cursors).forEach(k => delete S.cursors[k]);
  if (!nextSess) {
    showLogin();
    syncAccountSwitcherUi();
    return;
  }

  S.session = nextSess;
  showApp();
  syncSubTabUi();
  syncExperienceUi();
  try {
    await loadMyProfile();
    restoreComposeCache();
    const bootTab = getAdaptiveBootTab();
    switchTab(bootTab);
    await loadTab(bootTab);
    startNotifPoll();
    resetInactivityTimer();
    showToast('現在のアカウントをログアウトしました。別アカウントに切り替えました', 'info', 2200);
  } catch (e) {
    showToast(toUserErrorMessage(e, 'アカウント切り替え後の再読み込みに失敗しました'), 'error');
  }
}

function openShortcutsModal() {
  openModalById('shortcuts-modal', '#shortcuts-close-btn');
}

function closeShortcutsModal() {
  closeModalById('shortcuts-modal');
}

function isTypingTarget(target) {
  if (!target) return false;
  const tag = String(target.tagName || '').toLowerCase();
  return target.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select';
}

function focusSearchInput() {
  switchTab('search');
  const el = document.getElementById('search-input');
  if (!el) return;
  el.focus();
  el.select();
}

function focusComposeInput() {
  switchTab('home');
  const el = document.getElementById('compose-text');
  if (!el) return;
  document.getElementById('compose-area')?.scrollIntoView({ behavior: 'smooth' });
  el.focus();
}

function startNavChord() {
  S.navChordActive = true;
  clearTimeout(S.navChordTimer);
  S.navChordTimer = setTimeout(() => {
    S.navChordActive = false;
  }, 1500);
}

function consumeNavChord(key) {
  const map = {
    h: 'home',
    n: 'notifications',
    s: 'search',
    d: 'dm',
    l: 'lists',
    p: 'profile',
    t: 'settings',
  };
  const tab = map[key];
  if (!tab) return false;
  switchTab(tab);
  S.navChordActive = false;
  return true;
}

function handleGlobalKeydown(e) {
  const actionBtn = e.target?.closest?.('.post-actions .act-btn');
  if (actionBtn && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
    const row = actionBtn.closest('.post-actions');
    const items = row ? [...row.querySelectorAll('.act-btn')] : [];
    const idx = items.indexOf(actionBtn);
    if (idx >= 0 && items.length > 1) {
      const delta = e.key === 'ArrowRight' ? 1 : -1;
      const next = (idx + delta + items.length) % items.length;
      items[next].focus();
      e.preventDefault();
      return;
    }
  }

  const key = String(e.key || '').toLowerCase();
  const typing = isTypingTarget(e.target);
  const shortcuts = getActiveShortcutPrefs();
  const shortcutsEnabled = window.__skywebproShortcutsEnabled !== false;

  if (trapFocusInTopModal(e)) return;

  if (e.key === 'Escape') {
    if (closeTopVisibleModal()) {
      e.preventDefault();
      return;
    }
    return;
  }

  if ((e.ctrlKey || e.metaKey) && key === 'k') {
    if (!shortcutsEnabled) return;
    e.preventDefault();
    focusSearchInput();
    return;
  }

  // Ctrl/Cmd/Alt 系のショートカットは、専用ハンドラ以外で吸わない
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (!shortcutsEnabled) return;

  if (!typing && key === shortcuts.showHelp) {
    e.preventDefault();
    openShortcutsModal();
    return;
  }

  if (!typing && key === shortcuts.focusSearch) {
    e.preventDefault();
    focusSearchInput();
    return;
  }

  if (!typing && key === shortcuts.focusCompose) {
    e.preventDefault();
    focusComposeInput();
    return;
  }

  if (!typing && key === shortcuts.navPrefix) {
    e.preventDefault();
    startNavChord();
    return;
  }

  if (!typing && S.navChordActive && consumeNavChord(key)) {
    e.preventDefault();
  }
}

// =============================================
//  イベント一括バインド
// =============================================
function toggleComposeAreaCollapse() {
  const area = document.getElementById('compose-area');
  const btn = document.getElementById('compose-collapse-btn');
  if (!area || !btn) return;
  const isCollapsed = area.getAttribute('data-compose-collapsed') === 'true';
  area.setAttribute('data-compose-collapsed', !isCollapsed);
  btn.textContent = isCollapsed ? '-' : '+';
  btn.title = isCollapsed ? '投稿欄を折りたたむ' : '投稿欄を展開';
  btn.setAttribute('aria-label', isCollapsed ? '投稿欄を折りたたむ' : '投稿欄を展開');
}

function bindAll() {
  // ログイン
  document.getElementById('login-btn').addEventListener('click', handleLogin);
  document.getElementById('login-check-btn')?.addEventListener('click', handleLoginConnectivityCheck);
  document.getElementById('login-console-clear')?.addEventListener('click', clearLoginConsole);
  document.getElementById('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  document.getElementById('login-connection-mode')?.addEventListener('change', () => {
    applyConnectionModeFromUi('login');
  });
  document.getElementById('login-proxy-base')?.addEventListener('change', () => {
    applyConnectionModeFromUi('login');
  });

  // ログアウト
  document.getElementById('logout-btn').addEventListener('click', handleSidebarLogoutClick);
  document.getElementById('logout-action-close-page')?.addEventListener('click', tryClosePageOnly);
  document.getElementById('logout-action-cancel')?.addEventListener('click', closeLogoutActionModal);
  document.getElementById('logout-action-logout')?.addEventListener('click', confirmAndLogout);
  document.getElementById('logout-action-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeLogoutActionModal();
  });

  // ナビ
  document.querySelectorAll('.nav-item').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  document.querySelectorAll('.mobile-nav-item').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  // サブタブ
  document.querySelectorAll('#tab-home .sub-tab').forEach(b => b.addEventListener('click', () => switchHomeSubTab(b.dataset.sub)));
  document.querySelectorAll('#tab-notifications .sub-tab').forEach(b => b.addEventListener('click', () => switchNotifSubTab(b.dataset.sub)));
  document.querySelectorAll('#tab-search .sub-tab').forEach(b => b.addEventListener('click', () => switchSearchTab(b.dataset.sub)));
  document.querySelectorAll('#tab-profile .sub-tab').forEach(b => b.addEventListener('click', () => switchProfileSubTab(b.dataset.sub)));

  // リフレッシュ
  document.querySelectorAll('.refresh-btn').forEach(b => b.addEventListener('click', () => {
    b.classList.add('spinning');
    reloadTab(b.dataset.target).finally(() => setTimeout(() => b.classList.remove('spinning'), 500));
  }));

  // 検索
  document.getElementById('search-input').addEventListener('input', e => handleSearchInput(e.target.value));
  document.getElementById('search-input').addEventListener('compositionstart', () => { S.searchComposing = true; });
  document.getElementById('search-input').addEventListener('compositionend', e => {
    S.searchComposing = false;
    handleSearchInput(e.target.value);
  });
  document.getElementById('search-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !S.searchComposing && !e.isComposing) execSearch(e.target.value.trim());
  });
  document.getElementById('search-input').addEventListener('focus', renderSearchHistory);
  document.getElementById('search-ime-helper')?.addEventListener('click', openSearchImeModal);
  document.getElementById('search-clear-btn')?.addEventListener('click', () => {
    const inp = document.getElementById('search-input');
    const feed = document.getElementById('search-feed');
    if (!inp || !feed) return;
    inp.value = '';
    feed.innerHTML = '';
    updateSearchClearButton();
    renderSearchHistory();
    inp.focus();
  });
  document.getElementById('search-recent-clear')?.addEventListener('click', clearSearchHistory);
  document.getElementById('search-ime-cancel')?.addEventListener('click', closeSearchImeModal);
  document.getElementById('search-ime-apply')?.addEventListener('click', applySearchImeInput);
  document.getElementById('migration-wizard-close')?.addEventListener('click', () => closeModalById('migration-wizard-modal'));
  document.getElementById('migration-wizard-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModalById('migration-wizard-modal');
  });
  document.getElementById('search-ime-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeSearchImeModal();
  });
  document.querySelectorAll('#trend-category-tabs [data-trend-cat]').forEach(btn => {
    btn.addEventListener('click', () => setTrendCategory(btn.dataset.trendCat));
  });
  document.getElementById('home-pinned-edit')?.addEventListener('click', openPinnedModal);
  document.getElementById('home-pinned-cancel')?.addEventListener('click', closePinnedModal);
  document.getElementById('home-pinned-save')?.addEventListener('click', savePinnedModal);
  document.getElementById('home-pinned-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') savePinnedModal();
  });
  document.getElementById('home-pinned-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closePinnedModal();
  });

  // compose
  document.getElementById('compose-text').addEventListener('input', updateCharCount);
  document.getElementById('compose-text').addEventListener('input', refreshRightStats);
  document.getElementById('compose-text').addEventListener('input', renderComposeHashtagSuggestions);
  document.getElementById('compose-text').addEventListener('input', cacheComposeState);
  document.getElementById('compose-text').addEventListener('paste', handleComposeImagePaste);
  document.getElementById('reply-restriction').addEventListener('change', e => {
    cacheComposeState();
    setReplyTemplate(e.target.value);
  });
  document.getElementById('quick-post-restriction')?.addEventListener('change', e => {
    setReplyTemplate(e.target.value);
  });
  document.getElementById('reply-template-select')?.addEventListener('change', e => {
    setReplyTemplate(e.target.value);
    showToast('公開範囲テンプレートを更新しました', 'success', 1400);
  });
  document.getElementById('compose-text').addEventListener('keydown', e => { if ((e.metaKey||e.ctrlKey) && e.key === 'Enter') handlePost(); });
  document.getElementById('image-input').addEventListener('change', handleImageSelect);
  document.getElementById('quick-post-image-input')?.addEventListener('change', handleQuickImageSelect);
  document.getElementById('post-btn').addEventListener('click', handlePost);
  document.getElementById('cancel-reply-btn').addEventListener('click', cancelReply);
  document.getElementById('save-draft-btn').addEventListener('click', saveDraftAndClear);
  document.getElementById('drafts-btn').addEventListener('click', toggleDrafts);

  // 左下クイック投稿
  document.getElementById('quick-post-fab')?.addEventListener('click', openQuickPostModal);
  document.getElementById('compose-collapse-btn')?.addEventListener('click', toggleComposeAreaCollapse);
  document.getElementById('quick-post-image-input')?.addEventListener('change', handleQuickImageSelect);
  document.getElementById('quick-post-width')?.addEventListener('input', e => applyQuickPostWidth(e.target.value));
  document.getElementById('quick-post-text')?.addEventListener('input', updateQuickPostCount);
  document.getElementById('quick-post-cancel')?.addEventListener('click', closeQuickPostModal);
  document.getElementById('quick-post-submit')?.addEventListener('click', handleQuickPost);
  document.getElementById('quick-post-text')?.addEventListener('input', updateQuickPostCount);
  document.getElementById('quick-post-text')?.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleQuickPost(); });
  document.getElementById('quick-post-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeQuickPostModal(); });

  // 右側独自機能: クイックメモ
  document.getElementById('quick-note-save')?.addEventListener('click', saveQuickNote);
  document.getElementById('quick-note-insert')?.addEventListener('click', insertQuickNoteToCompose);
  document.getElementById('cfg-show-notes')?.addEventListener('change', onRightPanelConfigChange);
  document.getElementById('cfg-show-actions')?.addEventListener('change', onRightPanelConfigChange);
  document.getElementById('cfg-show-stats')?.addEventListener('change', onRightPanelConfigChange);
  document.getElementById('right-panel-toggle')?.addEventListener('click', toggleRightPanelCollapsed);
  document.getElementById('right-panel-mini')?.addEventListener('click', () => setRightPanelMini(true));
  document.getElementById('right-panel-mini-btn')?.addEventListener('click', openRightPanelFromMini);
  document.getElementById('right-panel-hide')?.addEventListener('click', () => setRightPanelVisible(false));
  document.getElementById('insight-range-week')?.addEventListener('click', () => switchInsightRange('week'));
  document.getElementById('insight-range-month')?.addEventListener('click', () => switchInsightRange('month'));
  document.getElementById('action-insert-time')?.addEventListener('click', quickInsertTime);
  document.getElementById('action-insert-date')?.addEventListener('click', quickInsertDate);
  document.getElementById('action-clear-compose')?.addEventListener('click', quickClearCompose);
  document.getElementById('action-go-home')?.addEventListener('click', () => switchTab('home'));
  document.getElementById('action-open-search')?.addEventListener('click', () => switchTab('search'));
  document.getElementById('right-stats-refresh')?.addEventListener('click', refreshRightStats);

  // 削除モーダル
  document.getElementById('delete-cancel-btn').addEventListener('click', () => { document.getElementById('delete-modal').classList.add('hidden'); S.deleteTarget = null; });
  document.getElementById('delete-confirm-btn').addEventListener('click', confirmDelete);

  // DM
  document.getElementById('dm-start-btn')?.addEventListener('click', openDmStartModal);
  document.getElementById('dm-search-input')?.addEventListener('input', renderDmConversationList);
  document.getElementById('dm-image-btn')?.addEventListener('click', handleDmImageScaffold);
  document.getElementById('dm-send-btn').addEventListener('click', sendDM);
  document.getElementById('dm-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendDM(); } });
  document.getElementById('dm-back-btn').addEventListener('click', () => document.getElementById('dm-chat-panel').classList.add('hidden'));
  document.getElementById('dm-start-cancel')?.addEventListener('click', closeDmStartModal);
  document.getElementById('dm-start-submit')?.addEventListener('click', submitDmStart);
  document.getElementById('dm-start-handle')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') submitDmStart();
  });
  document.getElementById('dm-start-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeDmStartModal();
  });

  // リストバック
  document.getElementById('list-back-btn').addEventListener('click', () => document.getElementById('list-feed-container').classList.add('hidden'));

  // 設定画面のログアウト
  document.getElementById('settings-logout-btn')?.addEventListener('click', handleSettingsLogoutClick);
  document.getElementById('theme-toggle-btn')?.addEventListener('click', toggleThemeMode);
  document.getElementById('settings-theme-mode')?.addEventListener('change', onThemeModeChange);
  document.getElementById('settings-font-scale')?.addEventListener('change', onFontScaleModeChange);
  document.getElementById('settings-reading-width')?.addEventListener('change', onReadingWidthModeChange);
  document.getElementById('settings-show-control-deck')?.addEventListener('change', onSettingsControlDeckChange);
  document.getElementById('settings-enable-feed-width')?.addEventListener('change', onFeedWidthSettingsChange);
  document.getElementById('settings-feed-width')?.addEventListener('input', e => {
    const label = document.getElementById('settings-feed-width-value');
    if (label) label.textContent = `${Number(e.target.value || 680)}px`;
  });
  document.getElementById('settings-feed-width-apply')?.addEventListener('click', applyFeedWidthWithLock);
  document.getElementById('settings-notif-interval')?.addEventListener('change', onNotifPollIntervalChange);
  document.getElementById('settings-toast-duration')?.addEventListener('change', onToastDurationChange);
  document.getElementById('settings-startup-tab-mode')?.addEventListener('change', onStartupTabModeChange);
  document.getElementById('settings-inactivity-timeout')?.addEventListener('change', onInactivityTimeoutChange);
  document.getElementById('settings-post-density')?.addEventListener('change', onPostDensityModeChange);
  document.getElementById('settings-image-autoload')?.addEventListener('change', onImageAutoloadModeChange);
  document.getElementById('settings-connection-mode')?.addEventListener('change', () => {
    const result = applyConnectionModeFromUi('settings');
    if (!result.ok) {
      showToast(result.message, 'warn', 2200);
      return;
    }
    showToast('接続モードを更新しました', 'success', 1400);
  });
  document.getElementById('settings-proxy-base')?.addEventListener('change', () => {
    const result = applyConnectionModeFromUi('settings');
    if (!result.ok) {
      showToast(result.message, 'warn', 2200);
      return;
    }
    showToast('XServer接続先を更新しました', 'success', 1400);
  });
  document.getElementById('settings-shortcut-help')?.addEventListener('change', onShortcutPrefsChange);
  document.getElementById('settings-shortcut-search')?.addEventListener('change', onShortcutPrefsChange);
  document.getElementById('settings-shortcut-compose')?.addEventListener('change', onShortcutPrefsChange);
  document.getElementById('settings-shortcut-nav')?.addEventListener('change', onShortcutPrefsChange);
  document.getElementById('settings-shortcut-reset')?.addEventListener('click', resetShortcutPrefs);
  document.getElementById('settings-shortcuts-enabled')?.addEventListener('change', onShortcutsEnabledChange);
  document.getElementById('settings-japan-mode')?.addEventListener('change', handleExperienceSettingsChange);
  document.getElementById('settings-japan-trends')?.addEventListener('change', handleExperienceSettingsChange);
  document.getElementById('settings-personalize')?.addEventListener('change', handleExperienceSettingsChange);
  document.getElementById('settings-report-admin-btn')?.addEventListener('click', reportToAdmin);
  document.getElementById('settings-shortcuts-btn')?.addEventListener('click', openShortcutsModal);
  document.getElementById('settings-account-switch-btn')?.addEventListener('click', handleSettingsAccountSwitch);
  document.getElementById('settings-add-account-btn')?.addEventListener('click', handleSettingsAddAccount);
  document.getElementById('settings-add-account-password')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSettingsAddAccount();
  });
  document.getElementById('settings-export-prefs-btn')?.addEventListener('click', exportSettingsToFile);
  document.getElementById('settings-import-prefs-btn')?.addEventListener('click', () => {
    document.getElementById('settings-import-prefs-file')?.click();
  });
  document.getElementById('settings-import-prefs-file')?.addEventListener('change', async e => {
    const file = e.target?.files?.[0] || null;
    await importSettingsFromFile(file);
    e.target.value = '';
  });

  // プロフィール編集
  document.getElementById('profile-save-btn').addEventListener('click', handleProfileSave);
  document.getElementById('edit-avatar-file')?.addEventListener('change', e => {
    const f = e.target.files[0]; if (f) document.getElementById('prof-avatar-img').src = URL.createObjectURL(f);
  });
  document.getElementById('edit-banner-file')?.addEventListener('change', e => {
    const f = e.target.files[0]; if (f) document.getElementById('prof-banner-img').style.backgroundImage = `url(${URL.createObjectURL(f)})`;
  });

  // 他人プロフィールパネルの閉じる
  document.getElementById('user-profile-close')?.addEventListener('click', closeUserProfile);
  document.getElementById('user-profile-panel')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeUserProfile();
  });
  document.getElementById('shortcuts-close-btn')?.addEventListener('click', closeShortcutsModal);
  document.getElementById('shortcuts-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeShortcutsModal();
  });

  // 画像ビューア
  document.getElementById('image-viewer-close')?.addEventListener('click', closeImageViewer);
  document.getElementById('image-viewer-prev')?.addEventListener('click', () => navigateImageViewer(-1));
  document.getElementById('image-viewer-next')?.addEventListener('click', () => navigateImageViewer(1));
  document.getElementById('image-viewer-img')?.addEventListener('dblclick', () => {
    const img = document.getElementById('image-viewer-img');
    if (img) {
      imageViewerZoomed = !imageViewerZoomed;
      if (imageViewerZoomed) {
        img.style.transform = 'scale(2)';
        img.style.cursor = 'zoom-out';
      } else {
        img.style.transform = '';
        img.style.cursor = 'default';
      }
    }
  });
  document.getElementById('image-viewer-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeImageViewer();
  });
  document.addEventListener('keydown', e => {
    const modal = document.getElementById('image-viewer-modal');
    if (modal && !modal.classList.contains('hidden')) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); navigateImageViewer(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); navigateImageViewer(1); }
      else if (e.key === 'Escape') { e.preventDefault(); closeImageViewer(); }
    }
  });

  // 委任クリック（フィード内全て）
  document.addEventListener('click', handleDelegatedClick);
  document.addEventListener('click', handleExternalLinkGuard, true);
  document.addEventListener('keydown', handleGlobalKeydown);
  document.addEventListener('visibilitychange', handleVisibilityForNotifPoll);
  window.addEventListener('online', flushQueuedPosts);
  ['click', 'keydown', 'pointerdown', 'touchstart', 'scroll'].forEach(evt => {
    document.addEventListener(evt, resetInactivityTimer, { passive: true });
  });
}

async function handleLogin() {
  const handleInput = document.getElementById('login-handle');
  const handle = String(handleInput?.value || '');
  const normalizedHandle = handle.replace(/^@/, '').trim();
  const pass   = document.getElementById('login-password').value;
  const btn    = document.getElementById('login-btn');
  const errEl  = document.getElementById('login-error');
  errEl.classList.add('hidden');

  if (normalizedHandle === ADVANCED_MODE_CODE) {
    setAdvancedModeEnabled(true);
    if (handleInput) handleInput.value = '';
    document.getElementById('login-password').value = '';
    showToast('拡張モードを有効化しました', 'success', 1400);
    return;
  }

  const connResult = applyConnectionModeFromUi('login');
  if (!connResult.ok) {
    errEl.textContent = connResult.message;
    errEl.classList.remove('hidden');
    return;
  }
  if (!handle || !pass) { errEl.textContent = 'ハンドルとアプリパスワードを入力してください'; errEl.classList.remove('hidden'); return; }
  setLoading(btn, true);
  const t0 = performance.now();
  try {
    const sess = await apiLogin(handle, pass);
    saveSession(sess); S.session = sess;
    showApp();
    syncSubTabUi();
    syncExperienceUi();
    await loadMyProfile();
    restoreComposeCache();
    const bootTab = getAdaptiveBootTab();
    switchTab(bootTab);
    await loadTab(bootTab);
    startNotifPoll();
    resetInactivityTimer();
    flushQueuedPosts();
    trackPerfMetric('auth:login', performance.now() - t0);
    document.getElementById('login-password').value = '';
  } catch(e) {
    errEl.innerHTML = escapeHtml(e.message).replace(/\n/g, '<br>');
    errEl.classList.remove('hidden');
  } finally { setLoading(btn, false); }
}

async function runProbe(label, url, opts = {}) {
  const acceptStatuses = Array.isArray(opts.acceptStatuses) ? opts.acceptStatuses : [];
  const start = performance.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { method: 'GET', cache: 'no-store', signal: ctrl.signal });
    const elapsed = Math.round(performance.now() - start);
    clearTimeout(timer);
    const effectiveOk = res.ok || acceptStatuses.includes(res.status);
    return {
      label,
      ok: res.ok,
      effectiveOk,
      status: res.status,
      statusText: res.statusText || '',
      elapsed,
      note: res.ok
        ? 'OK'
        : (effectiveOk ? `到達OK（許容ステータス: ${res.status}）` : '応答あり（エラー系ステータス）'),
    };
  } catch (e) {
    const elapsed = Math.round(performance.now() - start);
    clearTimeout(timer);
    // Safariでの「Load failed」はCORS/ポリシー失敗のことが多い。
    try {
      const c2 = new AbortController();
      const t2 = setTimeout(() => c2.abort(), 5000);
      await fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store', signal: c2.signal });
      clearTimeout(t2);
      return {
        label,
        ok: false,
        effectiveOk: false,
        status: 'OPAQUE',
        statusText: '',
        elapsed,
        note: '到達は可能だが CORS/ブラウザポリシーで詳細取得不可',
      };
    } catch {}
    const detail = e?.name === 'AbortError'
      ? 'timeout'
      : (e?.message || 'network/cors error');
    return {
      label,
      ok: false,
      effectiveOk: false,
      status: 'ERR',
      statusText: '',
      elapsed,
      note: `接続失敗: ${detail}`,
    };
  }
}

function renderLoginCheckResult(lines, level) {
  const box = document.getElementById('login-check-result');
  if (!box) return;
  box.classList.remove('hidden', 'ok', 'warn', 'err');
  box.classList.add(level);
  box.textContent = lines.join('\n');
}

async function handleLoginConnectivityCheck() {
  const btn = document.getElementById('login-check-btn');
  const handleInput = document.getElementById('login-handle');
  if (!btn) return;
  setLoading(btn, true);
  try {
    const now = new Date();
    const lines = [`接続診断: ${now.toLocaleString('ja-JP')}`];
    const ua = navigator.userAgent || 'unknown';
    lines.push(`- Browser: ${ua}`);

    // Safariのプライベートモード等で起きるストレージ制限の診断
    try {
      const k = '__skywebpro_storage_probe__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      lines.push('- Storage: OK (localStorage writable)');
    } catch (e) {
      lines.push(`- Storage: WARN (${e?.name || 'StorageError'}) localStorageが制限されています`);
    }

    const cfg = getSafeConnectionConfig();
    const rawHandle = String(handleInput?.value || '').replace(/^@/, '').trim();
    let targets = null;
    try {
      if (typeof getConnectivityProbeTargets === 'function') {
        targets = getConnectivityProbeTargets(rawHandle);
      }
    } catch (e) {
      lines.push(`- 接続設定: ${e?.message || '設定エラー'}`);
      renderLoginCheckResult(lines, 'err');
      return;
    }
    if (!targets) {
      if (cfg.mode === 'proxy') {
        const base = String(cfg.proxyBase || '').replace(/\/+$/, '');
        if (!base) {
          lines.push('- 接続設定: XServerベースURLが未設定です。');
          renderLoginCheckResult(lines, 'err');
          return;
        }
        const root = `${base}/xrpc`;
        targets = {
          publicApi: `${root}/com.atproto.server.describeServer`,
          chatApi: `${root}/chat.bsky.convo.listConvos?limit=1`,
          resolveHandle: rawHandle
            ? `${root}/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(rawHandle)}`
            : '',
        };
      } else {
        targets = {
          publicApi: 'https://bsky.social/xrpc/com.atproto.server.describeServer',
          chatApi: 'https://api.bsky.chat/xrpc/chat.bsky.convo.listConvos?limit=1',
          resolveHandle: rawHandle
            ? `https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(rawHandle)}`
            : '',
        };
      }
    }

    const probes = await Promise.all([
      runProbe('Public API', targets.publicApi),
      runProbe('Chat API', targets.chatApi, { acceptStatuses: [401, 403] }),
    ]);

    probes.forEach(p => {
      lines.push(`- ${p.label}: ${p.status} ${p.statusText} (${p.elapsed}ms) / ${p.note}`.trim());
    });
    const chatProbe = probes.find(p => p.label === 'Chat API');
    if (chatProbe && (chatProbe.status === 401 || chatProbe.status === 403)) {
      lines.push('- Chat API補足: 未ログイン/DM権限なしでは401/403が返るため、到達確認としては正常です。');
    }

    if (rawHandle) {
      const resolveUrl = targets.resolveHandle;
      if (!resolveUrl) {
        lines.push('- Handle Resolve: スキップ（接続先未設定）');
        renderLoginCheckResult(lines, 'warn');
        console.info('[connectivity-check]', lines.join(' | '));
        return;
      }
      const h = await runProbe('Handle Resolve', resolveUrl);
      lines.push(`- Handle Resolve: ${h.status} ${h.statusText} (${h.elapsed}ms) / ${h.note}`.trim());
      if (h.ok) {
        try {
          const resp = await fetch(resolveUrl, { method: 'GET', cache: 'no-store' });
          const data = await resp.json().catch(() => ({}));
          if (data?.did) lines.push(`  DID: ${data.did}`);
        } catch {}
      }
    } else {
      lines.push('- Handle Resolve: スキップ（ハンドル未入力）');
    }

    const allOk = probes.every(p => p.effectiveOk === true);
    const someOk = probes.some(p => p.effectiveOk === true || p.status === 'OPAQUE');
    const hasOpaque = probes.some(p => p.status === 'OPAQUE');
    const level = allOk ? 'ok' : someOk ? 'warn' : 'err';
    if (level === 'ok') lines.push('判定: 主要サーバーへ正常に接続できています。');
    else if (level === 'warn' && hasOpaque) lines.push('判定: サーバー到達は可能ですが、SafariのCORS/追跡防止設定で遮断されている可能性があります。');
    else if (level === 'warn') lines.push('判定: 一部接続に問題があります。GitHub Pages配信時はCORS/ネットワーク制約の可能性があります。');
    else lines.push('判定: サーバーへ接続できません。回線・DNS・CSP設定を確認してください。');

    renderLoginCheckResult(lines, level);
    console.info('[connectivity-check]', lines.join(' | '));
  } finally {
    setLoading(btn, false);
  }
}

// =============================================
//  委任クリックハンドラー（全フィード共通）
// =============================================
function handleDelegatedClick(e) {
  const emptyActionBtn = e.target.closest('[data-empty-action]');
  if (emptyActionBtn) {
    const action = String(emptyActionBtn.dataset.emptyAction || '').trim();
    const inp = document.getElementById('search-input');
    if (action === 'home') {
      switchTab('home');
      return;
    }
    if (action === 'search') {
      switchTab('search');
      switchSearchTab('posts');
      inp?.focus();
      return;
    }
    if (action === 'search-latest') {
      switchTab('search');
      switchSearchTab('latest');
      if (inp?.value?.trim()) execSearch(inp.value.trim());
      return;
    }
    if (action === 'search-posts') {
      switchTab('search');
      switchSearchTab('posts');
      if (inp?.value?.trim()) execSearch(inp.value.trim());
      return;
    }
    if (action === 'trend-all') {
      switchTab('search');
      switchSearchTab('trends');
      setTrendCategory('all');
      execSearch('');
      return;
    }
  }

  const markReadBtn = e.target.closest('[data-mark-read="1"]');
  if (markReadBtn) {
    markNotificationsAsReadLocal({
      reason: markReadBtn.dataset.markReason,
      subject: markReadBtn.dataset.markSubject,
      indexedAt: markReadBtn.dataset.markIndexedAt,
      authorDid: markReadBtn.dataset.markAuthorDid,
    });
    renderNotifList();
    checkNotif();
    return;
  }

  const dmReadToggle = e.target.closest('[data-dm-toggle-read]');
  if (dmReadToggle) {
    e.preventDefault();
    e.stopPropagation();
    toggleDmReadStateById(dmReadToggle.dataset.dmToggleRead);
    return;
  }

  const loadImagesBtn = e.target.closest('.load-images-btn');
  if (loadImagesBtn) {
    const container = loadImagesBtn.closest('.post-images');
    if (container) {
      container.querySelectorAll('img[data-src]').forEach(img => {
        img.src = img.dataset.src || '';
        img.removeAttribute('data-src');
      });
      container.querySelectorAll('.img-item.hidden').forEach(el => el.classList.remove('hidden'));
      loadImagesBtn.closest('.post-images-blocked')?.remove();
    }
    return;
  }

  // 画像をクリック
  const imgItem = e.target.closest('.post-images .img-item');
  if (imgItem) {
    const container = e.target.closest('.post-images');
    if (container && container.dataset.imagesJson) {
      try {
        const images = JSON.parse(container.dataset.imagesJson);
        const idx = parseInt(imgItem.dataset.imgIndex || '0');
        openImageViewer(images, idx);
        e.preventDefault();
        e.stopPropagation();
        return;
      } catch (err) { console.error('画像データ解析エラー:', err); }
    }
  }

  // プロフィール画像・バナーをクリック
  const profileImg = e.target.closest('[data-profile-img-click]');
  if (profileImg && profileImg.tagName === 'IMG') {
    const src = profileImg.src || profileImg.dataset.profileImgSrc;
    if (src) {
      openImageViewer([{fullsize: src}], 0);
      e.preventDefault();
      e.stopPropagation();
      return;
    }
  }
  const profileBanner = e.target.closest('[data-profile-banner-click]');
  if (profileBanner) {
    const bgImg = window.getComputedStyle(profileBanner).backgroundImage;
    if (bgImg && bgImg !== 'none') {
      const match = bgImg.match(/url\(["']?([^"'()]+)["']?\)/);
      if (match && match[1]) {
        openImageViewer([{fullsize: match[1]}], 0);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }
  }

  const hashLink = e.target.closest('[data-hashtag-search]');
  if (hashLink) {
    e.preventDefault();
    const tag = String(hashLink.dataset.hashtagSearch || '').trim();
    const term = tag ? `#${tag.replace(/^#/, '')}` : '';
    if (term) {
      const inp = document.getElementById('search-input');
      if (inp) inp.value = term;
      switchTab('search');
      switchSearchTab('latest');
      updateSearchClearButton();
      execSearch(term);
    }
    return;
  }

  const dmStartBtn = e.target.closest('[data-dm-start-did]');
  if (dmStartBtn) {
    startDmWithDid(dmStartBtn.dataset.dmStartDid);
    return;
  }

  const trendBtn = e.target.closest('[data-trend-tag]');
  if (trendBtn) {
    const term = String(trendBtn.dataset.trendTag || '').trim();
    const inp = document.getElementById('search-input');
    if (term && inp) {
      inp.value = term;
      switchSearchTab('latest');
      updateSearchClearButton();
      execSearch(term);
    }
    return;
  }

  const searchChip = e.target.closest('[data-search-item]');
  if (searchChip) {
    const q = searchChip.dataset.searchItem || '';
    const inp = document.getElementById('search-input');
    if (inp && q) {
      inp.value = q;
      updateSearchClearButton();
      execSearch(q);
    }
    return;
  }

  const hashtagInsert = e.target.closest('[data-hashtag-insert]');
  if (hashtagInsert) {
    const ta = document.getElementById('compose-text');
    const tag = String(hashtagInsert.dataset.hashtagInsert || '').trim();
    if (ta && tag) {
      const hasTag = ta.value.includes(tag);
      ta.value = hasTag ? ta.value : `${ta.value}${ta.value ? ' ' : ''}${tag}`;
      updateCharCount();
      renderComposeHashtagSuggestions();
      cacheComposeState();
      ta.focus();
    }
    return;
  }
  // 返信ボタン
  const replyBtn = e.target.closest('.reply-btn');
  if (replyBtn) {
    setReply(replyBtn.dataset.uri, replyBtn.dataset.cid, replyBtn.dataset.handle);
    document.getElementById('compose-area').scrollIntoView({ behavior: 'smooth' });
    return;
  }
  // いいね
  const likeBtn = e.target.closest('.like-btn');
  if (likeBtn) { handleLike(likeBtn); return; }
  // リポスト
  const repostBtn = e.target.closest('.repost-btn');
  if (repostBtn) { handleRepost(repostBtn); return; }
  // 引用リポスト表示トグル
  const quoteBtn = e.target.closest('.quote-btn');
  if (quoteBtn) {
    const rkey = quoteBtn.closest('.post-card')?.querySelector('.quote-post-btn')?.dataset.rkey
               || quoteBtn.dataset.uri?.split('/').pop();
    const qc = document.getElementById(`qc-${rkey}`);
    if (qc) qc.classList.toggle('hidden');
    return;
  }
  // 引用投稿確定
  const quotePostBtn = e.target.closest('.quote-post-btn');
  if (quotePostBtn) { handleQuotePost(quotePostBtn); return; }
  // 引用キャンセル
  const quoteCancelBtn = e.target.closest('.quote-cancel-btn');
  if (quoteCancelBtn) {
    const qc = document.getElementById(`qc-${quoteCancelBtn.dataset.rkey}`);
    if (qc) qc.classList.add('hidden');
    return;
  }
  // 返信スレッド表示トグル
  const threadBtn = e.target.closest('.thread-toggle-btn');
  if (threadBtn) {
    const card = threadBtn.closest('.post-card');
    const uri  = card?.dataset.uri;
    const rkey = uri?.split('/').pop();
    const container = document.getElementById(`replies-${rkey}`);
    if (container) toggleReplies(uri, container, threadBtn);
    return;
  }
  // 「他N件の返信を表示」
  const moreBtn = e.target.closest('.show-more-replies-btn');
  if (moreBtn) {
    const step = Math.max(1, Number(moreBtn.dataset.step || 3));
    const moreWrap = moreBtn.closest('.thread-more');
    const moreContainer = moreWrap?.previousElementSibling;
    if (moreContainer) {
      const hiddenItems = [...moreContainer.querySelectorAll('.more-reply-item.hidden')];
      hiddenItems.slice(0, step).forEach(el => el.classList.remove('hidden'));
      const remain = moreContainer.querySelectorAll('.more-reply-item.hidden').length;
      if (remain > 0) {
        moreBtn.dataset.count = String(remain);
        moreBtn.textContent = `他 ${remain} 件の返信を表示`;
      } else {
        moreWrap?.remove();
      }
    }
    return;
  }

  const notifActorsToggle = e.target.closest('.notif-actors-toggle');
  if (notifActorsToggle) {
    const wrap = notifActorsToggle.closest('.notif-actors-wrap');
    const collapsed = wrap?.querySelector('.notif-actors-collapsed');
    const expanded = wrap?.querySelector('.notif-actors-expanded');
    if (notifActorsToggle.dataset.action === 'expand') {
      collapsed?.classList.add('hidden');
      expanded?.classList.remove('hidden');
    } else {
      expanded?.classList.add('hidden');
      collapsed?.classList.remove('hidden');
    }
    return;
  }

  // 削除
  const deleteBtn = e.target.closest('.delete-btn');
  if (deleteBtn) { openDeleteModal(deleteBtn.dataset.uri); return; }
  // フォロートグル
  const followBtn = e.target.closest('.follow-toggle-btn');
  if (followBtn) { handleFollowToggle(followBtn); return; }
  // リストフィード
  const listBtn = e.target.closest('[data-list-uri]');
  if (listBtn && listBtn.tagName === 'BUTTON') {
    openListFeed(listBtn.dataset.listUri, listBtn.dataset.listName || 'リスト');
    return;
  }
  // DM会話
  const dmCard = e.target.closest('.dm-convo-card');
  if (dmCard) { openConvo(dmCard.dataset.convoId); return; }
  // もっと読む
  const moreLoadBtn = e.target.closest('.load-more-btn');
  if (moreLoadBtn) { handleLoadMore(moreLoadBtn); return; }
  // 下書き操作
  const draftBtn = e.target.closest('[data-draft-action]');
  if (draftBtn) {
    const draft = getDrafts().find(d => d.id === +draftBtn.dataset.draftId);
    if (draftBtn.dataset.draftAction === 'use' && draft) {
      document.getElementById('compose-text').value = draft.text;
      updateCharCount();
      cacheComposeState();
      document.getElementById('drafts-panel').classList.add('hidden');
    } else if (draftBtn.dataset.draftAction === 'del') {
      deleteDraft(+draftBtn.dataset.draftId);
      renderDraftsPanel();
    }
    return;
  }
  // クイックメモ履歴
  const noteBtn = e.target.closest('[data-note-action]');
  if (noteBtn) {
    const idx = Number(noteBtn.dataset.noteIndex || '-1');
    if (noteBtn.dataset.noteAction === 'use') useQuickNoteByIndex(idx);
    if (noteBtn.dataset.noteAction === 'delete') deleteQuickNoteByIndex(idx);
    return;
  }
  // 名前・アバタークリック → 他人プロフィール
  const nameEl = e.target.closest('.clickable-name, .post-name, .post-avatar, .notif-avatar, .user-card-av');
  if (nameEl) {
    const handle = nameEl.dataset.handle;
    const did    = nameEl.dataset.did;
    const myDid  = S.session?.did;
    if (handle && did !== myDid) { openUserProfile(handle); return; }
    if (did && did === myDid)    { switchTab('profile'); return; }
  }
}

document.addEventListener('DOMContentLoaded', init);
