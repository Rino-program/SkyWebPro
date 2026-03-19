/**
 * SkyDeck — app.js
 * アプリケーションの主要ロジック・イベントハンドラ
 */

// =============================================
//  アプリの状態管理
// =============================================

const State = {
  session:      null,    // 現在のセッション
  myProfile:    null,    // 自分のプロフィール
  currentTab:   'home',  // アクティブなタブ
  replyTarget:  null,    // { uri, cid, rootUri, rootCid, handle } 返信対象
  pendingImages: [],     // 添付予定の画像ファイル配列
  deleteTarget:  null,   // 削除確認中の投稿URI

  // タブごとのカーソル（無限スクロール）
  cursors: { home: null, 'my-posts': null, notifications: null, following: null },
  // タブごとのロード中フラグ
  loading: { home: false, 'my-posts': false, notifications: false, following: false },
};

// =============================================
//  初期化
// =============================================

async function init() {
  const session = loadSession();
  if (session) {
    State.session = session;
    showApp();
    await loadMyProfile();
    await loadTab('home');
    startNotifPolling();
  } else {
    showLoginScreen();
  }

  bindEvents();
}

// =============================================
//  画面切り替え
// =============================================

function showLoginScreen() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
}

async function loadMyProfile() {
  try {
    const profile = await withTokenRefresh(() => apiGetMyProfile());
    State.myProfile = profile;

    // サイドバーのユーザー情報更新
    document.getElementById('user-avatar').src       = profile.avatar || '';
    document.getElementById('user-displayname').textContent = profile.displayName || profile.handle;
    document.getElementById('user-handle').textContent      = `@${profile.handle}`;
    document.getElementById('compose-avatar').src    = profile.avatar || '';
  } catch (e) {
    console.error('プロフィール取得エラー:', e);
  }
}

// =============================================
//  イベントバインド（一括登録）
// =============================================

function bindEvents() {
  // --- ログイン ---
  document.getElementById('login-btn').addEventListener('click', handleLogin);
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });

  // --- ログアウト ---
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  // --- タブナビゲーション ---
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // --- リフレッシュボタン ---
  document.querySelectorAll('.refresh-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const target = btn.dataset.target;
      btn.classList.add('spinning');
      await reloadTab(target);
      setTimeout(() => btn.classList.remove('spinning'), 500);
    });
  });

  // --- 文字数カウント ---
  const textarea = document.getElementById('compose-text');
  textarea.addEventListener('input', updateCharCount);

  // --- 画像選択 ---
  document.getElementById('image-input').addEventListener('change', handleImageSelect);

  // --- 投稿ボタン ---
  document.getElementById('post-btn').addEventListener('click', handlePost);
  textarea.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handlePost();
  });

  // --- 返信キャンセル ---
  document.getElementById('cancel-reply-btn').addEventListener('click', cancelReply);

  // --- 削除モーダル ---
  document.getElementById('delete-cancel-btn').addEventListener('click', () => {
    document.getElementById('delete-modal').classList.add('hidden');
    State.deleteTarget = null;
  });
  document.getElementById('delete-confirm-btn').addEventListener('click', handleDeleteConfirm);

  // --- フィード内のイベント委任（返信・削除ボタン） ---
  document.addEventListener('click', handleFeedClick);
}

// =============================================
//  ログイン処理
// =============================================

async function handleLogin() {
  const handle   = document.getElementById('login-handle').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const btn      = document.getElementById('login-btn');
  const errorEl  = document.getElementById('login-error');

  if (!handle || !password) {
    errorEl.textContent = 'ハンドルとアプリパスワードを入力してください';
    errorEl.classList.remove('hidden');
    return;
  }

  errorEl.classList.add('hidden');
  setButtonLoading(btn, true);

  try {
    const session = await apiLogin(handle, password);
    saveSession(session);
    State.session = session;
    showApp();
    await loadMyProfile();
    await loadTab('home');
    startNotifPolling();
  } catch (e) {
    errorEl.textContent = e.message;
    errorEl.classList.remove('hidden');
  } finally {
    setButtonLoading(btn, false);
  }
}

// =============================================
//  ログアウト
// =============================================

