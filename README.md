# 📈 股价走势查看器

> 在 GitHub 仓库修改 `config.json` 的股票代码，刷新网页即可一键查看 **实时股价** 与 **走势图**。
> 基于 GitHub Pages 免费托管，无需服务器、无需 API Key。

---

## ✨ 功能

- **实时股价** — 打开网页即显示当前价格、涨跌额、涨跌幅
- **走势图** — 可交互的折线图，支持 5天 / 1月 / 3月 / 6月 / 1年 / 全部 时间范围切换
- **详细数据** — 开盘、最高、最低、收盘、成交量、前收盘
- **自动刷新** — 默认每 60 秒自动拉取最新价格
- **一键换股** — 在 GitHub 仓库编辑 `config.json`，保存后刷新页面即可
- **自动数据备份** — GitHub Action 每 30 分钟自动拉取数据写入 `data.json`，作为前端实时请求失败时的兜底

---

## 🚀 快速开始

### 第一步：创建 GitHub 仓库

1. 登录 [GitHub](https://github.com)，点击 **New repository**
2. 仓库名随意（如 `stock-trend`），选择 **Public**，点击 **Create repository**
3. 将本项目的所有文件上传到仓库根目录

> 文件结构：
> ```
> ├── config.json              ← 股票代码配置（改这个！）
> ├── index.html               ← 网页入口
> ├── app.js                   ← 前端逻辑
> ├── style.css                ← 样式
> ├── .nojekyll                ← 让 GitHub Pages 正常服务
> ├── data.json                ← Action 自动生成（首次可没有）
> ├── scripts/fetch-stock.js   ← Action 数据拉取脚本
> └── .github/workflows/
>     └── update-stock-data.yml ← 定时刷新 Action
> ```

### 第二步：开启 GitHub Pages

1. 进入仓库 **Settings → Pages**
2. **Source** 选择 `Deploy from a branch`
3. **Branch** 选择 `main`（或 `master`），文件夹选 `/ (root)`
4. 点击 **Save**
5. 等待 1~2 分钟，页面顶部会显示你的网址：
   ```
   https://kemomi.github.io/stock-trend
   ```
6. 打开这个网址即可看到股价走势图！🎉

### 第三步：切换股票代码

打开仓库中的 [`config.json`](config.json)，修改 `symbol` 字段：

```json
{
  "symbol": "NVDA",   ← 改成你想看的股票代码
  "range": "3mo",
  "interval": "1d",
  "refreshSeconds": 60
}
```

保存（Commit）后，刷新网页即可看到新股票的实时价格与走势。

#### 常见股票代码示例

| 代码    | 公司               |
|---------|--------------------|
| `AAPL`  | 苹果 Apple         |
| `NVDA`  | 英伟达 NVIDIA     |
| `TSLA`  | 特斯拉 Tesla       |
| `GOOGL` | 谷歌 Google        |
| `MSFT`  | 微软 Microsoft     |
| `AMZN`  | 亚马逊 Amazon      |
| `META`  | Meta (Facebook)    |
| `ANT`   | Antero Resources   |

> ⚠️ 注意：ANTHROPIC的代码是 `ANT`。

---

## ⚙️ 配置说明（config.json）

| 字段             | 说明                         | 默认值   |
|------------------|------------------------------|----------|
| `symbol`         | 股票代码（不带 `$`）          | `"AAPL"` |
| `range`          | 走势图默认时间范围            | `"3mo"`  |
| `interval`       | 数据粒度（`1d`=日线）         | `"1d"`   |
| `refreshSeconds` | 自动刷新间隔（秒，最小 15）   | `60`     |
| `chartType`      | 图表类型                      | `"line"` |
| `theme`          | 主题                          | `"dark"` |

`range` 可选值：`5d` `1mo` `3mo` `6mo` `1y` `2y` `5y` `10y` `max`

---

## 🔄 GitHub Action 说明

仓库包含一个 GitHub Action（`.github/workflows/update-stock-data.yml`），会自动：

1. **当你修改 `config.json` 并提交时** — 立即拉取新股票数据
2. **每 30 分钟** — 定时刷新数据
3. **手动触发** — 在 Actions 页面点 "Run workflow"

拉取的数据写入 `data.json`，作为前端实时请求失败时的兜底数据源。
首次推送后 Action 会自动运行一次生成 `data.json`。

---

## 📐 技术原理

```
用户打开 GitHub Pages 网页
        │
        ▼
  读取 config.json（获取股票代码）
        │
        ▼
  通过 CORS 代理请求 Yahoo Finance API
        │
        ├─ 成功 → 实时渲染股价 + 走势图
        │
        └─ 失败 → 回退读取 data.json（Action 生成的缓存数据）
```

- **数据源**：[Yahoo Finance](https://finance.yahoo.com)（免费、无需 API Key）
- **CORS 代理**：`corsproxy.io` / `allorigins.win` / `thingproxy`（依次尝试）
- **图表库**：[Chart.js](https://www.chartjs.org) v4
- **托管**：GitHub Pages（免费）

---

## ❓ 常见问题

**Q: 打开网页显示"数据获取失败"？**
A: CORS 公共代理偶尔不可用。请稍等刷新，或等 GitHub Action 生成 `data.json` 后会自动回退到缓存数据。也可以手动在 Actions 页面触发一次 workflow。

**Q: 股票代码填了但显示错误？**
A: 请确认代码正确（如苹果是 `AAPL` 不是 `APPL`）。可在 [Yahoo Finance](https://finance.yahoo.com/lookup) 搜索确认代码。

**Q: 数据有延迟？**
A: Yahoo Finance 的数据通常延迟 15~20 分钟（非实时行情），这是免费数据源的通用限制。

**Q: 支持港股 / A股？**
A: 支持。港股代码加 `.HK` 后缀（如 `0700.HK` 为腾讯），A 股加 `.SS`（上交所）或 `.SZ`（深交所），如 `600519.SS` 为贵州茅台。

---

## 📄 License

MIT — 自由使用，数据仅供学习参考，不构成投资建议。
