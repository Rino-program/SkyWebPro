/**
 * SkyDeck — app.js  v2.0
 * アプリケーション全体のロジック・状態管理
 */

// =============================================
//  状態
// =============================================
const S = {
  session:     null,
  myProfile:   null,
  tab:         'home',       // home | notifications | search | dm | lists | profile | settings
  homeSubTab:  'following',  // discover | following | video
  notifSubTab: 'all',        // all | mention
  searchTab:   'posts',      // posts | users
  replyTarget: null,         // { uri, cid, rootUri, rootCid, handle }
  pendingImgs: [],
  deleteTarget:null,
  draftsOpen:  false,
  cursors:     {},
  loading:     {},
  // DM
  activeConvoId: null,
  // Lists
  activelist:  null,
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
    loadTab('home');
    startNotifPoll();
  } else {
    showLogin();
  }
  bindAll();
}

// =============================================
//  ログイン/ログアウト
// =============================================
function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
}

async function handleLogin() {
  const handle = document.getElementById('login-handle').value;
  const pass   = document.getElementById('login-password').value;
  const btn    = document.getElementById('login-btn');
  const errEl  = document.getElementById('login-error');
  errEl.classList.add('hidden');
  if (!handle || !pass) { errEl.textContent='ハンドルとアプリパスワードを入力してください'; errEl.classList.remove('hidden'); return; }
  setLoading(btn, true);
  try {
    const sess = await apiLogin(handle, pass);
    saveSession(sess);
    S.session = sess;
    showApp();
    await loadMyProfile();
    loadTab('home');
    startNotifPoll();
    document.getElementById('login-password').value = '';
  } catch(e) {
    errEl.innerHTML = escapeHtml(e.message).replace(/\n/g,'<br>');
    errEl.classList.remove('hidden');
  } finally { setLoading(btn, false); }
}

function handleLogout() {
  clearSession();
  S.session = null; S.myProfile = null;
  stopNotifPoll();
  showLogin();
  Object.keys(S.cursors).forEach(k=>delete S.cursors[k]);
  document.querySelectorAll('.feed').forEach(f=>f.innerHTML='');
}

async function loadMyProfile() {
  try {
    const p = await withAuth(()=>apiGetProfile());
    S.myProfile = p;
    document.getElementById('user-avatar').src        = p.avatar||'';
    document.getElementById('user-displayname').textContent = p.displayName||p.handle;
    document.getElementById('user-handle').textContent      = `@${p.handle}`;
    document.getElementById('compose-avatar').src    = p.avatar||'';
    document.getElementById('prof-avatar-img').src   = p.avatar||'';
    document.getElementById('prof-banner-img').style.backgroundImage = p.banner ? `url(${p.banner})` : '';
    document.getElementById('prof-displayname').textContent = p.displayName||p.handle;
    document.getElementById('prof-handle').textContent      = `@${p.handle}`;
    document.getElementById('prof-desc').textContent        = p.description||'';
    document.getElementById('prof-followers').textContent   = p.followersCount||0;
    document.getElementById('prof-following').textContent   = p.followsCount||0;
    document.getElementById('prof-posts').textContent       = p.postsCount||0;
    // プロフィール編集フォームに反映
    document.getElementById('edit-displayname').value = p.displayName||'';
    document.getElementById('edit-description').value = p.description||'';
  } catch(e) { console.error('プロフィール取得失敗:', e); }
}

// =============================================
//  タブ切り替え
// =============================================
function switchTab(tab) {
  S.tab = tab;
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  document.querySelectorAll('.tab-section').forEach(s=>s.classList.toggle('active', s.id===`tab-${tab}`));
  if (tab==='notifications') {
    document.getElementById('notif-badge').classList.add('hidden');
    apiUpdateNotificationSeen();
  }
  const feedId = { home:'home-feed', notifications:'notif-feed', search:'search-feed',
                   dm:'dm-list', lists:'lists-feed', profile:'profile-feed', settings:null }[tab];
  if (feedId && document.getElementById(feedId)?.childElementCount===0) loadTab(tab);
}

function switchHomeSubTab(sub) {
  S.homeSubTab = sub; S.cursors['home'] = null;
  document.querySelectorAll('#tab-home .sub-tab').forEach(b=>b.classList.toggle('active',b.dataset.sub===sub));
  const feed = document.getElementById('home-feed');
  feed.innerHTML = ''; loadTab('home');
}

