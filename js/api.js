/**
 * SkyWebPro — api.js  v1.0
 *
 * 【重要な仕様】
 * - app.bsky.* / com.atproto.*  → https://bsky.social/xrpc/...
 * - chat.bsky.*                 → ユーザーのPDS URL + /xrpc/...
 *                                 + ヘッダー: Atproto-Proxy: did:web:api.bsky.chat#bsky_chat
 * - DM用アプリパスワードには「ダイレクトメッセージへのアクセスを許可」が必要
 */

const DIRECT_BSKY_PUB = 'https://bsky.social/xrpc';
const DIRECT_BSKY_CHAT = 'https://api.bsky.chat/xrpc';
const CONNECTION_MODE_KEY = 'skywebpro_connection_mode_v1';
const CONNECTION_PROXY_BASE_KEY = 'skywebpro_connection_proxy_base_v1';
const CONNECTION_MODE_DIRECT = 'direct';
const CONNECTION_MODE_PROXY = 'proxy';
const SESSION_KEY = 'skywebpro_session_v1';
const DRAFTS_KEY  = 'skywebpro_drafts_v1';
const STORAGE_VERSION_KEY = 'skywebpro_storage_version';
const CURRENT_STORAGE_VERSION = 'v1';
const RELOGIN_REASON_KEY = 'skywebpro_relogin_reason';
const SESSION_SAVED_AT_KEY = 'skywebpro_session_saved_at';
const SESSION_ACCOUNTS_KEY = 'skywebpro_session_accounts_v1';
const ACTIVE_SESSION_DID_KEY = 'skywebpro_active_session_did_v1';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LEGACY_SESSION_KEYS = ['skywebpro_session_v3'];
const LEGACY_DRAFT_KEYS = ['skywebpro_drafts_v2'];
const MAX_IMAGE_BYTES = 2000000;
const IMAGE_UPLOAD_RETRY_ATTEMPTS = 2;
const API_MEMORY_STORAGE = new Map();

function normalizeProxyBase(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  try {
    const url = new URL(value);
    if (!/^https?:$/i.test(url.protocol)) return '';
    return url.origin + url.pathname.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function getConnectionMode() {
  const raw = String(safeStorageGetItem(CONNECTION_MODE_KEY) || CONNECTION_MODE_DIRECT).toLowerCase();
  return raw === CONNECTION_MODE_PROXY ? CONNECTION_MODE_PROXY : CONNECTION_MODE_DIRECT;
}

function getProxyBaseUrl() {
  return normalizeProxyBase(safeStorageGetItem(CONNECTION_PROXY_BASE_KEY) || '');
}

function getPublicApiBase() {
  if (getConnectionMode() === CONNECTION_MODE_PROXY) {
    const base = getProxyBaseUrl();
    if (!base) throw new AppError('PROXY_BASE_REQUIRED', 'プロキシモードの接続先URLを設定してください。');
    return `${base}/xrpc`;
  }
  return DIRECT_BSKY_PUB;
}

function getChatApiBase() {
  if (getConnectionMode() === CONNECTION_MODE_PROXY) {
    const base = getProxyBaseUrl();
    if (!base) throw new AppError('PROXY_BASE_REQUIRED', 'プロキシモードの接続先URLを設定してください。');
    return `${base}/xrpc`;
  }
  return DIRECT_BSKY_CHAT;
}

class AppError extends Error {
  constructor(code, message, detail = null) {
    super(message || code || 'APP_ERROR');
    this.name = 'AppError';
    this.code = String(code || 'APP_ERROR');
    this.detail = detail;
  }
}

function isTransientStatus(status) {
  return status === 429 || status === 503 || status === 504;
}

function jitterDelay(baseMs, attempt) {
  const exp = Math.max(1, 2 ** Math.max(0, attempt - 1));
  const max = Math.min(4000, baseMs * exp);
  const jitter = Math.floor(Math.random() * Math.max(80, max * 0.3));
  return max + jitter;
}

function safeStorageGetItem(key) {
  try { return localStorage.getItem(key); }
  catch { return API_MEMORY_STORAGE.has(key) ? API_MEMORY_STORAGE.get(key) : null; }
}

function safeStorageSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    API_MEMORY_STORAGE.set(key, value);
    return true;
  } catch {
    API_MEMORY_STORAGE.set(key, value);
    return false;
  }
}

function safeStorageRemoveItem(key) {
  try { localStorage.removeItem(key); } catch {}
  API_MEMORY_STORAGE.delete(key);
}