function handleLogout() {
  clearSession();
  State.session = null;
  State.myProfile = null;
  stopNotifPolling();
  showLoginScreen();
  // フィードをクリア
  ['home-feed','notifications-feed','myposts-feed','following-feed'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
  // カーソルリセット
  Object.keys(State.cursors).forEach(k => State.cursors[k] = null);
}

// =============================================
//  タブ切り替え
// =============================================

async function switchTab(tab) {
  State.currentTab = tab;

  // ナビアクティブ
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  // セクション切り替え
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  const tabEl = document.getElementById(`tab-${tab}`);
  if (tabEl) tabEl.classList.add('active');

  // 通知タブの場合は既読に
  if (tab === 'notifications') {
    document.getElementById('notif-badge').classList.add('hidden');
    apiUpdateNotificationSeen().catch(() => {});
  }

  // まだ読み込まれていない場合は読み込む
  const feedId = getTabFeedId(tab);
  const feedEl = feedId ? document.getElementById(feedId) : null;
  if (feedEl && feedEl.childElementCount === 0) {
    await loadTab(tab);
  }
}

function getTabFeedId(tab) {
  return { home: 'home-feed', notifications: 'notifications-feed', 'my-posts': 'myposts-feed', following: 'following-feed' }[tab] || null;
}

async function reloadTab(tab) {
  State.cursors[tab] = null;
  const feedId = getTabFeedId(tab);
  if (feedId) document.getElementById(feedId).innerHTML = '';
  await loadTab(tab);
}

// =============================================
//  各タブのデータ読み込み
// =============================================

async function loadTab(tab) {
  if (State.loading[tab]) return;
  State.loading[tab] = true;

  const feedId = getTabFeedId(tab);
  const feedEl = feedId ? document.getElementById(feedId) : null;

  try {
    switch (tab) {
      case 'home':          await loadHomeFeed(feedEl); break;
      case 'my-posts':      await loadMyPosts(feedEl);  break;
      case 'notifications': await loadNotifications(feedEl); break;
      case 'following':     await loadFollowing(feedEl); break;
    }
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    State.loading[tab] = false;
  }
}

async function loadHomeFeed(feedEl) {
  feedEl.innerHTML = renderSpinner();
  const data = await withTokenRefresh(() => apiGetTimeline(null));
  feedEl.innerHTML = '';
  State.cursors['home'] = data.cursor || null;

  if (!data.feed || data.feed.length === 0) {
    feedEl.innerHTML = renderEmpty('ホームタイムラインに投稿がありません');
    return;
  }

  const myDid = State.session?.did;
  for (const item of data.feed) {
    appendToFeed(feedEl, renderPostCard(item, myDid));
  }
  if (data.cursor) addLoadMoreButton(feedEl, 'home');
}

async function loadMyPosts(feedEl) {
  feedEl.innerHTML = renderSpinner();
  const data = await withTokenRefresh(() => apiGetMyPosts(null));
  feedEl.innerHTML = '';
  State.cursors['my-posts'] = data.cursor || null;

  if (!data.feed || data.feed.length === 0) {
    feedEl.innerHTML = renderEmpty('まだ投稿がありません');
    return;
  }

  const myDid = State.session?.did;
  for (const item of data.feed) {
    appendToFeed(feedEl, renderPostCard(item, myDid));
  }
  if (data.cursor) addLoadMoreButton(feedEl, 'my-posts');
}

async function loadNotifications(feedEl) {
  feedEl.innerHTML = renderSpinner();
  const data = await withTokenRefresh(() => apiGetNotifications(null));
  feedEl.innerHTML = '';
  State.cursors['notifications'] = data.cursor || null;

  if (!data.notifications || data.notifications.length === 0) {
    feedEl.innerHTML = renderEmpty('通知はありません');
    return;
  }

  for (const notif of data.notifications) {
    appendToFeed(feedEl, renderNotifCard(notif));
  }
  if (data.cursor) addLoadMoreButton(feedEl, 'notifications');
}

async function loadFollowing(feedEl) {
  feedEl.innerHTML = renderSpinner();
  const data = await withTokenRefresh(() => apiGetFollows(null));
  feedEl.innerHTML = '';
  State.cursors['following'] = data.cursor || null;

  if (!data.follows || data.follows.length === 0) {
    feedEl.innerHTML = renderEmpty('フォロー中のユーザーがいません');
    return;
  }

  for (const profile of data.follows) {
    appendToFeed(feedEl, renderFollowingCard(profile));
  }
  if (data.cursor) addLoadMoreButton(feedEl, 'following');
}

// =============================================
//  「もっと読む」ボタン
// =============================================

function addLoadMoreButton(feedEl, tab) {
  // 既存のボタンを削除
  feedEl.querySelector('.load-more-btn')?.remove();
  const btn = document.createElement('button');
  btn.className = 'load-more-btn';
  btn.textContent = 'もっと読み込む';
  btn.addEventListener('click', () => loadMore(tab, feedEl, btn));
  feedEl.appendChild(btn);
}

async function loadMore(tab, feedEl, btn) {
  if (State.loading[tab]) return;
  State.loading[tab] = true;
  btn.textContent = '読み込み中…';
  btn.disabled    = true;

  try {
    const cursor = State.cursors[tab];
    const myDid  = State.session?.did;
    let data;

    switch (tab) {
      case 'home':
        data = await withTokenRefresh(() => apiGetTimeline(cursor));
        btn.remove();
        for (const item of data.feed || []) appendToFeed(feedEl, renderPostCard(item, myDid));
        State.cursors[tab] = data.cursor || null;
        if (data.cursor) addLoadMoreButton(feedEl, tab);
        break;
      case 'my-posts':
        data = await withTokenRefresh(() => apiGetMyPosts(cursor));
        btn.remove();
        for (const item of data.feed || []) appendToFeed(feedEl, renderPostCard(item, myDid));
        State.cursors[tab] = data.cursor || null;
        if (data.cursor) addLoadMoreButton(feedEl, tab);
        break;
      case 'notifications':
        data = await withTokenRefresh(() => apiGetNotifications(cursor));
        btn.remove();
        for (const n of data.notifications || []) appendToFeed(feedEl, renderNotifCard(n));
        State.cursors[tab] = data.cursor || null;
        if (data.cursor) addLoadMoreButton(feedEl, tab);
        break;
      case 'following':
        data = await withTokenRefresh(() => apiGetFollows(cursor));
        btn.remove();
        for (const p of data.follows || []) appendToFeed(feedEl, renderFollowingCard(p));
        State.cursors[tab] = data.cursor || null;
        if (data.cursor) addLoadMoreButton(feedEl, tab);
        break;
    }
  } catch (e) {
    showToast(e.message, 'error');
    btn.textContent = 'もっと読み込む';
    btn.disabled    = false;
  } finally {
    State.loading[tab] = false;
  }
}

// =============================================
//  文字数カウント
// =============================================

function updateCharCount() {
  const text    = document.getElementById('compose-text').value;
  const remain  = 300 - [...text].length; // Unicodeコードポイント単位でカウント
  const el      = document.getElementById('char-count');
  el.textContent = remain;
  el.className  = 'char-count';
  if (remain <= 20)  el.classList.add('warn');
  if (remain < 0)    el.classList.add('danger');
}

// =============================================
//  画像添付
// =============================================

function handleImageSelect(e) {
  const files = Array.from(e.target.files);
  const remaining = 4 - State.pendingImages.length;
  const toAdd     = files.slice(0, remaining);

  if (files.length > remaining) {
    showToast(`画像は最大4枚まで添付できます。${remaining}枚を追加しました。`, 'info');
  }

  for (const file of toAdd) {
    if (!file.type.startsWith('image/')) continue;
    State.pendingImages.push(file);
  }

  renderImagePreviews();
  e.target.value = ''; // 同じファイルを再選択可能にする
}

function renderImagePreviews() {
  const area = document.getElementById('image-preview-area');
  if (State.pendingImages.length === 0) {
    area.classList.add('hidden');
    area.innerHTML = '';
    return;
  }
  area.classList.remove('hidden');
  area.innerHTML = State.pendingImages.map((file, i) => {
    const url = URL.createObjectURL(file);
    return `
    <div class="preview-thumb" data-index="${i}">
      <img src="${url}" alt="添付画像${i+1}" />
      <button class="preview-remove" data-index="${i}" title="削除">✕</button>
    </div>`;
  }).join('');

  // 削除ボタン
  area.querySelectorAll('.preview-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      State.pendingImages.splice(idx, 1);
      renderImagePreviews();
    });
  });
}

