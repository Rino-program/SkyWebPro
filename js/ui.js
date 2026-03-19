/**
 * SkyDeck — ui.js  v2.0
 * UIレンダリング・ユーティリティ
 */

// =============================================
//  ユーティリティ
// =============================================
function escapeHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatTime(iso) {
  const d = new Date(iso), n = new Date(), diff = (n - d) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}秒前`;
  if (diff < 3600)  return `${Math.floor(diff/60)}分前`;
  if (diff < 86400) return `${Math.floor(diff/3600)}時間前`;
  if (diff < 86400*7) return `${Math.floor(diff/86400)}日前`;
  return d.toLocaleDateString('ja-JP', { month:'short', day:'numeric' });
}

function renderRichText(text, facets = []) {
  if (!facets?.length) return escapeHtml(text).replace(/\n/g,'<br>');
  const enc = new TextEncoder(), dec = new TextDecoder();
  const bytes = enc.encode(text);
  const sorted = [...facets].sort((a,b)=>a.index.byteStart-b.index.byteStart);
  let result = '', pos = 0;
  for (const f of sorted) {
    const { byteStart: bs, byteEnd: be } = f.index;
    if (bs > pos) result += escapeHtml(dec.decode(bytes.slice(pos, bs)));
    const seg = escapeHtml(dec.decode(bytes.slice(bs, be)));
    const feat = f.features[0];
    if (feat?.$type === 'app.bsky.richtext.facet#link')
      result += `<a href="${escapeHtml(feat.uri)}" target="_blank" rel="noopener">${seg}</a>`;
    else if (feat?.$type === 'app.bsky.richtext.facet#mention')
      result += `<a href="https://bsky.app/profile/${feat.did}" target="_blank" rel="noopener">${seg}</a>`;
    else if (feat?.$type === 'app.bsky.richtext.facet#tag')
      result += `<a href="https://bsky.app/hashtag/${feat.tag}" target="_blank" rel="noopener">${seg}</a>`;
    else result += seg;
    pos = be;
  }
  if (pos < bytes.length) result += escapeHtml(dec.decode(bytes.slice(pos)));
  return result.replace(/\n/g,'<br>');
}

function renderSpinner() {
  return `<div class="feed-spinner"><svg width="28" height="28" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40" stroke-dashoffset="20" class="spin-el"/></svg></div>`;
}

function renderEmpty(msg='表示する内容がありません') {
  return `<div class="empty-state"><div class="empty-icon">🌤</div><div>${escapeHtml(msg)}</div></div>`;
}

function showToast(msg, type='info', dur=3200) {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  // 改行を<br>で表示
  t.innerHTML = escapeHtml(msg).replace(/\n/g,'<br>');
  c.appendChild(t);
  setTimeout(()=>{ t.style.animation='toastOut .25s ease forwards'; setTimeout(()=>t.remove(),260); }, dur);
}

function setLoading(btn, on) {
  const txt = btn.querySelector('.btn-text'), sp = btn.querySelector('.btn-spinner');
  btn.disabled = on;
  txt?.classList.toggle('hidden', on);
  sp?.classList.toggle('hidden', !on);
}

// =============================================
//  投稿カード
// =============================================
function getEmbedImages(embed) {
  if (!embed) return [];
  if (embed.$type === 'app.bsky.embed.images#view') return embed.images||[];
  if (embed.$type === 'app.bsky.embed.recordWithMedia#view') return getEmbedImages(embed.media);
  return [];
}

function renderImagesGrid(images) {
  const n = Math.min(images.length, 4);
  return `<div class="post-images count-${n}">${images.slice(0,4).map(img=>`
    <div class="img-item">
      <img src="${escapeHtml(img.thumb||img.fullsize||'')}" alt="${escapeHtml(img.alt||'')}" loading="lazy" onerror="this.parentElement.style.display='none'"/>
    </div>`).join('')}</div>`;
}

