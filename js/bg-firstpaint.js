(function(){
  try {
    var defaultBg = "/img/bg/%E8%83%8C%E6%99%AF%E4%B8%80.webp";
    var legacyBgMap = {
      "/img/bg/%E8%83%8C%E6%99%AF%E4%B8%80.png": "/img/bg/%E8%83%8C%E6%99%AF%E4%B8%80.webp",
      "/img/bg/%E8%83%8C%E6%99%AF%E4%BA%8C.png": "/img/bg/%E8%83%8C%E6%99%AF%E4%BA%8C.webp",
      "/img/bg/%E8%83%8C%E6%99%AF%E4%B8%89.png": "/img/bg/%E8%83%8C%E6%99%AF%E4%B8%89.webp",
      "/img/bg/%E8%83%8C%E6%99%AF%E4%B8%89-%E5%89%AF%E5%9B%BE.jpg": "/img/bg/%E8%83%8C%E6%99%AF%E4%B8%89.webp",
      "/img/bg/%E8%83%8C%E6%99%AF%E4%B8%89-%E5%89%AF%E5%9B%BE.webp": "/img/bg/%E8%83%8C%E6%99%AF%E4%B8%89.webp",
      "/img/bg/%E8%83%8C%E6%99%AF%E5%9B%9B.jpg": "/img/bg/%E8%83%8C%E6%99%AF%E5%9B%9B.webp",
      "/img/bg/%E8%83%8C%E6%99%AF%E4%BA%94.jpg": "/img/bg/%E8%83%8C%E6%99%AF%E4%BA%94.webp"
    };
    var bgColorMap = {
      "/img/bg/%E8%83%8C%E6%99%AF%E4%B8%80.webp": "#A6B6CD",
      "/img/bg/%E8%83%8C%E6%99%AF%E4%BA%8C.webp": "#775D5C",
      "/img/bg/%E8%83%8C%E6%99%AF%E4%B8%89.webp": "#71797F",
      "/img/bg/%E8%83%8C%E6%99%AF%E4%B8%89-%E5%89%AF%E5%9B%BE.webp": "#7F5625",
      "/img/bg/%E8%83%8C%E6%99%AF%E5%9B%9B.webp": "#211415",
      "/img/bg/%E8%83%8C%E6%99%AF%E4%BA%94.webp": "#C4A896"
    };

    // 优先使用缓存的背景图片
    var savedBg = localStorage.getItem('bgUrl') || '';
    var bg = legacyBgMap[savedBg] || savedBg || defaultBg || '';
    if (savedBg && legacyBgMap[savedBg]) {
      localStorage.setItem('bgUrl', bg);
    }
    if (!bg) return;

    var bgColor = bgColorMap[bg] || "#1B2430";
    var preloaded = {};
    var css = '';

    // 立即应用背景颜色，提供视觉反馈
    css += "#web_bg{background-color:__BG_COLOR__!important;}".replace('__BG_COLOR__', bgColor);
    css += '#page-header{--mark-bg:transparent!important;}';
    css += '#page-header.full_page,#page-header.not-home-page{background:none transparent!important;background-image:none!important;}';
    css += '#page-header.full_page::before,#page-header.full_page::after,#page-header.not-home-page::before,#page-header.not-home-page::after{background:transparent!important;background-image:none!important;opacity:0!important;}';
    css += '#page-header.post-bg[data-has-custom-post-top-img="0"]{background:none transparent!important;background-image:none!important;}';
    css += '#page-header.post-bg[data-has-custom-post-top-img="0"]::before,#page-header.post-bg[data-has-custom-post-top-img="0"]::after{background:transparent!important;background-image:none!important;opacity:0!important;}';

    var style = document.createElement('style');
    style.id = 'bg-preload-style';
    style.textContent = css;
    document.head.appendChild(style);

    function preloadImage(url) {
      if (!url || preloaded[url]) return;
      preloaded[url] = true;

      // 预加载图片
      var link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      link.setAttribute('fetchpriority', 'high');
      link.setAttribute('loading', 'eager');
      document.head.appendChild(link);

      // 加载图片并在加载完成后应用
      var img = new Image();
      img.decoding = 'async';
      img.src = url;
      img.onload = function() {
        if (url === bg) {
          var bgStyle = document.createElement('style');
          bgStyle.textContent = "#web_bg{background-image:url(\"__BG__\")!important;background-size:cover!important;background-position:center center!important;background-repeat:no-repeat!important;}".replace('__BG__', bg);
          document.head.appendChild(bgStyle);
        }
      };
    }

    // 立即开始预加载
    preloadImage(bg);
  } catch (e) {}
})();
