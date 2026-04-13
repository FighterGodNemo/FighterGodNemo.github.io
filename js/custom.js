(function () {
  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function swapSidebarCards() {
    var sticky = document.querySelector('#aside-content .sticky_layout');
    if (!sticky) return;
    var recent = sticky.querySelector('.card-recent-post');
    var categories = sticky.querySelector('.card-categories');
    if (recent && categories && categories.nextElementSibling !== recent) {
      sticky.insertBefore(categories, recent);
    }
  }

  function isColorValue(val) {
    return /^(#|rgb|hsl|linear-gradient|radial-gradient)/i.test(val);
  }

  function normalizeBgValue(val) {
    return normalizeFileName(String(val || ''));
  }

  function lockHeaderBackground() {
    var header = document.getElementById('page-header');
    if (!header) return;
    header.style.setProperty('background', 'transparent', 'important');
    header.style.setProperty('background-image', 'none', 'important');
    header.style.setProperty('--mark-bg', 'transparent', 'important');
    header.setAttribute('data-bg-lock', '1');
  }

  function setElementBackground(el, bg) {
    if (!el) return;
    var next = String(bg || '');
    var current = el.getAttribute('data-bg-source') || '';
    if (normalizeBgValue(current) === normalizeBgValue(next)) return;

    el.removeAttribute('style');
    if (!next) {
      el.setAttribute('data-bg-source', '');
      return;
    }

    if (isColorValue(next)) {
      el.style.setProperty('background-image', 'none', 'important');
      el.style.setProperty('background-color', next, 'important');
    } else {
      el.style.setProperty('background-color', 'transparent', 'important');
      el.style.setProperty('background-image', 'url(' + next + ')', 'important');
      el.style.setProperty('background-size', 'cover', 'important');
      el.style.setProperty('background-position', 'center', 'important');
      el.style.setProperty('background-repeat', 'no-repeat', 'important');
    }
    el.setAttribute('data-bg-source', next);
  }

  function getVisibleBackgroundColor(el) {
    if (!el || !window.getComputedStyle) return '';
    var color = '';
    try {
      color = window.getComputedStyle(el).backgroundColor || '';
    } catch (e) {
      color = '';
    }
    if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
      return '';
    }
    return color;
  }

  function ensurePostHeaderLayer(header) {
    if (!header) return null;
    var layer = header.querySelector('.post-top-bg-layer');
    if (layer) return layer;
    layer = document.createElement('div');
    layer.className = 'post-top-bg-layer';
    header.insertBefore(layer, header.firstChild);
    return layer;
  }

  function clearPostHeaderLayer(header) {
    var target = header || document.getElementById('page-header');
    if (!target) return;
    var layer = target.querySelector('.post-top-bg-layer');
    if (layer && layer.parentNode) {
      layer.parentNode.removeChild(layer);
    }
  }

  function getHeaderDeclaredBackground(header) {
    if (!header) return '';
    var bgImage = header.style.backgroundImage || '';
    if (bgImage && bgImage !== 'none') {
      var imageMatch = bgImage.match(/^url\((['"]?)(.*?)\1\)$/i);
      return imageMatch ? imageMatch[2] : bgImage;
    }
    var bg = header.style.background || '';
    if (bg && bg !== 'none') return bg;
    var bgColor = header.style.backgroundColor || '';
    if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
      return bgColor;
    }
    return '';
  }

  function getCustomPostHeaderSource(header) {
    if (!header || header.getAttribute('data-has-custom-post-top-img') !== '1') return '';
    var cached = header.getAttribute('data-custom-post-top-source') || '';
    if (cached) return cached;
    var source = getHeaderDeclaredBackground(header);
    if (source) header.setAttribute('data-custom-post-top-source', source);
    return source;
  }

  function resolveCurrentPostHeaderBackground() {
    var header = document.getElementById('page-header');
    if (!header || !header.classList.contains('post-bg')) return '';
    return getCustomPostHeaderSource(header);
  }

  function updatePostHeaderBackground() {
    var header = document.getElementById('page-header');
    if (!header) return;
    if (!header.classList.contains('post-bg')) {
      clearPostHeaderLayer(header);
      return;
    }

    var source = resolveCurrentPostHeaderBackground();
    if (!source) {
      clearPostHeaderLayer(header);
      return;
    }

    var layer = ensurePostHeaderLayer(header);
    setElementBackground(layer, source);
  }

  function applyBackground(bg) {
    var webBg = document.getElementById('web_bg');
    if (!webBg) {
      webBg = document.createElement('div');
      webBg.id = 'web_bg';
      webBg.className = 'bg-animation';
      document.body.insertBefore(webBg, document.body.firstChild);
    }
    updatePostHeaderBackground();
    if (!bg) {
      lockHeaderBackground();
      return;
    }
    var isColor = isColorValue(bg);
    var fallbackBgColor = getVisibleBackgroundColor(webBg) || '#1B2430';
    var preloadStyle = document.getElementById('bg-preload-style');
    if (preloadStyle && preloadStyle.parentNode) {
      preloadStyle.parentNode.removeChild(preloadStyle);
    }
    if (webBg) {
      var current = webBg.getAttribute('data-bg-url') || '';
      var same = normalizeBgValue(current) === normalizeBgValue(bg);
      if (!same) {
        // Clear inline styles that may pin the default background.
        webBg.removeAttribute('style');
        if (isColor) {
          webBg.style.setProperty('background-image', 'none', 'important');
          webBg.style.setProperty('background-color', bg, 'important');
        } else {
          // Keep a visible fallback color until the image has fully painted.
          webBg.style.setProperty('background-color', fallbackBgColor, 'important');
          webBg.style.setProperty('background-image', 'url(' + bg + ')', 'important');
          // Force correct aspect scaling for images.
          webBg.style.setProperty('background-size', 'cover', 'important');
          webBg.style.setProperty('background-position', 'center', 'important');
          webBg.style.setProperty('background-repeat', 'no-repeat', 'important');
        }
        webBg.setAttribute('data-bg-url', bg);
      }
    }
    lockHeaderBackground();
    updatePostHeaderBackground();
    updateBgmCover();
    updateVideoBackground(bg);

    try {
      localStorage.setItem('bgUrl', String(bg));
    } catch (e) {}
  }

  function getBasenameFromUrl(url) {
    if (!url) return '';
    var clean = url.split('?')[0].split('#')[0];
    var parts = clean.split('/');
    var last = parts[parts.length - 1] || '';
    try {
      last = decodeURIComponent(last);
    } catch (e) {}
    return last.replace(/\.(png|jpe?g|webp|gif)$/i, '');
  }

  function getFileNameFromUrl(url) {
    if (!url) return '';
    var clean = url.split('?')[0].split('#')[0];
    var parts = clean.split('/');
    var last = parts[parts.length - 1] || '';
    try {
      last = decodeURIComponent(last);
    } catch (e) {}
    return last;
  }

  function normalizeFileName(name) {
    return String(name || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeMatchKey(name) {
    return normalizeFileName(String(name || ''));
  }

  function createFallbackBgMap(list) {
    var items = [];
    for (var i = 0; i < (list || []).length; i++) {
      var url = list[i];
      var baseName = getBasenameFromUrl(url);
      var key = normalizeMatchKey(baseName) || ('fallback-' + i);
      items.push({
        key: key,
        name: baseName || ('背景' + (i + 1)),
        order: i,
        main: url,
        post: ''
      });
    }
    return {
      order: items.map(function (item) { return item.key; }),
      items: items,
      byKey: items.reduce(function (acc, item) {
        acc[item.key] = item;
        return acc;
      }, {})
    };
  }

  function setBgMap(map, fallbackList) {
    var sourceItems = map && Array.isArray(map.items) && map.items.length
      ? map.items
      : createFallbackBgMap(fallbackList || []).items;
    var items = [];
    var byUrl = {};
    var byKey = {};

    for (var i = 0; i < sourceItems.length; i++) {
      var item = sourceItems[i];
      if (!item || !item.main) continue;
      var key = normalizeMatchKey(item.key || item.name || getBasenameFromUrl(item.main));
      var name = normalizeFileName(item.name || item.displayName || key || getBasenameFromUrl(item.main));
      var normalized = {
        key: key,
        name: name || key,
        order: typeof item.order === 'number' ? item.order : i,
        main: item.main,
        post: item.post || ''
      };
      items.push(normalized);
      byUrl[normalizeFileName(normalized.main)] = normalized;
      byKey[normalizeMatchKey(normalized.key)] = normalized;
    }

    bgState.map = {
      order: items.map(function (entry) { return entry.key; }),
      items: items,
      byKey: byKey
    };
    bgState.items = items;
    bgState.list = items.map(function (entry) { return entry.main; });
    bgState.byUrl = byUrl;
    bgState.byKey = byKey;
  }

  function getBgEntryByUrl(url) {
    return bgState.byUrl[normalizeFileName(url)] || null;
  }

  function getBgEntryByKey(key) {
    return bgState.byKey[normalizeMatchKey(key)] || null;
  }

  function getCurrentBgEntry() {
    return getBgEntryByUrl(bgState.current || '');
  }

  function normalizeTrackUrl(url) {
    return normalizeFileName(String(url || ''));
  }

  function stripAudioExt(name) {
    return String(name || '').replace(/\.(mp3|m4a|aac|ogg|wav|flac)$/i, '');
  }

  function getBgUrlByName(name) {
    var entry = getBgEntryByKey(name);
    return entry ? (entry.main || '') : '';
  }

  function setBgmCover(bg) {
    var root = document.documentElement;
    if (!root) return;
    if (!bg) {
      root.style.setProperty('--bgm-cover', 'none');
      return;
    }
    if (isColorValue(bg)) {
      root.style.setProperty('--bgm-cover', 'none');
    } else {
      root.style.setProperty('--bgm-cover', 'url(\"' + bg + '\")');
    }
  }

  function getCoverBg() {
    if (musicState.listKey && musicState.listKey !== '__bg__' && musicState.listKey !== '__all__') {
      var listBg = getBgUrlByName(musicState.listKey);
      if (listBg) return listBg;
    }
    return bgState.current || '';
  }

  function updateBgmCover() {
    setBgmCover(getCoverBg());
  }

  function addCacheBuster(url) {
    var ts = String(Date.now());
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'v=' + ts;
  }

  function loadJson(url, fallback) {
    var requestUrl = addCacheBuster(url);
    return fetch(requestUrl, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) return fallback;
        return res.json();
      })
      .catch(function () {
        return fallback;
      });
  }

  function waitForAPlayer(timeoutMs) {
    return new Promise(function (resolve) {
      if (window.APlayer) return resolve(true);
      var start = Date.now();
      var timer = setInterval(function () {
        if (window.APlayer) {
          clearInterval(timer);
          resolve(true);
          return;
        }
        if (Date.now() - start > timeoutMs) {
          clearInterval(timer);
          resolve(false);
        }
      }, 200);
    });
  }

  var videoBgConfig = {
    // Enable this only after adding matching /img/bg/<name>.mp4 files.
    enabled: false,
    basePath: '/img/bg/',
    poster: '/img/index-bg.jpg',
    fallback: ''
  };

  var videoBgState = {
    el: null,
    source: null,
    current: '',
    webBg: null
  };

  function shouldDisableVideoBg() {
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return true;
      }
      if (navigator.connection && navigator.connection.saveData) {
        return true;
      }
    } catch (e) {}
    return false;
  }

  function getVideoUrlByBg(bgUrl) {
    if (!bgUrl || isColorValue(bgUrl)) return videoBgConfig.fallback || '';
    var name = getBasenameFromUrl(bgUrl);
    if (!name) return videoBgConfig.fallback || '';
    return videoBgConfig.basePath + encodeURIComponent(name) + '.mp4';
  }

  function tryPlayVideo(video) {
    if (!video) return;
    var p = video.play();
    if (p && p.catch) p.catch(function () {});
  }

  function updateVideoBackground(bgUrl) {
    if (!videoBgConfig.enabled || shouldDisableVideoBg()) return;
    if (!videoBgState.el || !videoBgState.source) return;

    var nextUrl = getVideoUrlByBg(bgUrl);
    if (!nextUrl) {
      videoBgState.current = '';
      videoBgState.source.src = '';
      videoBgState.el.load();
      if (videoBgState.webBg) videoBgState.webBg.classList.remove('has-video');
      videoBgState.el.style.display = 'none';
      return;
    }

    if (videoBgState.current === nextUrl && videoBgState.el.style.display !== 'none') return;
    videoBgState.current = nextUrl;
    if (videoBgState.webBg) videoBgState.webBg.classList.remove('has-video');
    videoBgState.el.style.display = 'none';
    videoBgState.source.src = nextUrl;
    videoBgState.el.load();
    tryPlayVideo(videoBgState.el);
  }

  var bgGuardBound = false;

  function restoreBackground() {
    var saved = '';
    try {
      saved = localStorage.getItem('bgUrl') || '';
    } catch (e) {}
    var target = saved || (typeof bgState !== 'undefined' && bgState && bgState.current) || '';
    if (target) {
      applyBackground(target);
    } else {
      lockHeaderBackground();
    }
  }

  function bindBackgroundGuards() {
    if (bgGuardBound) return;
    bgGuardBound = true;
    document.addEventListener('pjax:send', restoreBackground);
    document.addEventListener('pjax:success', restoreBackground);
    document.addEventListener('pjax:complete', restoreBackground);
    document.addEventListener('DOMContentLoaded', restoreBackground);

    var observer = new MutationObserver(function () {
      var header = document.getElementById('page-header');
      if (!header) return;
      if (header.getAttribute('data-bg-lock') !== '1') {
        lockHeaderBackground();
      }
    });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  function initVideoBackground() {
    if (!videoBgConfig.enabled || shouldDisableVideoBg()) return;
    var webBg = document.getElementById('web_bg');
    if (!webBg) return;
    if (webBg.querySelector('.bg-video')) return;

    var video = document.createElement('video');
    video.className = 'bg-video';
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.style.display = 'none';
    if (videoBgConfig.poster) video.poster = videoBgConfig.poster;

    var source = document.createElement('source');
    source.type = 'video/mp4';
    video.appendChild(source);

    webBg.appendChild(video);
    videoBgState.el = video;
    videoBgState.source = source;
    videoBgState.webBg = webBg;

    video.addEventListener('loadeddata', function () {
      if (videoBgState.webBg) videoBgState.webBg.classList.add('has-video');
      video.style.display = '';
    });

    video.addEventListener('error', function () {
      if (videoBgState.webBg) videoBgState.webBg.classList.remove('has-video');
      video.style.display = 'none';
    });

    tryPlayVideo(video);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        video.pause();
      } else {
        tryPlayVideo(video);
      }
    });

    updateVideoBackground(bgState.current || '');
  }

  var bgState = {
    list: [],
    index: 0,
    current: '',
    map: null,
    items: [],
    byUrl: {},
    byKey: {}
  };

  var builtInDefaultMap = {
    '背景一': [
      '彼女は旅に出る - 鎖那.flac',
      '鎖那 - 彼女は旅に出る.flac',
      '鎖那 - 彼女は旅に出る.mp3',
      '彼女は旅に出る.flac',
      '彼女は旅に出る.mp3'
    ],
    '背景二': [
      '溯 (Reverse) - CORSAK胡梦周,马吟吟.flac',
      'CORSAK胡梦周,马吟吟 - 溯 (Reverse) .flac',
      'CORSAK胡梦周,马吟吟 - 溯 (Reverse) .mp3',
      '溯 (Reverse).flac',
      '溯 (Reverse).mp3'
    ],
    '背景三': [
      '虚妄与荣光 - 碧蓝航线.flac',
      '碧蓝航线 - 虚妄与荣光.flac',
      '碧蓝航线 - 虚妄与荣光.mp3',
      '虚妄与荣光.flac',
      '虚妄与荣光.mp3'
    ]
  };

  var musicState = {
    map: null,
    ap: null,
    initing: false,
    ready: false,
    lists: [],
    listKey: '__bg__',
    followKey: '',
    listIndex: 0,
    labelEl: null,
    switchBtn: null,
    defaultBtn: null,
    badTracks: {},
    handlingError: false
  };
  var bgmInitScheduled = false;

  function getSavedBgIndex(list) {
    var idx = parseInt(localStorage.getItem('bgIndex') || '0', 10);
    if (isNaN(idx) || idx < 0) idx = 0;
    if (!list.length) return 0;
    return idx % list.length;
  }

  function setSavedBgIndex(idx) {
    localStorage.setItem('bgIndex', String(idx));
  }

  function getSavedBgUrl(list) {
    var url = localStorage.getItem('bgUrl') || '';
    if (!url || !Array.isArray(list) || !list.length) return '';
    for (var i = 0; i < list.length; i++) {
      if (normalizeFileName(list[i]) === normalizeFileName(url)) return list[i];
    }
    return '';
  }

  function getSavedMusicListKey(lists) {
    var key = localStorage.getItem('bgmListKey') || '__bg__';
    if (!lists || !lists.length) return '__bg__';
    for (var i = 0; i < lists.length; i++) {
      if (lists[i].key === key) return key;
    }
    return lists[0].key;
  }

  function setSavedMusicListKey(key) {
    localStorage.setItem('bgmListKey', key);
  }

  function getSavedDefaultMap() {
    var raw = localStorage.getItem('bgmDefaultMap') || '';
    if (!raw) return {};
    try {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (e) {}
    return {};
  }

  function setSavedDefault(bgKey, fileName) {
    if (!bgKey || !fileName) return;
    var map = getSavedDefaultMap();
    map[bgKey] = fileName;
    localStorage.setItem('bgmDefaultMap', JSON.stringify(map));
  }

  function getMusicLabelByKey(key) {
    if (!key) return '';
    if (musicState.map && musicState.map.labels && musicState.map.labels[key]) {
      return musicState.map.labels[key];
    }
    if (key === 'default') return '默认歌单';
    return key;
  }

  function buildMusicLists(map) {
    var lists = [];
    var seen = {};
    var labels = map && map.labels ? map.labels : {};
    if (map && (map.all && map.all.length || (map.folders && Object.keys(map.folders).length))) {
      lists.push({ key: '__bg__', name: '跟随背景' });
    }

    var order = [];
    if (map && Array.isArray(map.order)) order = map.order.slice();
    if (map && map.folders) {
      Object.keys(map.folders).forEach(function (k) {
        if (order.indexOf(k) === -1) order.push(k);
      });
      order.forEach(function (k) {
        if (seen[k]) return;
        var items = map.folders[k];
        if (Array.isArray(items) && items.length) {
          lists.push({ key: k, name: labels[k] || k });
          seen[k] = true;
        }
      });
    }

    return lists;
  }

  function getFirstPlayableManualListState() {
    if (!musicState.map || !musicState.map.folders) {
      return { key: '', items: [] };
    }
    var order = Array.isArray(musicState.map.order) ? musicState.map.order.slice() : Object.keys(musicState.map.folders);
    for (var i = 0; i < order.length; i++) {
      var key = order[i];
      var items = filterPlayableTracks(musicState.map.folders[key]);
      if (items.length) {
        return {
          key: key,
          items: items
        };
      }
    }
    return { key: '', items: [] };
  }

  function resolveFollowListState() {
    var currentBg = getCurrentBgEntry();
    var bgName = getBgListName();
    if (currentBg && currentBg.key && musicState.map && musicState.map.folders) {
      var mapped = filterPlayableTracks(musicState.map.folders[currentBg.key]);
      if (mapped.length) {
        musicState.followKey = currentBg.key;
        return {
          key: currentBg.key,
          items: mapped,
          bgName: bgName,
          reuse: false
        };
      }
    }

    var reuseKey = musicState.followKey;
    var reuseItems = reuseKey && musicState.map && musicState.map.folders
      ? filterPlayableTracks(musicState.map.folders[reuseKey])
      : [];
    if (!reuseItems.length) {
      var first = getFirstPlayableManualListState();
      reuseKey = first.key;
      reuseItems = first.items;
    }

    if (reuseKey && reuseItems.length) {
      musicState.followKey = reuseKey;
      return {
        key: reuseKey,
        items: reuseItems,
        bgName: bgName,
        reuse: !!currentBg && currentBg.key !== reuseKey
      };
    }

    return {
      key: '',
      items: [],
      bgName: bgName,
      reuse: false
    };
  }

  function isBrokenTrack(item) {
    if (!item || !item.url) return false;
    return !!musicState.badTracks[normalizeTrackUrl(item.url)];
  }

  function filterPlayableTracks(list) {
    if (!Array.isArray(list) || !list.length) return [];
    var out = [];
    var seen = {};
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!item || !item.url) continue;
      var key = normalizeTrackUrl(item.url);
      if (!key || seen[key] || musicState.badTracks[key]) continue;
      seen[key] = true;
      out.push(item);
    }
    return out;
  }

  function getListItemsByKey(key) {
    if (key === '__bg__') return resolveFollowListState().items;
    if (key === '__all__') return musicState.map && musicState.map.all ? musicState.map.all : [];
    if (musicState.map && musicState.map.folders && musicState.map.folders[key]) {
      return musicState.map.folders[key];
    }
    return [];
  }

  function getPlayableListItemsByKey(key) {
    return filterPlayableTracks(getListItemsByKey(key));
  }

  function getBgListName() {
    var entry = getCurrentBgEntry();
    return entry ? (entry.name || entry.key) : getBasenameFromUrl(bgState.current || '');
  }

  function getBgKey() {
    var entry = getCurrentBgEntry();
    return entry ? (entry.key || '') : normalizeMatchKey(getBasenameFromUrl(bgState.current || ''));
  }

  function getMusicListDisplayName(key) {
    if (key === '__bg__') {
      var follow = resolveFollowListState();
      var bgName = follow.bgName || getBgListName();
      if (!bgName) return '跟随背景';
      if (follow.reuse && follow.key) {
        return '跟随背景：' + bgName + '（沿用 ' + getMusicLabelByKey(follow.key) + '）';
      }
      return '跟随背景：' + bgName;
    }
    if (key === '__all__') return '全部';
    return getMusicLabelByKey(key) || key || '歌单';
  }

  function updateMusicListLabel() {
    if (!musicState.labelEl) return;
    musicState.labelEl.textContent = '歌单：' + getMusicListDisplayName(musicState.listKey);
  }

  function getCurrentAudioItem() {
    if (!musicState.ap || !musicState.ap.list || !musicState.ap.list.audios) return null;
    var idx = typeof musicState.ap.list.index === 'number' ? musicState.ap.list.index : 0;
    return musicState.ap.list.audios[idx] || musicState.ap.list.audios[0] || null;
  }

  function updateDefaultBtnState() {
    if (!musicState.defaultBtn) return;
    var bgKey = getBgKey();
    var map = getSavedDefaultMap();
    var current = getCurrentAudioItem();
    var currentFile = current ? getFileNameFromUrl(current.url) : '';
    var saved = map[bgKey];
    var isSet = saved && currentFile &&
      normalizeFileName(saved) === normalizeFileName(currentFile);
    if (isSet) {
      musicState.defaultBtn.textContent = '默认 ✓';
      musicState.defaultBtn.classList.add('is-set');
    } else {
      musicState.defaultBtn.textContent = '设为默认';
      musicState.defaultBtn.classList.remove('is-set');
    }
  }

  function findDefaultIndex(list, bgKey) {
    if (!Array.isArray(list) || !list.length || !bgKey) return 0;
    var targets = [];
    var map = getSavedDefaultMap();
    if (map[bgKey]) targets.push(map[bgKey]);
    if (builtInDefaultMap[bgKey] && builtInDefaultMap[bgKey].length) {
      targets = targets.concat(builtInDefaultMap[bgKey]);
    }
    if (!targets.length) return 0;
    var normalizedTargets = targets.map(function (t) { return normalizeFileName(t); });
    var baseTargets = normalizedTargets.map(stripAudioExt);
    for (var i = 0; i < list.length; i++) {
      var file = getFileNameFromUrl(list[i].url || '');
      var norm = normalizeFileName(file);
      if (normalizedTargets.indexOf(norm) !== -1) return i;
      if (baseTargets.indexOf(stripAudioExt(norm)) !== -1) return i;
    }
    return 0;
  }

  function moveItemToFront(list, idx) {
    if (!Array.isArray(list) || idx <= 0 || idx >= list.length) return list;
    var copy = list.slice();
    var item = copy.splice(idx, 1)[0];
    copy.unshift(item);
    return copy;
  }

  function getDefaultKeyForList(key) {
    if (key === '__bg__') return getBgKey();
    if (key === '__all__') return '';
    return key || '';
  }

  function syncMusicListIndex() {
    var lists = musicState.lists || [];
    for (var i = 0; i < lists.length; i++) {
      if (lists[i].key === musicState.listKey) {
        musicState.listIndex = i;
        return;
      }
    }
    musicState.listIndex = 0;
  }

  function applyMusicListByKey(key, save) {
    var resolved = key === '__bg__'
      ? resolveFollowListState()
      : { key: key, items: getPlayableListItemsByKey(key), reuse: false };
    var items = resolved.items;
    if (!Array.isArray(items) || !items.length) return false;
    if (!applyPlaylist(musicState.ap, items)) return false;
    musicState.listKey = key;
    if (key === '__bg__' && resolved.key) {
      musicState.followKey = resolved.key;
    }
    if (save) setSavedMusicListKey(key);
    updateMusicListLabel();
    updateBgmCover();
    return true;
  }

  function applyMusicListByIndex(idx, save) {
    if (!musicState.lists || !musicState.lists.length) return;
    var start = idx;
    var tries = 0;
    while (tries < musicState.lists.length) {
      var list = musicState.lists[idx];
      if (applyMusicListByKey(list.key, save)) {
        musicState.listIndex = idx;
        return;
      }
      idx = (idx + 1) % musicState.lists.length;
      tries += 1;
      if (idx === start) break;
    }
  }

  function pickMusicListForBg(bgUrl) {
    var map = musicState.map;
    if (!map || !map.folders) return [];
    var entry = getBgEntryByUrl(bgUrl);
    var key = entry ? entry.key : normalizeMatchKey(getBasenameFromUrl(bgUrl));
    if (key && map.folders[key] && map.folders[key].length) {
      return map.folders[key];
    }
    return [];
  }

  function applyPlaylist(ap, list) {
    var nextList = filterPlayableTracks(list);
    if (!ap || !nextList.length) return false;
    ap.list.clear();
    ap.list.add(nextList);
    ap.list.switch(0);
    ap.pause();
    return true;
  }

  function getCurrentAudioUrl() {
    var current = getCurrentAudioItem();
    return current ? normalizeTrackUrl(current.url) : '';
  }

  function getFallbackListState() {
    var lists = musicState.lists || [];
    var preferred = [];
    if (musicState.listKey) preferred.push(musicState.listKey);
    if (musicState.listKey !== '__bg__') preferred.push('__bg__');
    if (musicState.listKey !== '__all__') preferred.push('__all__');

    for (var i = 0; i < lists.length; i++) {
      if (preferred.indexOf(lists[i].key) === -1) preferred.push(lists[i].key);
    }

    for (var j = 0; j < preferred.length; j++) {
      var key = preferred[j];
      var items = getPlayableListItemsByKey(key);
      if (items.length) {
        return {
          key: key,
          items: items
        };
      }
    }

    return {
      key: musicState.listKey,
      items: []
    };
  }

  function bindAPlayerErrorRecovery(ap) {
    if (!ap || !ap.audio || ap.audio.dataset.codexErrorBound === '1') return;
    ap.audio.dataset.codexErrorBound = '1';

    ap.audio.addEventListener('error', function () {
      if (musicState.handlingError) return;

      var brokenUrl = getCurrentAudioUrl();
      if (brokenUrl) {
        musicState.badTracks[brokenUrl] = true;
      }

      musicState.handlingError = true;

      var fallback = getFallbackListState();
      if (!fallback.items.length) {
        if (typeof ap.notice === 'function') {
          ap.notice('当前歌单暂时无法播放', 2200, 1);
        }
        musicState.handlingError = false;
        return;
      }

      if (fallback.key !== musicState.listKey) {
        musicState.listKey = fallback.key;
        setSavedMusicListKey(fallback.key);
        syncMusicListIndex();
      }

      if (!applyPlaylist(ap, fallback.items)) {
        musicState.handlingError = false;
        return;
      }

      updateMusicListLabel();
      updateBgmCover();
      updateDefaultBtnState();

      if (typeof ap.notice === 'function') {
        ap.notice('检测到异常音频，已自动切换下一首', 2200, 0);
      }

      setTimeout(function () {
        try {
          ap.play();
        } catch (e) {}
        musicState.handlingError = false;
      }, 120);
    });
  }

  async function initBgSwitcher() {
    if (document.getElementById('bg-switch-btn')) return;
    var rightside = document.getElementById('rightside-config-show') || document.getElementById('rightside');
    if (!rightside) return;

    var btn = document.createElement('button');
    btn.id = 'bg-switch-btn';
    btn.type = 'button';
    btn.title = '切换默认背景';
    btn.innerHTML = '<i class="fas fa-image"></i>';
    rightside.appendChild(btn);

    var list = await loadJson('/bg-list.json', []);
    if (!Array.isArray(list)) list = [];
    var map = await loadJson('/bg-map.json', null);
    setBgMap(map, list);
    list = bgState.list.slice();

    if (!list.length) {
      btn.style.display = 'none';
      return;
    }

    var savedUrl = getSavedBgUrl(list);
    var idx = savedUrl ? list.indexOf(savedUrl) : getSavedBgIndex(list);
    if (idx < 0) idx = 0;
    bgState.list = list;
    bgState.index = idx;
    bgState.current = list[idx];
    applyBackground(bgState.current);

    btn.addEventListener('click', function () {
      idx = (idx + 1) % list.length;
      setSavedBgIndex(idx);
      bgState.index = idx;
      bgState.current = list[idx];
      applyBackground(bgState.current);
      if (musicState.ap && musicState.listKey === '__bg__') {
        var previousFollowKey = musicState.followKey;
        var follow = resolveFollowListState();
        var hasList = musicState.ap.list && musicState.ap.list.audios && musicState.ap.list.audios.length;
        if (follow.items.length && (!hasList || (follow.key && follow.key !== previousFollowKey))) {
          applyPlaylist(musicState.ap, follow.items);
        }
        updateMusicListLabel();
      }
      updateDefaultBtnState();
    });
  }

  function ensureBgmPlayerUi() {
    var rightside = document.getElementById('rightside-config-show') || document.getElementById('rightside');
    if (!rightside) {
      return null;
    }

    var btn = document.getElementById('bgm-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'bgm-btn';
      btn.type = 'button';
      btn.title = 'BGM';
      btn.innerHTML = '<i class="fas fa-music"></i>';
      rightside.appendChild(btn);
    }

    var wrap = document.getElementById('bgm-player');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'bgm-player';
      wrap.className = 'bgm-player';
      wrap.innerHTML = '<div id="bgm-aplayer"></div>';
      document.body.appendChild(wrap);
    }

    if (!btn.dataset.bound) {
      var visible = wrap.classList.contains('active');
      btn.addEventListener('click', function () {
        visible = !visible;
        wrap.classList.toggle('active', visible);
        if (!musicState.ready && !musicState.initing) {
          initBgmPlayer();
        }
      });
      btn.dataset.bound = '1';
    }

    return {
      btn: btn,
      wrap: wrap
    };
  }

  function scheduleBgmPlayerInit() {
    if (musicState.ready || musicState.initing || bgmInitScheduled) return;

    var start = function () {
      bgmInitScheduled = false;
      initBgmPlayer();
    };

    var schedule = function () {
      if (musicState.ready || musicState.initing) {
        bgmInitScheduled = false;
        return;
      }
      if (window.requestIdleCallback) {
        window.requestIdleCallback(start, { timeout: 2500 });
      } else {
        window.setTimeout(start, 1400);
      }
    };

    bgmInitScheduled = true;
    if (document.readyState === 'complete') {
      schedule();
    } else {
      window.addEventListener('load', schedule, { once: true });
    }
  }

  async function initBgmPlayer() {
    var ui = ensureBgmPlayerUi();
    if (!ui) {
      return;
    }
    var btn = ui.btn;
    var wrap = ui.wrap;

    if (musicState.ready || musicState.initing) return;
    musicState.initing = true;

    var map = await loadJson('/music-map.json', null);
    if (map && map.folders) {
      musicState.map = map;
    } else {
      map = { all: await loadJson('/music-list.json', []) };
      musicState.map = map;
    }

    musicState.lists = buildMusicLists(musicState.map);
    if (!musicState.lists.length) {
      btn.style.display = 'none';
      musicState.initing = false;
      return;
    }

    var savedKey = getSavedMusicListKey(musicState.lists);
    musicState.listKey = savedKey;
    syncMusicListIndex();
    updateBgmCover();
    var resolved = musicState.listKey === '__bg__'
      ? resolveFollowListState()
      : { key: musicState.listKey, items: getPlayableListItemsByKey(musicState.listKey) };
    if (musicState.listKey === '__bg__' && resolved.key) {
      musicState.followKey = resolved.key;
    }
    var list = resolved.items;
    if (!Array.isArray(list) || list.length === 0) {
      for (var i = 0; i < musicState.lists.length; i++) {
        var tryKey = musicState.lists[i].key;
        var tryResolved = tryKey === '__bg__'
          ? resolveFollowListState()
          : { key: tryKey, items: getPlayableListItemsByKey(tryKey) };
        var tryList = tryResolved.items;
        if (Array.isArray(tryList) && tryList.length) {
          list = tryList;
          musicState.listKey = tryKey;
          if (tryKey === '__bg__' && tryResolved.key) {
            musicState.followKey = tryResolved.key;
          }
          musicState.listIndex = i;
          break;
        }
      }
    }

    if (!Array.isArray(list) || list.length === 0) {
      btn.style.display = 'none';
      musicState.initing = false;
      return;
    }

    var hasAPlayer = await waitForAPlayer(4000);
    if (!hasAPlayer) {
      musicState.initing = false;
      setTimeout(initBgmPlayer, 800);
      return;
    }

    var ap = new APlayer({
      container: document.getElementById('bgm-aplayer'),
      mini: false,
      autoplay: false,
      loop: 'all',
      order: 'list',
      preload: 'metadata',
      volume: 0.6,
      listFolded: false,
      listMaxHeight: 240,
      audio: list
    });

    musicState.ap = ap;
    bindAPlayerErrorRecovery(ap);
    // Prevent theme pjax handler from destroying our persistent player
    try {
      ap.options.fixed = true;
    } catch (e) {}
    musicState.ready = true;
    musicState.initing = false;

    var toolbar = wrap.querySelector('.bgm-toolbar');
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.className = 'bgm-toolbar';
      toolbar.innerHTML = '<span class="bgm-list-label"></span><div class="bgm-toolbar-actions"><button type="button" class="bgm-list-switch" title="切换歌单"><i class="fas fa-exchange-alt"></i><span>切换</span></button></div>';
      wrap.insertBefore(toolbar, wrap.firstChild);
    }
    wrap.classList.add('has-toolbar');
    musicState.labelEl = toolbar.querySelector('.bgm-list-label');
    musicState.switchBtn = toolbar.querySelector('.bgm-list-switch');
    updateMusicListLabel();

    if (musicState.switchBtn) {
      if (musicState.lists.length <= 1) {
        musicState.switchBtn.disabled = true;
        musicState.switchBtn.style.display = 'none';
      } else {
        musicState.switchBtn.style.display = '';
        musicState.switchBtn.addEventListener('click', function () {
          var next = (musicState.listIndex + 1) % musicState.lists.length;
          applyMusicListByIndex(next, true);
        });
      }
    }

  }

  async function initAll() {
    swapSidebarCards();
    bindBackgroundGuards();
    await initBgSwitcher();
    initVideoBackground();
    ensureBgmPlayerUi();
    scheduleBgmPlayerInit();
  }

  function initCopyFunction() {
    const copyIcons = document.querySelectorAll('.copy-text-wrapper .social-icon[data-copy-text]');
    copyIcons.forEach(icon => {
      icon.addEventListener('click', function(e) {
        e.preventDefault();
        const copyText = this.getAttribute('data-copy-text');
        if (copyText) {
          navigator.clipboard.writeText(copyText).then(() => {
            const popup = this.parentElement.querySelector('.copy-text-popup');
            const hint = popup.querySelector('.copy-hint');
            if (popup && hint) {
              const originalText = hint.textContent;
              hint.textContent = '已复制！';
              hint.style.color = '#07c160';
              setTimeout(() => {
                hint.textContent = originalText;
                hint.style.color = '';
              }, 2000);
            }
          }).catch(err => {
            console.error('复制失败:', err);
          });
        }
      });
    });
  }

  onReady(function () {
    initAll();
    initCopyFunction();
  });
  document.addEventListener('pjax:complete', function () {
    initAll();
    initCopyFunction();
  });
})();
