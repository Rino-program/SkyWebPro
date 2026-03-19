/**
 * SkyDeck — ui.js
 * UIのレンダリング・ユーティリティ関数群
 */

// =============================================
//  トースト通知
// =============================================

function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut .25s ease forwards';
    setTimeout(() => toast.remove(), 260);
  }, duration);
}

// =============================================
//  ボタンのローディング状態
// =============================================

function setButtonLoading(btn, isLoading) {
  const text    = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.btn-spinner');
  btn.disabled = isLoading;
  if (text)    text.classList.toggle('hidden', isLoading);
  if (spinner) spinner.classList.toggle('hidden', !isLoading);
}

// =============================================
//  時刻フォーマット
// =============================================

function formatTime(isoString) {
  const date = new Date(isoString);
  const now  = new Date();
  const diff = (now - date) / 1000;

  if (diff < 60)   return `${Math.floor(diff)}秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}日前`;

  return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}

// =============================================
//  テキストのエスケープ＆リンク化
// =============================================

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * facetsを利用してテキストをHTML化する
 * @param {string} text
 * @param {Array}  facets
 */
function renderRichText(text, facets = []) {
  if (!facets || facets.length === 0) {
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const bytes   = encoder.encode(text);

  // facetsをbyteStart順に並べ替え
  const sorted = [...facets].sort((a, b) => a.index.byteStart - b.index.byteStart);

  let result = '';
  let pos = 0;

  for (const facet of sorted) {
    const { byteStart, byteEnd } = facet.index;
    if (byteStart > pos) {
      result += escapeHtml(decoder.decode(bytes.slice(pos, byteStart)));
    }
    const segment = escapeHtml(decoder.decode(bytes.slice(byteStart, byteEnd)));
    const feature = facet.features[0];

    if (feature?.$type === 'app.bsky.richtext.facet#link') {
      result += `<a href="${escapeHtml(feature.uri)}" target="_blank" rel="noopener noreferrer">${segment}</a>`;
    } else if (feature?.$type === 'app.bsky.richtext.facet#mention') {
      result += `<a href="https://bsky.app/profile/${feature.did}" target="_blank" rel="noopener noreferrer">${segment}</a>`;
    } else if (feature?.$type === 'app.bsky.richtext.facet#tag') {
      result += `<a href="https://bsky.app/hashtag/${feature.tag}" target="_blank" rel="noopener noreferrer">${segment}</a>`;
    } else {
      result += segment;
    }
    pos = byteEnd;
  }

  if (pos < bytes.length) {
    result += escapeHtml(decoder.decode(bytes.slice(pos)));
  }

  return result.replace(/\n/g, '<br>');
}

// =============================================
//  フィードスピナー
// =============================================

function renderSpinner() {
  return `<div class="feed-spinner">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"
        stroke-dasharray="40" stroke-dashoffset="20"/>
    </svg>
  </div>`;
}

function renderEmpty(message = '表示する投稿がありません') {
  return `<div class="empty-state">
    <div class="empty-state-icon">🌤</div>
    <div class="empty-state-text">${escapeHtml(message)}</div>
  </div>`;
}

// =============================================
//  投稿カードのレンダリング
// =============================================

/**
 * feedItemオブジェクトから投稿カードのHTML文字列を生成する
 * @param {object} feedItem  - getTimeline / getAuthorFeed の feed[] 要素
 * @param {string} myDid     - 自分のDID（削除ボタン表示判定に使用）
 * @returns {string} HTML
 */
function renderPostCard(feedItem, myDid) {
  const post   = feedItem.post;
  const author = post.author;
  const record = post.record;

  // リポスト表示
  const isRepost = feedItem.reason?.$type === 'app.bsky.feed.defs#reasonRepost';
  const repostBy = isRepost ? feedItem.reason.by : null;

  // 返信表示
  const replyParentAuthor = record.reply
    ? feedItem.reply?.parent?.author?.handle || null
    : null;

  // 画像embed
  const embed = post.embed;
  const images = getEmbedImages(embed);

  // 自分の投稿かどうか
  const isMine = post.author.did === myDid;

  const avatarSrc = escapeHtml(author.avatar || '');
  const displayName = escapeHtml(author.displayName || author.handle);
  const handle      = escapeHtml(author.handle);
  const postText    = renderRichText(record.text || '', record.facets);
  const postTime    = formatTime(record.createdAt);
  const postUri     = escapeHtml(post.uri);
  const postCid     = escapeHtml(post.cid);

  return `
<div class="post-card" data-uri="${postUri}" data-cid="${postCid}">
  ${isRepost ? `
  <div style="grid-column:1/-1;display:flex;align-items:center;gap:6px;font-size:.78rem;color:var(--text-3);padding-bottom:6px">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
    ${escapeHtml(repostBy?.displayName || repostBy?.handle || '')} がリポスト
  </div>` : ''}
  <img class="post-avatar" src="${avatarSrc}" alt="${displayName}" onerror="this.src=''" />
  <div class="post-main">
    ${replyParentAuthor ? `
    <div class="reply-indicator">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
      @${escapeHtml(replyParentAuthor)} への返信
    </div>` : ''}
    <div class="post-header">
      <span class="post-displayname">${displayName}</span>
      <span class="post-handle">@${handle}</span>
      <span class="post-time">${postTime}</span>
    </div>
    <div class="post-text">${postText}</div>
    ${images.length > 0 ? renderImages(images) : ''}
    <div class="post-actions">
      <button class="action-btn reply-btn"
        data-uri="${postUri}"
        data-cid="${postCid}"
        data-handle="${handle}"
        title="返信">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <span>${post.replyCount || 0}</span>
      </button>
      ${isMine ? `
      <button class="action-btn danger delete-btn"
        data-uri="${postUri}"
        title="削除">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        削除
      </button>` : ''}
      <a class="action-btn"
        href="https://bsky.app/profile/${handle}/post/${post.uri.split('/').pop()}"
        target="_blank" rel="noopener"
        title="Blueskyで開く">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </a>
    </div>
  </div>
</div>`;
}

/**
 * embed から画像配列を取り出す
 */
function getEmbedImages(embed) {
  if (!embed) return [];
  if (embed.$type === 'app.bsky.embed.images#view') {
    return embed.images || [];
  }
  if (embed.$type === 'app.bsky.embed.recordWithMedia#view') {
    return getEmbedImages(embed.media);
  }
  return [];
}

/**
 * 画像グリッドのHTML
 */
function renderImages(images) {
  const count = Math.min(images.length, 4);
  const items = images.slice(0, 4).map(img => {
    const src = escapeHtml(img.thumb || img.fullsize || '');
    const alt = escapeHtml(img.alt || '');
    return `<div class="img-item">
      <img src="${src}" alt="${alt}" loading="lazy" onerror="this.parentElement.style.display='none'" />
    </div>`;
  }).join('');
  return `<div class="post-images count-${count}">${items}</div>`;
}

// =============================================
//  通知カードのレンダリング
// =============================================

const NOTIF_ICONS = {
  like:         { icon: '❤️', label: 'があなたの投稿をいいねしました' },
  repost:       { icon: '🔁', label: 'があなたの投稿をリポストしました' },
  follow:       { icon: '👤', label: 'があなたをフォローしました' },
  mention:      { icon: '💬', label: 'があなたをメンションしました' },
  reply:        { icon: '↩️', label: 'があなたの投稿に返信しました' },
  quote:        { icon: '🗨️', label: 'があなたの投稿を引用しました' },
  starterpack:  { icon: '🎁', label: 'があなたをスターターパックに追加しました' },
};

function renderNotifCard(notif) {
  const author = notif.author;
  const { icon = '🔔', label = '' } = NOTIF_ICONS[notif.reason] || {};
  const isUnread = !notif.isRead;

  const avatarSrc   = escapeHtml(author.avatar || '');
  const displayName = escapeHtml(author.displayName || author.handle);
  const notifTime   = formatTime(notif.indexedAt);

  // 通知に紐づく投稿テキスト（ある場合）
  const subjectText = notif.record?.text
    ? `<div style="font-size:.82rem;color:var(--text-2);margin-top:4px;border-left:2px solid var(--border);padding-left:8px">${escapeHtml(notif.record.text.slice(0, 100))}${notif.record.text.length > 100 ? '…' : ''}</div>`
    : '';

  return `
<div class="notif-card ${isUnread ? 'unread' : ''}">
  <img class="notif-avatar" src="${avatarSrc}" alt="${displayName}" onerror="this.src=''" />
  <div class="notif-body">
    <div class="notif-text">
      <strong>${displayName}</strong>${label}
    </div>
    ${subjectText}
    <div class="notif-time">${notifTime}</div>
  </div>
  <span style="font-size:1.3rem;flex-shrink:0">${icon}</span>
</div>`;
}

// =============================================
//  フォロー中ユーザーカード
// =============================================

function renderFollowingCard(profile) {
  const avatarSrc   = escapeHtml(profile.avatar || '');
  const displayName = escapeHtml(profile.displayName || profile.handle);
  const handle      = escapeHtml(profile.handle);
  const description = escapeHtml(profile.description || '');

  return `
<div class="following-card">
  <img class="following-avatar" src="${avatarSrc}" alt="${displayName}" onerror="this.src=''" />
  <div class="following-info">
    <div class="following-name">${displayName}</div>
    <div class="following-handle">@${handle}</div>
    ${description ? `<div class="following-desc">${description.slice(0, 80)}${description.length > 80 ? '…' : ''}</div>` : ''}
  </div>
  <a href="https://bsky.app/profile/${handle}" target="_blank" rel="noopener"
    style="color:var(--primary);font-size:.82rem;font-weight:500;flex-shrink:0">
    開く ↗
  </a>
</div>`;
}

// =============================================
//  フィードにカードを追加するヘルパー
// =============================================

function appendToFeed(feedEl, html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  while (div.firstChild) feedEl.appendChild(div.firstChild);
}

function prependToFeed(feedEl, html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  // 逆順でprependして順序を保つ
  const children = Array.from(div.children).reverse();
  for (const child of children) {
    feedEl.insertBefore(child, feedEl.firstChild);
  }
}
