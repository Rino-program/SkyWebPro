/**
 * SkyDeck — app.js  v3.0
 */

const S = {
  session: null, myProfile: null,
  tab: 'home', homeSubTab: 'following', notifSubTab: 'all', searchTab: 'posts',
  replyTarget: null, pendingImgs: [], quickPendingImgs: [], deleteTarget: null,
  cursors: {}, loading: {},
  activeConvoId: null,
  cachedNotifs: [],
  statsRange: 'week',
};

const QUICK_NOTE_KEY = 'skydeck_quick_note_v1';
const QUICK_NOTE_LIST_KEY = 'skydeck_quick_note_list_v1';
const THEME_KEY = 'skydeck_theme_v1';
const APP_MAX_IMAGE_BYTES = 1000000;
const RIGHT_PANEL_PREFS_KEY = 'skydeck_right_panel_prefs_v1';
const POST_HISTORY_KEY = 'skydeck_post_history_v1';
const ADMIN_REPORT_HANDLE = 'rino-program.bsky.social';
const LOGIN_CONSOLE_MAX_LINES = 200;
const APP_MEMORY_STORAGE = new Map();

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

function formatLogArg(v) {
  if (v instanceof Error) return v.stack || v.message;
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v); } catch { return String(v); }
}

function appendLoginConsole(level, args) {
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
  if (window.__skydeckLoginConsoleInstalled) return;
  window.__skydeckLoginConsoleInstalled = true;

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
  out.textContent = '[SkyDeck] login console cleared';
}

// =============================================
//  console.error のポップアップ表示
// =============================================
(function () {
  const _origError = console.error.bind(console);
  console.error = function (...args) {
    _origError(...args);
    const msg = args
      .map(a => (a instanceof Error ? a.message : String(a ?? '')))
      .join(' ')
      .trim();
    if (msg && typeof showToast === 'function') showToast(msg, 'error', 5000);
  };
})();

// =============================================
//  初期化
// =============================================
async function init() {
  installLoginConsoleCapture();
  applySavedTheme();
  const sess = loadSession();
  if (sess) {
    S.session = sess;
    showApp();
    await loadMyProfile();
    await loadTab('home');
    startNotifPoll();
  } else {
    showLogin();
  }
  bindAll();
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
  ta.value = next.slice(0, 320);
  updateCharCount();
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
  if (mode === 'dark') html.setAttribute('data-theme', 'dark');
  else html.removeAttribute('data-theme');
  safeStorageSet(THEME_KEY, mode);
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.textContent = mode === 'dark' ? 'ライトへ' : 'ダークへ';
}

function applySavedTheme() {
  const saved = safeStorageGet(THEME_KEY) || 'light';
  applyTheme(saved === 'dark' ? 'dark' : 'light');
}

function toggleThemeMode() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  applyTheme(isDark ? 'light' : 'dark');
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
    set('prof-desc', p.description || '');
    set('prof-following', p.followsCount || 0);
    set('prof-followers', p.followersCount || 0);
    set('prof-posts', p.postsCount || 0);
    const banner = document.getElementById('prof-banner-img');
    if (banner) {
      if (p.banner) {
        banner.style.backgroundImage = `url(${p.banner})`;
        banner.style.backgroundSize = 'auto 100%';
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
  } catch(e) { console.error('プロフィール取得失敗:', e); }
}

// =============================================
//  タブ
// =============================================
function switchTab(tab) {
  S.tab = tab;
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-section').forEach(s => {
    const isActive = s.id === `tab-${tab}`;
    s.classList.toggle('active', isActive);
    s.classList.toggle('hidden', !isActive);
  });
  if (tab === 'notifications') { document.getElementById('notif-badge').classList.add('hidden'); apiUpdateNotificationSeen(); }
  const feedIds = { home:'home-feed', notifications:'notif-feed', search:'search-feed', dm:'dm-list', lists:'lists-feed', profile:'profile-feed' };
  const feedId = feedIds[tab];
  if (feedId && document.getElementById(feedId)?.childElementCount === 0) loadTab(tab);
}