// =============================================
//  返信の設定・キャンセル
// =============================================

function setReplyTarget(uri, cid, handle) {
  // rootを取得するためにスレッドを確認する
  // シンプルに：replyの場合は同じURI/CIDをrootとして使う（一階層のみ対応）
  State.replyTarget = { uri, cid, rootUri: uri, rootCid: cid, handle };

  const ctx = document.getElementById('reply-context');
  document.getElementById('reply-to-text').textContent = `@${handle} への返信`;
  ctx.classList.remove('hidden');
  document.getElementById('compose-text').focus();

  // スレッドのrootを非同期で特定する
  withTokenRefresh(() => apiGetPostThread(uri)).then(data => {
    const thread = data.thread;
    if (thread?.root) {
      State.replyTarget.rootUri = thread.root.post?.uri || uri;
      State.replyTarget.rootCid = thread.root.post?.cid || cid;
    }
  }).catch(() => {});
}

function cancelReply() {
  State.replyTarget = null;
  document.getElementById('reply-context').classList.add('hidden');
  document.getElementById('reply-to-text').textContent = '返信先: ';
}

// =============================================
//  投稿処理
// =============================================

async function handlePost() {
  const textarea = document.getElementById('compose-text');
  const text     = textarea.value.trim();
  const btn      = document.getElementById('post-btn');

  if (!text && State.pendingImages.length === 0) {
    showToast('テキストまたは画像を入力してください', 'error');
    return;
  }

  if ([...text].length > 300) {
    showToast('300文字以内で入力してください', 'error');
    return;
  }

  setButtonLoading(btn, true);

  try {
    await withTokenRefresh(() => apiPost(text, State.pendingImages, State.replyTarget));

    // 入力クリア
    textarea.value = '';
    State.pendingImages = [];
    renderImagePreviews();
    cancelReply();
    updateCharCount();

    showToast('投稿しました！', 'success');

    // フィードを更新（ホームと自分の投稿）
    const tab = State.replyTarget ? 'home' : State.currentTab;
    await reloadTab('home');
    if (State.currentTab === 'my-posts') await reloadTab('my-posts');

  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

// =============================================
//  削除処理
// =============================================

function openDeleteModal(uri) {
  State.deleteTarget = uri;
  document.getElementById('delete-modal').classList.remove('hidden');
}

async function handleDeleteConfirm() {
  if (!State.deleteTarget) return;
  const uri = State.deleteTarget;
  const btn = document.getElementById('delete-confirm-btn');
  btn.disabled = true;
  btn.textContent = '削除中…';

  try {
    await withTokenRefresh(() => apiDeletePost(uri));

    // DOMから該当カードを削除
    const card = document.querySelector(`.post-card[data-uri="${CSS.escape(uri)}"]`);
    if (card) {
      card.style.transition = 'opacity .3s, transform .3s';
      card.style.opacity    = '0';
      card.style.transform  = 'translateX(20px)';
      setTimeout(() => card.remove(), 300);
    }

    showToast('投稿を削除しました', 'success');
    document.getElementById('delete-modal').classList.add('hidden');
    State.deleteTarget = null;
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = '削除する';
  }
}

// =============================================
//  フィード内クリックの委任処理
// =============================================

function handleFeedClick(e) {
  // 返信ボタン
  const replyBtn = e.target.closest('.reply-btn');
  if (replyBtn) {
    const uri    = replyBtn.dataset.uri;
    const cid    = replyBtn.dataset.cid;
    const handle = replyBtn.dataset.handle;
    setReplyTarget(uri, cid, handle);
    // 投稿エリアまでスクロール
    document.getElementById('compose-area').scrollIntoView({ behavior: 'smooth' });
    return;
  }

  // 削除ボタン
  const deleteBtn = e.target.closest('.delete-btn');
  if (deleteBtn) {
    openDeleteModal(deleteBtn.dataset.uri);
    return;
  }
}

// =============================================
//  通知ポーリング（30秒ごと）
// =============================================

let notifInterval = null;

async function checkUnreadNotifications() {
  try {
    const data = await withTokenRefresh(() => apiGetNotifications(null));
    const unread = (data.notifications || []).filter(n => !n.isRead).length;
    const badge  = document.getElementById('notif-badge');
    if (unread > 0) {
      badge.textContent = unread > 99 ? '99+' : unread;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } catch (_) {}
}

function startNotifPolling() {
  checkUnreadNotifications();
  notifInterval = setInterval(checkUnreadNotifications, 30000);
}

function stopNotifPolling() {
  if (notifInterval) {
    clearInterval(notifInterval);
    notifInterval = null;
  }
}

// =============================================
//  起動
// =============================================

document.addEventListener('DOMContentLoaded', init);