function getStorageVersion() {
  const v = safeStorageGetItem(STORAGE_VERSION_KEY);
  return typeof v === 'string' ? v : null;
}

function setStorageVersion(v) {
  safeStorageSetItem(STORAGE_VERSION_KEY, String(v || CURRENT_STORAGE_VERSION));
}

function setReloginReason(reason) {
  safeStorageSetItem(RELOGIN_REASON_KEY, String(reason || ''));
}

function takeReloginReason() {
  const reason = safeStorageGetItem(RELOGIN_REASON_KEY) || '';
  safeStorageRemoveItem(RELOGIN_REASON_KEY);
  return reason;
}

function hasLegacySession() {
  return LEGACY_SESSION_KEYS.some(k => !!safeStorageGetItem(k));
}

function sanitizeSessionObject(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const did = String(raw.did || '').trim();
  const accessJwt = String(raw.accessJwt || '').trim();
  const refreshJwt = String(raw.refreshJwt || '').trim();
  if (!did || !accessJwt || !refreshJwt) return null;
  return {
    ...raw,
    did,
    accessJwt,
    refreshJwt,
    handle: String(raw.handle || '').trim(),
  };
}

function readSessionAccountsStore() {
  let parsed = null;
  try {
    parsed = JSON.parse(safeStorageGetItem(SESSION_ACCOUNTS_KEY) || 'null');
  } catch {
    parsed = null;
  }

  const accountsRaw = Array.isArray(parsed?.accounts) ? parsed.accounts : [];
  const accounts = accountsRaw.map(acc => {
    const session = sanitizeSessionObject(acc?.session);
    if (!session) return null;
    const did = String(acc?.did || session.did || '').trim();
    if (!did) return null;
    return {
      did,
      handle: String(acc?.handle || session.handle || '').trim(),
      savedAt: Number(acc?.savedAt || 0) || Date.now(),
      session,
    };
  }).filter(Boolean);

  const activeDidRaw = String(parsed?.activeDid || safeStorageGetItem(ACTIVE_SESSION_DID_KEY) || '').trim();
  const activeDid = accounts.some(acc => acc.did === activeDidRaw)
    ? activeDidRaw
    : (accounts[0]?.did || '');

  return { accounts, activeDid };
}

function writeSessionAccountsStore(store) {
  const payload = {
    version: 1,
    activeDid: String(store?.activeDid || ''),
    accounts: (Array.isArray(store?.accounts) ? store.accounts : []).map(acc => ({
      did: String(acc.did || ''),
      handle: String(acc.handle || acc.session?.handle || ''),
      savedAt: Number(acc.savedAt || Date.now()),
      session: sanitizeSessionObject(acc.session),
    })).filter(acc => !!acc.did && !!acc.session),
  };
  safeStorageSetItem(SESSION_ACCOUNTS_KEY, JSON.stringify(payload));
  if (payload.activeDid) safeStorageSetItem(ACTIVE_SESSION_DID_KEY, payload.activeDid);
  else safeStorageRemoveItem(ACTIVE_SESSION_DID_KEY);
}

function getActiveAccountFromStore(store) {
  if (!store || !Array.isArray(store.accounts) || !store.accounts.length) return null;
  return store.accounts.find(acc => acc.did === store.activeDid) || store.accounts[0] || null;
}

function mirrorLegacySession(activeAccount) {
  if (!activeAccount?.session) {
    safeStorageRemoveItem(SESSION_KEY);
    safeStorageRemoveItem(SESSION_SAVED_AT_KEY);
    return;
  }
  safeStorageSetItem(SESSION_KEY, JSON.stringify(activeAccount.session));
  safeStorageSetItem(SESSION_SAVED_AT_KEY, String(Number(activeAccount.savedAt || Date.now())));
}

function upsertSessionAccount(session, options = {}) {
  const nextSession = sanitizeSessionObject(session);
  if (!nextSession) return null;

  const store = readSessionAccountsStore();
  const idx = store.accounts.findIndex(acc => acc.did === nextSession.did);
  const now = Date.now();
  const account = {
    did: nextSession.did,
    handle: String(nextSession.handle || '').trim(),
    savedAt: now,
    session: nextSession,
  };

  if (idx >= 0) store.accounts[idx] = account;
  else store.accounts.unshift(account);

  if (options.setActive !== false || !store.activeDid) {
    store.activeDid = nextSession.did;
  }

  writeSessionAccountsStore(store);
  mirrorLegacySession(getActiveAccountFromStore(store));
  return nextSession;
}