async function loadTab(tab) {
  if (S.loading[tab]) return; S.loading[tab] = true;
  try {
    if (tab === 'home')          await loadHome();
    else if (tab === 'notifications') await loadNotifications();
    else if (tab === 'search')   { /* 検索は手動入力で動作 */ }
    else if (tab === 'profile')  await loadProfile();
    else if (tab === 'lists')    await loadLists();
    else if (tab === 'dm')       await loadDM();
    else if (tab === 'settings') { /* 設定タブは静的HTML */ }
  } catch(e) { showToast(e.message, 'error'); }
  finally { S.loading[tab] = false; }
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
  feed.innerHTML = renderSpinner();
  let data;
  if (S.homeSubTab === 'discover') data = await withAuth(() => apiGetDiscover(null));
  else data = await withAuth(() => apiGetTimeline(null));
  S.cursors['home'] = data.cursor || null;
  feed.innerHTML = '';
  if (!data.feed?.length) { feed.innerHTML = renderEmpty('タイムラインに投稿がありません'); return; }
  const myDid = S.session?.did;
  data.feed.forEach(item => appendCards(feed, renderPostCard(item, myDid)));
  if (data.cursor) addLoadMoreBtn(feed, 'home');
}

function switchHomeSubTab(sub) {
  S.homeSubTab = sub; S.cursors['home'] = null;
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
  const data = await withAuth(() => apiGetNotifications(null));
  S.cachedNotifs = data.notifications || [];
  S.cursors['notifications'] = data.cursor || null;
  renderNotifList();
}

function switchNotifSubTab(sub) {
  S.notifSubTab = sub;
  document.querySelectorAll('#tab-notifications .sub-tab').forEach(b => b.classList.toggle('active', b.dataset.sub === sub));
  renderNotifList();
}

function renderNotifList() {
  const feed = document.getElementById('notif-feed');
  feed.innerHTML = '';
  let list = S.cachedNotifs;
  if (S.notifSubTab === 'mention') list = list.filter(n => n.reason === 'mention' || n.reason === 'reply');
  if (!list.length) { feed.innerHTML = renderEmpty('通知はありません'); return; }
  list.forEach(n => appendCards(feed, renderNotifCard(n)));
  if (S.cursors['notifications']) addLoadMoreBtn(feed, 'notifications');
}

// =============================================
//  プロフィール（自分）
// =============================================
async function loadProfile() {
  const feed = document.getElementById('profile-feed');
  feed.innerHTML = renderSpinner();
  const actor = S.myProfile?.handle || S.session?.handle;
  const data = await withAuth(() => apiGetAuthorFeed(actor, 'posts_no_replies', null));
  S.cursors['profile'] = data.cursor || null;
  feed.innerHTML = '';
  if (!data.feed?.length) { feed.innerHTML = renderEmpty('投稿がありません'); return; }
  const myDid = S.session?.did;
  data.feed.forEach(item => appendCards(feed, renderPostCard(item, myDid)));
  if (data.cursor) addLoadMoreBtn(feed, 'profile');
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
    content.innerHTML = renderProfilePanel(profile);

    // 投稿を読み込む
    const feedEl = document.getElementById('user-profile-feed');
    if (feedEl) {
      feedEl.innerHTML = renderSpinner();
      const data = await withAuth(() => apiGetAuthorFeed(profile.handle, 'posts_no_replies', null));
      feedEl.innerHTML = '';
      if (!data.feed?.length) { feedEl.innerHTML = renderEmpty('投稿がありません'); return; }
      const myDid = S.session?.did;
      data.feed.forEach(item => appendCards(feedEl, renderPostCard(item, myDid)));
    }
  } catch(e) {
    content.innerHTML = renderEmpty(`プロフィールの取得に失敗しました: ${e.message}`);
  }
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
    containerEl.innerHTML = '';

    if (!thread.replies?.length) {
      containerEl.innerHTML = '<div class="no-replies">返信はありません</div>';
    } else {
      thread.replies.forEach(reply => {
        appendCards(containerEl, renderThreadNode(reply, myDid, 1));
      });
    }
    containerEl.classList.remove('hidden');
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>`;
  } catch(e) {
    showToast(e.message, 'error');
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
    list.innerHTML = '';
    if (!data.convos?.length) { list.innerHTML = renderEmpty('DMはありません'); return; }
    data.convos.forEach(c => {
      const other = (c.members||[]).find(m => m.did !== S.session?.did);
      if (!other) return;
      appendCards(list, `<div class="dm-convo-card" data-convo-id="${escapeHtml(c.id)}">
        <img class="dm-avatar" src="${escapeHtml(other.avatar||'')}" alt="" onerror="this.src=''"/>
        <div class="dm-info">
          <div class="dm-name">${escapeHtml(other.displayName||other.handle)}</div>
          <div class="dm-preview">${c.lastMessage?.text ? escapeHtml(c.lastMessage.text.slice(0,40)) : ''}</div>
        </div>
        ${(c.unreadCount||0)>0 ? `<span class="dm-badge">${c.unreadCount}</span>` : ''}
      </div>`);
    });
  } catch(e) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">💬</div>
      <div style="font-size:.85rem;line-height:1.7">${escapeHtml(e.message)}</div>
      ${e.message.includes('アプリパスワード') ? `<a href="https://bsky.app/settings/app-passwords" target="_blank" style="margin-top:8px;display:inline-block">アプリパスワードを再発行する↗</a>` : ''}
    </div>`;
  }
}

