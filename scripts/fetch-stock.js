/**
 * fetch-stock.js — GitHub Action 脚本
 * 读取 config.json → 请求 Yahoo Finance → 写入 data.json
 * 在服务端运行，无 CORS 限制
 */
const fs = require("fs");
const path = require("path");

async function main() {
  // 读取配置
  const configPath = path.join(process.cwd(), "config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  const symbol = String(config.symbol || "AAPL")
    .replace(/^\$/, "")
    .trim()
    .toUpperCase();
  const range = config.range || "3mo";
  const interval = config.interval || "1d";

  console.log(`📊 获取 ${symbol} 数据 (range=${range}, interval=${interval}) ...`);

  // 请求 Yahoo Finance（服务端无 CORS 问题）
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=${interval}&range=${range}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`Yahoo Finance 返回 ${res.status}: ${res.statusText}`);
  }

  const json = await res.json();

  if (!json.chart || !json.chart.result) {
    const errMsg = json.chart && json.chart.error
      ? json.chart.error.description
      : "未知错误";
    throw new Error(`无法获取 ${symbol} 的数据: ${errMsg}`);
  }

  const result = json.chart.result[0];
  const meta = result.meta || {};

  // 组装 data.json
  const data = {
    symbol: symbol,
    fetchedAt: new Date().toISOString(),
    range: range,
    interval: interval,
    currentPrice: meta.regularMarketPrice,
    previousClose: meta.previousClose || meta.chartPreviousClose,
    currency: meta.currency || "USD",
    exchange: meta.exchangeName || "",
    yahooResult: result,
  };

  const dataPath = path.join(process.cwd(), "data.json");
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), "utf-8");

  console.log(`✅ 数据已写入 data.json`);
  console.log(`   当前价格: ${data.currentPrice} ${data.currency}`);
  console.log(`   数据点数: ${(result.timestamp || []).length}`);
}

main().catch((err) => {
  console.error("❌ 失败:", err.message);
  process.exit(1);
});
