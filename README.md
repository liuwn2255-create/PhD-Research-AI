# 博士論文 AI 研究室

AI 驅動的文獻研究與博士論文助手。第一階段提供「AI 文獻研究中心」前端 MVP，採 Vite + 原生 JavaScript。

## 開發

```sh
npm install
npm run dev
npm run build
npm run preview
```

## 部署

Vite 的 `base: './'` 讓靜態資產使用相對路徑，可部署到 GitHub Pages 專案子路徑。建置輸出位於 `dist/`。目前路由使用 hash，因此可由靜態主機直接載入。

## API 架構

前端頁面只呼叫 `src/services/` adapter。設定 `VITE_API_BASE_URL` 後，文獻搜尋會向 Worker 的 `/literature/search` 發送 JSON；Research Gap 預留 `/research/gap`。Worker 再負責串接 Crossref、Semantic Scholar、PubMed 與後續 AI 分析服務。

任何學術來源或 AI API Key 都只能放在 Cloudflare Worker 的伺服器端環境變數，不能放進 `VITE_*` 前端變數。未設定 Worker 時，搜尋介面會顯示未連接狀態，不會提供假文獻。
