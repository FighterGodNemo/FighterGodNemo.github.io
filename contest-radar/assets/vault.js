(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const DATA_URL = "../data.json";
  const VAULT_URL = "../private.enc.json";

  let publicData = null;
  let vaultData = null;

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

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    }).format(date);
  }

  function base64Bytes(value) {
    const raw = atob(value);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
    return bytes;
  }

  async function deriveKey(password, salt, iterations) {
    const encoder = new TextEncoder();
    const baseKey = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"],
    );
  }

  async function decryptVault(envelope, password) {
    if (envelope.kdf !== "PBKDF2-SHA256" || envelope.cipher !== "AES-256-GCM") {
      throw new Error("不支持的加密格式");
    }
    const salt = base64Bytes(envelope.salt);
    const iv = base64Bytes(envelope.iv);
    const cipherBytes = base64Bytes(envelope.data);
    const tagBytes = base64Bytes(envelope.tag);
    const payload = new Uint8Array(cipherBytes.length + tagBytes.length);
    payload.set(cipherBytes, 0);
    payload.set(tagBytes, cipherBytes.length);
    const key = await deriveKey(password, salt, Number(envelope.iterations) || 310000);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, payload);
    return JSON.parse(new TextDecoder().decode(plain));
  }

  function projectCard(project, watchlistById) {
    const card = element("article", "vault-card");
    const top = element("div", "card-top");
    top.append(element("h3", "", project.name), element("span", "pill", project.status));
    const tags = element("div", "tag-row");
    (project.tags || []).forEach((tag) => tags.append(element("span", "tag", tag)));
    const fit = element("div", "fit-row");
    fit.append(element("small", "", "可关注的白名单方向"));
    const links = element("div", "fit-links");
    (project.competition_ids || []).forEach((id) => {
      const competition = watchlistById.get(String(id));
      if (!competition) return;
      links.append(element("span", "fit-chip", competition.title));
    });
    fit.append(links);
    const evidence = project.evidence ? element("small", "evidence", project.evidence) : null;
    card.append(top, element("p", "", project.summary || ""), tags, fit);
    if (evidence) card.append(evidence);
    return card;
  }

  function eventRow(event, match) {
    const row = element("article", "vault-row");
    const score = element("div", "row-score");
    score.append(element("strong", "", match.match_score || 0), element("span", "", "适配分"));
    const main = element("div", "row-main");
    const meta = element("div", "row-meta");
    meta.append(element("span", "pill", event.category || "综合竞赛"));
    if (event.whitelist) meta.append(element("span", "pill whitelist", "学校白名单"));
    if (event.registration_deadline) meta.append(element("span", "pill", `报名截止 ${event.registration_deadline}`));
    else if (event.event_start) meta.append(element("span", "pill", `比赛时间 ${event.event_start.slice(0, 10)}`));
    const title = element("h3", "row-title");
    const url = safeUrl(event.url);
    if (url) {
      const link = element("a", "", event.title);
      link.href = url; link.target = "_blank"; link.rel = "noopener noreferrer";
      title.append(link);
    } else {
      title.textContent = event.title;
    }
    const chips = element("div", "tag-row");
    (match.matched_projects || []).forEach((name) => chips.append(element("span", "fit-chip", `适配：${name}`)));
    main.append(meta, title, chips);
    row.append(score, main, element("span", "row-source", event.source || "公开网页"));
    return row;
  }

  function watchlistRow(item, match) {
    const row = element("article", "vault-row");
    const score = element("div", "row-score");
    score.append(element("strong", "", match.match_score || 0), element("span", "", "相关度"));
    const main = element("div", "row-main");
    const meta = element("div", "row-meta");
    const status = match.school_status || "未标注";
    meta.append(element("span", `pill${status === "已参加" ? " attended" : ""}`, status));
    if (match.department) meta.append(element("span", "pill", match.department));
    meta.append(element("span", "pill", item.category || "综合竞赛"));
    const title = element("h3", "row-title", item.title);
    const chips = element("div", "tag-row");
    (match.matched_projects || []).forEach((name) => chips.append(element("span", "fit-chip", `可衔接：${name}`)));
    main.append(meta, title, chips);
    row.append(score, main, element("span", "row-source", "白名单监测"));
    return row;
  }

  function render(payload) {
    const projects = payload.projects || [];
    const eventMatches = payload.event_matches || {};
    const watchlistMatches = payload.watchlist_matches || {};
    const watchlistById = new Map();
    (publicData.watchlist || []).forEach((item) => {
      const ids = item.whitelist_ids || [];
      if (ids.length) watchlistById.set(String(ids[0]), item);
    });

    $("#vault-summary").textContent = `数据时间 ${formatDate(payload.generated_at)} · 项目 ${projects.length} 个 · 赛事匹配 ${Object.keys(eventMatches).length} 条 · 白名单联动 ${Object.keys(watchlistMatches).length} 项`;

    const projectNodes = projects.map((project) => projectCard(project, watchlistById));
    $("#project-list").replaceChildren(...(projectNodes.length ? projectNodes : [element("p", "vault-empty", "未发现项目数据")]));

    const scoredEvents = (publicData.events || [])
      .map((event) => ({ event, match: eventMatches[event.id] }))
      .filter((row) => row.match && (
        (row.match.matched_projects || []).length > 0 || (row.match.whitelist_ids || []).length > 0
      ))
      .sort((a, b) => (b.match.match_score || 0) - (a.match.match_score || 0))
      .slice(0, 60);
    $("#event-list").replaceChildren(...(scoredEvents.length
      ? scoredEvents.map((row) => eventRow(row.event, row.match))
      : [element("p", "vault-empty", "当前没有命中项目或白名单的赛事。公开雷达里的海外 CTF 与国内通知会持续累积，命中后自动出现在这里。")]));

    const watchRows = (publicData.watchlist || [])
      .map((item) => {
        const ids = item.whitelist_ids || [];
        const key = ids.length ? String(ids[0]) : String(item.id);
        return { item, match: watchlistMatches[key] };
      })
      .filter((row) => row.match)
      .sort((a, b) => (b.match.match_score || 0) - (a.match.match_score || 0));
    $("#watchlist-list").replaceChildren(...(watchRows.length
      ? watchRows.map((row) => watchlistRow(row.item, row.match))
      : [element("p", "vault-empty", "白名单联动数据暂不可用")]));
  }

  function showError(message) {
    $("#gate-status").textContent = message;
    $("#gate-status").classList.add("error");
  }

  async function unlock(password) {
    const status = $("#gate-status");
    status.classList.remove("error");
    status.textContent = "正在解密…";
    $("#gate-submit").disabled = true;
    try {
      const envelopeResponse = await fetch(`${VAULT_URL}?t=${Date.now()}`, { cache: "no-store" });
      if (!envelopeResponse.ok) throw new Error(`加密数据读取失败 HTTP ${envelopeResponse.status}`);
      const envelope = await envelopeResponse.json();
      const payload = await decryptVault(envelope, password);
      if (!publicData) {
        const dataResponse = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: "no-store" });
        if (!dataResponse.ok) throw new Error(`公开数据读取失败 HTTP ${dataResponse.status}`);
        publicData = await dataResponse.json();
      }
      render(payload);
      $("#gate").hidden = true;
      $("#vault-content").hidden = false;
      $("#gate-password").value = "";
      window.scrollTo({ top: 0 });
    } catch (error) {
      const message = String(error && error.message || error);
      if (/OperationError|decrypt/i.test(message)) {
        showError("密码错误，无法解密。");
      } else {
        showError(`解锁失败：${message}`);
      }
      $("#gate-submit").disabled = false;
    }
  }

  function lock() {
    vaultData = null;
    publicData = null;
    $("#project-list").replaceChildren();
    $("#event-list").replaceChildren();
    $("#watchlist-list").replaceChildren();
    $("#vault-content").hidden = true;
    $("#gate").hidden = false;
    $("#gate-status").textContent = "已锁定，数据已从页面清除。";
    $("#gate-status").classList.remove("error");
    $("#gate-password").value = "";
    $("#gate-password").focus();
    window.scrollTo({ top: 0 });
  }

  function bind() {
    $("#gate-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const password = $("#gate-password").value;
      if (!password) return;
      unlock(password);
    });
    $("#lock-button").addEventListener("click", lock);
    if (!window.crypto || !window.crypto.subtle) {
      showError("当前浏览器环境不支持 WebCrypto，无法解密。请使用 HTTPS 或 localhost 打开。");
      $("#gate-submit").disabled = true;
    }
  }

  bind();
  $("#gate-password").focus();
})();