async function openConvo(convoId) {
  S.activeConvoId = convoId;
  document.getElementById('dm-chat-panel').classList.remove('hidden');
  const msgs = document.getElementById('dm-messages');
  msgs.innerHTML = renderSpinner();
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
  } catch(e) { msgs.innerHTML = renderEmpty(e.message); }
}

async function sendDM() {
  const inp = document.getElementById('dm-input');
  const text = inp.value.trim();
  if (!text || !S.activeConvoId) return;
  inp.value = '';
  try { await withAuth(() => apiSendMessage(S.activeConvoId, text)); await openConvo(S.activeConvoId); }
  catch(e) { showToast(e.message, 'error'); }
}

// =============================================
//  検索
// =============================================
let searchTimer = null;
function handleSearchInput(q) {
  clearTimeout(searchTimer);
  if (!q.trim()) { document.getElementById('search-feed').innerHTML = ''; return; }
  searchTimer = setTimeout(() => execSearch(q.trim()), 500);
}

function switchSearchTab(sub) {
  S.searchTab = sub;
  document.querySelectorAll('#tab-search .sub-tab').forEach(b => b.classList.toggle('active', b.dataset.sub === sub));
  const q = document.getElementById('search-input').value.trim();
  if (q) execSearch(q);
}

async function execSearch(q) {
  const feed = document.getElementById('search-feed');
  feed.innerHTML = renderSpinner();
  try {
    if (S.searchTab === 'posts') {
      const data = await withAuth(() => apiSearchPosts(q, null));
      feed.innerHTML = '';
      if (!data.posts?.length) { feed.innerHTML = renderEmpty('投稿が見つかりません'); return; }
      const myDid = S.session?.did;
      data.posts.forEach(p => appendCards(feed, renderPostCard({ post: p }, myDid)));
    } else {
      const data = await withAuth(() => apiSearchActors(q, null));
      feed.innerHTML = '';
      if (!data.actors?.length) { feed.innerHTML = renderEmpty('ユーザーが見つかりません'); return; }
      data.actors.forEach(a => appendCards(feed, renderUserCard(a, true)));
    }
  } catch(e) { feed.innerHTML = renderEmpty(e.message); }
}

// =============================================
//  投稿
// =============================================
function updateCharCount() {
  const t = document.getElementById('compose-text').value;
  const r = 320 - [...t].length;
  const el = document.getElementById('char-count');
  el.textContent = r;
  el.className = 'char-count' + (r <= 20 ? ' warn' : '') + (r < 0 ? ' danger' : '');
}

function handleImageSelect(e) {
  const files = Array.from(e.target.files);
  const rem = 4 - S.pendingImgs.length;
  const validImages = files.filter(f => f.type.startsWith('image/'));
  const sizeOk = validImages.filter(f => f.size <= APP_MAX_IMAGE_BYTES);
  const rejected = validImages.length - sizeOk.length;
  S.pendingImgs.push(...sizeOk.slice(0, rem));
  if (rejected > 0) showToast(`1MBを超える画像を ${rejected} 枚除外しました`, 'info');
  if (sizeOk.length > rem) showToast(`画像は最大4枚です。${Math.max(0,rem)}枚追加しました。`, 'info');
  renderPreviews();
  refreshRightStats();
  e.target.value = '';
}

