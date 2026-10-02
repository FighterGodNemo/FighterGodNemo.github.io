/* ============================================================
   琉璃幻彩博客 · 精修层 (refine.js)
   1. 阅读进度条
   2. 工具反向索引（本站 signature：告诉读者哪些工具本站还写过）
   3. 键盘快捷键
   独立于 custom.js，互不影响；全部走 pjax 生命周期。
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- 通用工具 ---------------- */

  function onReady(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  /**
   * body 可能尚未就绪（pjax 替换节点、脚本在 head 提前执行等）。
   * 所有需要往 body 挂节点的逻辑都先过这里，避免静默失败。
   */
  function withBody(fn) {
    if (document.body) { fn(); return true; }
    // 兜底：body 一出现就补做一次
    var done = false;
    var retry = function () {
      if (done || !document.body) return;
      done = true;
      document.removeEventListener('DOMContentLoaded', retry);
      try { fn(); } catch (e) { console.warn('[refine]', e); }
    };
    document.addEventListener('DOMContentLoaded', retry);
    // 某些情况下 DOMContentLoaded 已过但 body 仍被替换，交给 load 再试
    if (document.readyState === 'complete') setTimeout(retry, 0);
    return false;
  }

  function isTypingContext(el) {
    if (!el) return false;
    var tag = (el.tagName || '').toLowerCase();
    return (
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'select' ||
      el.isContentEditable === true
    );
  }

  /* ============================================================
     1. 阅读进度条
     衡量「文章正文」而非整个页面，这样文末不会停在 85%
     ============================================================ */

  function ensureProgressBar() {
    var bar = document.getElementById('rf-progress');
    if (!bar) {
      if (!document.body) return null;
      bar = document.createElement('div');
      bar.id = 'rf-progress';
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-hidden', 'true');
      document.body.appendChild(bar);
    }
    return bar;
  }

  /** 只在真正的文章页显示；首页/归档/分类页没有正文可衡量 */
  function getArticleBody() {
    var article = document.getElementById('article-container');
    if (!article) return null;

    // 首页的 article-container 承载的是文章卡片流，没有 .post-content 正文语义
    var isPostPage = document.getElementById('page-header') &&
      !document.body.classList.contains('home');
    if (!isPostPage) return null;

    var body = article.querySelector('.post-content, .article-content, #post-content');
    return body || article;
  }

  function updateProgress() {
    var bar = document.getElementById('rf-progress');
    if (!bar) return;

    var body = getArticleBody();
    if (!body) {
      bar.classList.remove('is-active');
      bar.style.width = '0%';
      return;
    }

    var rect = body.getBoundingClientRect();
    var viewport = window.innerHeight || document.documentElement.clientHeight;

    // 衡量区间：正文顶部进入视口 → 正文底部离开视口
    var total = rect.height - viewport;
    if (total <= 0) {
      // 文章比一屏还短：读完即 100%
      var done = rect.bottom <= viewport ? 1 : 0;
      bar.style.width = done ? '100%' : '0%';
      bar.classList.toggle('is-active', done === 1);
      return;
    }

    var scrolled = -rect.top;
    var ratio = scrolled / total;
    ratio = Math.max(0, Math.min(1, ratio));

    bar.style.width = (ratio * 100).toFixed(2) + '%';
    bar.classList.toggle('is-active', ratio > 0.001);
  }

  /* ============================================================
     2. 工具反向索引
     从 prebuild 出的工具→文章索引里，找出「本文提到的工具」和
     「本站还有哪些文章写过这个工具」，在文末连成网。
     ============================================================ */

  var TOOL_INDEX_URL = '/tool-index.json';
  var indexCache = null;
  var indexLoadFailed = false;

  function loadToolIndex() {
    if (indexCache) return Promise.resolve(indexCache);
    if (indexLoadFailed) return Promise.resolve(null);

    return fetch(TOOL_INDEX_URL + '?t=' + Date.now(), { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        // 约定结构: { "<工具名>": { count, posts: ["/permalink/", ...] } }
        indexCache = data && typeof data === 'object' ? data : null;
        return indexCache;
      })
      .catch(function (err) {
        // 索引缺失属于正常情况（首次构建未跑 prebuild），安静降级
        indexLoadFailed = true;
        console.warn('[refine] 工具索引不可用：', err && err.message);
        return null;
      });
  }

  /** 取正文纯文本，用于判断本文是否真的提到了某个工具 */
  function getArticleText() {
    var body = getArticleBody();
    if (!body) return '';
    var clone = body.cloneNode(true);
    clone.querySelectorAll('script, style, pre, .highlight, #rf-toolbox').forEach(function (n) {
      n.remove();
    });
    return clone.textContent || '';
  }

  /** 工具名归一化：大小写不敏感，容忍空格/连字符差异 */
  function normalizeTool(name) {
    return String(name).toLowerCase().replace(/[\s_\-.]+/g, '');
  }

  /**
   * 判断工具名是否在正文里出现。
   * 用词边界避免 "bin" 命中 "combine" 这类误报。
   */
  function mentions(text, tool) {
    var t = tool.trim();
    if (!t) return false;
    var esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var re = new RegExp('(^|[^A-Za-z0-9])' + esc + '(?![A-Za-z0-9])', 'i');
    return re.test(text);
  }

  function currentPermalink() {
    var meta = document.querySelector('meta[property="og:url"], link[rel="canonical"]');
    if (meta) {
      try {
        return new URL(meta.content || meta.href, location.href).pathname.replace(/\/+$/, '') || '/';
      } catch (e) { /* 落到下面 */ }
    }
    return location.pathname.replace(/\/+$/, '') || '/';
  }

  function createToolbox(index, text, here) {
    var box = document.createElement('aside');
    box.id = 'rf-toolbox';

    var hits = [];
    var others = [];

    Object.keys(index).forEach(function (tool) {
      var entry = index[tool];
      var posts = (entry && entry.posts) || [];
      if (!posts.length) return;

      var usedHere = mentions(text, tool);
      var related = posts.filter(function (p) {
        return normalizeUrl(p) !== normalizeUrl(here);
      });
      // 只有「本文用过」或「还有别的文章写过」才值得列出
      if (!usedHere && !related.length) return;

      // 跳转目标优先选真正的实战文章，而不是总被提及的「工具索引」页——
      // 点每个标签都落到同一篇索引等于没给读者任何增量信息。
      var realPosts = related.filter(function (p) { return !isIndexPage(p); });
      var targetPool = realPosts.length ? realPosts : related;

      hits.push({
        tool: tool,
        count: posts.length,
        here: usedHere,
        posts: targetPool,
        realCount: realPosts.length
      });
    });

    if (!hits.length) return null;

    var hereTools = hits.filter(function (h) { return h.here; });
    var siteTools = hits.filter(function (h) { return !h.here && h.posts.length; });
    siteTools.sort(function (a, b) { return b.count - a.count; });
    hereTools.sort(function (a, b) { return b.count - a.count; });

    // --- 头部 ---
    var head = document.createElement('div');
    head.className = 'rf-tb-head';
    // 副标题只说对读者有用的事实：本文用到几个、还关联几篇
    var subText;
    if (hereTools.length && siteTools.length) {
      subText = '本文用到 ' + hereTools.length + ' 个 · 另有 ' + siteTools.length + ' 个站内工具';
    } else if (hereTools.length) {
      subText = '本文用到 ' + hereTools.length + ' 个工具';
    } else {
      subText = '本站还有 ' + siteTools.length + ' 个相关工具';
    }

    head.innerHTML =
      '<span class="rf-tb-label">related</span>' +
      '<span class="rf-tb-title">相关工具</span>' +
      '<span class="rf-tb-sub">' + subText + '</span>';
    box.appendChild(head);

    // --- 标签墙 ---
    var tags = document.createElement('div');
    tags.className = 'rf-tb-tags';

    function chip(h, isHere) {
      // 有站内关联文章时，标签即链接：读者能直接跳过去看
      var target = h.posts[0];
      var el;
      if (target && target.url) {
        el = document.createElement('a');
        el.href = target.url;
        el.className = 'rf-chip' + (isHere ? ' is-here' : '');
        el.title = h.here
          ? h.tool + '：本文使用，站内 ' + h.count + ' 篇文章提及'
            + (h.posts.length ? '，点此看其中一篇' : '')
          : h.tool + '：站内 ' + h.count + ' 篇文章提及，点此看其中一篇';
      } else {
        el = document.createElement('span');
        el.className = 'rf-chip' + (isHere ? ' is-here' : '');
        el.title = h.tool + '：站内 ' + h.count + ' 篇文章提及';
      }
      el.dataset.count = h.count;
      el.innerHTML =
        '<span>' + escapeHtml(h.tool) + '</span>' +
        '<span class="rf-cnt">' + h.count + '</span>';
      return el;
    }

    hereTools.forEach(function (h) { tags.appendChild(chip(h, true)); });

    if (hereTools.length && siteTools.length) {
      var sep = document.createElement('div');
      sep.className = 'rf-tb-sep';
      tags.appendChild(sep);
    }

    siteTools.slice(0, 24).forEach(function (h) { tags.appendChild(chip(h, false)); });

    box.appendChild(tags);

    // --- 图例：解释两个圆点的含义 ---
    var legend = document.createElement('div');
    legend.className = 'rf-tb-legend';
    legend.innerHTML =
      '<span><i class="rf-dot here"></i>本文用到</span>' +
      '<span><i class="rf-dot site"></i>站内其他文章写过</span>' +
      '<span style="margin-left:auto">数字为提及文章数 · 点标签可跳转</span>';
    box.appendChild(legend);

    return box;
  }

  function normalizeUrl(u) {
    return String(u || '').replace(/\/+$/, '');
  }

  /**
   * 「工具索引」类页面是目录，不是实战内容。
   * 读者想看的是别人在真实题目里怎么用这个工具。
   */
  function isIndexPage(post) {
    var t = String((post && post.title) || '');
    if (/工具索引|工具清单|工具列表|解题妙具/.test(t)) return true;
    var u = String((post && post.url) || '');
    return /工具索引|工具清单|工具列表/.test(u);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function mountToolbox() {
    // 幂等：pjax 回来时先清掉旧的
    var old = document.getElementById('rf-toolbox');
    if (old) old.remove();

    if (!getArticleBody()) return;

    var text = getArticleText();
    if (!text || text.length < 200) return; // 太短的页面不值得挂组件

    loadToolIndex().then(function (index) {
      if (!index) return;
      // 异步回来时可能已经 pjax 走了
      if (!getArticleBody() || !document.body.contains(document.getElementById('article-container'))) return;

      var box = createToolbox(index, text, currentPermalink());
      if (!box) return;

      var host = getArticleBody();
      // 放在正文末尾；若文章有「上一篇/下一篇」，插在它前面更自然
      var nav = document.querySelector('.post-nav, .post-next, .post-prev, #post-navigation');
      if (nav && nav.parentNode) {
        nav.parentNode.insertBefore(box, nav);
      } else {
        host.appendChild(box);
      }
    });
  }

  /* ============================================================
     3. 键盘快捷键
     ============================================================ */

  var KEY_HINTS = [
    { k: '/', label: '搜索' },
    { k: 't', label: '回到顶部' },
    { k: '?', label: '打开/关闭本帮助' }
  ];

  function ensureKeyUi() {
    if (!document.body) return null;
    var bar = document.getElementById('rf-keys');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'rf-keys';
      KEY_HINTS.forEach(function (h) {
        var b = document.createElement('span');
        b.className = 'rf-kbd';
        b.innerHTML = '<kbd>' + h.k + '</kbd><span>' + h.label + '</span>';
        bar.appendChild(b);
      });
      document.body.appendChild(bar);
    }

    var help = document.getElementById('rf-help');
    if (!help) {
      help = document.createElement('div');
      help.id = 'rf-help';
      help.setAttribute('role', 'dialog');
      help.setAttribute('aria-modal', 'true');
      help.setAttribute('aria-label', '键盘快捷键');
      help.innerHTML =
        '<div class="rf-help-card">' +
        '<div class="rf-help-title">keyboard shortcuts</div>' +
        '<div class="rf-help-list">' +
        KEY_HINTS.concat([
          { k: 'Esc', label: '关闭搜索 / 关闭本页' }
        ]).map(function (h) {
          return '<div class="rf-help-row"><span>' + h.label +
            '</span><kbd>' + h.k + '</kbd></div>';
        }).join('') +
        '</div>' +
        '<div class="rf-help-foot">在输入框内打字时快捷键自动让位，不会打断你。</div>' +
        '</div>';
      document.body.appendChild(help);

      // 点遮罩关闭
      help.addEventListener('click', function (e) {
        if (e.target === help) closeHelp();
      });
    }
    return { bar: bar, help: help };
  }

  function closeHelp() {
    var help = document.getElementById('rf-help');
    if (help) help.classList.remove('is-open');
  }

  function toggleHelp() {
    var help = document.getElementById('rf-help');
    if (!help) return;
    help.classList.toggle('is-open');
  }

  function focusSearch() {
    var input =
      document.querySelector('#search-input .search-input') ||
      document.querySelector('input[name="s"], #search-input input, .search-input');
    if (!input) return;
    input.focus();
    input.select();
  }

  function scrollTop() {
    var behavior = matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth';
    window.scrollTo({ top: 0, behavior: behavior });
  }

  /** 鼠标移动时短暂显示快捷键提示，静止后淡出 */
  function bindHintReveal(bar) {
    var timer;
    var reveal = function () {
      bar.classList.add('is-revealed');
      clearTimeout(timer);
      timer = setTimeout(function () {
        bar.classList.remove('is-revealed');
      }, 2200);
    };
    window.addEventListener('mousemove', reveal, { passive: true });
    // 触屏没有鼠标，键盘用户走 focus 提示
    window.addEventListener('keydown', function () {
      document.body.classList.add('rf-keyboard');
      bar.classList.add('is-revealed');
      clearTimeout(timer);
      timer = setTimeout(function () {
        bar.classList.remove('is-revealed');
      }, 2200);
    });
  }

  function bindKeys() {
    // 整个文档生命周期只注册一次，避免 pjax 反复触发后
    // 同一次按键被处理多遍（会导致搜索框被 focus 两次等怪现象）。
    if (window.__rfKeysBound) return;
    window.__rfKeysBound = true;

    document.addEventListener('keydown', function (e) {
      // 正在打字 → 完全让位
      if (isTypingContext(e.target)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      var help = document.getElementById('rf-help');
      var helpOpen = help && help.classList.contains('is-open');

      switch (e.key) {
        case '/':
          e.preventDefault();
          focusSearch();
          break;
        case '?':
          e.preventDefault();
          toggleHelp();
          break;
        case 'Escape':
          if (helpOpen) closeHelp();
          break;
        case 't':
        case 'T':
          if (helpOpen) return;
          e.preventDefault();
          scrollTop();
          break;
      }
    });
  }

  /* ============================================================
     生命周期
     ============================================================ */

  function refresh() {
    ensureProgressBar();
    updateProgress();
    mountToolbox();

    // pjax 会替换 body 子节点，挂上去的快捷键 UI 会随之消失，
    // 因此每次刷新都重新确保存在，而不是只在首次创建时绑定一次。
    withBody(function () {
      try {
        var ui = ensureKeyUi();
        if (!ui) return;
        bindKeys();
        if (!ui.bar.dataset.rfBound) {
          ui.bar.dataset.rfBound = '1';
          bindHintReveal(ui.bar);
        }
      } catch (e) {
        console.warn('[refine] 快捷键 UI 初始化失败:', e);
      }
    });
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      // 首次可能因 body 未就绪而没挂上进度条，这里补建
      ensureProgressBar();
      updateProgress();
      ticking = false;
    });
  }

  onReady(function () {
    refresh();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
  });

  document.addEventListener('pjax:complete', refresh);
})();
