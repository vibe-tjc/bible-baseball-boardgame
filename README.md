# 聖經全壘打（Bible Home Run）⚾

一款以**聖經知識問答**結合**棒球**規則的多人即時搶答遊戲。主畫面（Host）顯示棒球場與計分板，玩家用手機掃描 QR Code 加入分隊搶答；答對就揮出安打推進壘包、得分，答錯則由對隊搶分。適合教會團契、主日學、小組聚會等場合在大螢幕上帶動。

支援**繁體中文 / English** 雙語即時切換。

---

## 遊戲玩法

1. **加入**：主持人開啟 Host 畫面建立遊戲，玩家以手機掃描 QR Code 進入，系統自動分隊（預設 2 隊）。
2. **出題**：每題顯示後開放**搶答**，最先按下搶答鈕的玩家取得作答權。
3. **作答**：
   - **答對** → 隨機產生一種打擊結果（依機率設定），跑者與打者依規則推進：
     | 結果 | 推進壘包 |
     |------|----------|
     | 一壘安打 Single | 1 |
     | 二壘安打 Double | 2 |
     | 三壘安打 Triple | 3 |
     | 全壘打 Home Run | 全員回本壘得分 |
     | 保送 Walk | 被迫進壘（擠壘）|
   - **答錯** → 換**對隊**作答（pass to other）。
   - **兩隊皆失敗** → **三振（Strikeout）**，無人得分。
4. **得分**：跑者回到本壘即為該隊加分。
5. **結束**：打完設定的題數後，分數最高的隊伍獲勝。

主畫面會以動畫呈現球的飛行、跑者推進、全壘打煙火與三振等效果。

---

## 技術架構

- **執行環境**：Node.js（原生 `http` + WebSocket）
- **即時通訊**：[`ws`](https://www.npmjs.com/package/ws) WebSocket
- **QR Code**：[`qrcode`](https://www.npmjs.com/package/qrcode)
- **語言**：TypeScript
- **打包**：[`tsdown`](https://www.npmjs.com/package/tsdown)（伺服器輸出 ESM、前端輸出 IIFE）
- **前端**：原生 HTML / CSS / TypeScript，球場以 HTML5 Canvas 繪製，無前端框架

整個遊戲狀態（場次、搶答仲裁、計分、存檔）皆由伺服器集中管理，主畫面與玩家端皆透過 WebSocket 連線到同一台伺服器。

### 三個端點

| 端點 | 路徑 | 說明 |
|------|------|------|
| 主畫面 Host | `/host.html` | 大螢幕：球場、計分板、題目、設定與即時出題 |
| 玩家端 Player | `/player?game=<gameId>` | 手機：加入、搶答、作答（QR Code 會自動帶入 `gameId`）|
| 伺服器 Server | `src/server/` | HTTP 靜態檔案服務 + WebSocket 遊戲邏輯 |

---

## 環境需求

- **Node.js 22 以上**（建置目標為 `node22`）
- npm

---

## 安裝與啟動

```bash
# 安裝相依套件
npm install

# 建置（編譯 TypeScript 並複製靜態檔到 dist/）
npm run build

# 啟動伺服器（預設埠號 3000）
npm start
```

啟動後開啟主畫面：

```
http://localhost:3000/host.html
```

玩家以同一區域網路的手機掃描畫面上的 QR Code 加入即可。

### 其他指令

```bash
# 開發模式：監看原始碼自動重建
npm run build:watch

# 一次完成建置並啟動
npm run dev
```

> **埠號**：可用環境變數 `PORT` 覆寫，例如 `PORT=8080 npm start`。

---

## 遊戲設定

主畫面的「設定」面板可即時調整下列項目（預設值見 `data/config/default-config.json`）：

| 設定 | 預設 | 說明 |
|------|------|------|
| 題目數量 `totalQuestions` | 20 | 一場比賽的總題數 |
| 搶答時間 `buzzerTimeLimit` | 5 秒 | 開放搶答的秒數 |
| 答題時間 `answerTimeLimit` | 10 秒 | 取得作答權後的限時 |
| 每隊人數 `playersPerTeam` | 1 | 每隊可容納的玩家數 |
| 打擊結果機率 `correctOutcomes` | 見下 | 答對時各種結果的出現機率 |

預設打擊機率：一壘安打 0.40、二壘安打 0.25、三壘安打 0.10、全壘打 0.10、保送 0.15。

主畫面也支援**即時出題**，可現場輸入題目與四個選項並指定正解。

---

## 題庫

題庫為 JSON 檔，放在 `data/questions/`（範例：`sample-questions.json`）。每題格式如下，題目與選項皆為雙語：

```json
{
  "questions": [
    {
      "id": "q1",
      "text": { "zh": "亞伯拉罕的妻子叫什麼名字？", "en": "What was Abraham's wife's name?" },
      "answers": [
        { "id": 1, "text": { "zh": "撒拉", "en": "Sarah" }, "correct": true },
        { "id": 2, "text": { "zh": "利百加", "en": "Rebekah" }, "correct": false },
        { "id": 3, "text": { "zh": "拉結", "en": "Rachel" }, "correct": false },
        { "id": 4, "text": { "zh": "利亞", "en": "Leah" }, "correct": false }
      ],
      "category": "Old Testament"
    }
  ]
}
```

新增題目時，在 `questions` 陣列中加入物件即可；每題需有一個 `correct: true` 的選項。

---

## 專案結構

```
.
├── src/
│   ├── server/          # Node 伺服器：HTTP、WebSocket、遊戲場次與計分
│   │   ├── index.ts             # 進入點，啟動 HTTP + WS
│   │   ├── http-handler.ts      # 靜態檔案與 QR Code
│   │   ├── ws-handler.ts        # WebSocket 訊息處理
│   │   ├── game-manager.ts      # 管理所有場次
│   │   ├── game-session.ts      # 單場遊戲狀態機與規則
│   │   ├── buzzer-arbiter.ts    # 搶答仲裁
│   │   ├── question-bank.ts     # 載入題庫
│   │   └── state-persistence.ts # 場次存檔
│   ├── host/            # 主畫面（大螢幕）
│   │   ├── index.ts
│   │   └── renderer/            # Canvas 球場與動畫
│   │       ├── baseball-field.ts
│   │       └── animations.ts
│   ├── player/          # 玩家端（手機）
│   └── shared/          # 共用：協定、設定、常數、i18n
├── public/              # HTML 與 CSS（建置時複製到 dist/）
├── data/
│   ├── config/          # 預設設定
│   ├── questions/        # 題庫
│   └── sessions/         # 場次存檔
├── scripts/copy-public.js
├── tsdown.config.ts
└── package.json
```

---

## 部署說明

本遊戲需要**長時間運行的 Node.js 伺服器**與 WebSocket 連線，因此**無法部署在 GitHub Pages**（Pages 只能提供靜態檔案，沒有 Node 執行環境）。

請部署到支援常駐程序與 WebSocket 的平台，例如 Render、Railway、Fly.io 或自架 VPS。基本流程為：在伺服器上 `npm install && npm run build`，再以 `npm start`（建議搭配 pm2 / systemd 等程序管理工具）執行，並將 `PORT` 設定為平台指定的埠號。

---

## 授權

本專案目前未指定授權條款（All rights reserved）；如需開放授權，請補上對應的 LICENSE 檔案。