function handleQuickImageSelect(e) {
  const files = Array.from(e.target.files);
  const rem = 4 - S.quickPendingImgs.length;
  const validImages = files.filter(f => f.type.startsWith('image/'));
  const sizeOk = validImages.filter(f => f.size <= APP_MAX_IMAGE_BYTES);
  const rejected = validImages.length - sizeOk.length;
  S.quickPendingImgs.push(...sizeOk.slice(0, rem));
  if (rejected > 0) showToast(`1MBを超える画像を ${rejected} 枚除外しました`, 'info');
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

async function handlePost() {
  const ta   = document.getElementById('compose-text');
  const text = ta.value.trim();
  const btn  = document.getElementById('post-btn');
  const restriction = document.getElementById('reply-restriction').value;
  if (!text && !S.pendingImgs.length) { showToast('テキストまたは画像を入力してください', 'error'); return; }
  if ([...text].length > 320) { showToast('320文字以内にしてください', 'error'); return; }
  setLoading(btn, true);
  try {
    await withAuth(() => apiPost(text, S.pendingImgs, S.replyTarget, restriction));
    logPostActivity(text, S.pendingImgs.length);
    ta.value = ''; S.pendingImgs = []; renderPreviews(); cancelReply(); updateCharCount();
    showToast('投稿しました！', 'success');
    reloadTab('home');
    if (S.tab === 'profile') reloadTab('profile');
    refreshRightStats();
  } catch(e) { showToast(e.message, 'error'); }
  finally { setLoading(btn, false); }
}

function updateQuickPostCount() {
  const t = document.getElementById('quick-post-text')?.value || '';
  const r = 320 - [...t].length;
  const el = document.getElementById('quick-post-count');
  if (!el) return;
  el.textContent = r;
  el.className = 'char-count' + (r <= 20 ? ' warn' : '') + (r < 0 ? ' danger' : '');
}

function openQuickPostModal() {
  const modal = document.getElementById('quick-post-modal');
  const ta = document.getElementById('quick-post-text');
  if (!modal || !ta) return;
  modal.classList.remove('hidden');
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
  document.getElementById('quick-post-modal')?.classList.add('hidden');
}

async function handleQuickPost() {
  const ta = document.getElementById('quick-post-text');
  const btn = document.getElementById('quick-post-submit');
  const text = ta?.value.trim() || '';
  const restriction = document.getElementById('quick-post-restriction')?.value || 'everybody';
  if (!text && !S.quickPendingImgs.length) { showToast('テキストまたは画像を入力してください', 'error'); return; }
  if ([...text].length > 320) { showToast('320文字以内にしてください', 'error'); return; }
  setLoading(btn, true);
  try {
    await withAuth(() => apiPost(text, S.quickPendingImgs, null, restriction));
    logPostActivity(text, S.quickPendingImgs.length);
    closeQuickPostModal();
    showToast('投稿しました！', 'success');
    await reloadTab('home');
    refreshRightStats();
  } catch (e) {
    showToast(e.message, 'error');
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
  ta.value = next.slice(0, 320);
  updateCharCount();
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
  } catch(e) { showToast(e.message, 'error'); }
  finally { setLoading(btn, false); }
}

// 下書き
function saveDraftAndClear() {
  const text = document.getElementById('compose-text').value.trim();
  if (!text) { showToast('テキストを入力してください', 'error'); return; }
  saveDraft(text);
  document.getElementById('compose-text').value = '';
  updateCharCount();
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
    showToast(e.message, 'error');
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
    showToast(e.message, 'error');
  }
}

async function handleFollowToggle(btn) {
  const { did, followUri } = btn.dataset;
  const following = btn.classList.contains('following');
  btn.disabled = true;
  try {
    if (following) { await withAuth(() => apiUnfollow(followUri)); btn.classList.remove('following'); btn.textContent = 'フォロー'; btn.dataset.followUri = ''; }
    else { const r = await withAuth(() => apiFollow(did)); btn.classList.add('following'); btn.textContent = 'フォロー中'; btn.dataset.followUri = r.uri || ''; }
  } catch(e) { showToast(e.message, 'error'); }
  finally { btn.disabled = false; }
}

