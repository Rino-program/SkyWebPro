/**
 * SkyDeck — app.js  v3.0
 */

const S = {
  session: null, myProfile: null,
  tab: 'home', homeSubTab: 'following', notifSubTab: 'all', searchTab: 'posts',
  replyTarget: null, pendingImgs: [], deleteTarget: null,
  cursors: {}, loading: {},
  activeConvoId: null,
  cachedNotifs: [],
};

// =============================================
//  初期化
// =============================================
async function init() {
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
}
function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
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
    if (banner) banner.style.backgroundImage = p.banner ? `url(${p.banner})` : '';
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
  document.querySelectorAll('.tab-section').forEach(s => s.classList.toggle('active', s.id === `tab-${tab}`));
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
    else if (tab === 'profile')  await loadProfile();
    else if (tab === 'lists')    await loadLists();
    else if (tab === 'dm')       await loadDM();
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
  const r = 300 - [...t].length;
  const el = document.getElementById('char-count');
  el.textContent = r;
  el.className = 'char-count' + (r <= 20 ? ' warn' : '') + (r < 0 ? ' danger' : '');
}

function handleImageSelect(e) {
  const files = Array.from(e.target.files);
  const rem = 4 - S.pendingImgs.length;
  S.pendingImgs.push(...files.filter(f => f.type.startsWith('image/')).slice(0, rem));
  if (files.length > rem) showToast(`画像は最大4枚です。${Math.max(0,rem)}枚追加しました。`, 'info');
  renderPreviews();
  e.target.value = '';
}

function renderPreviews() {
  const area = document.getElementById('image-preview-area');
  if (!S.pendingImgs.length) { area.classList.add('hidden'); area.innerHTML = ''; return; }
  area.classList.remove('hidden');
  area.innerHTML = S.pendingImgs.map((f, i) => `
    <div class="preview-thumb">
      <img src="${URL.createObjectURL(f)}" alt=""/>
      <button class="preview-rm" data-i="${i}">✕</button>
    </div>`).join('');
  area.querySelectorAll('.preview-rm').forEach(b => b.addEventListener('click', () => { S.pendingImgs.splice(+b.dataset.i, 1); renderPreviews(); }));
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
  if ([...text].length > 300) { showToast('300文字以内にしてください', 'error'); return; }
  setLoading(btn, true);
  try {
    await withAuth(() => apiPost(text, S.pendingImgs, S.replyTarget, restriction));
    ta.value = ''; S.pendingImgs = []; renderPreviews(); cancelReply(); updateCharCount();
    showToast('投稿しました！', 'success');
    reloadTab('home');
    if (S.tab === 'profile') reloadTab('profile');
  } catch(e) { showToast(e.message, 'error'); }
  finally { setLoading(btn, false); }
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
  document.getElementById('compose-text').addEventListener('keydown', e => { if ((e.metaKey||e.ctrlKey) && e.key === 'Enter') handlePost(); });
  document.getElementById('image-input').addEventListener('change', handleImageSelect);
  document.getElementById('post-btn').addEventListener('click', handlePost);
  document.getElementById('cancel-reply-btn').addEventListener('click', cancelReply);
  document.getElementById('save-draft-btn').addEventListener('click', saveDraftAndClear);
  document.getElementById('drafts-btn').addEventListener('click', toggleDrafts);

  // 削除モーダル
  document.getElementById('delete-cancel-btn').addEventListener('click', () => { document.getElementById('delete-modal').classList.add('hidden'); S.deleteTarget = null; });
  document.getElementById('delete-confirm-btn').addEventListener('click', confirmDelete);

  // DM
  document.getElementById('dm-send-btn').addEventListener('click', sendDM);
  document.getElementById('dm-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendDM(); } });
  document.getElementById('dm-back-btn').addEventListener('click', () => document.getElementById('dm-chat-panel').classList.add('hidden'));

  // リストバック
  document.getElementById('list-back-btn').addEventListener('click', () => document.getElementById('list-feed-container').classList.add('hidden'));

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
