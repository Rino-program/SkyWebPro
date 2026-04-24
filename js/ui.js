/**
 * SkyWebPro — ui.js  v1.0
 */

// =============================================
//  ユーティリティ
// =============================================
const _utils = window.SKYWEBPRO_UTILS || {};
const escapeHtml = _utils.escapeHtml || (s => String(s ?? ''));
const sanitizeHttpUrl = _utils.sanitizeHttpUrl || (() => '');
const toSafeProfileId = _utils.toSafeProfileId || (v => String(v ?? ''));

function autoLinkText(text) {
  const escaped = escapeHtml(String(text || ''));
  return escaped.replace(/(https?:\/\/[^\s<]+)/g, url => {
    const safe = sanitizeHttpUrl(url);
    if (!safe) return url;
    return `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`;
  });
}

function buildSafeBannerStyle(url) {
  const safe = sanitizeHttpUrl(url);
  return safe
    ? `background-image:url('${escapeHtml(safe)}');background-size:cover;background-position:center center;background-repeat:no-repeat`
    : '';
}

function formatTime(iso) {
  const d = new Date(iso), n = new Date(), diff = (n - d) / 1000;
  if (isNaN(diff)) return '';
  if (diff < 60)     return `${Math.floor(diff)}秒前`;
  if (diff < 3600)   return `${Math.floor(diff/60)}分前`;
  if (diff < 86400)  return `${Math.floor(diff/3600)}時間前`;
  if (diff < 86400*7) return `${Math.floor(diff/86400)}日前`;
  return d.toLocaleDateString('ja-JP', { month:'short', day:'numeric' });
}

function renderRichText(text, facets = []) {
  if (!facets?.length) return escapeHtml(text).replace(/\n/g,'<br>');
  const enc = new TextEncoder(), dec = new TextDecoder();
  const bytes = enc.encode(text);
  const sorted = [...facets].sort((a,b) => a.index.byteStart - b.index.byteStart);
  let out = '', pos = 0;
  for (const f of sorted) {
    const { byteStart: bs, byteEnd: be } = f.index;
    if (bs > pos) out += escapeHtml(dec.decode(bytes.slice(pos, bs)));
    const seg = escapeHtml(dec.decode(bytes.slice(bs, be)));
    const ft = f.features[0];
    if (ft?.$type === 'app.bsky.richtext.facet#link') {
      const safeHref = sanitizeHttpUrl(ft.uri);
      out += safeHref
        ? `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer">${seg}</a>`
        : seg;
    }
    else if (ft?.$type === 'app.bsky.richtext.facet#mention')
      out += `<a href="https://bsky.app/profile/${encodeURIComponent(toSafeProfileId(ft.did))}" target="_blank" rel="noopener noreferrer">${seg}</a>`;
    else if (ft?.$type === 'app.bsky.richtext.facet#tag')
      out += `<a href="#" data-hashtag-search="${escapeHtml(String(ft.tag || ''))}">${seg}</a>`;
    else out += seg;
    pos = be;
  }
  if (pos < bytes.length) out += escapeHtml(dec.decode(bytes.slice(pos)));
  return out.replace(/\n/g,'<br>');
}

function showToast(msg, type='info', dur) {
  const configured = Number(window.__skywebproToastDurationMs || 3500);
  const ttl = Number.isFinite(Number(dur)) ? Number(dur) : (Number.isFinite(configured) ? configured : 3500);
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = escapeHtml(msg).replace(/\n/g,'<br>');
  c.appendChild(t);
  setTimeout(() => { t.style.animation='toastOut .25s ease forwards'; setTimeout(()=>t.remove(), 260); }, ttl);
}

function setLoading(btn, on) {
  const txt = btn.querySelector('.btn-text'), sp = btn.querySelector('.btn-spinner');
  btn.disabled = on;
  txt?.classList.toggle('hidden', on);
  sp?.classList.toggle('hidden', !on);
}

function renderSpinner() {
  return `<div class="feed-spinner"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-dasharray="40" stroke-dashoffset="20" class="spin-el"/></svg></div>`;
}