function migrateLegacySingleSessionIfNeeded() {
  const existingStore = readSessionAccountsStore();
  if (existingStore.accounts.length) {
    mirrorLegacySession(getActiveAccountFromStore(existingStore));
    return;
  }

  let legacy = null;
  try {
    legacy = JSON.parse(safeStorageGetItem(SESSION_KEY) || 'null');
  } catch {
    legacy = null;
  }
  const session = sanitizeSessionObject(legacy);
  if (!session) return;

  const savedAt = Number(safeStorageGetItem(SESSION_SAVED_AT_KEY) || Date.now()) || Date.now();
  writeSessionAccountsStore({
    activeDid: session.did,
    accounts: [{ did: session.did, handle: String(session.handle || ''), savedAt, session }],
  });
  mirrorLegacySession({ did: session.did, handle: String(session.handle || ''), savedAt, session });
}

function clearAllSessions() {
  safeStorageRemoveItem(SESSION_KEY);
  safeStorageRemoveItem(SESSION_SAVED_AT_KEY);
  safeStorageRemoveItem(SESSION_ACCOUNTS_KEY);
  safeStorageRemoveItem(ACTIVE_SESSION_DID_KEY);
  LEGACY_SESSION_KEYS.forEach(safeStorageRemoveItem);
}

function listSessions() {
  migrateLegacySingleSessionIfNeeded();
  const store = readSessionAccountsStore();
  return store.accounts.map(acc => ({
    did: acc.did,
    handle: String(acc.handle || acc.session?.handle || ''),
    savedAt: Number(acc.savedAt || 0),
    isActive: acc.did === store.activeDid,
  }));
}

function switchSession(did) {
  const targetDid = String(did || '').trim();
  if (!targetDid) return null;
  const store = readSessionAccountsStore();
  const hit = store.accounts.find(acc => acc.did === targetDid);
  if (!hit) return null;
  store.activeDid = hit.did;
  writeSessionAccountsStore(store);
  mirrorLegacySession(hit);
  return hit.session;
}

function removeSession(did = '') {
  const store = readSessionAccountsStore();
  const targetDid = String(did || store.activeDid || '').trim();
  if (!targetDid) {
    mirrorLegacySession(getActiveAccountFromStore(store));
    return false;
  }
  const nextAccounts = store.accounts.filter(acc => acc.did !== targetDid);
  if (nextAccounts.length === store.accounts.length) return false;

  const nextActiveDid = (store.activeDid === targetDid)
    ? (nextAccounts[0]?.did || '')
    : (nextAccounts.some(acc => acc.did === store.activeDid) ? store.activeDid : (nextAccounts[0]?.did || ''));

  writeSessionAccountsStore({ activeDid: nextActiveDid, accounts: nextAccounts });
  const active = nextAccounts.find(acc => acc.did === nextActiveDid) || null;
  mirrorLegacySession(active);
  return true;
}

// =============================================
//  セッション
// =============================================
function saveSession(s, options = {})  {
  upsertSessionAccount(s, options);
}

function loadSession() {
  migrateLegacySingleSessionIfNeeded();

  const ver = getStorageVersion();
  const hasV1Session = !!safeStorageGetItem(SESSION_KEY);
  const hasAccountSessions = !!safeStorageGetItem(SESSION_ACCOUNTS_KEY);
  const hasOldSession = hasLegacySession();

  // Storage version mismatch: invalidate current/legacy sessions and force fresh login.
  if ((hasV1Session || hasOldSession || hasAccountSessions) && ver !== CURRENT_STORAGE_VERSION) {
    clearAllSessions();
    setStorageVersion(CURRENT_STORAGE_VERSION);
    setReloginReason('storage_version_mismatch');
    return null;
  }

  if (!ver) setStorageVersion(CURRENT_STORAGE_VERSION);

  // 有効期限切れアカウントを先頭から取り除き、利用可能なアカウントを返す。
  let guard = 0;
  while (guard < 8) {
    guard += 1;
    const store = readSessionAccountsStore();
    if (!store.accounts.length) {
      mirrorLegacySession(null);
      return null;
    }

    const active = getActiveAccountFromStore(store);
    if (!active?.session) {
      removeSession(active?.did || '');
      continue;
    }

    const savedAt = Number(active.savedAt || 0);
    if (savedAt > 0 && (Date.now() - savedAt) > SESSION_TTL_MS) {
      const did = active.did;
      removeSession(did);
      const remain = listSessions();
      if (!remain.length) {
        setReloginReason('session_expired_policy');
        return null;
      }
      continue;
    }

    if (store.activeDid !== active.did) {
      writeSessionAccountsStore({ ...store, activeDid: active.did });
    }
    mirrorLegacySession(active);
    return active.session;
  }

  mirrorLegacySession(null);
  return null;
}