function switchNotifSubTab(sub) {
  S.notifSubTab = sub;
  document.querySelectorAll('#tab-notifications .sub-tab').forEach(b=>b.classList.toggle('active',b.dataset.sub===sub));
  renderNotifFilter();
}

function switchSearchTab(sub) {
  S.searchTab = sub;
  document.querySelectorAll('#tab-search .sub-tab').forEach(b=>b.classList.toggle('active',b.dataset.sub===sub));
}

// =============================================
//  データ読み込み
// =============================================
async function loadTab(tab) {
  if (S.loading[tab]) return; S.loading[tab] = true;
  try {
    if (tab==='home')          await loadHome();
    if (tab==='notifications') await loadNotifications();
    if (tab==='profile')       await loadProfile();
    if (tab==='lists')         await loadLists();
    if (tab==='dm')            await loadDM();
  } catch(e) { showToast(e.message,'error'); }
  finally { S.loading[tab]=false; }
}

async function reloadTab(tab) {
  S.cursors[tab]=null;
  const feedId={home:'home-feed',notifications:'notif-feed',profile:'profile-feed',lists:'lists-feed',dm:'dm-list'}[tab];
  if (feedId) document.getElementById(feedId).innerHTML='';
  await loadTab(tab);
}

// --- Home ---
async function loadHome() {
  const feed = document.getElementById('home-feed');
  feed.innerHTML = renderSpinner();
  const cursor = S.cursors['home']||null;
  let data;
  if (S.homeSubTab==='discover')   data = await withAuth(()=>apiGetDiscover(cursor));
  else if (S.homeSubTab==='video') data = await withAuth(()=>apiGetVideoFeed(cursor));
  else                             data = await withAuth(()=>apiGetTimeline(cursor));
  feed.innerHTML = '';
  S.cursors['home'] = data.cursor||null;
  if (!data.feed?.length) { feed.innerHTML=renderEmpty('タイムラインに投稿がありません'); return; }
  const myDid = S.session?.did;
  data.feed.forEach(item=>appendCards(feed, renderPostCard(item, myDid)));
  if (data.cursor) addLoadMoreBtn(feed, 'home', S.homeSubTab);
}

// --- Notifications ---
let cachedNotifs = [];
async function loadNotifications() {
  const feed = document.getElementById('notif-feed');
  feed.innerHTML = renderSpinner();
  const data = await withAuth(()=>apiGetNotifications(null));
  cachedNotifs = data.notifications||[];
  S.cursors['notifications'] = data.cursor||null;
  renderNotifFilter();
}

function renderNotifFilter() {
  const feed = document.getElementById('notif-feed');
  feed.innerHTML = '';
  let notifs = cachedNotifs;
  if (S.notifSubTab==='mention') notifs = notifs.filter(n=>n.reason==='mention'||n.reason==='reply');
  if (!notifs.length) { feed.innerHTML=renderEmpty('通知はありません'); return; }
  notifs.forEach(n=>appendCards(feed, renderNotifCard(n)));
}

// --- Profile ---
async function loadProfile() {
  const feed = document.getElementById('profile-feed');
  feed.innerHTML = renderSpinner();
  const actor = S.myProfile?.handle || S.session?.handle;
  const data = await withAuth(()=>apiGetAuthorFeed(actor,'posts_no_replies',null));
  feed.innerHTML='';
  S.cursors['profile'] = data.cursor||null;
  if (!data.feed?.length) { feed.innerHTML=renderEmpty('投稿がありません'); return; }
  const myDid = S.session?.did;
  data.feed.forEach(item=>appendCards(feed, renderPostCard(item,myDid)));
  if (data.cursor) addLoadMoreBtn(feed,'profile','');
}