function renderFeedSkeleton(count = 4) {
  const n = Math.max(1, Number(count || 4));
  return `<div class="feed-skeleton-list">${Array.from({ length: n }).map(() => `
    <div class="skeleton-post-card">
      <div class="skeleton-post-avatar"></div>
      <div class="skeleton-post-body">
        <div class="skeleton-line w-40"></div>
        <div class="skeleton-line w-90"></div>
        <div class="skeleton-line w-70"></div>
      </div>
    </div>
  `).join('')}</div>`;
}

function renderEmpty(msg = '表示する内容がありません', type = 'default', action = null) {
  const icons = {
    default: '🌤',
    home: '📲',
    search: '🔍',
    notifications: '🔔',
    dm: '💬',
    profile: '👤',
    likes: '❤️',
    replies: '💬',
    media: '🖼️',
    error: '⚠️',
    network: '📡',
  };
  const icon = icons[type] || icons.default;
  const cta = action && action.label
    ? `<button class="btn-sm" data-empty-action="${escapeHtml(action.action || '')}" style="margin-top:12px">${escapeHtml(action.label)}</button>`
    : '';
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><div>${escapeHtml(msg)}</div>${cta}</div>`;
}

function renderError(msg = 'エラーが発生しました', actionBtn = null) {
  let html = `<div class="empty-state" style="color:var(--danger)"><div class="empty-icon">⚠️</div><div>${escapeHtml(msg)}</div>`;
  if (actionBtn) {
    html += `<button class="btn-sm" style="margin-top:12px">${escapeHtml(actionBtn.text)}</button>`;
  }
  html += '</div>';
  return html;
}

function renderLoadingState() {
  return `<div class="feed-spinner"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-dasharray="40" stroke-dashoffset="20" class="spin-el"/></svg><div style="margin-top:12px;text-align:center;color:var(--text-3);font-size:.85rem">読み込み中...</div></div>`;
}

function appendCards(el, html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  while (d.firstChild) el.appendChild(d.firstChild);
}

function addLoadMoreBtn(feedEl, tab, extra = {}) {
  feedEl.querySelector('.load-more-btn')?.remove();
  const btn = document.createElement('button');
  btn.className = 'load-more-btn';
  btn.textContent = 'もっと読み込む';
  btn.dataset.tab = tab;
  Object.entries(extra).forEach(([k,v]) => btn.dataset[k] = v);
  feedEl.appendChild(btn);
}

// =============================================
//  画像グリッド
// =============================================
function getEmbedImages(embed) {
  if (!embed) return [];
  if (embed.$type === 'app.bsky.embed.images#view') return embed.images || [];
  if (embed.$type === 'app.bsky.embed.recordWithMedia#view') return getEmbedImages(embed.media);
  return [];
}

function shouldAutoLoadFeedImages() {
  const mode = String(window.__skywebproImageAutoLoadMode || 'always');
  if (mode !== 'wifi') return true;
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) return true;
  if (conn.saveData) return false;
  const t = String(conn.type || '').toLowerCase();
  if (t) return t === 'wifi';
  return true;
}

function renderImagesGrid(images) {
  const n = Math.min(images.length, 4);
  const safeImages = images.slice(0, 4).map((img, idx) => ({
    fullsize: sanitizeHttpUrl(img.fullsize || img.thumb || ''),
    thumb: sanitizeHttpUrl(img.thumb || img.fullsize || ''),
    alt: String(img.alt || '').trim() || `投稿画像 ${idx + 1}`,
    ratioW: Number(img?.aspectRatio?.width) > 0 ? Number(img.aspectRatio.width) : 0,
    ratioH: Number(img?.aspectRatio?.height) > 0 ? Number(img.aspectRatio.height) : 0,
  }));
  const json = escapeHtml(JSON.stringify(safeImages.map(img => ({ fullsize: img.fullsize, alt: img.alt }))));
  if (!shouldAutoLoadFeedImages()) {
    return `<div class="post-images count-${n}" data-images-json="${json}">${safeImages.map((img, idx) =>
      `<div class="img-item cursor-pointer hidden" data-img-index="${idx}"><img data-src="${escapeHtml(img.thumb)}" alt="${escapeHtml(img.alt)}" ${img.ratioW > 0 && img.ratioH > 0 ? `width="${img.ratioW}" height="${img.ratioH}" style="aspect-ratio:${img.ratioW}/${img.ratioH}"` : ''} loading="lazy" decoding="async" fetchpriority="low" onerror="this.parentElement.style.display='none'"/></div>`
    ).join('')}<div class="post-images-blocked"><button class="btn-sm load-images-btn" type="button">画像を読み込む</button></div></div>`;
  }
  return `<div class="post-images count-${n}" data-images-json="${json}">${safeImages.map((img, idx) =>
    `<div class="img-item cursor-pointer" data-img-index="${idx}"><img src="${escapeHtml(img.thumb)}" alt="${escapeHtml(img.alt)}" ${img.ratioW > 0 && img.ratioH > 0 ? `width="${img.ratioW}" height="${img.ratioH}" style="aspect-ratio:${img.ratioW}/${img.ratioH}"` : ''} loading="lazy" decoding="async" fetchpriority="low" onerror="this.parentElement.style.display='none'"/></div>`
  ).join('')}</div>`;
}

// =============================================
//  引用リポストの埋め込み表示
// =============================================
function renderQuoteEmbed(embed) {
  if (!embed) return '';
  // app.bsky.embed.record#view
  const rec = embed.$type === 'app.bsky.embed.record#view' ? embed.record
            : embed.$type === 'app.bsky.embed.recordWithMedia#view' ? embed.record?.record
            : null;
  if (!rec) return '';
  if (rec.$type !== 'app.bsky.embed.record#viewRecord') return '';

  const author = rec.author;
  const text   = rec.value?.text || '';
  const facets = rec.value?.facets || [];
  const images = getEmbedImages(rec.embeds?.[0]);

  return `<div class="quote-embed">
    <div class="quote-header">
      <img class="quote-avatar" src="${escapeHtml(sanitizeHttpUrl(author.avatar||''))}" alt="" onerror="this.src=''"/>
      <span class="quote-name">${escapeHtml(author.displayName||author.handle)}</span>
      <span class="quote-handle">@${escapeHtml(author.handle)}</span>
    </div>
    <div class="quote-text">${renderRichText(text, facets)}</div>
    ${images.length ? renderImagesGrid(images) : ''}
  </div>`;
}

// =============================================
//  投稿カード（メインフィード用）
// =============================================
function renderPostCard(item, myDid, opts = {}) {
  const post   = item.post;
  const author = post.author;
  const record = post.record;
  const isRepost = item.reason?.$type === 'app.bsky.feed.defs#reasonRepost';
  const repostBy = isRepost ? item.reason.by : null;
  const replyHandle = record.reply ? (item.reply?.parent?.author?.handle || null) : null;

  const images    = getEmbedImages(post.embed);
  const quoteHtml = renderQuoteEmbed(post.embed);
  const isMine    = post.author.did === myDid;

  const liked     = !!post.viewer?.like;
  const reposted  = !!post.viewer?.repost;
  const likeUri   = post.viewer?.like   || '';
  const repostUri = post.viewer?.repost || '';

  const uri     = escapeHtml(post.uri);
  const cid     = escapeHtml(post.cid);
  const handleRaw = String(author.handle || '');
  const handleUrl = encodeURIComponent(handleRaw);
  const handle  = escapeHtml(author.handle);
  const name    = escapeHtml(author.displayName || author.handle);
  const avatar  = escapeHtml(sanitizeHttpUrl(author.avatar || ''));
  const rkey    = post.uri.split('/').pop();
  const depth   = opts.depth || 0;
  const isThread = opts.isThread || false;

  return `<div class="post-card ${isThread?'thread-card':''} depth-${Math.min(depth,3)}" data-uri="${uri}" data-cid="${cid}">
  ${isRepost ? `<div class="repost-label"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>${escapeHtml(repostBy?.displayName||repostBy?.handle||'')} がリポスト</div>` : ''}
  <div class="post-card-inner">
    <div class="post-left">
      <img class="post-avatar" src="${avatar}" alt="${name}" onerror="this.src=''" data-handle="${handle}" data-did="${escapeHtml(author.did)}"/>
      ${isThread ? '<div class="thread-connector"></div>' : ''}
    </div>
    <div class="post-main">
      ${replyHandle ? `<div class="reply-indicator"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>@${escapeHtml(replyHandle)} への返信</div>` : ''}
      <div class="post-header">
        <span class="post-name" data-handle="${handle}" data-did="${escapeHtml(author.did)}">${name}</span>
        <span class="post-handle">@${handle}</span>
        <span class="post-time">${formatTime(record.createdAt)}</span>
      </div>
      <div class="post-text">${renderRichText(record.text||'', record.facets)}</div>
      ${images.length ? renderImagesGrid(images) : ''}
      ${quoteHtml}
      <div class="post-actions">
        <button class="act-btn reply-btn" data-uri="${uri}" data-cid="${cid}" data-handle="${handle}" title="返信">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span class="act-count">${post.replyCount||0}</span>
        </button>
        <button class="act-btn repost-btn ${reposted?'active':''}" data-uri="${uri}" data-cid="${cid}" data-repost-uri="${escapeHtml(repostUri)}" title="リポスト">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
          <span class="act-count">${post.repostCount||0}</span>
        </button>
        <button class="act-btn quote-btn" data-uri="${uri}" data-cid="${cid}" title="引用リポスト">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" y1="9" x2="15" y2="9"/></svg>
        </button>
        <button class="act-btn like-btn ${liked?'active':''}" data-uri="${uri}" data-cid="${cid}" data-like-uri="${escapeHtml(likeUri)}" title="いいね">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="${liked?'currentColor':'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <span class="act-count">${post.likeCount||0}</span>
        </button>
        <button class="act-btn thread-toggle-btn" data-uri="${uri}" title="返信を表示">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        ${isMine ? `<button class="act-btn danger delete-btn" data-uri="${uri}" title="削除">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          削除</button>` : ''}
        <a class="act-btn" href="https://bsky.app/profile/${handleUrl}/post/${encodeURIComponent(String(rkey || ''))}" target="_blank" rel="noopener noreferrer" title="Blueskyで開く">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
      </div>
      <!-- 引用入力（折り畳み） -->
      <div class="quote-compose hidden" id="qc-${rkey}">
        <textarea class="quote-compose-ta" placeholder="引用コメントを入力（省略可）" rows="2" maxlength="280"></textarea>
        <div class="quote-compose-footer">
          <button class="btn-post quote-post-btn" data-quote-uri="${uri}" data-quote-cid="${cid}" data-rkey="${rkey}">
            <span class="btn-text">引用投稿</span>
            <span class="btn-spinner hidden"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40" stroke-dashoffset="20" class="spin-el"/></svg></span>
          </button>
          <button class="btn-modal-cancel quote-cancel-btn" data-rkey="${rkey}">キャンセル</button>
        </div>
      </div>
      <!-- 返信スレッド（折り畳み） -->
      <div class="replies-container hidden" id="replies-${rkey}"></div>
    </div>
  </div>
</div>`;
}

// =============================================
//  スレッド表示（返信の再帰レンダリング）
// =============================================
function renderThreadNode(thread, myDid, depth = 0) {
  if (!thread?.post) return '';
  const maxDepth = 5;
  const replyChunkSize = 3;
  let html = renderPostCard({ post: thread.post, reply: thread.parent ? { parent: thread.parent?.post } : undefined }, myDid, { depth, isThread: true });

  if (thread.replies?.length && depth < maxDepth) {
    const visible = thread.replies.slice(0, replyChunkSize);
    const rest = thread.replies.slice(replyChunkSize);
    html += `<div class="thread-children depth-${depth}">`;
    visible.forEach(r => { html += renderThreadNode(r, myDid, depth + 1); });
    if (rest.length) {
      html += `<div class="more-replies-container">`;
      rest.forEach(r => { html += `<div class="more-reply-item hidden">${renderThreadNode(r, myDid, depth + 1)}</div>`; });
      html += `</div>`;
      html += `<div class="thread-more"><button class="show-more-replies-btn" data-count="${rest.length}" data-step="${replyChunkSize}">他 ${rest.length} 件の返信を表示</button></div>`;
    }
    html += `</div>`;
  }
  return html;
}

// =============================================
//  通知カード
// =============================================
const NOTIF_META = {
  like:    { icon: '❤️', label: 'があなたの投稿をいいねしました' },
  repost:  { icon: '🔁', label: 'があなたの投稿をリポストしました' },
  follow:  { icon: '👤', label: 'があなたをフォローしました' },
  mention: { icon: '💬', label: 'があなたをメンションしました' },
  reply:   { icon: '↩️', label: 'があなたの投稿に返信しました' },
  quote:   { icon: '🗨️', label: 'があなたの投稿を引用しました' },
  starterpack: { icon: '🎁', label: 'があなたをスターターパックに追加しました' },
};

function renderNotifActorLink(actor) {
  const handle = escapeHtml(actor?.handle || '');
  const did = escapeHtml(actor?.did || '');
  const label = escapeHtml(actor?.displayName || actor?.handle || 'unknown');
  return `<span class="clickable-name notif-actor" data-handle="${handle}" data-did="${did}">${label}</span>`;
}

function renderNotifActorsBlock(actors) {
  const list = Array.isArray(actors) ? actors.filter(Boolean) : [];
  if (!list.length) return '<span>不明なユーザー</span>';
  if (list.length <= 2) {
    return `<span class="notif-actors-wrap">${list.map(renderNotifActorLink).join('、')}</span>`;
  }
  const collapsed = `${list.slice(0, 2).map(renderNotifActorLink).join('、')} <button class="notif-actors-toggle" data-action="expand" type="button">ほか${list.length - 2}人</button>`;
  const expanded = `${list.map(renderNotifActorLink).join('、')} <button class="notif-actors-toggle" data-action="collapse" type="button">最小化</button>`;
  return `<span class="notif-actors-wrap"><span class="notif-actors-collapsed">${collapsed}</span><span class="notif-actors-expanded hidden">${expanded}</span></span>`;
}

function renderNotifCard(n) {
  const { icon = '🔔', label = '' } = NOTIF_META[n.reason] || {};
  const actors = Array.isArray(n.groupedAuthors) && n.groupedAuthors.length ? n.groupedAuthors : [n.author].filter(Boolean);
  const a = actors[0] || n.author || {};
  const actorText = renderNotifActorsBlock(actors);
  const actionSnippet = n.record?.text
    ? `<div class="notif-snippet">${escapeHtml(n.record.text.slice(0, 80))}${n.record.text.length > 80 ? '…' : ''}</div>`
    : '';
  const subjectRaw = String(n.subjectTextPreview || '').trim();
  const subjectFallback = n.reasonSubject || n.record?.subject?.uri || n.record?.reply?.parent?.uri || '';
  const subjectSnippet = subjectRaw
    ? `<div class="notif-snippet">対象投稿: ${escapeHtml(subjectRaw.slice(0, 80))}${subjectRaw.length > 80 ? '…' : ''}</div>`
    : (subjectFallback ? `<div class="notif-snippet">対象投稿: ${escapeHtml(subjectFallback.split('/').pop() || '投稿')}</div>` : '');
  const markSubject = String(n.reasonSubject || n.record?.subject?.uri || n.record?.reply?.parent?.uri || '').trim();
  const markReadBtn = n.isRead
    ? ''
    : `<button class="btn-sm notif-mark-read-btn" type="button" data-mark-read="1" data-mark-reason="${escapeHtml(String(n.reason || ''))}" data-mark-subject="${escapeHtml(markSubject)}" data-mark-indexed-at="${escapeHtml(String(n.indexedAt || ''))}" data-mark-author-did="${escapeHtml(String(n.author?.did || ''))}">既読にする</button>`;
  return `<div class="notif-card ${n.isRead ? '' : 'unread'}">
  <img class="notif-avatar" src="${escapeHtml(a.avatar||'')}" alt="" onerror="this.src=''" data-handle="${escapeHtml(a.handle)}" data-did="${escapeHtml(a.did)}"/>
  <div class="notif-body">
    ${n.isRead ? '' : '<div class="notif-unread-label">未読</div>'}
    <div class="notif-text">${actorText}${label}</div>
    ${subjectSnippet}
    ${actionSnippet}
    <div class="notif-time">${formatTime(n.indexedAt)}</div>
    ${markReadBtn}
  </div>
  <span class="notif-icon-el">${icon}</span>
</div>`;
}

// =============================================
//  ユーザーカード
// =============================================
function renderUserCard(profile, showFollow = false, showDm = false) {
  const isFollowing = !!profile.viewer?.following;
  const followUri   = profile.viewer?.following || '';
  return `<div class="user-card">
  <img class="user-card-av" src="${escapeHtml(sanitizeHttpUrl(profile.avatar||''))}" alt="" onerror="this.src=''" data-handle="${escapeHtml(profile.handle)}" data-did="${escapeHtml(profile.did)}"/>
  <div class="user-card-info">
    <div class="user-card-name clickable-name" data-handle="${escapeHtml(profile.handle)}" data-did="${escapeHtml(profile.did)}">${escapeHtml(profile.displayName||profile.handle)}</div>
    <div class="user-card-handle">@${escapeHtml(profile.handle)}</div>
    ${profile.description ? `<div class="user-card-desc">${autoLinkText(profile.description.slice(0,80))}${profile.description.length>80?'…':''}</div>` : ''}
  </div>
  <div class="user-card-actions">
    ${showDm ? `<button class="dm-start-btn" data-dm-start-did="${escapeHtml(profile.did)}">DM開始</button>` : ''}
    ${showFollow ? `<button class="follow-toggle-btn ${isFollowing?'following':''}" data-did="${escapeHtml(profile.did)}" data-follow-uri="${escapeHtml(followUri)}">${isFollowing?'フォロー中':'フォロー'}</button>` : ''}
  </div>
</div>`;
}

// =============================================
//  他人のプロフィールパネル
// =============================================
function renderProfilePanel(profile, options = {}) {
  const isFollowing = !!profile.viewer?.following;
  const followUri   = profile.viewer?.following || '';
  const isMe        = profile.did === loadSession()?.did;
  const canDm       = !!options.canDm;
  return `<div class="profile-panel">
  <div class="profile-banner cursor-pointer" data-profile-banner-click style="${buildSafeBannerStyle(profile.banner)}"></div>
  <div class="profile-panel-header">
    <img class="prof-avatar-lg cursor-pointer" data-profile-img-click data-profile-img-src="${escapeHtml(sanitizeHttpUrl(profile.avatar||''))}" src="${escapeHtml(sanitizeHttpUrl(profile.avatar||''))}" alt="" onerror="this.src=''"/>
    <div class="prof-panel-meta">
      <div class="prof-panel-name">${escapeHtml(profile.displayName||profile.handle)}</div>
      <div class="prof-panel-handle">@${escapeHtml(profile.handle)}</div>
      ${profile.description ? `<div class="prof-panel-desc">${autoLinkText(profile.description)}</div>` : ''}
      <div class="prof-panel-stats">
        <span><strong>${profile.followsCount||0}</strong> フォロー中</span>
        <span><strong>${profile.followersCount||0}</strong> フォロワー</span>
        <span><strong>${profile.postsCount||0}</strong> 投稿</span>
      </div>
    </div>
    ${!isMe ? `<div class="user-card-actions">
      ${canDm ? `<button class="dm-start-btn" data-dm-start-did="${escapeHtml(profile.did)}">DM開始</button>` : ''}
      <button class="follow-toggle-btn ${isFollowing?'following':''}" data-did="${escapeHtml(profile.did)}" data-follow-uri="${escapeHtml(followUri)}">${isFollowing?'フォロー中':'フォロー'}</button>
    </div>` : ''}
  </div>
  <div id="user-profile-feed" class="feed"></div>
</div>`;
}