// =============================================
//  削除
// =============================================
function openDeleteModal(uri) { S.deleteTarget = uri; document.getElementById('delete-modal').classList.remove('hidden'); }

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
    showToast('削除しました', 'success');
    document.getElementById('delete-modal').classList.add('hidden'); S.deleteTarget = null;
  } catch(e) { showToast(e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = '削除する'; }
}

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
  } catch(e) { showToast(e.message, 'error'); }
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
        : await withAuth(() => apiGetTimeline(cursor));
      btn.remove();
      data.feed?.forEach(i => appendCards(feed, renderPostCard(i, myDid)));
      S.cursors[tab] = data.cursor || null;
      if (data.cursor) addLoadMoreBtn(feed, tab);
    } else if (tab === 'profile') {
      const actor = S.myProfile?.handle;
      const data = await withAuth(() => apiGetAuthorFeed(actor, 'posts_no_replies', cursor));
      btn.remove();
      data.feed?.forEach(i => appendCards(feed, renderPostCard(i, myDid)));
      S.cursors[tab] = data.cursor || null;
      if (data.cursor) addLoadMoreBtn(feed, tab);
    } else if (tab === 'notifications') {
      const data = await withAuth(() => apiGetNotifications(cursor));
      S.cachedNotifs = [...S.cachedNotifs, ...(data.notifications || [])];
      S.cursors[tab] = data.cursor || null;
      btn.remove();
      renderNotifList();
    }
  } catch(e) { showToast(e.message, 'error'); btn.textContent = 'もっと読み込む'; btn.disabled = false; }
  finally { S.loading[tab] = false; }
}

// =============================================
//  通知ポーリング
// =============================================
let notifInterval = null;
async function checkNotif() {
  try {
    const d = await withAuth(() => apiGetUnreadCount());
    const n = d.count || 0;
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    if (n > 0) { badge.textContent = n > 99 ? '99+' : n; badge.classList.remove('hidden'); }
    else badge.classList.add('hidden');
  } catch {}
}
function startNotifPoll() { checkNotif(); notifInterval = setInterval(checkNotif, 30000); }
function stopNotifPoll()  { clearInterval(notifInterval); notifInterval = null; }

function handleLogout() {
  clearSession(); S.session = null; S.myProfile = null;
  stopNotifPoll();
  document.querySelectorAll('.feed').forEach(f => f.innerHTML = '');
  Object.keys(S.cursors).forEach(k => delete S.cursors[k]);
  showLogin();
}

