/**
 * SkyDeck — api.js  v1.0
 *
 * 【重要な仕様】
 * - app.bsky.* / com.atproto.*  → https://bsky.social/xrpc/...
 * - chat.bsky.*                 → ユーザーのPDS URL + /xrpc/...
 *                                 + ヘッダー: Atproto-Proxy: did:web:api.bsky.chat#bsky_chat
 * - DM用アプリパスワードには「ダイレクトメッセージへのアクセスを許可」が必要
 */

const BSKY_PUB  = 'https://bsky.social/xrpc';
const SESSION_KEY = 'skydeck_session_v1';
const DRAFTS_KEY  = 'skydeck_drafts_v1';
const STORAGE_VERSION_KEY = 'skydeck_storage_version';
const CURRENT_STORAGE_VERSION = 'v1';
const RELOGIN_REASON_KEY = 'skydeck_relogin_reason';
const SESSION_SAVED_AT_KEY = 'skydeck_session_saved_at';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LEGACY_SESSION_KEYS = ['skydeck_session_v3'];
const LEGACY_DRAFT_KEYS = ['skydeck_drafts_v2'];
const MAX_IMAGE_BYTES = 1000000;
const IMAGE_UPLOAD_RETRY_ATTEMPTS = 2;
const API_MEMORY_STORAGE = new Map();

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

// =============================================
//  セッション
// =============================================
function saveSession(s)  {
  safeStorageSetItem(SESSION_KEY, JSON.stringify(s));
  safeStorageSetItem(SESSION_SAVED_AT_KEY, String(Date.now()));
}
function loadSession() {
  const ver = getStorageVersion();
  const hasV1Session = !!safeStorageGetItem(SESSION_KEY);
  const hasOldSession = hasLegacySession();

  // Storage version mismatch: invalidate current/legacy sessions and force fresh login.
  if ((hasV1Session || hasOldSession) && ver !== CURRENT_STORAGE_VERSION) {
    clearSession();
    setStorageVersion(CURRENT_STORAGE_VERSION);
    setReloginReason('storage_version_mismatch');
    return null;
  }

  if (!ver) setStorageVersion(CURRENT_STORAGE_VERSION);

  try {
    const v1 = JSON.parse(safeStorageGetItem(SESSION_KEY) || 'null');
    if (v1) {
      const savedAt = Number(safeStorageGetItem(SESSION_SAVED_AT_KEY) || 0);
      if (savedAt > 0 && (Date.now() - savedAt) > SESSION_TTL_MS) {
        clearSession();
        setReloginReason('session_expired_policy');
        return null;
      }
      return v1;
    }
  } catch {}
  return null;
}
function clearSession()  {
  safeStorageRemoveItem(SESSION_KEY);
  safeStorageRemoveItem(SESSION_SAVED_AT_KEY);
  LEGACY_SESSION_KEYS.forEach(safeStorageRemoveItem);
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
const BSKY_CHAT = 'https://api.bsky.chat/xrpc';

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
  const res = await fetch(`${BSKY_PUB}/com.atproto.server.createSession`, {
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
  const s = loadSession();
  const pdsUrl = s?.pdsUrl || 'https://bsky.social';
  const res = await fetch(`${pdsUrl}/xrpc/com.atproto.server.refreshSession`, {
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
  const res = await fetch(`${BSKY_PUB}/app.bsky.actor.getProfile?actor=${encodeURIComponent(t)}`, { headers: getAuth() });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || e.message || 'プロフィール取得失敗'); }
  return res.json();
}

async function apiGetOwnProfileRecord() {
  const s = loadSession();
  const url = `${BSKY_PUB}/com.atproto.repo.getRecord?repo=${encodeURIComponent(s.did)}&collection=app.bsky.actor.profile&rkey=self`;
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
  const res = await fetch(`${BSKY_PUB}/com.atproto.repo.putRecord`, {
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
  let url = `${BSKY_PUB}/app.bsky.feed.getTimeline?limit=30`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await withRetry(() => fetch(url, { headers: getAuth() }), { attempts: 3, baseMs: 220 });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || e.message || 'タイムライン取得失敗'); }
  return res.json();
}

async function apiGetDiscover(cursor = null) {
  const feedUri = 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot';
  let url = `${BSKY_PUB}/app.bsky.feed.getFeed?feed=${encodeURIComponent(feedUri)}&limit=30`;
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
  let url = `${BSKY_PUB}/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(t)}&limit=30&filter=${encodeURIComponent(filter)}`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await fetch(url, { headers: getAuth() });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || e.message || '投稿一覧取得失敗'); }
  return res.json();
}

