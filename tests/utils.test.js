const test = require('node:test');
const assert = require('node:assert/strict');

const {
  escapeHtml,
  sanitizeHttpUrl,
  toSafeProfileId,
} = require('../js/utils.js');

test('escapeHtml escapes dangerous characters', () => {
  const input = `<img src=x onerror=alert('xss')>&\"'`;
  const out = escapeHtml(input);
  assert.equal(
    out,
    '&lt;img src=x onerror=alert(&#39;xss&#39;)&gt;&amp;&quot;&#39;'
  );
});

test('sanitizeHttpUrl keeps only http/https', () => {
  assert.equal(sanitizeHttpUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1');
  assert.equal(sanitizeHttpUrl('/path', 'https://example.com'), 'https://example.com/path');
  assert.equal(sanitizeHttpUrl('javascript:alert(1)'), '');
  assert.equal(sanitizeHttpUrl('data:text/html,hello'), '');
});

test('toSafeProfileId strips did:handle prefix', () => {
  assert.equal(toSafeProfileId('did:handle:alice.bsky.social'), 'alice.bsky.social');
  assert.equal(toSafeProfileId('did:plc:abc123'), 'did:plc:abc123');
});
