module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'script',
  },
  rules: {
    'no-unused-vars': ['warn', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^(api.*|render.*|showToast|setLoading|appendCards|addLoadMoreBtn|escapeHtml|sanitizeHttpUrl|toSafeProfileId|withAuth|withTokenRefresh|loadSession|saveSession|clearSession|getAuth|getDrafts|saveDraft|deleteDraft|takeReloginReason|saveScrollPosition|restoreScrollPosition|clearScrollPositions|SCROLL_POSITIONS_KEY)$',
    }],
    'no-console': 'off',
    'no-undef': 'off',
    'no-empty': 'off',
    'no-useless-escape': 'off',
  },
};