// --- Lists ---
async function loadLists() {
  const feed = document.getElementById('lists-feed');
  feed.innerHTML = renderSpinner();
  const data = await withAuth(()=>apiGetLists());
  feed.innerHTML='';
  if (!data.lists?.length) { feed.innerHTML=renderEmpty('リストがありません'); return; }
  data.lists.forEach(list=>{
    appendCards(feed, `<div class="list-card" data-uri="${escapeHtml(list.uri)}">
      <div class="list-card-info">
        <div class="list-card-name">${escapeHtml(list.name)}</div>
        ${list.description?`<div class="list-card-desc">${escapeHtml(list.description.slice(0,60))}</div>`:''}
        <div class="list-card-count">${list.listItemCount||0}人</div>
      </div>
      <button class="btn-sm" data-list-uri="${escapeHtml(list.uri)}">フィードを見る</button>
    </div>`);
  });
}

async function loadListFeed(listUri) {
  S.activelist = listUri;
  const feed = document.getElementById('lists-feed');
  const back = document.getElementById('list-feed-container');
  back.classList.remove('hidden');
  document.getElementById('list-feed').innerHTML = renderSpinner();
  const data = await withAuth(()=>apiGetListFeed(listUri,null));
  document.getElementById('list-feed').innerHTML='';
  if (!data.feed?.length) { document.getElementById('list-feed').innerHTML=renderEmpty(); return; }
  const myDid=S.session?.did;
  data.feed.forEach(item=>appendCards(document.getElementById('list-feed'),renderPostCard(item,myDid)));
}

// --- DM ---
async function loadDM() {
  const list = document.getElementById('dm-list');
  list.innerHTML = renderSpinner();
  try {
    const data = await withAuth(()=>apiGetConversations(null));
    list.innerHTML='';
    if (!data.convos?.length) { list.innerHTML=renderEmpty('DMはありません'); return; }
    data.convos.forEach(c=>{
      const members = (c.members||[]).filter(m=>m.did!==S.session?.did);
      const other = members[0];
      if (!other) return;
      appendCards(list, `<div class="dm-convo-card" data-convo-id="${escapeHtml(c.id)}">
        <img class="dm-avatar" src="${escapeHtml(other.avatar||'')}" alt="${escapeHtml(other.displayName||other.handle)}" onerror="this.src=''"/>
        <div class="dm-info">
          <div class="dm-name">${escapeHtml(other.displayName||other.handle)}</div>
          <div class="dm-preview">${c.lastMessage?.text ? escapeHtml(c.lastMessage.text.slice(0,40)) : ''}</div>
        </div>
        ${c.unreadCount>0?`<span class="dm-badge">${c.unreadCount}</span>`:''}
      </div>`);
    });
  } catch(e) {
    list.innerHTML=renderEmpty('DM機能はBluesky Chatが有効なアカウントのみ利用可能です');
  }
}

async function openConvo(convoId) {
  S.activeConvoId = convoId;
  document.getElementById('dm-chat-panel').classList.remove('hidden');
  document.getElementById('dm-messages').innerHTML = renderSpinner();
  try {
    const data = await withAuth(()=>apiGetMessages(convoId,null));
    const msgs = (data.messages||[]).reverse();
    document.getElementById('dm-messages').innerHTML='';
    msgs.forEach(m=>{
      const mine = m.sender?.did===S.session?.did;
      appendCards(document.getElementById('dm-messages'),
        `<div class="dm-msg ${mine?'mine':'theirs'}">
          <div class="dm-bubble">${escapeHtml(m.text||'')}</div>
          <div class="dm-msg-time">${formatTime(m.sentAt)}</div>
        </div>`);
    });
    document.getElementById('dm-messages').scrollTop = 9999;
  } catch(e) { document.getElementById('dm-messages').innerHTML=renderEmpty(e.message); }
}

async function sendDM() {
  const inp = document.getElementById('dm-input');
  const text = inp.value.trim();
  if (!text || !S.activeConvoId) return;
  inp.value='';
  try {
    await withAuth(()=>apiSendMessage(S.activeConvoId, text));
    await openConvo(S.activeConvoId);
  } catch(e) { showToast(e.message,'error'); }
}

// =============================================
//  検索
// =============================================
let searchTimer = null;
function handleSearchInput(q) {
  clearTimeout(searchTimer);
  if (!q.trim()) { document.getElementById('search-feed').innerHTML=''; return; }
  searchTimer = setTimeout(()=>execSearch(q.trim()), 500);
}

