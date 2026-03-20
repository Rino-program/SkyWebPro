/**
 * SkyDeck shared utility functions.
 * - Browser: exposes globals used by app/ui scripts.
 * - Node.js: exports for unit tests.
 */
(function initSkydeckUtils(root) {
  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sanitizeHttpUrl(raw, baseOrigin) {
    const base = typeof baseOrigin === 'string' && baseOrigin
      ? baseOrigin
      : (root?.location?.origin || 'http://localhost');
    try {
      const u = new URL(String(raw ?? ''), base);
      if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
    } catch {}
    return '';
  }

  function toSafeProfileId(v) {
    const s = String(v ?? '');
    return s.startsWith('did:handle:') ? s.slice('did:handle:'.length) : s;
  }

  const api = {
    escapeHtml,
    sanitizeHttpUrl,
    toSafeProfileId,
  };

  root.SKYDECK_UTILS = api;
  root.escapeHtml = root.escapeHtml || escapeHtml;
  root.sanitizeHttpUrl = root.sanitizeHttpUrl || sanitizeHttpUrl;
  root.toSafeProfileId = root.toSafeProfileId || toSafeProfileId;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