function clearSession()  {
  removeSession('');
}

function getAuth() {
  const s = loadSession();
  if (!s) throw new Error('ログインが必要です');
  return { Authorization: `Bearer ${s.accessJwt}` };
}

/**
 * DM APIは https://api.bsky.chat/xrpc/ を使う
 * （bsky.social/xrpc/ ではなく専用ドメイン）
 * + ヘッダー: Atproto-Proxy: did:web:api.bsky.chat#bsky_chat
 */
function getChatAuth() {
  return {
    ...getAuth(),
    'Atproto-Proxy': 'did:web:api.bsky.chat#bsky_chat',
    'Content-Type': 'application/json',
  };
}

// =============================================
//  ログイン
// =============================================
async function apiLogin(identifier, password) {
  const id = identifier.replace(/^@/, '').trim();
  const res = await fetch(`${getPublicApiBase()}/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: id, password: password.trim() }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error(
      '認証失敗 — 以下を確認してください\n' +
      '① 通常パスワードではなく「アプリパスワード」を使用\n' +
      '② ハンドルに @ は不要（例: name.bsky.social）\n' +
      '③ アプリパスワードは Bluesky設定 → アプリパスワード で発行'
    );
    throw new Error(e.message || `ログインエラー (${res.status})`);
  }
  const data = await res.json();

  // PDS URLを取得してセッションに保存
  let pdsUrl = 'https://bsky.social';
  try {
    const didDoc = data.didDoc;
    if (didDoc?.service) {
      const atpSvc = didDoc.service.find(s => s.id === '#atproto_pds' || s.type === 'AtprotoPersonalDataServer');
      if (atpSvc?.serviceEndpoint) pdsUrl = atpSvc.serviceEndpoint;
    }
  } catch {}

  return { ...data, pdsUrl };
}

async function apiRefreshSession(refreshJwt) {
  const res = await fetch(`${getPublicApiBase()}/com.atproto.server.refreshSession`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${refreshJwt}` },
  });
  if (!res.ok) throw new AppError('SESSION_EXPIRED', 'session_expired');
  return res.json();
}

async function withAuth(fn) {
  try { return await fn(); }
  catch (e) {
    if (e.message?.includes('ExpiredToken') || e.message?.includes('AuthMissing')) {
      const s = loadSession();
      if (s?.refreshJwt) {
        try {
          const ns = await apiRefreshSession(s.refreshJwt);
          saveSession({ ...s, accessJwt: ns.accessJwt, refreshJwt: ns.refreshJwt });
          return await fn();
        } catch {
          clearSession();
          setReloginReason('session_expired');
          throw new AppError('SESSION_EXPIRED', 'セッション期限切れです。再ログインしてください。');
        }
      }
    }
    throw e;
  }
}
const withTokenRefresh = withAuth;

// =============================================
//  プロフィール
// =============================================
async function apiGetProfile(actor) {
  const s = loadSession();
  const t = (actor || s.handle).replace(/^@/, '');
  const res = await fetch(`${getPublicApiBase()}/app.bsky.actor.getProfile?actor=${encodeURIComponent(t)}`, { headers: getAuth() });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || e.message || 'プロフィール取得失敗'); }
  return res.json();
}

async function apiGetOwnProfileRecord() {
  const s = loadSession();
  const url = `${getPublicApiBase()}/com.atproto.repo.getRecord?repo=${encodeURIComponent(s.did)}&collection=app.bsky.actor.profile&rkey=self`;
  const res = await fetch(url, { headers: getAuth() });
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return data.value || null;
}

async function apiUpdateProfile({ displayName, description, avatarFile, bannerFile }) {
  const s = loadSession();
  const current = await apiGetOwnProfileRecord();
  const nextDisplayName = displayName ?? current?.displayName ?? '';
  const nextDescription = description ?? current?.description ?? '';
  const sameDisplayName = String(current?.displayName || '') === String(nextDisplayName || '');
  const sameDescription = String(current?.description || '') === String(nextDescription || '');
  const needsAvatar = !!avatarFile;
  const needsBanner = !!bannerFile;
  if (sameDisplayName && sameDescription && !needsAvatar && !needsBanner) {
    return { skipped: true };
  }
  const record = {
    ...(current || {}),
    $type: 'app.bsky.actor.profile',
    displayName: nextDisplayName,
    description: nextDescription,
  };
  if (avatarFile) record.avatar = await apiUploadBlob(avatarFile);
  else if (current?.avatar) record.avatar = current.avatar;
  if (bannerFile) record.banner = await apiUploadBlob(bannerFile);
  else if (current?.banner) record.banner = current.banner;
  const res = await fetch(`${getPublicApiBase()}/com.atproto.repo.putRecord`, {
    method: 'POST',
    headers: { ...getAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo: s.did, collection: 'app.bsky.actor.profile', rkey: 'self', record }),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message||'プロフィール更新失敗'); }
  return res.json();
}

