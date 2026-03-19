/**
 * SkyDeck — api.js
 * Bluesky AT Protocol API wrapper
 * すべてのAPIコールをここに集約する
 */

const BSKY_API = 'https://bsky.social/xrpc';

// =============================================
//  セッション管理
// =============================================

/**
 * ログイン（セッション作成）
 * @param {string} identifier - ハンドルまたはDID
 * @param {string} password    - アプリパスワード
 * @returns {Promise<object>}  - セッション情報
 */
async function apiLogin(identifier, password) {
  const res = await fetch(`${BSKY_API}/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `ログインに失敗しました (${res.status})`);
  }
  return res.json();
}

/**
 * セッションをRefreshTokenで更新する
 * @param {string} refreshJwt
 * @returns {Promise<object>}
 */
async function apiRefreshSession(refreshJwt) {
  const res = await fetch(`${BSKY_API}/com.atproto.server.refreshSession`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${refreshJwt}` },
  });
  if (!res.ok) throw new Error('セッション更新に失敗しました');
  return res.json();
}

// =============================================
//  共通認証ヘッダー取得
// =============================================

function getAuthHeader() {
  const session = loadSession();
  if (!session) throw new Error('ログインしてください');
  return { Authorization: `Bearer ${session.accessJwt}` };
}

// =============================================
//  ユーザー情報
// =============================================

/**
 * 自分のプロフィール取得
 */
async function apiGetMyProfile() {
  const session = loadSession();
  const res = await fetch(
    `${BSKY_API}/app.bsky.actor.getProfile?actor=${encodeURIComponent(session.handle)}`,
    { headers: getAuthHeader() }
  );
  if (!res.ok) throw new Error('プロフィール取得に失敗しました');
  return res.json();
}

// =============================================
//  フィード取得
// =============================================

/**
 * ホームタイムライン（フォロー中のユーザーの投稿）
 * @param {string|null} cursor
 */
async function apiGetTimeline(cursor = null) {
  let url = `${BSKY_API}/app.bsky.feed.getTimeline?limit=30`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await fetch(url, { headers: getAuthHeader() });
  if (!res.ok) throw new Error('タイムライン取得に失敗しました');
  return res.json(); // { feed: [], cursor }
}

/**
 * 自分の投稿一覧
 * @param {string|null} cursor
 */
async function apiGetMyPosts(cursor = null) {
  const session = loadSession();
  let url = `${BSKY_API}/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(session.handle)}&limit=30&filter=posts_no_replies`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await fetch(url, { headers: getAuthHeader() });
  if (!res.ok) throw new Error('投稿一覧取得に失敗しました');
  return res.json();
}

/**
 * 通知一覧
 * @param {string|null} cursor
 */
async function apiGetNotifications(cursor = null) {
  let url = `${BSKY_API}/app.bsky.notification.listNotifications?limit=30`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await fetch(url, { headers: getAuthHeader() });
  if (!res.ok) throw new Error('通知取得に失敗しました');
  return res.json(); // { notifications: [], cursor }
}

/**
 * 通知を既読にする
 */
async function apiUpdateNotificationSeen() {
  await fetch(`${BSKY_API}/app.bsky.notification.updateSeen`, {
    method: 'POST',
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ seenAt: new Date().toISOString() }),
  });
}

/**
 * フォロー中ユーザー一覧
 * @param {string|null} cursor
 */
async function apiGetFollows(cursor = null) {
  const session = loadSession();
  let url = `${BSKY_API}/app.bsky.graph.getFollows?actor=${encodeURIComponent(session.handle)}&limit=50`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await fetch(url, { headers: getAuthHeader() });
  if (!res.ok) throw new Error('フォロー一覧取得に失敗しました');
  return res.json(); // { follows: [], cursor }
}

// =============================================
//  投稿操作
// =============================================

/**
 * 画像をBlobとしてアップロードする
 * @param {File} file - 画像ファイル
 * @returns {Promise<object>} - blobオブジェクト
 */
async function apiUploadBlob(file) {
  const arrayBuffer = await file.arrayBuffer();
  const res = await fetch(`${BSKY_API}/com.atproto.repo.uploadBlob`, {
    method: 'POST',
    headers: {
      ...getAuthHeader(),
      'Content-Type': file.type,
    },
    body: arrayBuffer,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || '画像アップロードに失敗しました');
  }
  const data = await res.json();
  return data.blob;
}

/**
 * リッチテキストのfacets（メンション・URL・ハッシュタグ）を解析する
 * atproto/api ライブラリが無い環境向けの簡易実装
 * @param {string} text
 * @returns {Array} facets配列
 */
