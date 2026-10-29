(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const state = {
    data: null,
    view: "latest",
    category: "all",
    search: "",
    favoritesOnly: false,
    urgentOnly: false,
    sort: "newest",
    visible: 12,
    favorites: new Set(),
  };

  try {
    state.favorites = new Set(JSON.parse(localStorage.getItem("contest-radar-favorites") || "[]"));
  } catch (_) {
    state.favorites = new Set();
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function safeUrl(value) {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) ? url.href : null;
    } catch (_) {
      return null;
    }
  }

  function dayDiff(dateString) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString || "")) return null;
    const [year, month, day] = dateString.split("-").map(Number);
    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((Date.UTC(year, month - 1, day) - today) / 86400000);
  }

  function formatDate(value, includeTime = false) {
    if (!value) return "待官方确认";
    const date = new Date(value.length === 10 ? `${value}T00:00:00+08:00` : value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    }).format(date);
  }

  function saveFavorites() {
    try {
      localStorage.setItem("contest-radar-favorites", JSON.stringify([...state.favorites]));
    } catch (_) {
      // The board remains usable when storage is unavailable.
    }
  }

  function currentItems() {
    if (!state.data) return [];
    if (state.view === "watchlist") return [...state.data.watchlist];
    return [...state.data.events];
  }

  function filteredItems() {
    const query = state.search.trim().toLowerCase();
    const items = currentItems().filter((item) => {
      if (state.category !== "all" && item.category !== state.category) return false;
      if (state.favoritesOnly && !state.favorites.has(item.id)) return false;
      if (state.urgentOnly) {
        const remaining = dayDiff(item.registration_deadline);
        if (remaining === null || remaining < 0 || remaining > 30) return false;
      }
      if (query) {
        const haystack = [item.title, item.summary, item.source, item.category, ...(item.aliases || [])].join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
    return items.sort((a, b) => {
      if (state.sort === "deadline") {
        const aDate = a.registration_deadline || "9999-12-31";
        const bDate = b.registration_deadline || "9999-12-31";
        return aDate.localeCompare(bDate);
      }
      return (b.published_at || b.discovered_at || "").localeCompare(a.published_at || a.discovered_at || "");
    });
  }

  function badge(text, className = "") {
    return element("span", `badge ${className}`.trim(), text);
  }

  function buildEventCard(item) {
    const card = element("article", "event-card");

    const main = element("div", "event-main");
    const badges = element("div", "event-badges");
    badges.append(badge(item.category || "综合竞赛"));
    if (item.whitelist) badges.append(badge("学校白名单", "whitelist"));
    if (item.analysis_mode === "ai") badges.append(badge("AI 辅助分析", "ai"));
    const remaining = dayDiff(item.registration_deadline);
    if (remaining !== null && remaining >= 0 && remaining <= 30) badges.append(badge(`报名剩 ${remaining} 天`, "urgent"));
    if (item.source_kind === "微信公众号公开索引") badges.append(badge("公众号公开索引"));
    main.append(badges);

    const title = element("h3", "event-title");
    const url = safeUrl(item.url);
    if (url) {
      const link = element("a", "", item.title);
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      title.append(link);
    } else {
      title.textContent = item.title;
    }
    main.append(title, element("p", "event-summary", item.summary || "暂无摘要，请核对原始来源。"));

    const side = element("div", "event-side");
    const dateBox = element("div", `event-date${remaining !== null && remaining >= 0 && remaining <= 30 ? " urgent" : ""}`);
    if (item.registration_deadline) {
      dateBox.append(document.createTextNode("报名截止"), element("strong", "", formatDate(item.registration_deadline)));
      if (remaining !== null) {
        const suffix = remaining > 0 ? `剩 ${remaining} 天` : remaining === 0 ? "今天截止" : "已过截止日";
        dateBox.append(element("span", "", suffix));
      }
    } else if (item.event_start) {
      dateBox.append(document.createTextNode("比赛开始"), element("strong", "", formatDate(item.event_start)));
    } else if (item.published_at) {
      dateBox.append(document.createTextNode("公开记录时间"), element("strong", "", formatDate(item.published_at)));
    } else {
      dateBox.append(document.createTextNode("监测状态"), element("strong", "", "等待新通知"));
    }
    const source = element("span", "event-source", `${item.source || "公开网页"} · ${item.analysis_mode === "ai" ? "AI 摘要" : item.analysis_mode === "rules" ? "规则初筛" : "白名单监测"}`);
    const actions = element("div", "event-actions");
    const favorite = element("button", "favorite-button", state.favorites.has(item.id) ? "已收藏" : "收藏");
    favorite.type = "button";
    favorite.setAttribute("aria-pressed", String(state.favorites.has(item.id)));
    favorite.setAttribute("aria-label", `${state.favorites.has(item.id) ? "取消收藏" : "收藏"}：${item.title}`);
    favorite.addEventListener("click", () => {
      if (state.favorites.has(item.id)) state.favorites.delete(item.id);
      else state.favorites.add(item.id);
      saveFavorites();
      renderEvents();
    });
    actions.append(favorite);
    if (url) {
      const sourceLink = element("a", "", "查看原文");
      sourceLink.href = url;
      sourceLink.target = "_blank";
      sourceLink.rel = "noopener noreferrer";
      actions.append(sourceLink);
    }
    side.append(dateBox, source, actions);
    card.append(main, side);
    return card;
  }

  function renderEvents() {
    const list = $("#event-list");
    const items = filteredItems();
    const shown = items.slice(0, state.visible);
    list.replaceChildren(...shown.map(buildEventCard));
    $("#results-count").textContent = `显示 ${shown.length} / ${items.length} 条`;
    $("#empty-state").hidden = items.length !== 0;
    $("#load-more").hidden = items.length <= state.visible;
    $("#load-more").textContent = `查看更多（剩余 ${Math.max(0, items.length - state.visible)} 条）`;
  }

  function renderDeadlines() {
    const items = state.data.events
      .filter((item) => {
        const remaining = dayDiff(item.registration_deadline);
        return remaining !== null && remaining >= 0;
      })
      .sort((a, b) => a.registration_deadline.localeCompare(b.registration_deadline));
    const urgent = items.filter((item) => dayDiff(item.registration_deadline) <= 45).slice(0, 3);
    $("#deadline-section").hidden = urgent.length === 0;
    const nodes = urgent.map((item) => {
      const remaining = dayDiff(item.registration_deadline);
      const link = element("a", "deadline-item");
      const url = safeUrl(item.url);
      if (url) link.href = url;
      else link.href = "#radar";
      if (url) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
      link.append(element("strong", "", item.title), element("span", "", `${formatDate(item.registration_deadline)} · ${remaining === 0 ? "今天" : `${remaining} 天`}`));
      return link;
    });
    $("#deadline-list").replaceChildren(...nodes);
    const exportButton = $("#export-calendar");
    exportButton.disabled = items.length === 0;
    exportButton.textContent = items.length ? `导出报名日历（${items.length}）` : "导出报名日历";
  }

  function renderSources() {
    const rows = (state.data.sources || []).map((source) => {
      const row = element("div", "source-row");
      const stateDot = element("span", `source-state ${source.status}`);
      const main = element("div");
      main.append(element("strong", "", source.name), element("small", "", source.detail || "等待运行"));
      row.append(stateDot, main, element("span", "", source.status === "pending" ? "PENDING" : `${source.count || 0} 条`));
      return row;
    });
    $("#source-list").replaceChildren(...rows);
  }

  function icsEscape(value) {
    return String(value || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  }

  function exportCalendar() {
    const events = state.data.events.filter((item) => dayDiff(item.registration_deadline) !== null && dayDiff(item.registration_deadline) >= 0);
    if (!events.length) return;
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//FighterGodNemo//Contest Radar//ZH-CN", "CALSCALE:GREGORIAN"];
    events.forEach((item) => {
      const start = item.registration_deadline.replaceAll("-", "");
      const next = new Date(`${item.registration_deadline}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      const end = next.toISOString().slice(0, 10).replaceAll("-", "");
      lines.push("BEGIN:VEVENT", `UID:${icsEscape(item.id)}@fightergodnemo.github.io`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${end}`, `SUMMARY:${icsEscape(`报名截止：${item.title}`)}`, `DESCRIPTION:${icsEscape(item.summary)}`);
      if (safeUrl(item.url)) lines.push(`URL:${safeUrl(item.url)}`);
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:-P7D", `DESCRIPTION:${icsEscape(`${item.title} 距报名截止 7 天`)}`, "END:VALARM", "BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:-P1D", `DESCRIPTION:${icsEscape(`${item.title} 明天报名截止`)}`, "END:VALARM", "END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "竞赛报名日历.ics";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function bindControls() {
    document.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => {
        state.view = button.dataset.view;
        state.visible = 12;
        state.sort = "newest";
        $("#sort-order").value = state.sort;
        document.querySelectorAll("[data-view]").forEach((tab) => tab.setAttribute("aria-selected", String(tab === button)));
        renderEvents();
      });
    });
    $("#search-input").addEventListener("input", (event) => { state.search = event.target.value; state.visible = 12; renderEvents(); });
    $("#category-filter").addEventListener("change", (event) => { state.category = event.target.value; state.visible = 12; renderEvents(); });
    $("#favorites-only").addEventListener("change", (event) => { state.favoritesOnly = event.target.checked; state.visible = 12; renderEvents(); });
    $("#urgent-only").addEventListener("change", (event) => { state.urgentOnly = event.target.checked; state.visible = 12; renderEvents(); });
    $("#sort-order").addEventListener("change", (event) => { state.sort = event.target.value; renderEvents(); });
    $("#load-more").addEventListener("click", () => { state.visible += 12; renderEvents(); });
    $("#reset-filters").addEventListener("click", () => {
      state.search = "";
      state.category = "all";
      state.favoritesOnly = false;
      state.urgentOnly = false;
      $("#search-input").value = "";
      $("#category-filter").value = "all";
      $("#favorites-only").checked = false;
      $("#urgent-only").checked = false;
      renderEvents();
    });
    $("#export-calendar").addEventListener("click", exportCalendar);
  }

  function hydrate(data) {
    state.data = data;
    const stats = data.stats || {};
    ["whitelist", "events", "urgent"].forEach((key) => {
      const metric = $(`#metric-${key}`);
      if (metric) metric.textContent = stats[key] ?? 0;
    });
    const sourceMetric = $("#metric-sources");
    if (sourceMetric) sourceMetric.textContent = (data.sources || []).length;
    $("#brief-events").textContent = stats.events ?? data.events.length;
    $("#brief-urgent").textContent = stats.urgent ?? 0;
    $("#brief-wechat").textContent = stats.wechat ?? 0;
    $("#generated-at").textContent = formatDate(data.generated_at, true);
    $("#generated-at").dateTime = data.generated_at;
    $("#run-status").textContent = "情报数据已载入";
    $(".live-dot").classList.add("ready");
    $("#analysis-mode").textContent = data.analysis?.mode === "ai+rules" ? "AI 辅助分析已启用 · 定时采集每 4 小时运行" : "规则初筛运行中 · 配置 API 后启用 AI 摘要";
    renderDeadlines();
    renderEvents();
    renderSources();
  }

  async function init() {
    bindControls();
    try {
      const response = await fetch("data.json", { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.events) || !Array.isArray(data.watchlist)) throw new Error("Invalid data schema");
      hydrate(data);
    } catch (error) {
      $("#run-status").textContent = "情报数据读取失败";
      $("#results-count").textContent = `无法读取 data.json：${error.message}`;
      $("#empty-state").hidden = false;
      $("#empty-state strong").textContent = "情报数据暂不可用";
      $("#empty-state p").textContent = "请稍后刷新，或等待下一次定时采集。";
      $("#reset-filters").hidden = true;
    }
  }

  init();
})();
