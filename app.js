/* ============================================================
 *  股价走势查看器  —  app.js
 *  读取 config.json → 通过 CORS 代理请求 Yahoo Finance → 渲染图表
 *  在 GitHub 仓库修改 config.json 的 symbol 字段即可切换股票
 * ============================================================ */

(function () {
  "use strict";

  // ---------- DOM 引用 ----------
  const $ = (id) => document.getElementById(id);
  const el = {
    symbol: $("symbol"),
    exchange: $("exchange"),
    price: $("price"),
    change: $("change"),
    currency: $("currency"),
    lastUpdated: $("lastUpdated"),
    statOpen: $("statOpen"),
    statHigh: $("statHigh"),
    statLow: $("statLow"),
    statClose: $("statClose"),
    statVolume: $("statVolume"),
    statPrevClose: $("statPrevClose"),
    configDisplay: $("configDisplay"),
    errorBox: $("errorBox"),
    errorMsg: $("errorMsg"),
    statusDot: $("statusDot"),
    statusText: $("statusText"),
    refreshInfo: $("refreshInfo"),
    rangeButtons: $("rangeButtons"),
  };

  let chart = null;
  let config = null;
  let currentRange = "3mo";

  // ---------- 状态指示 ----------
  function setStatus(state, text) {
    el.statusDot.className = "dot " + state;
    el.statusText.textContent = text;
  }

  function showError(msg) {
    el.errorBox.style.display = "block";
    el.errorMsg.textContent = msg;
  }
  function hideError() {
    el.errorBox.style.display = "none";
  }

  // ---------- 工具函数 ----------
  function cleanSymbol(sym) {
    return String(sym || "").replace(/^\$/, "").trim().toUpperCase();
  }

  function fmtNum(n, digits = 2) {
    if (n == null || isNaN(n)) return "--";
    return n.toLocaleString("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  function fmtVolume(v) {
    if (v == null || isNaN(v)) return "--";
    if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
    if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
    if (v >= 1e3) return (v / 1e3).toFixed(2) + "K";
    return String(v);
  }

  function fmtTime(ts) {
    if (!ts) return "";
    const d = new Date(ts * 1000);
    return d.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // ---------- CORS 代理列表（依次尝试） ----------
  const CORS_PROXIES = [
    (url) => "https://corsproxy.io/?url=" + encodeURIComponent(url),
    (url) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(url),
    (url) => "https://thingproxy.freeboard.io/fetch/" + url,
  ];

  async function fetchViaProxy(targetUrl) {
    for (let i = 0; i < CORS_PROXIES.length; i++) {
      try {
        const proxied = CORS_PROXIES[i](targetUrl);
        const res = await fetch(proxied, { method: "GET" });
        if (!res.ok) continue;
        const text = await res.text();
        if (text && text.length > 10) return text;
      } catch (e) {
        // 尝试下一个代理
      }
    }
    throw new Error("所有 CORS 代理均失败");
  }

  // ---------- 获取 Yahoo Finance 数据 ----------
  async function fetchStockData(symbol, range, interval) {
    const yahooUrl =
      "https://query1.finance.yahoo.com/v8/finance/chart/" +
      encodeURIComponent(symbol) +
      "?interval=" + interval +
      "&range=" + range;

    // 1) 先尝试 CORS 代理实时获取
    try {
      const text = await fetchViaProxy(yahooUrl);
      const json = JSON.parse(text);
      if (json && json.chart && json.chart.result) {
        return { data: json.chart.result[0], source: "live" };
      }
      if (json && json.chart && json.chart.error) {
        throw new Error(json.chart.error.description || "Yahoo API 返回错误");
      }
    } catch (e) {
      // 2) 回退到 GitHub Action 提交的 data.json
      try {
        const res = await fetch("data.json", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          if (json && json.symbol === symbol) {
            return { data: json.yahooResult, source: "cached" };
          }
        }
      } catch (e2) {
        /* ignore */
      }
      throw e;
    }
  }

  // ---------- 渲染价格信息 ----------
  function renderPrice(result, source) {
    const meta = result.meta || {};
    const quote = (result.indicators && result.indicators.quote && result.indicators.quote[0]) || {};
    const timestamps = result.timestamp || [];
    const closes = quote.close || [];

    const symbol = meta.symbol || cleanSymbol(config.symbol);
    const price = meta.regularMarketPrice;
    const prevClose = meta.previousClose || meta.chartPreviousClose;
    const currency = meta.currency || "USD";
    const exchange = meta.exchangeName || meta.fullExchangeName || "";

    // 价格 & 涨跌
    el.symbol.textContent = "$" + symbol;
    el.exchange.textContent = exchange;
    el.price.textContent = fmtNum(price);

    if (price != null && prevClose != null) {
      const change = price - prevClose;
      const changePct = (change / prevClose) * 100;
      const sign = change >= 0 ? "+" : "";
      el.change.textContent =
        sign + fmtNum(change) + "  (" + sign + fmtNum(changePct) + "%)";
      el.change.className = "change " + (change >= 0 ? "up" : "down");
    } else {
      el.change.textContent = "--";
      el.change.className = "change";
    }

    el.currency.textContent = "货币：" + currency;
    el.lastUpdated.textContent =
      "更新：" + fmtTime(meta.regularMarketTime) +
      (source === "cached" ? "  (缓存数据)" : "  (实时)");

    // 统计数据（取最后一条有效记录）
    let lastIdx = -1;
    for (let i = closes.length - 1; i >= 0; i--) {
      if (closes[i] != null) { lastIdx = i; break; }
    }
    el.statOpen.textContent = fmtNum(lastIdx >= 0 ? quote.open[lastIdx] : null);
    el.statHigh.textContent = fmtNum(lastIdx >= 0 ? quote.high[lastIdx] : null);
    el.statLow.textContent = fmtNum(lastIdx >= 0 ? quote.low[lastIdx] : null);
    el.statClose.textContent = fmtNum(lastIdx >= 0 ? closes[lastIdx] : null);
    el.statVolume.textContent = fmtVolume(lastIdx >= 0 ? quote.volume[lastIdx] : null);
    el.statPrevClose.textContent = fmtNum(prevClose);
  }

  // ---------- 渲染图表 ----------
  function renderChart(result) {
    const quote = (result.indicators && result.indicators.quote && result.indicators.quote[0]) || {};
    const timestamps = result.timestamp || [];
    const closes = quote.close || [];

    const labels = timestamps.map((t) =>
      new Date(t * 1000).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })
    );

    // 填充 null 间隙（前值填充）
    let lastVal = null;
    const data = closes.map((c) => {
      if (c == null) return lastVal;
      lastVal = c;
      return c;
    });

    // 涨跌颜色
    const first = data.find((d) => d != null);
    const last = [...data].reverse().find((d) => d != null);
    const isUp = last != null && first != null && last >= first;
    const color = isUp ? "#3fb950" : "#f85149";

    if (chart) chart.destroy();

    const ctx = document.getElementById("priceChart").getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, 360);
    gradient.addColorStop(0, isUp ? "rgba(63,185,80,0.25)" : "rgba(248,81,73,0.25)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");

    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: "收盘价",
          data: data,
          borderColor: color,
          backgroundColor: gradient,
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: color,
          spanGaps: true,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(13,17,23,0.95)",
            borderColor: "#30363d",
            borderWidth: 1,
            titleColor: "#8b949e",
            bodyColor: "#e6edf3",
            padding: 12,
            callbacks: {
              label: (ctx) => "价格: " + fmtNum(ctx.parsed.y),
            },
          },
        },
        scales: {
          x: {
            grid: { color: "rgba(48,54,61,0.5)" },
            ticks: { color: "#8b949e", maxTicksLimit: 8, font: { size: 11 } },
          },
          y: {
            grid: { color: "rgba(48,54,61,0.5)" },
            ticks: {
              color: "#8b949e",
              font: { size: 11 },
              callback: (v) => fmtNum(v),
            },
          },
        },
      },
    });
  }

  // ---------- 主加载流程 ----------
  async function load() {
    if (!config) return;
    const symbol = cleanSymbol(config.symbol);
    const interval = config.interval || "1d";

    setStatus("loading", "正在获取 $" + symbol + " …");
    hideError();

    try {
      const { data, source } = await fetchStockData(symbol, currentRange, interval);
      renderPrice(data, source);
      renderChart(data);
      setStatus(source === "live" ? "live" : "loading",
        source === "live" ? "实时数据 · $" + symbol : "缓存数据 · $" + symbol);
    } catch (err) {
      setStatus("error", "获取失败");
      showError(
        "无法获取 $" + symbol + " 的数据。" + (err.message || "") +
        "  请检查股票代码是否正确，或稍后重试。"
      );
    }
  }

  // ---------- 自动刷新 ----------
  let refreshTimer = null;
  function setupAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    const sec = Math.max(15, config.refreshSeconds || 60);
    el.refreshInfo.textContent = sec + " 秒";
    refreshTimer = setInterval(load, sec * 1000);
  }

  // ---------- 时间范围按钮 ----------
  function setupRangeButtons() {
    const btns = el.rangeButtons.querySelectorAll("button");
    btns.forEach((btn) => {
      btn.addEventListener("click", () => {
        btns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentRange = btn.dataset.range;
        load();
      });
    });
  }

  // ---------- 初始化 ----------
  async function init() {
    setStatus("loading", "正在加载配置…");

    // 读取 config.json
    try {
      const res = await fetch("config.json", { cache: "no-store" });
      config = await res.json();
    } catch (e) {
      setStatus("error", "配置加载失败");
      showError("无法读取 config.json，请确保文件存在且格式正确。");
      return;
    }

    // 显示配置
    el.configDisplay.textContent = JSON.stringify(config, null, 2);
    currentRange = config.range || "3mo";

    // 高亮当前范围按钮
    const activeBtn = el.rangeButtons.querySelector(
      'button[data-range="' + currentRange + '"]'
    );
    if (activeBtn) {
      el.rangeButtons.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      activeBtn.classList.add("active");
    }

    setupRangeButtons();
    setupAutoRefresh();
    await load();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