// =============================================
//  フィード
// =============================================
async function apiGetTimeline(cursor = null) {
  let url = `${getPublicApiBase()}/app.bsky.feed.getTimeline?limit=30`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await withRetry(() => fetch(url, { headers: getAuth() }), { attempts: 3, baseMs: 220 });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || e.message || 'タイムライン取得失敗'); }
  return res.json();
}

async function apiGetDiscover(cursor = null) {
  const feedUri = 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot';
  let url = `${getPublicApiBase()}/app.bsky.feed.getFeed?feed=${encodeURIComponent(feedUri)}&limit=30`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await fetch(url, { headers: getAuth() });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || e.message || 'Discoverフィード取得失敗'); }
  return res.json();
}

async function apiGetVideoFeed(cursor = null) {
  // 動画フィードは取得できないケースが多いのでFollowingにフォールバック
  return apiGetTimeline(cursor);
}

async function apiGetAuthorFeed(actor, filter = 'posts_no_replies', cursor = null) {
  const t = actor.replace(/^@/, '');
  let url = `${getPublicApiBase()}/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(t)}&limit=30&filter=${encodeURIComponent(filter)}`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await fetch(url, { headers: getAuth() });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || e.message || '投稿一覧取得失敗'); }
  return res.json();
}

async function apiGetActorLikes(actor, cursor = null) {
  const t = actor.replace(/^@/, '');
  let url = `${getPublicApiBase()}/app.bsky.feed.getActorLikes?actor=${encodeURIComponent(t)}&limit=30`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await fetch(url, { headers: getAuth() });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || e.message || 'いいね一覧取得失敗'); }
  return res.json();
}

async function apiGetNotifications(cursor = null) {
  let url = `${getPublicApiBase()}/app.bsky.notification.listNotifications?limit=30`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await withRetry(() => fetch(url, { headers: getAuth() }), { attempts: 3, baseMs: 300 });
  if (!res.ok) throw new Error(`通知取得失敗 (${res.status})`);
  return res.json();
}

async function apiGetUnreadCount() {
  const res = await fetch(`${getPublicApiBase()}/app.bsky.notification.getUnreadCount`, { headers: getAuth() });
  if (!res.ok) return { count: 0 };
  return res.json();
}

async function apiUpdateNotificationSeen() {
  await fetch(`${getPublicApiBase()}/app.bsky.notification.updateSeen`, {
    method: 'POST',
    headers: { ...getAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ seenAt: new Date().toISOString() }),
  }).catch(() => {});
}

async function apiSearchPosts(query, cursor = null, sort = 'top', signal = undefined) {
  let url = `${getPublicApiBase()}/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=25`;
  if (sort === 'latest') url += `&sort=latest`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await withRetry(() => fetch(url, { headers: getAuth(), signal }), {
    attempts: 2,
    baseMs: 180,
    shouldRetry: err => err?.name !== 'AbortError',
  });
  if (!res.ok) throw new Error(`投稿検索失敗 (${res.status})`);
  return res.json();
}

async function apiGetTrendingTopics(limit = 20, signal = undefined) {
  const url = `${getPublicApiBase()}/app.bsky.unspecced.getTrendingTopics?limit=${Math.max(5, Math.min(50, Number(limit || 20)))}`;
  const res = await fetch(url, { headers: getAuth(), signal });
  if (!res.ok) throw new Error(`トレンド取得失敗 (${res.status})`);
  return res.json();
}

async function apiSearchActors(query, cursor = null, signal = undefined) {
  let url = `${getPublicApiBase()}/app.bsky.actor.searchActors?q=${encodeURIComponent(query)}&limit=25`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await withRetry(() => fetch(url, { headers: getAuth(), signal }), {
    attempts: 2,
    baseMs: 180,
    shouldRetry: err => err?.name !== 'AbortError',
  });
  if (!res.ok) throw new Error(`ユーザー検索失敗 (${res.status})`);
  return res.json();
}