async function execSearch(q) {
  const feed = document.getElementById('search-feed');
  feed.innerHTML = renderSpinner();
  try {
    if (S.searchTab==='posts') {
      const data = await withAuth(()=>apiSearchPosts(q,null));
      feed.innerHTML='';
      if (!data.posts?.length) { feed.innerHTML=renderEmpty('投稿が見つかりません'); return; }
      const myDid=S.session?.did;
      data.posts.forEach(p=>appendCards(feed, renderPostCard({post:p},myDid)));
    } else {
      const data = await withAuth(()=>apiSearchActors(q,null));
      feed.innerHTML='';
      if (!data.actors?.length) { feed.innerHTML=renderEmpty('ユーザーが見つかりません'); return; }
      data.actors.forEach(a=>appendCards(feed, renderUserCard(a,true)));
    }
  } catch(e) { feed.innerHTML=renderEmpty(e.message); }
}

// =============================================
//  投稿
// =============================================
function updateCharCount() {
  const t = document.getElementById('compose-text').value;
  const r = 300 - [...t].length;
  const el = document.getElementById('char-count');
  el.textContent = r;
  el.className = 'char-count' + (r<=20?' warn':'') + (r<0?' danger':'');
}

function handleImageSelect(e) {
  const files = Array.from(e.target.files);
  const rem = 4 - S.pendingImgs.length;
  S.pendingImgs.push(...files.filter(f=>f.type.startsWith('image/')).slice(0,rem));
  if (files.length > rem) showToast(`画像は最大4枚です。${rem}枚を追加しました。`,'info');
  renderPreviews();
  e.target.value='';
}

function renderPreviews() {
  const area = document.getElementById('image-preview-area');
  if (!S.pendingImgs.length) { area.classList.add('hidden'); area.innerHTML=''; return; }
  area.classList.remove('hidden');
  area.innerHTML = S.pendingImgs.map((f,i)=>`
    <div class="preview-thumb">
      <img src="${URL.createObjectURL(f)}" alt=""/>
      <button class="preview-rm" data-i="${i}">✕</button>
    </div>`).join('');
  area.querySelectorAll('.preview-rm').forEach(b=>b.addEventListener('click',()=>{ S.pendingImgs.splice(+b.dataset.i,1); renderPreviews(); }));
}

function setReply(uri,cid,handle) {
  S.replyTarget = { uri, cid, rootUri:uri, rootCid:cid, handle };
  document.getElementById('reply-ctx').classList.remove('hidden');
  document.getElementById('reply-to-text').textContent = `@${handle} への返信`;
  document.getElementById('compose-text').focus();
  withAuth(()=>apiGetPostThread(uri)).then(d=>{
    if (d.thread?.root?.post) { S.replyTarget.rootUri=d.thread.root.post.uri; S.replyTarget.rootCid=d.thread.root.post.cid; }
  }).catch(()=>{});
}

function cancelReply() {
  S.replyTarget=null;
  document.getElementById('reply-ctx').classList.add('hidden');
}

async function handlePost() {
  const ta   = document.getElementById('compose-text');
  const text = ta.value.trim();
  const btn  = document.getElementById('post-btn');
  const restriction = document.getElementById('reply-restriction').value;
  if (!text && !S.pendingImgs.length) { showToast('テキストまたは画像を入力してください','error'); return; }
  if ([...text].length>300) { showToast('300文字以内にしてください','error'); return; }
  setLoading(btn,true);
  try {
    await withAuth(()=>apiPost(text, S.pendingImgs, S.replyTarget, restriction));
    ta.value=''; S.pendingImgs=[]; renderPreviews(); cancelReply(); updateCharCount();
    showToast('投稿しました！','success');
    reloadTab('home');
    if (S.tab==='profile') reloadTab('profile');
  } catch(e) { showToast(e.message,'error'); }
  finally { setLoading(btn,false); }
}

// 下書き
function saveDraftAndClear() {
  const text = document.getElementById('compose-text').value.trim();
  if (!text) { showToast('テキストを入力してください','error'); return; }
  saveDraft(text);
  document.getElementById('compose-text').value='';
  updateCharCount();
  showToast('下書きを保存しました','success');
}

function toggleDrafts() {
  S.draftsOpen = !S.draftsOpen;
  const panel = document.getElementById('drafts-panel');
  panel.classList.toggle('hidden', !S.draftsOpen);
  if (S.draftsOpen) renderDraftsPanel();
}

