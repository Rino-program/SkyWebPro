/**
 * SkyDeck — api.js  v3.0
 *
 * 【重要な仕様】
 * - app.bsky.* / com.atproto.*  → https://bsky.social/xrpc/...
 * - chat.bsky.*                 → ユーザーのPDS URL + /xrpc/...
 *                                 + ヘッダー: Atproto-Proxy: did:web:api.bsky.chat#bsky_chat
 * - DM用アプリパスワードには「ダイレクトメッセージへのアクセスを許可」が必要
 */

const BSKY_PUB  = 'https://bsky.social/xrpc';
const SESSION_KEY = 'skydeck_session_v3';
const DRAFTS_KEY  = 'skydeck_drafts_v2';
const MAX_IMAGE_BYTES = 1000000;

// =============================================
//  セッション
// =============================================
function saveSession(s)  { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
function loadSession()   { try { return JSON.parse(localStorage.getItem(SESSION_KEY)||'null'); } catch { return null; } }
function clearSession()  { localStorage.removeItem(SESSION_KEY); }

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
  if (!res.ok) throw new Error('session_expired');
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
        } catch { clearSession(); throw new Error('セッション期限切れです。再ログインしてください。'); }
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
  if (!res.ok) throw new Error('プロフィール取得失敗');
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
  const record = {
    ...(current || {}),
    $type: 'app.bsky.actor.profile',
    displayName: displayName ?? current?.displayName ?? '',
    description: description ?? current?.description ?? '',
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
  const res = await fetch(url, { headers: getAuth() });
  if (!res.ok) throw new Error('タイムライン取得失敗');
  return res.json();
}

async function apiGetDiscover(cursor = null) {
  const feedUri = 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot';
  let url = `${BSKY_PUB}/app.bsky.feed.getFeed?feed=${encodeURIComponent(feedUri)}&limit=30`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await fetch(url, { headers: getAuth() });
  if (!res.ok) throw new Error('Discoverフィード取得失敗');
  return res.json();
}

async function apiGetVideoFeed(cursor = null) {
  // 動画フィードは取得できないケースが多いのでFollowingにフォールバック
  return apiGetTimeline(cursor);
}

async function apiGetAuthorFeed(actor, filter = 'posts_no_replies', cursor = null) {
  const t = actor.replace(/^@/, '');
  let url = `${BSKY_PUB}/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(t)}&limit=30&filter=${filter}`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await fetch(url, { headers: getAuth() });
  if (!res.ok) throw new Error('投稿一覧取得失敗');
  return res.json();
}

async function apiGetNotifications(cursor = null) {
  let url = `${BSKY_PUB}/app.bsky.notification.listNotifications?limit=30`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await fetch(url, { headers: getAuth() });
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

async function apiSearchPosts(query, cursor = null) {
  let url = `${BSKY_PUB}/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=25`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await fetch(url, { headers: getAuth() });
  if (!res.ok) throw new Error(`投稿検索失敗 (${res.status})`);
  return res.json();
}

async function apiSearchActors(query, cursor = null) {
  let url = `${BSKY_PUB}/app.bsky.actor.searchActors?q=${encodeURIComponent(query)}&limit=25`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await fetch(url, { headers: getAuth() });
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
  const url = `${BSKY_PUB}/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=${depth}&parentHeight=5`;
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
  const res = await fetch(url, { headers: getChatAuth() });
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
    for (const f of images.slice(0, 4)) imgs.push({ alt: '', image: await apiUploadBlob(f) });
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
function getDrafts()     { try { return JSON.parse(localStorage.getItem(DRAFTS_KEY)||'[]'); } catch { return []; } }
function saveDraft(text) { const d = getDrafts(); d.unshift({ id: Date.now(), text, savedAt: new Date().toISOString() }); localStorage.setItem(DRAFTS_KEY, JSON.stringify(d.slice(0, 20))); }
function deleteDraft(id) { localStorage.setItem(DRAFTS_KEY, JSON.stringify(getDrafts().filter(d => d.id !== id))); }