function renderPostCard(item, myDid) {
  const post   = item.post;
  const author = post.author;
  const record = post.record;
  const isRepost = item.reason?.$type === 'app.bsky.feed.defs#reasonRepost';
  const repostBy = isRepost ? item.reason.by : null;
  const replyHandle = record.reply ? item.reply?.parent?.author?.handle : null;
  const images = getEmbedImages(post.embed);
  const isMine = post.author.did === myDid;

  const liked    = !!post.viewer?.like;
  const reposted = !!post.viewer?.repost;
  const likeUri    = post.viewer?.like   || '';
  const repostUri  = post.viewer?.repost || '';
  const likeCount  = post.likeCount  || 0;
  const repostCount= post.repostCount|| 0;
  const replyCount = post.replyCount || 0;

  const uri = escapeHtml(post.uri);
  const cid = escapeHtml(post.cid);
  const handle = escapeHtml(author.handle);
  const displayName = escapeHtml(author.displayName || author.handle);
  const avatar = escapeHtml(author.avatar||'');
  const rkey = post.uri.split('/').pop();

  return `<div class="post-card" data-uri="${uri}" data-cid="${cid}">
  ${isRepost ? `<div class="repost-label"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>${escapeHtml(repostBy?.displayName||repostBy?.handle||'')} がリポスト</div>` : ''}
  <img class="post-avatar" src="${avatar}" alt="${displayName}" onerror="this.src=''" data-handle="${handle}"/>
  <div class="post-main">
    ${replyHandle ? `<div class="reply-indicator"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg> @${escapeHtml(replyHandle)} への返信</div>` : ''}
    <div class="post-header">
      <span class="post-name">${displayName}</span>
      <span class="post-handle">@${handle}</span>
      <span class="post-time">${formatTime(record.createdAt)}</span>
    </div>
    <div class="post-text">${renderRichText(record.text||'', record.facets)}</div>
    ${images.length ? renderImagesGrid(images) : ''}
    <div class="post-actions">
      <button class="act-btn reply-btn" data-uri="${uri}" data-cid="${cid}" data-handle="${handle}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        ${replyCount}
      </button>
      <button class="act-btn repost-btn ${reposted?'active':''}" data-uri="${uri}" data-cid="${cid}" data-repost-uri="${escapeHtml(repostUri)}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
        ${repostCount}
      </button>
      <button class="act-btn like-btn ${liked?'active':''}" data-uri="${uri}" data-cid="${cid}" data-like-uri="${escapeHtml(likeUri)}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="${liked?'currentColor':'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        ${likeCount}
      </button>
      ${isMine ? `
      <button class="act-btn danger delete-btn" data-uri="${uri}">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        削除
      </button>` : ''}
      <a class="act-btn" href="https://bsky.app/profile/${handle}/post/${rkey}" target="_blank" rel="noopener" title="Blueskyで開く">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </a>
    </div>
  </div>
</div>`;
}

// =============================================
//  通知カード
// =============================================
const NOTIF_META = {
  like:    { icon:'❤️', label:'があなたの投稿をいいねしました' },
  repost:  { icon:'🔁', label:'があなたの投稿をリポストしました' },
  follow:  { icon:'👤', label:'があなたをフォローしました' },
  mention: { icon:'💬', label:'があなたをメンションしました' },
  reply:   { icon:'↩️', label:'があなたの投稿に返信しました' },
  quote:   { icon:'🗨️', label:'があなたの投稿を引用しました' },
};

function renderNotifCard(n) {
  const { icon='🔔', label='' } = NOTIF_META[n.reason] || {};
  const a = n.author;
  const snippet = n.record?.text ? `<div class="notif-snippet">${escapeHtml(n.record.text.slice(0,80))}${n.record.text.length>80?'…':''}</div>` : '';
  return `<div class="notif-card ${n.isRead?'':'unread'}">
  <img class="notif-avatar" src="${escapeHtml(a.avatar||'')}" alt="${escapeHtml(a.displayName||a.handle)}" onerror="this.src=''"/>
  <div class="notif-body">
    <div class="notif-text"><strong>${escapeHtml(a.displayName||a.handle)}</strong>${label}</div>
    ${snippet}
    <div class="notif-time">${formatTime(n.indexedAt)}</div>
  </div>
  <span class="notif-icon-badge">${icon}</span>
</div>`;
}

// =============================================
//  ユーザーカード（フォロー中・検索結果）
// =============================================
function renderUserCard(profile, showFollowBtn = false) {
  const isFollowing = !!profile.viewer?.following;
  const followUri   = profile.viewer?.following || '';
  return `<div class="user-card">
  <img class="user-card-avatar" src="${escapeHtml(profile.avatar||'')}" alt="${escapeHtml(profile.displayName||profile.handle)}" onerror="this.src=''"/>
  <div class="user-card-info">
    <div class="user-card-name">${escapeHtml(profile.displayName||profile.handle)}</div>
    <div class="user-card-handle">@${escapeHtml(profile.handle)}</div>
    ${profile.description ? `<div class="user-card-desc">${escapeHtml(profile.description.slice(0,80))}${profile.description.length>80?'…':''}</div>` : ''}
  </div>
  <div class="user-card-actions">
    ${showFollowBtn ? `
    <button class="follow-toggle-btn ${isFollowing?'following':''}"
      data-did="${escapeHtml(profile.did)}"
      data-follow-uri="${escapeHtml(followUri)}">
      ${isFollowing ? 'フォロー中' : 'フォロー'}
    </button>` : ''}
    <a class="act-btn" href="https://bsky.app/profile/${escapeHtml(profile.handle)}" target="_blank" rel="noopener">開く↗</a>
  </div>
</div>`;
}

// =============================================
//  フィードヘルパー
// =============================================
function appendCards(feedEl, html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  while (d.firstChild) feedEl.appendChild(d.firstChild);
}

function addLoadMoreBtn(feedEl, tab, subTab) {
  feedEl.querySelector('.load-more-btn')?.remove();
  const btn = document.createElement('button');
  btn.className = 'load-more-btn';
  btn.textContent = 'もっと読み込む';
  btn.dataset.tab = tab;
  btn.dataset.subTab = subTab || '';
  feedEl.appendChild(btn);
}