async function apiGetFollows(actor, cursor = null) {
  const s = loadSession();
  const t = (actor || s.handle).replace(/^@/, '');
  let url = `${getPublicApiBase()}/app.bsky.graph.getFollows?actor=${encodeURIComponent(t)}&limit=50`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await fetch(url, { headers: getAuth() });
  if (!res.ok) throw new Error(`フォロー一覧取得失敗 (${res.status})`);
  return res.json();
}

async function apiGetFollowers(actor, cursor = null) {
  const s = loadSession();
  const t = (actor || s.handle).replace(/^@/, '');
  let url = `${getPublicApiBase()}/app.bsky.graph.getFollowers?actor=${encodeURIComponent(t)}&limit=50`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await fetch(url, { headers: getAuth() });
  if (!res.ok) throw new Error(`フォロワー一覧取得失敗 (${res.status})`);
  return res.json();
}

async function apiGetLists(actor) {
  const s = loadSession();
  const t = (actor || s.handle).replace(/^@/, '');
  const res = await fetch(`${getPublicApiBase()}/app.bsky.graph.getLists?actor=${encodeURIComponent(t)}&limit=50`, { headers: getAuth() });
  if (!res.ok) throw new Error(`リスト取得失敗 (${res.status})`);
  return res.json();
}

async function apiGetListFeed(listUri, cursor = null) {
  let url = `${getPublicApiBase()}/app.bsky.feed.getListFeed?list=${encodeURIComponent(listUri)}&limit=30`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await fetch(url, { headers: getAuth() });
  if (!res.ok) throw new Error(`リストフィード取得失敗 (${res.status})`);
  return res.json();
}

// =============================================
//  スレッド（投稿の返信階層）
// =============================================
async function apiGetPostThread(uri, depth = 6) {
  const d = Math.max(1, Math.min(15, Number(depth) || 6));
  const url = `${getPublicApiBase()}/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=${d}&parentHeight=5`;
  const res = await fetch(url, { headers: getAuth() });
  if (!res.ok) throw new Error(`スレッド取得失敗 (${res.status})`);
  return res.json();
}

// =============================================
//  DM（api.bsky.chat 専用ドメイン経由）
//  ※ bsky.social/xrpc/ ではなく api.bsky.chat/xrpc/ を使う
// =============================================
async function apiGetConversations(cursor = null) {
  let url = `${getChatApiBase()}/chat.bsky.convo.listConvos?limit=20`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await withRetry(() => fetch(url, { headers: getChatAuth() }), { attempts: 3, baseMs: 280 });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('DMアクセス権限がありません。\nアプリパスワード発行時に「ダイレクトメッセージへのアクセスを許可」にチェックしてください。');
    throw new Error(e.message || `DM一覧取得失敗 (${res.status})`);
  }
  return res.json();
}

async function apiGetMessages(convoId, cursor = null) {
  let url = `${getChatApiBase()}/chat.bsky.convo.getMessages?convoId=${encodeURIComponent(convoId)}&limit=50`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await fetch(url, { headers: getChatAuth() });
  if (!res.ok) throw new Error(`メッセージ取得失敗 (${res.status})`);
  return res.json();
}

async function apiSendMessage(convoId, text) {
  const res = await fetch(`${getChatApiBase()}/chat.bsky.convo.sendMessage`, {
    method: 'POST',
    headers: getChatAuth(),
    body: JSON.stringify({ convoId, message: { $type: 'chat.bsky.convo.defs#messageInput', text } }),
  });
  if (!res.ok) throw new Error(`メッセージ送信失敗 (${res.status})`);
  return res.json();
}

async function apiGetOrCreateConvoWithMember(memberDid) {
  const did = String(memberDid || '').trim();
  if (!did) throw new Error('DM対象ユーザーが不正です');
  const url = `${getChatApiBase()}/chat.bsky.convo.getConvoForMembers?members=${encodeURIComponent(did)}`;
  const res = await fetch(url, { headers: getChatAuth() });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    if (res.status === 403) throw new Error('このユーザーは新規DMに対応していません');
    throw new Error(e.message || `DM開始失敗 (${res.status})`);
  }
  return res.json();
}