// =============================================
//  イベント一括バインド
// =============================================
function bindAll() {
  // ログイン
  document.getElementById('login-btn').addEventListener('click', handleLogin);
  document.getElementById('login-check-btn')?.addEventListener('click', handleLoginConnectivityCheck);
  document.getElementById('login-console-clear')?.addEventListener('click', clearLoginConsole);
  document.getElementById('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });

  // ログアウト
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  // ナビ
  document.querySelectorAll('.nav-item').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  // サブタブ
  document.querySelectorAll('#tab-home .sub-tab').forEach(b => b.addEventListener('click', () => switchHomeSubTab(b.dataset.sub)));
  document.querySelectorAll('#tab-notifications .sub-tab').forEach(b => b.addEventListener('click', () => switchNotifSubTab(b.dataset.sub)));
  document.querySelectorAll('#tab-search .sub-tab').forEach(b => b.addEventListener('click', () => switchSearchTab(b.dataset.sub)));

  // リフレッシュ
  document.querySelectorAll('.refresh-btn').forEach(b => b.addEventListener('click', () => {
    b.classList.add('spinning');
    reloadTab(b.dataset.target).finally(() => setTimeout(() => b.classList.remove('spinning'), 500));
  }));

  // 検索
  document.getElementById('search-input').addEventListener('input', e => handleSearchInput(e.target.value));
  document.getElementById('search-input').addEventListener('keydown', e => { if (e.key === 'Enter') execSearch(e.target.value.trim()); });

  // compose
  document.getElementById('compose-text').addEventListener('input', updateCharCount);
  document.getElementById('compose-text').addEventListener('input', refreshRightStats);
  document.getElementById('compose-text').addEventListener('keydown', e => { if ((e.metaKey||e.ctrlKey) && e.key === 'Enter') handlePost(); });
  document.getElementById('image-input').addEventListener('change', handleImageSelect);
  document.getElementById('quick-post-image-input')?.addEventListener('change', handleQuickImageSelect);
  document.getElementById('post-btn').addEventListener('click', handlePost);
  document.getElementById('cancel-reply-btn').addEventListener('click', cancelReply);
  document.getElementById('save-draft-btn').addEventListener('click', saveDraftAndClear);
  document.getElementById('drafts-btn').addEventListener('click', toggleDrafts);

  // 左下クイック投稿
  document.getElementById('quick-post-fab')?.addEventListener('click', openQuickPostModal);
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
  document.getElementById('dm-send-btn').addEventListener('click', sendDM);
  document.getElementById('dm-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendDM(); } });
  document.getElementById('dm-back-btn').addEventListener('click', () => document.getElementById('dm-chat-panel').classList.add('hidden'));

  // リストバック
  document.getElementById('list-back-btn').addEventListener('click', () => document.getElementById('list-feed-container').classList.add('hidden'));

  // 設定画面のログアウト
  document.getElementById('settings-logout-btn')?.addEventListener('click', handleLogout);
  document.getElementById('theme-toggle-btn')?.addEventListener('click', toggleThemeMode);
  document.getElementById('settings-show-control-deck')?.addEventListener('change', onSettingsControlDeckChange);
  document.getElementById('settings-report-admin-btn')?.addEventListener('click', reportToAdmin);

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

  // 委任クリック（フィード内全て）
  document.addEventListener('click', handleDelegatedClick);
  document.addEventListener('click', handleExternalLinkGuard, true);
}

async function handleLogin() {
  const handle = document.getElementById('login-handle').value;
  const pass   = document.getElementById('login-password').value;
  const btn    = document.getElementById('login-btn');
  const errEl  = document.getElementById('login-error');
  errEl.classList.add('hidden');
  if (!handle || !pass) { errEl.textContent = 'ハンドルとアプリパスワードを入力してください'; errEl.classList.remove('hidden'); return; }
  setLoading(btn, true);
  try {
    const sess = await apiLogin(handle, pass);
    saveSession(sess); S.session = sess;
    showApp();
    await loadMyProfile();
    await loadTab('home');
    startNotifPoll();
    document.getElementById('login-password').value = '';
  } catch(e) {
    errEl.innerHTML = escapeHtml(e.message).replace(/\n/g, '<br>');
    errEl.classList.remove('hidden');
  } finally { setLoading(btn, false); }
}

async function runProbe(label, url) {
  const start = performance.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { method: 'GET', cache: 'no-store', signal: ctrl.signal });
    const elapsed = Math.round(performance.now() - start);
    clearTimeout(timer);
    return {
      label,
      ok: res.ok,
      status: res.status,
      statusText: res.statusText || '',
      elapsed,
      note: res.ok ? 'OK' : '応答あり（エラー系ステータス）',
    };
  } catch (e) {
    const elapsed = Math.round(performance.now() - start);
    clearTimeout(timer);
    const detail = e?.name === 'AbortError'
      ? 'timeout'
      : (e?.message || 'network/cors error');
    return {
      label,
      ok: false,
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

    // Safariのプライベートモード等で起きるストレージ制限の診断
    try {
      const k = '__skydeck_storage_probe__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      lines.push('- Storage: OK (localStorage writable)');
    } catch (e) {
      lines.push(`- Storage: WARN (${e?.name || 'StorageError'}) localStorageが制限されています`);
    }

    const probes = await Promise.all([
      runProbe('Public API', 'https://bsky.social/xrpc/com.atproto.server.describeServer'),
      runProbe('Chat API', 'https://api.bsky.chat/xrpc/chat.bsky.convo.listConvos?limit=1'),
    ]);

    probes.forEach(p => {
      lines.push(`- ${p.label}: ${p.status} ${p.statusText} (${p.elapsed}ms) / ${p.note}`.trim());
    });

    const rawHandle = String(handleInput?.value || '').replace(/^@/, '').trim();
    if (rawHandle) {
      const resolveUrl = `https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(rawHandle)}`;
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

    const allOk = probes.every(p => p.ok);
    const someOk = probes.some(p => p.ok);
    const level = allOk ? 'ok' : someOk ? 'warn' : 'err';
    if (level === 'ok') lines.push('判定: 主要サーバーへ正常に接続できています。');
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
    const moreContainer = moreBtn.closest('.thread-more')?.nextElementSibling;
    if (moreContainer) { moreContainer.classList.remove('hidden'); moreBtn.closest('.thread-more').remove(); }
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