async function apiGetActorLikes(actor, cursor = null) {
  const t = actor.replace(/^@/, '');
  let url = `${BSKY_PUB}/app.bsky.feed.getActorLikes?actor=${encodeURIComponent(t)}&limit=30`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await fetch(url, { headers: getAuth() });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || e.message || 'いいね一覧取得失敗'); }
  return res.json();
}

async function apiGetNotifications(cursor = null) {
  let url = `${BSKY_PUB}/app.bsky.notification.listNotifications?limit=30`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await withRetry(() => fetch(url, { headers: getAuth() }), { attempts: 3, baseMs: 300 });
  if (!res.ok) throw new Error(`通知取得失敗 (${res.status})`);
  return res.json();
}

async function apiGetUnreadCount() {
  const res = await fetch(`${BSKY_PUB}/app.bsky.notification.getUnreadCount`, { headers: getAuth() });
  if (!res.ok) return { count: 0 };
  return res.json();
}

async function apiUpdateNotificationSeen() {
  await fetch(`${BSKY_PUB}/app.bsky.notification.updateSeen`, {
    method: 'POST',
    headers: { ...getAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ seenAt: new Date().toISOString() }),
  }).catch(() => {});
}

async function apiSearchPosts(query, cursor = null, sort = 'top', signal = undefined) {
  let url = `${BSKY_PUB}/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=25`;
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
  const url = `${BSKY_PUB}/app.bsky.unspecced.getTrendingTopics?limit=${Math.max(5, Math.min(50, Number(limit || 20)))}`;
  const res = await fetch(url, { headers: getAuth(), signal });
  if (!res.ok) throw new Error(`トレンド取得失敗 (${res.status})`);
  return res.json();
}

async function apiSearchActors(query, cursor = null, signal = undefined) {
  let url = `${BSKY_PUB}/app.bsky.actor.searchActors?q=${encodeURIComponent(query)}&limit=25`;
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
  let url = `${BSKY_PUB}/app.bsky.graph.getFollows?actor=${encodeURIComponent(t)}&limit=50`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await fetch(url, { headers: getAuth() });
  if (!res.ok) throw new Error(`フォロー一覧取得失敗 (${res.status})`);
  return res.json();
}

async function apiGetFollowers(actor, cursor = null) {
  const s = loadSession();
  const t = (actor || s.handle).replace(/^@/, '');
  let url = `${BSKY_PUB}/app.bsky.graph.getFollowers?actor=${encodeURIComponent(t)}&limit=50`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await fetch(url, { headers: getAuth() });
  if (!res.ok) throw new Error(`フォロワー一覧取得失敗 (${res.status})`);
  return res.json();
}

async function apiGetLists(actor) {
  const s = loadSession();
  const t = (actor || s.handle).replace(/^@/, '');
  const res = await fetch(`${BSKY_PUB}/app.bsky.graph.getLists?actor=${encodeURIComponent(t)}&limit=50`, { headers: getAuth() });
  if (!res.ok) throw new Error(`リスト取得失敗 (${res.status})`);
  return res.json();
}

async function apiGetListFeed(listUri, cursor = null) {
  let url = `${BSKY_PUB}/app.bsky.feed.getListFeed?list=${encodeURIComponent(listUri)}&limit=30`;
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
  const url = `${BSKY_PUB}/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=${d}&parentHeight=5`;
  const res = await fetch(url, { headers: getAuth() });
  if (!res.ok) throw new Error(`スレッド取得失敗 (${res.status})`);
  return res.json();
}