// =============================================
//  投稿操作
// =============================================
async function apiUploadBlob(file) {
  if (!file || typeof file.size !== 'number') throw new Error('画像ファイルが不正です');
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`画像サイズが大きすぎます（最大 2,000,000 bytes / 現在 ${file.size.toLocaleString()} bytes）`);
  }
  const buf = await file.arrayBuffer();
  const res = await fetch(`${getPublicApiBase()}/com.atproto.repo.uploadBlob`, {
    method: 'POST',
    headers: { ...getAuth(), 'Content-Type': file.type },
    body: buf,
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message||'画像アップロード失敗'); }
  return (await res.json()).blob;
}

function waitMs(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry(fn, options = {}) {
  const attempts = Math.max(1, Number(options.attempts || 1));
  const baseMs = Math.max(80, Number(options.baseMs || 250));
  const shouldRetry = typeof options.shouldRetry === 'function'
    ? options.shouldRetry
    : (err => {
      const msg = String(err?.message || '').toLowerCase();
      if (err?.status && isTransientStatus(err.status)) return true;
      return /network|fetch failed|timed out|timeout|503|504|429/.test(msg);
    });
  let lastError = null;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i >= attempts || !shouldRetry(err)) break;
      await waitMs(jitterDelay(baseMs, i));
    }
  }
  throw lastError || new AppError('RETRY_FAILED', '通信に失敗しました');
}

async function apiUploadBlobWithRetry(file, maxAttempts = IMAGE_UPLOAD_RETRY_ATTEMPTS) {
  let lastError = null;
  const attempts = Math.max(1, Number(maxAttempts || 1));
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await apiUploadBlob(file);
    } catch (e) {
      lastError = e;
      if (i < attempts) await waitMs(250 * i);
    }
  }
  throw lastError || new Error('画像アップロード失敗');
}

function detectFacets(text) {
  const enc = new TextEncoder();
  const facets = [];
  const add = (match, idx, feature) => {
    const bs = enc.encode(text.slice(0, idx)).length;
    facets.push({ index: { byteStart: bs, byteEnd: bs + enc.encode(match).length }, features: [feature] });
  };
  let m;
  const urlRe = /https?:\/\/[^\s\u3000-\u9fff\uff00-\uffef<>\[\]{}|\\^`"]+/g;
  const menRe = /@([\w.-]+\.\w{2,})/g;
  const tagRe = /#([\w\u3040-\u9fff\u4e00-\u9fff]+)/g;
  while ((m = urlRe.exec(text)) !== null) add(m[0], m.index, { $type: 'app.bsky.richtext.facet#link', uri: m[0] });
  while ((m = menRe.exec(text)) !== null) add(m[0], m.index, { $type: 'app.bsky.richtext.facet#mention', did: `did:handle:${m[1]}` });
  while ((m = tagRe.exec(text)) !== null) add(m[0], m.index, { $type: 'app.bsky.richtext.facet#tag', tag: m[1] });
  return facets;
}

async function apiPost(text, images = [], replyTo = null, replyRestriction = null, quoteUri = null, quoteCid = null) {
  const s = loadSession();
  const record = { $type: 'app.bsky.feed.post', text, createdAt: new Date().toISOString() };
  const facets = detectFacets(text);
  if (facets.length) record.facets = facets;

  // 画像 or 引用リポスト embed
  if (images.length) {
    const imgs = [];
    const failedUploads = [];
    for (let i = 0; i < images.slice(0, 4).length; i += 1) {
      const f = images[i];
      try {
        const blob = await apiUploadBlobWithRetry(f, IMAGE_UPLOAD_RETRY_ATTEMPTS);
        imgs.push({ alt: '', image: blob });
      } catch (e) {
        failedUploads.push({ index: i, name: String(f?.name || `image-${i + 1}`), reason: e?.message || 'upload_failed' });
      }
    }
    if (failedUploads.length) {
      const err = new Error(`画像アップロード失敗: ${failedUploads.length}枚（再試行できます）`);
      err.code = 'IMAGE_UPLOAD_PARTIAL_FAILURE';
      err.failedUploads = failedUploads;
      throw err;
    }
    record.embed = { $type: 'app.bsky.embed.images', images: imgs };
  } else if (quoteUri && quoteCid) {
    record.embed = {
      $type: 'app.bsky.embed.record',
      record: { uri: quoteUri, cid: quoteCid },
    };
  }

  if (replyTo) {
    record.reply = {
      root:   { uri: replyTo.rootUri, cid: replyTo.rootCid },
      parent: { uri: replyTo.uri,     cid: replyTo.cid },
    };
  }

  const res = await fetch(`${getPublicApiBase()}/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: { ...getAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo: s.did, collection: 'app.bsky.feed.post', record }),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message||'投稿失敗'); }
  const result = await res.json();
  if (replyRestriction && replyRestriction !== 'everybody') {
    await apiSetThreadgate(result.uri, replyRestriction).catch(() => {});
  }
  return result;
}