function renderDraftsPanel() {
  const list = document.getElementById('drafts-list');
  const drafts = getDrafts();
  if (!drafts.length) { list.innerHTML='<div style="padding:12px;color:var(--text-3);font-size:.85rem">下書きがありません</div>'; return; }
  list.innerHTML = drafts.map(d=>`
    <div class="draft-item">
      <div class="draft-text">${escapeHtml(d.text.slice(0,60))}${d.text.length>60?'…':''}</div>
      <div class="draft-time">${formatTime(d.savedAt)}</div>
      <div class="draft-actions">
        <button class="btn-sm" data-draft-id="${d.id}" data-action="use">使用</button>
        <button class="btn-sm danger" data-draft-id="${d.id}" data-action="del">削除</button>
      </div>
    </div>`).join('');
  list.querySelectorAll('[data-draft-id]').forEach(b=>{
    b.addEventListener('click',()=>{
      const draft = getDrafts().find(d=>d.id===+b.dataset.draftId);
      if (!draft) return;
      if (b.dataset.action==='use') {
        document.getElementById('compose-text').value = draft.text;
        updateCharCount();
        S.draftsOpen=false;
        document.getElementById('drafts-panel').classList.add('hidden');
      } else {
        deleteDraft(+b.dataset.draftId);
        renderDraftsPanel();
      }
    });
  });
}

// =============================================
//  いいね・リポスト
// =============================================
async function handleLike(btn) {
  const { uri, cid } = btn.dataset;
  const likeUri = btn.dataset.likeUri;
  const liked = btn.classList.contains('active');
  // 楽観的UI
  btn.classList.toggle('active', !liked);
  const countEl = btn.querySelector('span') || btn;
  const c = parseInt(btn.textContent.replace(/[^0-9]/g,''))||0;
  btn.innerHTML = btn.innerHTML.replace(/\d+/, liked ? Math.max(0,c-1) : c+1);
  try {
    if (liked) {
      await withAuth(()=>apiUnlike(likeUri));
      btn.dataset.likeUri='';
    } else {
      const r = await withAuth(()=>apiLike(uri,cid));
      btn.dataset.likeUri = r.uri||'';
    }
  } catch(e) {
    btn.classList.toggle('active', liked); // ロールバック
    showToast(e.message,'error');
  }
}

async function handleRepost(btn) {
  const { uri, cid } = btn.dataset;
  const repostUri = btn.dataset.repostUri;
  const reposted = btn.classList.contains('active');
  btn.classList.toggle('active', !reposted);
  try {
    if (reposted) {
      await withAuth(()=>apiUnrepost(repostUri));
      btn.dataset.repostUri='';
    } else {
      const r = await withAuth(()=>apiRepost(uri,cid));
      btn.dataset.repostUri = r.uri||'';
    }
    showToast(reposted?'リポストを解除しました':'リポストしました','success');
  } catch(e) {
    btn.classList.toggle('active', reposted);
    showToast(e.message,'error');
  }
}

// =============================================
//  削除
// =============================================
function openDeleteModal(uri) {
  S.deleteTarget=uri;
  document.getElementById('delete-modal').classList.remove('hidden');
}

async function confirmDelete() {
  if (!S.deleteTarget) return;
  const btn=document.getElementById('delete-confirm-btn');
  btn.disabled=true; btn.textContent='削除中…';
  try {
    await withAuth(()=>apiDeletePost(S.deleteTarget));
    const card = document.querySelector(`.post-card[data-uri="${CSS.escape(S.deleteTarget)}"]`);
    if (card) { card.style.transition='opacity .3s'; card.style.opacity='0'; setTimeout(()=>card.remove(),300); }
    showToast('削除しました','success');
    document.getElementById('delete-modal').classList.add('hidden');
    S.deleteTarget=null;
  } catch(e) { showToast(e.message,'error'); }
  finally { btn.disabled=false; btn.textContent='削除する'; }
}

