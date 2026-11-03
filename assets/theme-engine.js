/* ============================================================
   夜秣浏览器书签本地整理 · 换肤引擎
   基于业界通行的 CSS 变量主题约定（shadcn 风格命名：--background / --primary / --card / --radius）
   能力：内置皮肤 / 深浅色双套 / 跟随系统 / 自定义导入导出 / 快照回退
   ============================================================ */
(function (global) {
  'use strict';

  var LS = {
    theme: 'yemo_bm_theme',
    mode: 'yemo_bm_mode',          // light | dark | auto
    custom: 'yemo_bm_custom',      // 自定义主题 JSON
    last: 'yemo_bm_last',          // 上一套快照
    view: 'yemo_bm_view'           // card | app
  };

  /* ---------- 内置皮肤 ----------
     每套只声明 9 个基础色，其余由 derive() 派生，保证换肤不会漏色。
     radius 单独控制圆角，neo 主题靠它做出硬边效果。           */
  var BUILTIN = [
    {
      id: 'yemo-navy', name: '夜秣深蓝', tag: '品牌默认', brutal: 0,
      light: { bg: '#f7f8fb', fg: '#1b2540', card: '#ffffff', primary: '#16243f', primaryFg: '#f7f8fb', secondary: '#eef1f7', accent: '#f6ebd6', border: '#dfe4ee', radius: '1rem' },
      dark:  { bg: '#101827', fg: '#e8ecf5', card: '#182238', primary: '#e6b45c', primaryFg: '#1b2540', secondary: '#1f2b45', accent: '#26334f', border: '#2c3a56', radius: '1rem' }
    },
    {
      id: 'clear-green', name: '清爽绿', tag: '干净', brutal: 0,
      light: { bg: '#ffffff', fg: '#1e293b', card: '#ffffff', primary: '#16a34a', primaryFg: '#ffffff', secondary: '#f1f5f9', accent: '#ecfdf5', border: '#e2e8f0', radius: '1rem' },
      dark:  { bg: '#0f172a', fg: '#e2e8f0', card: '#1e293b', primary: '#4ade80', primaryFg: '#052e16', secondary: '#1e293b', accent: '#243b52', border: '#334155', radius: '1rem' }
    },
    {
      id: 'claude', name: 'Claude', tag: '暖陶土', brutal: 0,
      light: { bg: '#faf9f5', fg: '#4a4540', card: '#fffefb', primary: '#d97757', primaryFg: '#ffffff', secondary: '#ece9e2', accent: '#f4efe6', border: '#e3ded4', radius: '1rem' },
      dark:  { bg: '#262624', fg: '#d4cfc4', card: '#302f2c', primary: '#cd6e4e', primaryFg: '#1a1917', secondary: '#3d3c38', accent: '#3a3833', border: '#44423d', radius: '1rem' }
    },
    {
      id: 'amethyst', name: 'Amethyst Haze', tag: '优雅紫', brutal: 0,
      light: { bg: '#f5f3f8', fg: '#4a4160', card: '#ffffff', primary: '#7c5fa8', primaryFg: '#ffffff', secondary: '#eae5f2', accent: '#f3e9ee', border: '#ddd6e8', radius: '1rem' },
      dark:  { bg: '#251f33', fg: '#e7e2f1', card: '#2f2741', primary: '#9d82c4', primaryFg: '#1b1526', secondary: '#3a3050', accent: '#4a3355', border: '#453a5c', radius: '1rem' }
    },
    {
      id: 'catppuccin', name: 'Catppuccin', tag: '柔和', brutal: 0,
      light: { bg: '#eff1f5', fg: '#4c4f69', card: '#ffffff', primary: '#7287fd', primaryFg: '#ffffff', secondary: '#e3e6ed', accent: '#fbe9ec', border: '#dce0e8', radius: '1rem' },
      dark:  { bg: '#303446', fg: '#c6d0f5', card: '#3a3f53', primary: '#a6d189', primaryFg: '#232634', secondary: '#414559', accent: '#4a3f47', border: '#51576d', radius: '1rem' }
    },
    {
      id: 'kodama', name: 'Kodama Grove', tag: '自然绿', brutal: 0,
      light: { bg: '#f4f7f2', fg: '#3a4a3a', card: '#ffffff', primary: '#4a7c59', primaryFg: '#ffffff', secondary: '#e7eee4', accent: '#eef4ec', border: '#dbe6d8', radius: '1rem' },
      dark:  { bg: '#1f2a22', fg: '#dce8dc', card: '#28352c', primary: '#7fb98b', primaryFg: '#16211a', secondary: '#2c3a30', accent: '#2f4236', border: '#3a4a3f', radius: '1rem' }
    },
    {
      id: 'rose', name: 'Quantum Rose', tag: '玫粉', brutal: 0,
      light: { bg: '#fdf2f5', fg: '#5a3a45', card: '#ffffff', primary: '#e2559a', primaryFg: '#ffffff', secondary: '#f9e3ea', accent: '#fdeef3', border: '#f0d9e1', radius: '1rem' },
      dark:  { bg: '#2a1c24', fg: '#f5ddea', card: '#352430', primary: '#e87ea8', primaryFg: '#2a1c24', secondary: '#3d2833', accent: '#4a2f3d', border: '#4f3543', radius: '1rem' }
    },
    {
      id: 'elegant', name: 'Elegant Luxury', tag: '沉稳驼', brutal: 0,
      light: { bg: '#f8f6f2', fg: '#3c3830', card: '#fffdf9', primary: '#b08968', primaryFg: '#ffffff', secondary: '#efe9df', accent: '#f5efe4', border: '#e3dbcd', radius: '1rem' },
      dark:  { bg: '#211c18', fg: '#e8e0d4', card: '#2b251f', primary: '#cba47f', primaryFg: '#211c18', secondary: '#322b24', accent: '#3a312a', border: '#453c32', radius: '1rem' }
    },
    {
      id: 'neo-brutalism', name: 'Neo Brutalism', tag: '高饱和', brutal: 1,
      light: { bg: '#fff8e7', fg: '#1a1a1a', card: '#ffffff', primary: '#f04b3c', primaryFg: '#ffffff', secondary: '#ffd23f', accent: '#e8f4ff', border: '#1a1a1a', radius: '0.5rem' },
      dark:  { bg: '#1a1a1a', fg: '#fff8e7', card: '#242424', primary: '#ff6b5e', primaryFg: '#1a1a1a', secondary: '#ffd23f', accent: '#2a3a4a', border: '#fff8e7', radius: '0.5rem' }
    },
    {
      id: 'graphite', name: 'Graphite', tag: '极简灰', brutal: 0,
      light: { bg: '#f5f5f5', fg: '#333333', card: '#ffffff', primary: '#52525b', primaryFg: '#ffffff', secondary: '#e4e4e7', accent: '#ededf0', border: '#d4d4d8', radius: '0.75rem' },
      dark:  { bg: '#18181b', fg: '#d4d4d8', card: '#212124', primary: '#a1a1aa', primaryFg: '#18181b', secondary: '#27272a', accent: '#2c2c31', border: '#3f3f46', radius: '0.75rem' }
    }
  ];

  var BY_ID = {};
  BUILTIN.forEach(function (t) { BY_ID[t.id] = t; });

  /* ---------- 安全校验（导入主题必须过这道闸） ---------- */
  var ALLOWED_KEY = /^(background|foreground|card|card-foreground|primary|primary-foreground|secondary|secondary-foreground|muted|muted-foreground|accent|accent-foreground|border|input|ring|radius|font-sans|bg|fg|primaryFg|primary-fg)$/;
  // 只放行颜色/长度/字体栈会用到的字符，堵死 url() / expression() / 分号注入
  var SAFE_VALUE = /^[a-zA-Z0-9#%.,()\/ '*-]{1,80}$/;

  function safeValue(v) {
    if (typeof v !== 'string') return '';
    var s = v.trim();
    if (!s || s.length > 80) return '';
    if (!SAFE_VALUE.test(s)) return '';
    // 双重拦截：任何可能执行代码或外链的片段一律拒绝
    if (/url\s*\(|expression|javascript|@import|;|\\/i.test(s)) return '';
    return s;
  }

  function sanitizeLayer(src) {
    var out = {}, n = 0, bad = 0;
    if (!src || typeof src !== 'object' || Array.isArray(src)) return { layer: out, n: 0, bad: 0 };
    Object.keys(src).forEach(function (k) {
      if (!ALLOWED_KEY.test(k)) { bad++; return; }
      var v = safeValue(src[k]);
      if (!v) { bad++; return; }
      if (n >= 24) { bad++; return; }
      out[k] = v;
      n++;
    });
    return { layer: out, n: n, bad: bad };
  }

  /* 把用户粘的 JSON 归一化成 {name, light:{...}, dark:{...}}
     兼容三种形态：本站导出 / shadcn 风格 {name, cssVars} / 裸 {light,dark} */
  function sanitizeTheme(raw) {
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw); } catch (e) { return null; }
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

    var src = raw;
    if (raw.cssVars && typeof raw.cssVars === 'object') src = raw.cssVars;
    else if (raw.data && typeof raw.data === 'object') src = raw.data;

    var light = sanitizeLayer(src.light);
    var dark = sanitizeLayer(src.dark);
    var flat = sanitizeLayer(src.theme || (src.light || src.dark ? null : src));

    if (!light.n && !dark.n && !flat.n) return null;

    // 统计被拦下的非法值，用于给用户提示
    var dropped = light.bad + dark.bad + flat.bad;

    // 只有单一配色时，深浅两套共用
    if (!light.n && !dark.n && flat.n) { light = flat; dark = flat; }
    if (!light.n) light = dark;
    if (!dark.n) dark = light;

    // 归一化键名：bg/fg 是简写，统一成 CSS 变量名
    function normalize(layer) {
      var o = {};
      Object.keys(layer).forEach(function (k) {
        var key = k;
        if (k === 'bg') key = 'background';
        else if (k === 'fg') key = 'foreground';
        else if (k === 'primaryFg') key = 'primaryFg';
        o[key] = layer[k];
      });
      return o;
    }

    var name = '';
    if (typeof raw.name === 'string') {
      name = raw.name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 40);
    }

    return {
      id: 'custom-' + Date.now().toString(36),
      name: name || '自定义皮肤',
      tag: '导入',
      brutal: 0,
      light: normalize(light.layer),
      dark: normalize(dark.layer),
      custom: true,
      dropped: dropped
    };
  }

  /* ---------- 从基础色派生完整变量表 ---------- */
  function derive(c) {
    // 允许简写，缺项用合理默认，保证任何半套配色也不会崩
    var bg = c.background || c.bg || '#ffffff';
    var fg = c.foreground || c.fg || '#1e293b';
    var card = c.card || bg;
    var primary = c.primary || '#16a34a';
    var primaryFg = c['primary-foreground'] || c.primaryFg || '#ffffff';
    var secondary = c.secondary || '#f1f5f9';
    var accent = c.accent || secondary;
    var border = c.border || '#e2e8f0';
    var radius = c.radius || '1rem';

    return {
      '--background': bg,
      '--foreground': fg,
      '--card': card,
      '--card-foreground': fg,
      '--primary': primary,
      '--primary-foreground': primaryFg,
      '--secondary': secondary,
      '--secondary-foreground': fg,
      '--muted': secondary,
      '--muted-foreground': 'color-mix(in srgb, ' + fg + ' 52%, ' + bg + ')',
      '--accent': accent,
      '--accent-foreground': primary,
      '--border': border,
      '--input': border,
      '--ring': primary,
      '--radius': radius,
      '--font-sans': c['font-sans'] || "'Inter', 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', system-ui, -apple-system, sans-serif"
    };
  }

  /* ---------- 状态读写 ----------
     关键：localStorage 在沙箱 iframe / 隐私模式下会直接抛 SecurityError。
     这里做内存兜底 —— 拿不到持久化也要让换肤在当前会话内正常工作，
     绝不能让一次存储访问把整个页面带崩。 */
  var memStore = {};
  var lsOK = (function () {
    try {
      window.localStorage.setItem('__yemo_probe', '1');
      window.localStorage.removeItem('__yemo_probe');
      return true;
    } catch (e) { return false; }
  })();

  function get(k, d) {
    if (lsOK) {
      try {
        var v = localStorage.getItem(k);
        if (v !== null) return v;
      } catch (e) { lsOK = false; }
    }
    return Object.prototype.hasOwnProperty.call(memStore, k) ? memStore[k] : d;
  }

  function set(k, v) {
    memStore[k] = v;
    if (lsOK) {
      try { localStorage.setItem(k, v); } catch (e) { lsOK = false; }
    }
    return true;
  }

  function del(k) {
    delete memStore[k];
    if (lsOK) {
      try { localStorage.removeItem(k); } catch (e) { lsOK = false; }
    }
  }

  function systemDark() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); }
    catch (e) { return false; }
  }

  function getMode() {
    var m = get(LS.mode, 'auto');
    return (m === 'light' || m === 'dark' || m === 'auto') ? m : 'auto';
  }

  function resolveDark() {
    var m = getMode();
    if (m === 'dark') return true;
    if (m === 'light') return false;
    return systemDark();
  }

  function getCustom() {
    var raw = get(LS.custom, null);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function getCurrentTheme() {
    var id = get(LS.theme, 'yemo-navy');
    if (id === 'custom') {
      var c = getCustom();
      if (c) return c;
      id = 'yemo-navy';
    }
    return BY_ID[id] || BUILTIN[0];
  }

  /* ---------- 应用皮肤 ---------- */
  function apply(themeId, opts) {
    opts = opts || {};
    var theme;
    if (themeId === 'custom') {
      theme = getCustom() || BUILTIN[0];
    } else {
      theme = BY_ID[themeId] || BUILTIN[0];
    }

    var isDark = resolveDark();
    var layer = (isDark ? theme.dark : theme.light) || theme.light || {};

    var vars = derive(layer);
    var root = document.documentElement;

    // 先清掉上次注入的（含派生圆角），避免残留
    Object.keys(vars).forEach(function (k) { root.style.removeProperty(k); });

    Object.keys(vars).forEach(function (k) {
      root.style.setProperty(k, vars[k]);
    });

    // 圆角派生 —— 主题换 radius 后整套跟着缩放
    var r = vars['--radius'];
    root.style.setProperty('--radius-sm', 'calc(' + r + ' * 0.375)');
    root.style.setProperty('--radius-md', 'calc(' + r + ' * 0.5)');
    root.style.setProperty('--radius-lg', 'calc(' + r + ' * 0.75)');
    root.style.setProperty('--radius-xl', r);
    root.style.setProperty('--radius-2xl', 'calc(' + r + ' * 1.25)');

    // 深色模式类名同步（部分组件靠它取色）
    root.classList.toggle('dark', isDark);
    root.setAttribute('data-theme', theme.id || 'custom');
    root.setAttribute('data-brutal', String(theme.brutal ? 1 : 0));

    // 供 UI 读当前态
    root.setAttribute('data-mode', isDark ? 'dark' : 'light');

    if (!opts.silent) {
      if (themeId !== 'custom') set(LS.theme, themeId);
    }

    return theme;
  }

  /* ---------- 对外 API ---------- */
  var api = {
    LIGHT: LS,
    builtin: BUILTIN,
    byId: function (id) { return BY_ID[id]; },
    apply: apply,
    current: getCurrentTheme,

    /* 存储可用性：false 表示当前是内存模式（沙箱/隐私模式），刷新后偏好不保留 */
    storageOK: function () { return lsOK; },
    storedThemeId: function () { return get(LS.theme, 'yemo-navy'); },

    mode: getMode,
    setMode: function (m) {
      set(LS.mode, m);
      apply(get(LS.theme, 'yemo-navy'), { silent: true });
    },
    isDark: resolveDark,

    /* 切换皮肤时存一份快照，供「回退上一套」使用 */
    use: function (id) {
      var prev = snapshot();
      set(LS.last, JSON.stringify(prev));
      set(LS.theme, id);
      return apply(id);
    },

    snapshot: snapshot,
    rollback: rollback,
    hasSnapshot: function () { return !!get(LS.last, null); },

    importTheme: function (raw) {
      var t = sanitizeTheme(raw);
      if (!t) return { ok: false, error: '这个主题数据不合法：至少需要一组有效的颜色值。' };
      set(LS.last, JSON.stringify(snapshot()));
      set(LS.custom, JSON.stringify(t));
      set(LS.theme, 'custom');
      apply('custom');
      return { ok: true, theme: t, dropped: t.dropped || 0 };
    },

    exportTheme: function () {
      var t = getCurrentTheme();
      return JSON.stringify({
        name: t.name,
        light: t.light,
        dark: t.dark
      }, null, 2);
    },

    reset: function () {
      set(LS.last, JSON.stringify(snapshot()));
      del(LS.custom);
      set(LS.theme, 'yemo-navy');
      return apply('yemo-navy');
    },

    /* 视图模式 */
    view: function () { return get(LS.view, 'card'); },
    setView: function (v) { set(LS.view, v === 'app' ? 'app' : 'card'); },

    sanitize: sanitizeTheme
  };

  function snapshot() {
    var id = get(LS.theme, 'yemo-navy');
    return { theme: id, custom: get(LS.custom, null) };
  }

  function rollback() {
    var raw = get(LS.last, null);
    if (!raw) return false;
    var s;
    try { s = JSON.parse(raw); } catch (e) { return false; }
    if (!s || !s.theme) return false;

    if (s.theme === 'custom') {
      if (!s.custom) return false;
      set(LS.custom, s.custom);
    }
    set(LS.theme, s.theme);
    apply(s.theme);
    del(LS.last);
    return true;
  }

  /* 系统主题变化时，auto 模式自动跟随 */
  try {
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () {
        if (getMode() === 'auto') apply(get(LS.theme, 'yemo-navy'), { silent: true });
      };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  } catch (e) {}

  global.YemoSkin = api;
})(window);