async function apiSetThreadgate(postUri, restriction) {
  const s = loadSession();
  const rkey = postUri.split('/').pop();
  const allow = [];
  if (restriction === 'following')      allow.push({ $type: 'app.bsky.feed.threadgate#followingRule' });
  if (restriction === 'followers')      allow.push({ $type: 'app.bsky.feed.threadgate#followerRule' });
  if (restriction === 'mentionedUsers') allow.push({ $type: 'app.bsky.feed.threadgate#mentionRule' });
  await fetch(`${getPublicApiBase()}/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: { ...getAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo: s.did, collection: 'app.bsky.feed.threadgate', rkey,
      record: { $type: 'app.bsky.feed.threadgate', post: postUri, allow, createdAt: new Date().toISOString() },
    }),
  });
}

async function apiDeletePost(uri) {
  const s = loadSession();
  const res = await fetch(`${getPublicApiBase()}/com.atproto.repo.deleteRecord`, {
    method: 'POST',
    headers: { ...getAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo: s.did, collection: 'app.bsky.feed.post', rkey: uri.split('/').pop() }),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message||'削除失敗'); }
}

async function apiLike(uri, cid) {
  const s = loadSession();
  const res = await fetch(`${getPublicApiBase()}/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: { ...getAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo: s.did, collection: 'app.bsky.feed.like', record: { $type: 'app.bsky.feed.like', subject: { uri, cid }, createdAt: new Date().toISOString() } }),
  });
  if (!res.ok) throw new Error('いいね失敗');
  return res.json();
}
async function apiUnlike(likeUri) {
  const s = loadSession();
  await fetch(`${getPublicApiBase()}/com.atproto.repo.deleteRecord`, {
    method: 'POST',
    headers: { ...getAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo: s.did, collection: 'app.bsky.feed.like', rkey: likeUri.split('/').pop() }),
  });
}

async function apiRepost(uri, cid) {
  const s = loadSession();
  const res = await fetch(`${getPublicApiBase()}/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: { ...getAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo: s.did, collection: 'app.bsky.feed.repost', record: { $type: 'app.bsky.feed.repost', subject: { uri, cid }, createdAt: new Date().toISOString() } }),
  });
  if (!res.ok) throw new Error('リポスト失敗');
  return res.json();
}
async function apiUnrepost(repostUri) {
  const s = loadSession();
  await fetch(`${getPublicApiBase()}/com.atproto.repo.deleteRecord`, {
    method: 'POST',
    headers: { ...getAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo: s.did, collection: 'app.bsky.feed.repost', rkey: repostUri.split('/').pop() }),
  });
}

async function apiFollow(did) {
  const s = loadSession();
  const res = await fetch(`${getPublicApiBase()}/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: { ...getAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo: s.did, collection: 'app.bsky.graph.follow', record: { $type: 'app.bsky.graph.follow', subject: did, createdAt: new Date().toISOString() } }),
  });
  if (!res.ok) throw new Error('フォロー失敗');
  return res.json();
}
async function apiUnfollow(followUri) {
  const s = loadSession();
  await fetch(`${getPublicApiBase()}/com.atproto.repo.deleteRecord`, {
    method: 'POST',
    headers: { ...getAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo: s.did, collection: 'app.bsky.graph.follow', rkey: followUri.split('/').pop() }),
  });
}

// =============================================
//  下書き
// =============================================
function getDrafts() {
  try {
    const v1 = JSON.parse(safeStorageGetItem(DRAFTS_KEY) || '[]');
    if (Array.isArray(v1) && v1.length) return v1;
  } catch {}
  for (const key of LEGACY_DRAFT_KEYS) {
    try {
      const old = JSON.parse(safeStorageGetItem(key) || '[]');
      if (Array.isArray(old) && old.length) {
        safeStorageSetItem(DRAFTS_KEY, JSON.stringify(old));
        return old;
      }
    } catch {}
  }
  return [];
}
function saveDraft(text) { const d = getDrafts(); d.unshift({ id: Date.now(), text, savedAt: new Date().toISOString() }); safeStorageSetItem(DRAFTS_KEY, JSON.stringify(d.slice(0, 20))); }
function deleteDraft(id) { safeStorageSetItem(DRAFTS_KEY, JSON.stringify(getDrafts().filter(d => d.id !== id))); }