// =============================================
//  DM（api.bsky.chat 専用ドメイン経由）
//  ※ bsky.social/xrpc/ ではなく api.bsky.chat/xrpc/ を使う
// =============================================
async function apiGetConversations(cursor = null) {
  let url = `${BSKY_CHAT}/chat.bsky.convo.listConvos?limit=20`;
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
  let url = `${BSKY_CHAT}/chat.bsky.convo.getMessages?convoId=${encodeURIComponent(convoId)}&limit=50`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await fetch(url, { headers: getChatAuth() });
  if (!res.ok) throw new Error(`メッセージ取得失敗 (${res.status})`);
  return res.json();
}

async function apiSendMessage(convoId, text) {
  const res = await fetch(`${BSKY_CHAT}/chat.bsky.convo.sendMessage`, {
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
  const url = `${BSKY_CHAT}/chat.bsky.convo.getConvoForMembers?members=${encodeURIComponent(did)}`;
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
    throw new Error(`画像サイズが大きすぎます（最大 1,000,000 bytes / 現在 ${file.size.toLocaleString()} bytes）`);
  }
  const buf = await file.arrayBuffer();
  const res = await fetch(`${BSKY_PUB}/com.atproto.repo.uploadBlob`, {
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

  const res = await fetch(`${BSKY_PUB}/com.atproto.repo.createRecord`, {
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
  await fetch(`${BSKY_PUB}/com.atproto.repo.createRecord`, {
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
  const res = await fetch(`${BSKY_PUB}/com.atproto.repo.deleteRecord`, {
    method: 'POST',
    headers: { ...getAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo: s.did, collection: 'app.bsky.feed.post', rkey: uri.split('/').pop() }),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message||'削除失敗'); }
}

async function apiLike(uri, cid) {
  const s = loadSession();
  const res = await fetch(`${BSKY_PUB}/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: { ...getAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo: s.did, collection: 'app.bsky.feed.like', record: { $type: 'app.bsky.feed.like', subject: { uri, cid }, createdAt: new Date().toISOString() } }),
  });
  if (!res.ok) throw new Error('いいね失敗');
  return res.json();
}
async function apiUnlike(likeUri) {
  const s = loadSession();
  await fetch(`${BSKY_PUB}/com.atproto.repo.deleteRecord`, {
    method: 'POST',
    headers: { ...getAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo: s.did, collection: 'app.bsky.feed.like', rkey: likeUri.split('/').pop() }),
  });
}

async function apiRepost(uri, cid) {
  const s = loadSession();
  const res = await fetch(`${BSKY_PUB}/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: { ...getAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo: s.did, collection: 'app.bsky.feed.repost', record: { $type: 'app.bsky.feed.repost', subject: { uri, cid }, createdAt: new Date().toISOString() } }),
  });
  if (!res.ok) throw new Error('リポスト失敗');
  return res.json();
}
async function apiUnrepost(repostUri) {
  const s = loadSession();
  await fetch(`${BSKY_PUB}/com.atproto.repo.deleteRecord`, {
    method: 'POST',
    headers: { ...getAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo: s.did, collection: 'app.bsky.feed.repost', rkey: repostUri.split('/').pop() }),
  });
}

async function apiFollow(did) {
  const s = loadSession();
  const res = await fetch(`${BSKY_PUB}/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: { ...getAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo: s.did, collection: 'app.bsky.graph.follow', record: { $type: 'app.bsky.graph.follow', subject: did, createdAt: new Date().toISOString() } }),
  });
  if (!res.ok) throw new Error('フォロー失敗');
  return res.json();
}
async function apiUnfollow(followUri) {
  const s = loadSession();
  await fetch(`${BSKY_PUB}/com.atproto.repo.deleteRecord`, {
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
