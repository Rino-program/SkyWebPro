/**
 * SkyWebPro constants
 * Shared app-level constants are grouped here.
 */
(function initSkywebproConstants() {
  const SKYWEBPRO_CONST = {
    QUICK_NOTE_KEY: 'skywebpro_quick_note_v1',
    QUICK_NOTE_LIST_KEY: 'skywebpro_quick_note_list_v1',
    THEME_KEY: 'skywebpro_theme_v1',
    APP_MAX_IMAGE_BYTES: 2000000,
    RIGHT_PANEL_PREFS_KEY: 'skywebpro_right_panel_prefs_v1',
    POST_HISTORY_KEY: 'skywebpro_post_history_v1',
    SEARCH_HISTORY_KEY: 'skywebpro_search_history_v1',
    COMPOSE_CACHE_KEY: 'skywebpro_compose_cache_v1',
    UI_PREFS_KEY: 'skywebpro_ui_prefs_v1',
    EXPERIENCE_PREFS_KEY: 'skywebpro_experience_prefs_v1',
    ACTIVITY_STATS_KEY: 'skywebpro_activity_stats_v1',
    HOME_PINNED_QUERY_KEY: 'skywebpro_home_pinned_query_v1',
    SCROLL_POSITIONS_KEY: 'skywebpro_scroll_positions_v1',
    QUICK_POST_WIDTH_KEY: 'skywebpro_quick_post_width_v1',
    FEED_WIDTH_PREFS_KEY: 'skywebpro_feed_width_prefs_v1',
    NOTIF_POLL_MS_KEY: 'skywebpro_notif_poll_ms_v1',
    TOAST_DURATION_MS_KEY: 'skywebpro_toast_duration_ms_v1',
    STARTUP_TAB_MODE_KEY: 'skywebpro_startup_tab_mode_v1',
    IMAGE_AUTOLOAD_MODE_KEY: 'skywebpro_image_autoload_mode_v1',
    POST_DENSITY_KEY: 'skywebpro_post_density_v1',
    FONT_SCALE_KEY: 'skywebpro_font_scale_v1',
    READING_WIDTH_KEY: 'skywebpro_reading_width_v1',
    SHORTCUT_PREFS_KEY: 'skywebpro_shortcut_prefs_v1',
    SHORTCUTS_ENABLED_KEY: 'skywebpro_shortcuts_enabled_v1',
    INACTIVITY_TIMEOUT_MIN_KEY: 'skywebpro_inactivity_timeout_min_v1',
    PERF_METRICS_KEY: 'skywebpro_perf_metrics_v1',
    PINNED_QUERIES_KEY: 'skywebpro_pinned_queries_v1',
    REPLY_TEMPLATE_KEY: 'skywebpro_reply_template_v1',
    POST_QUEUE_KEY: 'skywebpro_post_queue_v1',
    DM_READ_STATE_KEY: 'skywebpro_dm_read_state_v1',
    LOG_LEVEL_KEY: 'skywebpro_log_level_v1',
    ADMIN_REPORT_HANDLE: 'rino-program.bsky.social',
    LOGIN_CONSOLE_MAX_LINES: 200,
    DEFAULT_SHORTCUT_PREFS: {
      showHelp: '?',
      focusSearch: '/',
      focusCompose: 'c',
      navPrefix: 'g',
    },
  };

  window.SKYWEBPRO_CONST = Object.freeze(SKYWEBPRO_CONST);
})();
