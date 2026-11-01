/* ============================================================
   夜秣浏览器书签本地整理 · 卡片渲染引擎
   卡片视图 / APP 紧凑视图 · 搜索高亮 · 分类筛选 · 图标兜底
   ============================================================ */
(function () {
  'use strict';

  var DATA = (window.BOOKMARKS || []).slice();
  var META = window.BM_META || {};

  var state = {
    q: '',
    cat: 'all',
    view: 'card'
  };

  /* ---------- 分类配色：按出现顺序分配，保证每组颜色固定 ---------- */
  var CAT_COLORS = [
    '#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed',
    '#0891b2', '#db2777', '#65a30d', '#ea580c', '#4f46e5',
    '#0d9488', '#b45309', '#be123c', '#7e22ce', '#0284c7'
  ];
  var catColorMap = {};

  function catColor(cat) {
    if (!catColorMap[cat]) {
      var idx = Object.keys(catColorMap).length % CAT_COLORS.length;
      catColorMap[cat] = CAT_COLORS[idx];
    }
    return catColorMap[cat];
  }

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function normalizeUrl(u) {
    if (!u) return '#';
    // 只放行 http/https，挡掉 javascript: 之类的伪协议
    if (!/^https?:\/\//i.test(u)) return '#';
    return u;
  }

  function domainOf(url) {
    try {
      var h = new URL(url).hostname.replace(/^www\./, '');
      return h;
    } catch (e) {
      return '';
    }
  }

  function initial(title, domain) {
    var t = (title || domain || '?').trim();
    // 中文取首字，英文取首字母
    var ch = t.charAt(0);
    return /[a-zA-Z]/.test(ch) ? ch.toUpperCase() : ch;
  }

  // 由域名生成稳定的色相，同一站点永远同色
  function hueOf(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
    return h;
  }

  function highlight(text, q) {
    if (!q) return esc(text);
    var t = String(text);
    var idx = t.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return esc(t);
    return esc(t.slice(0, idx)) + '<mark>' + esc(t.slice(idx, idx + q.length)) + '</mark>' + esc(t.slice(idx + q.length));
  }

  /* ---------- 图标：优先真实 favicon，失败回落字母块 ---------- */
  function iconHtml(item) {
    var d = domainOf(item.u);
    var color = 'hsl(' + hueOf(d || item.n || 'x') + ' 62% 46%)';
    var letter = '<span class="letter" style="background:linear-gradient(135deg,' +
      color + ',hsl(' + (hueOf(d || item.n || 'x') + 28) + ' 68% 56%))">' +
      esc(initial(item.n, d)) + '</span>';

    if (!item.i || META.icons === false) return letter;

    // 有 icon 字段就试它；onerror 时替换成字母块
    return '<img class="favicon" alt="" loading="lazy" referrerpolicy="no-referrer" src="' +
      esc(item.i) + '" data-fallback="' + esc(initial(item.n, d)) + '"' +
      ' data-color="hsl(' + hueOf(d || item.n || 'x') + ' 62% 46%)"' +
      ' onerror="window.__iconFail&&window.__iconFail(this)">';
  }

  window.__iconFail = function (img) {
    var span = document.createElement('span');
    span.className = 'letter';
    var c = img.getAttribute('data-color') || '#64748b';
    span.style.background = 'linear-gradient(135deg,' + c + ',color-mix(in srgb,' + c + ' 70%, #ffffff))';
    span.textContent = img.getAttribute('data-fallback') || '?';
    if (img.parentNode) img.parentNode.replaceChild(span, img);
  };

  /* ---------- 过滤 ---------- */
  function filtered() {
    var q = state.q.trim().toLowerCase();
    return DATA.filter(function (it) {
      if (state.cat !== 'all' && it.c !== state.cat) return false;
      if (!q) return true;
      return (it.n || '').toLowerCase().indexOf(q) >= 0 ||
             (it.d || '').toLowerCase().indexOf(q) >= 0 ||
             (it.u || '').toLowerCase().indexOf(q) >= 0 ||
             (it.c || '').toLowerCase().indexOf(q) >= 0;
    });
  }

  /* ---------- 卡片 ---------- */
  function cardHtml(it) {
    var c = catColor(it.c || '其他');
    var d = domainOf(it.u);
    var q = state.q.trim();

    return '<a class="card" href="' + esc(normalizeUrl(it.u)) + '" target="_blank" rel="noopener noreferrer"' +
      ' style="--cat-color:' + c + '" title="' + esc(it.n) + '\n' + esc(it.u) + '">' +
        '<div class="card-head">' +
          iconHtml(it) +
          '<div style="min-width:0;flex:1">' +
            '<div class="card-title">' + highlight(it.n || d || '(无标题)', q) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="card-desc">' + highlight(it.d || '', q) + '</div>' +
        '<div class="card-foot">' +
          '<span class="domain">' + highlight(d, q) + '</span>' +
          '<span class="tag">' + esc(it.c || '其他') + '</span>' +
        '</div>' +
      '</a>';
  }

  /* ---------- 主渲染 ---------- */
  function render() {
    var list = filtered();
    var box = document.getElementById('list');
    var grid = document.getElementById('grid');
    var empty = document.getElementById('empty');

    // 统计
    document.getElementById('statTotal').textContent = DATA.length;
    document.getElementById('statCat').textContent = countCats();
    document.getElementById('statShow').textContent = list.length;

    if (!list.length) {
      grid.innerHTML = '';
      empty.style.display = 'block';
      box.innerHTML = '';
      return;
    }
    empty.style.display = 'none';

    grid.className = 'grid' + (state.view === 'app' ? ' app' : '');

    // 未筛选未搜索时按分类分组展示，更有整理感
    var grouped = state.cat === 'all' && !state.q.trim();
    if (!grouped) {
      box.innerHTML = '';
      grid.innerHTML = list.map(cardHtml).join('');
      return;
    }

    // 分组视图：grid 变成若干 group + 各自网格
    grid.innerHTML = '';
    var groups = {};
    list.forEach(function (it) {
      var k = it.c || '其他';
      (groups[k] = groups[k] || []).push(it);
    });

    var order = Object.keys(groups).sort(function (a, b) {
      return groups[b].length - groups[a].length;
    });

    box.innerHTML = order.map(function (k) {
      return '<div class="group-head">' +
        '<h2><span style="width:7px;height:7px;border-radius:99px;display:inline-block;background:' +
        catColor(k) + '"></span>' + esc(k) + '</h2>' +
        '<span style="font-size:10.5px;color:var(--muted-foreground)">' + groups[k].length + '</span>' +
        '<span class="line"></span></div>' +
        '<div class="grid' + (state.view === 'app' ? ' app' : '') + '">' +
        groups[k].map(cardHtml).join('') + '</div>';
    }).join('');
  }

  function countCats() {
    var s = {};
    DATA.forEach(function (it) { s[it.c || '其他'] = 1; });
    return Object.keys(s).length;
  }

  /* ---------- 分类胶囊 ---------- */
  function renderChips() {
    var counts = {};
    DATA.forEach(function (it) { var k = it.c || '其他'; counts[k] = (counts[k] || 0) + 1; });
    var order = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });

    var html = '<button class="chip' + (state.cat === 'all' ? ' active' : '') + '" data-cat="all">' +
      '全部<span class="n">' + DATA.length + '</span></button>';

    html += order.map(function (k) {
      return '<button class="chip' + (state.cat === k ? ' active' : '') + '" data-cat="' + esc(k) + '">' +
        esc(k) + '<span class="n">' + counts[k] + '</span></button>';
    }).join('');

    var el = document.getElementById('chips');
    el.innerHTML = html;
    el.querySelectorAll('.chip').forEach(function (b) {
      b.addEventListener('click', function () {
        state.cat = b.getAttribute('data-cat');
        renderChips();
        render();
      });
    });
  }

  /* ---------- 主题面板 ---------- */
  function buildThemePanel() {
    var grid = document.getElementById('themeGrid');
    var cur = YemoSkin.current();
    var isDark = YemoSkin.isDark();

    grid.innerHTML = YemoSkin.builtin.map(function (t) {
      var layer = isDark ? t.dark : t.light;
      var active = cur && cur.id === t.id;
      return '<button class="theme-card' + (active ? ' active' : '') + '" data-theme="' + t.id + '">' +
        (active ? '<span class="use-badge">使用中</span>' : '') +
        '<div class="theme-preview" style="background:' + layer.bg + '">' +
          '<span class="sw" style="background:' + layer.primary + '"></span>' +
          '<span class="sw" style="background:' + layer.accent + '"></span>' +
          '<span class="sw" style="background:' + layer.secondary + '"></span>' +
          '<span class="bar" style="background:' + layer.primary + ';opacity:.35"></span>' +
        '</div>' +
        '<div class="theme-name">' + esc(t.name) + '</div>' +
        '<div class="theme-tag">' + esc(t.tag || '') + '</div>' +
      '</button>';
    }).join('');

    // 自定义皮肤也展示成一张卡
    if (cur && cur.custom) {
      var l = isDark ? cur.dark : cur.light;
      grid.innerHTML += '<button class="theme-card active" data-theme="custom">' +
        '<span class="use-badge">使用中</span>' +
        '<div class="theme-preview" style="background:' + (l.bg || l.background || '#fff') + '">' +
          '<span class="sw" style="background:' + (l.primary || '#888') + '"></span>' +
          '<span class="sw" style="background:' + (l.accent || '#ddd') + '"></span>' +
          '<span class="bar" style="background:' + (l.primary || '#888') + ';opacity:.35"></span>' +
        '</div>' +
        '<div class="theme-name">' + esc(cur.name || '自定义') + '</div>' +
        '<div class="theme-tag">自定义</div>' +
      '</button>';
    }

    grid.querySelectorAll('.theme-card').forEach(function (b) {
      b.addEventListener('click', function () {
        YemoSkin.use(b.getAttribute('data-theme'));
        buildThemePanel();
        syncModeButtons();
        toast('已换成「' + (YemoSkin.current().name) + '」');
      });
    });

    // 回退按钮可用性
    var rb = document.getElementById('rollbackBtn');
    if (rb) rb.disabled = !YemoSkin.hasSnapshot();

    // 面板顶部实时显示当前皮肤，换完能立刻确认生效
    var curEl = document.getElementById('themeCurrent');
    if (curEl) {
      var suffix = YemoSkin.storageOK() ? '' : '（此环境不保留偏好）';
      curEl.textContent = '当前皮肤：' + (cur ? cur.name : '默认') + suffix;
    }
  }

  function syncModeButtons() {
    var m = YemoSkin.mode();
    document.querySelectorAll('.mode-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-mode') === m);
    });
    var dt = document.getElementById('darkToggleIcon');
    if (dt) dt.innerHTML = YemoSkin.isDark() ? ICON.sun : ICON.moon;
  }

  /* ---------- Toast ---------- */
  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1900);
  }

  /* ---------- 图标 ---------- */
  var ICON = {
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/></svg>',
    card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    app: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4" rx="1.5"/><rect x="3" y="12" width="18" height="4" rx="1.5"/><rect x="3" y="20" width="10" height="1.5" rx=".75"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>'
  };

  /* ---------- 初始化 ---------- */
  function init() {
    // 皮肤：走 YemoSkin 的安全读法，沙箱里也能拿到默认值
    YemoSkin.apply(YemoSkin.storedThemeId(), { silent: true });

    // 视图
    state.view = YemoSkin.view();

    // 搜索
    var q = document.getElementById('q');
    var wrap = document.getElementById('searchWrap');
    q.addEventListener('input', function () {
      state.q = q.value;
      wrap.classList.toggle('has-value', !!q.value);
      render();
    });
    q.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { q.value = ''; state.q = ''; wrap.classList.remove('has-value'); render(); }
    });
    document.getElementById('clearQ').addEventListener('click', function () {
      q.value = ''; state.q = ''; wrap.classList.remove('has-value'); render(); q.focus();
    });

    // 快捷键：/ 聚焦搜索
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && document.activeElement !== q) { e.preventDefault(); q.focus(); }
    });

    // 视图切换
    var vt = document.getElementById('viewToggle');
    function paintView() {
      vt.innerHTML = state.view === 'card' ? ICON.card + '<span>卡片</span>' : ICON.app + '<span>紧凑</span>';
      vt.title = state.view === 'card' ? '切换到紧凑视图' : '切换到卡片视图';
    }
    vt.addEventListener('click', function () {
      state.view = state.view === 'card' ? 'app' : 'card';
      YemoSkin.setView(state.view);
      paintView();
      render();
      toast(state.view === 'card' ? '卡片视图' : '紧凑视图');
    });
    paintView();

    // 深色快捷开关
    document.getElementById('darkToggle').addEventListener('click', function () {
      var next = YemoSkin.isDark() ? 'light' : 'dark';
      YemoSkin.setMode(next);
      buildThemePanel();
      syncModeButtons();
      render();
    });

    // 主题面板打开/关闭
    var ov = document.getElementById('overlay');
    document.getElementById('themeBtn').addEventListener('click', function () {
      buildThemePanel();
      syncModeButtons();
      ov.classList.add('open');
    });
    document.getElementById('closeDialog').addEventListener('click', function () {
      ov.classList.remove('open');
    });
    ov.addEventListener('click', function (e) {
      if (e.target === ov) ov.classList.remove('open');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') ov.classList.remove('open');
    });

    // 外观模式
    document.querySelectorAll('.mode-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        YemoSkin.setMode(b.getAttribute('data-mode'));
        buildThemePanel();
        syncModeButtons();
        render();
      });
    });

    // 回退
    document.getElementById('rollbackBtn').addEventListener('click', function () {
      if (YemoSkin.rollback()) {
        buildThemePanel();
        syncModeButtons();
        render();
        toast('已回退上一套皮肤');
      } else {
        toast('没有可回退的皮肤');
      }
    });

    // 自定义皮肤导入
    document.getElementById('importBtn').addEventListener('click', function () {
      var ta = document.getElementById('themeJson');
      var r = YemoSkin.importTheme(ta.value);
      if (r.ok) {
        buildThemePanel();
        syncModeButtons();
        render();
        toast('已应用自定义皮肤：' + r.theme.name +
          (r.dropped ? '（已拦下 ' + r.dropped + ' 个非法值）' : ''));
        ta.value = '';
      } else {
        toast(r.error);
      }
    });

    // 导出
    document.getElementById('exportBtn').addEventListener('click', function () {
      var json = YemoSkin.exportTheme();
      var ta = document.getElementById('themeJson');
      ta.value = json;
      // 尝试直接下载一份
      try {
        var blob = new Blob([json], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'yemo-skin-' + (YemoSkin.current().name || 'theme') + '.json';
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1200);
      } catch (e) {}
      toast('已导出当前皮肤');
    });

    // 恢复默认
    document.getElementById('resetBtn').addEventListener('click', function () {
      YemoSkin.reset();
      buildThemePanel();
      syncModeButtons();
      render();
      toast('已恢复默认皮肤');
    });

    // 回到顶部
    var top = document.getElementById('toTop');
    top.innerHTML = ICON.up;
    top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    window.addEventListener('scroll', function () {
      top.classList.toggle('show', window.scrollY > 420);
    }, { passive: true });

    // 首屏
    renderChips();
    render();
    syncModeButtons();
  }

  /* 兜底：初始化任何一步出错，都不能让页面变成白板 —— 至少把书签列出来 */
  function safeInit() {
    try {
      init();
    } catch (err) {
      if (window.console) console.error('[书签页] 初始化失败：', err);
      try { renderFallback(); } catch (e) {}
    }
  }

  function renderFallback() {
    var grid = document.getElementById('grid');
    if (!grid) return;
    grid.className = 'grid';
    grid.innerHTML = DATA.map(function (it) {
      return '<a class="card" href="' + esc(normalizeUrl(it.u)) + '" target="_blank" rel="noopener noreferrer">' +
        '<div class="card-head">' + iconHtml(it) +
        '<div style="min-width:0;flex:1"><div class="card-title">' + esc(it.n) + '</div></div></div>' +
        '<div class="card-desc">' + esc(it.d || '') + '</div>' +
        '<div class="card-foot"><span class="domain">' + esc(domainOf(it.u)) + '</span></div></a>';
    }).join('');
    var q = document.getElementById('q');
    if (q) {
      q.addEventListener('input', function () {
        var v = q.value.toLowerCase();
        Array.prototype.forEach.call(grid.children, function (a, i) {
          var it = DATA[i] || {};
          var hit = !v || (it.n + it.d + it.u).toLowerCase().indexOf(v) >= 0;
          a.style.display = hit ? '' : 'none';
        });
      });
    }
    var chips = document.getElementById('chips');
    if (chips) chips.style.display = 'none';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeInit);
  } else {
    safeInit();
  }
})();