// =============================================
//  フォロー
// =============================================
async function handleFollowToggle(btn) {
  const { did, followUri } = btn.dataset;
  const following = btn.classList.contains('following');
  btn.disabled=true;
  try {
    if (following) {
      await withAuth(()=>apiUnfollow(followUri));
      btn.classList.remove('following');
      btn.textContent='フォロー';
      btn.dataset.followUri='';
    } else {
      const r = await withAuth(()=>apiFollow(did));
      btn.classList.add('following');
      btn.textContent='フォロー中';
      btn.dataset.followUri=r.uri||'';
    }
  } catch(e) { showToast(e.message,'error'); }
  finally { btn.disabled=false; }
}

// =============================================
//  プロフィール編集
// =============================================
async function handleProfileSave() {
  const displayName = document.getElementById('edit-displayname').value.trim();
  const description = document.getElementById('edit-description').value.trim();
  const avatarFile  = document.getElementById('edit-avatar-file').files[0]||null;
  const bannerFile  = document.getElementById('edit-banner-file').files[0]||null;
  const btn = document.getElementById('profile-save-btn');
  setLoading(btn,true);
  try {
    await withAuth(()=>apiUpdateProfile({ displayName, description, avatarFile, bannerFile }));
    showToast('プロフィールを更新しました','success');
    await loadMyProfile();
    // プロフィールタブを再読み込み
    document.getElementById('profile-feed').innerHTML='';
    if (S.tab==='profile') loadTab('profile');
  } catch(e) { showToast(e.message,'error'); }
  finally { setLoading(btn,false); }
}

// =============================================
//  通知ポーリング
// =============================================
let notifInterval=null;
async function checkNotif() {
  try {
    const d = await withAuth(()=>apiGetUnreadCount());
    const n = d.count||0;
    const badge=document.getElementById('notif-badge');
    if (n>0) { badge.textContent=n>99?'99+':n; badge.classList.remove('hidden'); }
    else badge.classList.add('hidden');
  } catch{}
}
function startNotifPoll() { checkNotif(); notifInterval=setInterval(checkNotif,30000); }
function stopNotifPoll()  { clearInterval(notifInterval); }