function detectFacets(text) {
  const facets = [];
  const encoder = new TextEncoder();

  // URLの検出
  const urlRegex = /https?:\/\/[^\s\u3000-\u9fff\uff00-\uffef]+/g;
  let m;
  while ((m = urlRegex.exec(text)) !== null) {
    const byteStart = encoder.encode(text.slice(0, m.index)).length;
    const byteEnd = byteStart + encoder.encode(m[0]).length;
    facets.push({
      index: { byteStart, byteEnd },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: m[0] }],
    });
  }

  // メンションの検出 (@handle.bsky.social など)
  const mentionRegex = /@([\w.-]+\.\w+)/g;
  while ((m = mentionRegex.exec(text)) !== null) {
    const byteStart = encoder.encode(text.slice(0, m.index)).length;
    const byteEnd = byteStart + encoder.encode(m[0]).length;
    // DIDの解決は省略（did:plcをそのまま使う）
    facets.push({
      index: { byteStart, byteEnd },
      features: [{ $type: 'app.bsky.richtext.facet#mention', did: `did:handle:${m[1]}` }],
    });
  }

  // ハッシュタグの検出
  const tagRegex = /#([\w\u3040-\u9fff]+)/g;
  while ((m = tagRegex.exec(text)) !== null) {
    const byteStart = encoder.encode(text.slice(0, m.index)).length;
    const byteEnd = byteStart + encoder.encode(m[0]).length;
    facets.push({
      index: { byteStart, byteEnd },
      features: [{ $type: 'app.bsky.richtext.facet#tag', tag: m[1] }],
    });
  }

  return facets;
}

/**
 * 投稿（テキスト＋オプション画像）
 * @param {string}       text     - 投稿テキスト
 * @param {File[]}       images   - 画像ファイル配列（最大4枚）
 * @param {object|null}  replyTo  - { uri, cid, rootUri, rootCid } 返信先
 * @returns {Promise<object>}
 */
async function apiPost(text, images = [], replyTo = null) {
  const session = loadSession();

  const record = {
    $type: 'app.bsky.feed.post',
    text,
    createdAt: new Date().toISOString(),
  };

  // ファセット（リンク・ハッシュタグ）
  const facets = detectFacets(text);
  if (facets.length > 0) record.facets = facets;

  // 画像
  if (images.length > 0) {
    const uploadedImages = [];
    for (const file of images.slice(0, 4)) {
      const blob = await apiUploadBlob(file);
      uploadedImages.push({ alt: '', image: blob });
    }
    record.embed = {
      $type: 'app.bsky.embed.images',
      images: uploadedImages,
    };
  }

  // 返信
  if (replyTo) {
    record.reply = {
      root:   { uri: replyTo.rootUri, cid: replyTo.rootCid },
      parent: { uri: replyTo.uri,     cid: replyTo.cid },
    };
  }

  const res = await fetch(`${BSKY_API}/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo:       session.did,
      collection: 'app.bsky.feed.post',
      record,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || '投稿に失敗しました');
  }
  return res.json();
}

/**
 * 投稿を削除する
 * @param {string} uri - 投稿のat://URI
 */
async function apiDeletePost(uri) {
  const session = loadSession();
  // at://did.../app.bsky.feed.post/rkey から rkey を抽出
  const rkey = uri.split('/').pop();

  const res = await fetch(`${BSKY_API}/com.atproto.repo.deleteRecord`, {
    method: 'POST',
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo:       session.did,
      collection: 'app.bsky.feed.post',
      rkey,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || '削除に失敗しました');
  }
}

/**
 * 投稿スレッドを取得する（返信時にroot/parentを特定するため）
 * @param {string} uri
 * @returns {Promise<object>}
 */
async function apiGetPostThread(uri) {
  const res = await fetch(
    `${BSKY_API}/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=0`,
    { headers: getAuthHeader() }
  );
  if (!res.ok) throw new Error('スレッド取得に失敗しました');
  return res.json();
}

// =============================================
//  セッションの永続化（localStorage）
// =============================================

const SESSION_KEY = 'skydeck_session';

function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

/**
 * accessJwtが古い場合にrefreshJwtで更新を試みる汎用ラッパー
 * @param {Function} fn - API呼び出し関数
 */
async function withTokenRefresh(fn) {
  try {
    return await fn();
  } catch (e) {
    // 401の場合はトークンをリフレッシュして再試行
    if (e.message && e.message.includes('ExpiredToken')) {
      const session = loadSession();
      if (session && session.refreshJwt) {
        try {
          const newSession = await apiRefreshSession(session.refreshJwt);
          saveSession({ ...session, accessJwt: newSession.accessJwt, refreshJwt: newSession.refreshJwt });
          return await fn();
        } catch {
          clearSession();
          throw new Error('セッションが期限切れです。再ログインしてください。');
        }
      }
    }
    throw e;
  }
}
