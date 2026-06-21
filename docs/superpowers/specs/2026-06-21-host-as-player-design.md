# 設計：主持人參與作答（Host as Player）

日期：2026-06-21
分支：kigali

## 目標

讓主持人（Host 大螢幕）可以**直接在大螢幕上**邊主控、邊作為玩家之一參與搶答與作答，無需另一台裝置。

## 使用場景（Option B）

一個人同時負責主畫面與遊玩。主持人在 Lobby 勾選參與後，被指派到一個隊伍，遊戲中可用滑鼠在大螢幕上搶答與選答案。

## UX 流程

- **Lobby**：`lobby-controls` 新增「主持人也參與」勾選框 + 名字輸入框（預設「主持人」/ "Host"）。
  - 勾選 → 主持人以該名字加入，沿用既有「分到人最少隊伍」邏輯指派隊伍。
  - 取消勾選 → 退出。
  - 隊伍列表即時顯示主持人，附 👑 徽章標示身份。
  - 僅能在 Lobby 勾選/取消；遊戲開始後鎖定（與一般玩家僅能在 lobby 加入一致）。
- **遊戲中**：
  - 搶答階段：題目區下方出現明顯且跳動的「搶答」按鈕。
  - 主持人搶到 → 既有選項方塊變為可點擊，點下送出答案。
  - 對手答錯轉到主持人隊伍 → 選項方塊同樣變可點擊。
  - 其餘時候選項維持唯讀顯示。

## 架構設計

### 關鍵洞察

Host 的 WebSocket 連線可同時帶 `playerId`。伺服器的 `player:buzz` / `player:answer` 處理只檢查 `conn.playerId`、不檢查 `conn.role`，因此主持人沿用既有搶答/作答路徑，**不需新增任何遊戲邏輯**。

主持人判斷「輪到自己」時，僅依賴 Host 本來就會收到的訊息（`server:question`、`server:buzzWinner`、`server:passToOther`），**不需新增 server→host 的回合訊息**。

### 伺服器端改動

`src/shared/protocol.ts`：
- 新增 `HostJoinAsPlayerMsg = WsMessage<'host:joinAsPlayer', { name: string }>`
- 新增 `HostLeaveAsPlayerMsg = WsMessage<'host:leaveAsPlayer', {}>`
- 新增 `ServerHostJoinedMsg = WsMessage<'server:hostJoined', { player: PlayerInfo | null }>`（null = 已退出或加入失敗）
- 加入對應 union 型別
- `PlayerInfo` 新增可選欄位 `isHost?: boolean`

`src/server/ws-handler.ts`：
- `host:joinAsPlayer` → `game.addPlayer()`（標記 isHost）、設 `conn.playerId`（`conn.role` 維持 `'host'`）、回 `server:hostJoined { player }`、廣播 `server:playerJoined` 更新隊伍顯示。加入失敗（已滿/非 lobby）回 `server:hostJoined { player: null }`。
- `host:leaveAsPlayer` → `removePlayer()`、清 `conn.playerId`、回 `server:hostJoined { player: null }`、廣播更新隊伍顯示。
- `player:buzz` / `player:answer` 既有處理已適用 host 連線（以 playerId 為準），無需改動。

`src/server/game-session.ts`：
- `addPlayer(id, name, isHost = false)`：沿用最少隊伍指派邏輯，僅在 `PlayerInfo` 設定 `isHost`。

### Host 端改動

`public/host.html`：
- `lobby-controls` 新增勾選框 `cfg-host-play` 與名字輸入 `host-player-name`。
- `game-screen` 新增搶答按鈕 `btn-host-buzz`（預設隱藏）。

`src/host/index.ts`：
- 狀態：`hostPlayerId: string | null`、`hostTeamIndex: number`、`isParticipant: boolean`。
- 勾選框切換 → 送 `host:joinAsPlayer { name }` / `host:leaveAsPlayer`。
- 處理 `server:hostJoined` → 儲存或清除 `hostPlayerId` / `hostTeamIndex`。
- `handleQuestion`：若 `isParticipant`，顯示並啟用搶答鈕，重設選項為唯讀。
- 搶答鈕 click → 送 `player:buzz`，停用。
- `handleBuzzWinner`：隱藏搶答鈕；若 `playerId === hostPlayerId`，啟用選項點擊。
- `handlePassToOther`：若 `teamIndex === hostTeamIndex`，啟用選項點擊。
- 選項 click（啟用時）→ 送 `player:answer`，停用全部。
- `handleAnswerResult`：停用搶答鈕與選項互動。
- 遊戲開始後鎖定勾選框。

### i18n 與樣式

- `src/shared/i18n.ts` 新增：`hostJoinAsPlayer`（主持人也參與 / Join as Player）、`host`（主持人 / Host）。`buzz` 已存在，重用。
- `public/styles/host.css`：搶答鈕、可點選項的 hover/啟用狀態、主持人徽章。

## 已知限制

1. **搶答延遲優勢**：主持人在本機、手機玩家走 Wi-Fi，理論上主持人略快。休閒場景可接受。
2. **遊戲中斷線**：主持人連線中途掉線重連時，host-player 會被移除且不自動恢復（`addPlayer` 僅允許 lobby 狀態）。實務上 Host 通常與伺服器同機，影響小；列為後續可加強項目。

## 測試策略

專案目前無測試框架。採：
- TypeScript 編譯（`npm run build`）作為靜態檢查。
- 實機端到端驗證：啟動伺服器 → Host 勾選參與 → 開始遊戲 → 搶答 → 作答 → 確認計分與動畫正確、隊伍列表顯示主持人徽章。