// =============================================
//  イベントバインド
// =============================================
function bindAll() {
  // ログイン
  document.getElementById('login-btn').addEventListener('click', handleLogin);
  document.getElementById('login-password').addEventListener('keydown',e=>{ if(e.key==='Enter') handleLogin(); });

  // ログアウト
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  // ナビ
  document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));

  // ホームサブタブ
  document.querySelectorAll('#tab-home .sub-tab').forEach(b=>b.addEventListener('click',()=>switchHomeSubTab(b.dataset.sub)));

  // 通知サブタブ
  document.querySelectorAll('#tab-notifications .sub-tab').forEach(b=>b.addEventListener('click',()=>switchNotifSubTab(b.dataset.sub)));

  // 検索サブタブ
  document.querySelectorAll('#tab-search .sub-tab').forEach(b=>b.addEventListener('click',()=>switchSearchTab(b.dataset.sub)));

  // 検索入力
  document.getElementById('search-input').addEventListener('input',e=>handleSearchInput(e.target.value));
  document.getElementById('search-input').addEventListener('keydown',e=>{ if(e.key==='Enter') execSearch(e.target.value.trim()); });

  // リフレッシュ
  document.querySelectorAll('.refresh-btn').forEach(b=>b.addEventListener('click',()=>{
    b.classList.add('spinning');
    reloadTab(b.dataset.target).finally(()=>setTimeout(()=>b.classList.remove('spinning'),500));
  }));

  // compose
  document.getElementById('compose-text').addEventListener('input', updateCharCount);
  document.getElementById('compose-text').addEventListener('keydown',e=>{ if((e.metaKey||e.ctrlKey)&&e.key==='Enter') handlePost(); });
  document.getElementById('image-input').addEventListener('change', handleImageSelect);
  document.getElementById('post-btn').addEventListener('click', handlePost);
  document.getElementById('cancel-reply-btn').addEventListener('click', cancelReply);
  document.getElementById('save-draft-btn').addEventListener('click', saveDraftAndClear);
  document.getElementById('drafts-btn').addEventListener('click', toggleDrafts);

  // 削除モーダル
  document.getElementById('delete-cancel-btn').addEventListener('click',()=>{ document.getElementById('delete-modal').classList.add('hidden'); S.deleteTarget=null; });
  document.getElementById('delete-confirm-btn').addEventListener('click', confirmDelete);

  // DM
  document.getElementById('dm-send-btn').addEventListener('click', sendDM);
  document.getElementById('dm-input').addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendDM();} });
  document.getElementById('dm-back-btn').addEventListener('click',()=>document.getElementById('dm-chat-panel').classList.add('hidden'));

  // リストバック
  document.getElementById('list-back-btn').addEventListener('click',()=>document.getElementById('list-feed-container').classList.add('hidden'));

  // プロフィール編集
  document.getElementById('profile-save-btn').addEventListener('click', handleProfileSave);
  document.getElementById('edit-avatar-file').addEventListener('change',e=>{
    const f=e.target.files[0]; if(f) document.getElementById('prof-avatar-img').src=URL.createObjectURL(f);
  });
  document.getElementById('edit-banner-file').addEventListener('change',e=>{
    const f=e.target.files[0]; if(f) document.getElementById('prof-banner-img').style.backgroundImage=`url(${URL.createObjectURL(f)})`;
  });

  // 委任クリック
  document.addEventListener('click', e=>{
    // 返信
    const rBtn = e.target.closest('.reply-btn');
    if (rBtn) { setReply(rBtn.dataset.uri,rBtn.dataset.cid,rBtn.dataset.handle); document.getElementById('compose-area').scrollIntoView({behavior:'smooth'}); return; }
    // いいね
    const lBtn = e.target.closest('.like-btn');
    if (lBtn) { handleLike(lBtn); return; }
    // リポスト
    const rpBtn = e.target.closest('.repost-btn');
    if (rpBtn) { handleRepost(rpBtn); return; }
    // 削除
    const dBtn = e.target.closest('.delete-btn');
    if (dBtn) { openDeleteModal(dBtn.dataset.uri); return; }
    // フォロートグル
    const fBtn = e.target.closest('.follow-toggle-btn');
    if (fBtn) { handleFollowToggle(fBtn); return; }
    // リストフィード
    const lCard = e.target.closest('[data-list-uri]');
    if (lCard) { loadListFeed(lCard.dataset.listUri); return; }
    // DM会話
    const dCard = e.target.closest('.dm-convo-card');
    if (dCard) { openConvo(dCard.dataset.convoId); return; }
    // もっと読む
    const mBtn = e.target.closest('.load-more-btn');
    if (mBtn) { handleLoadMore(mBtn); return; }
  });
}

// =============================================
//  もっと読む
// =============================================
async function handleLoadMore(btn) {
  const tab = btn.dataset.tab;
  if (S.loading[tab]) return;
  S.loading[tab]=true;
  btn.textContent='読み込み中…'; btn.disabled=true;
  const feedId={home:'home-feed',notifications:'notif-feed',profile:'profile-feed',lists:'list-feed'}[tab];
  const feed = document.getElementById(feedId);
  try {
    const cursor = S.cursors[tab];
    const myDid  = S.session?.did;
    let data;
    if (tab==='home') {
      if (S.homeSubTab==='discover') data=await withAuth(()=>apiGetDiscover(cursor));
      else data=await withAuth(()=>apiGetTimeline(cursor));
      btn.remove();
      data.feed?.forEach(i=>appendCards(feed,renderPostCard(i,myDid)));
      S.cursors[tab]=data.cursor||null;
      if (data.cursor) addLoadMoreBtn(feed,tab,'');
    } else if (tab==='profile') {
      data=await withAuth(()=>apiGetAuthorFeed(S.myProfile?.handle,'posts_no_replies',cursor));
      btn.remove();
      data.feed?.forEach(i=>appendCards(feed,renderPostCard(i,myDid)));
      S.cursors[tab]=data.cursor||null;
      if (data.cursor) addLoadMoreBtn(feed,tab,'');
    } else if (tab==='notifications') {
      data=await withAuth(()=>apiGetNotifications(cursor));
      btn.remove();
      cachedNotifs=[...cachedNotifs,...(data.notifications||[])];
      renderNotifFilter();
    }
  } catch(e) { showToast(e.message,'error'); btn.textContent='もっと読み込む'; btn.disabled=false; }
  finally { S.loading[tab]=false; }
}

document.addEventListener('DOMContentLoaded', init);
