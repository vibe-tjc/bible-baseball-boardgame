# 部署指南（Dokploy / 自架 VPS）

聖經全壘打需要一個常駐的 Node.js 行程與 WebSocket 連線，**無法用 GitHub Pages 等純靜態托管**。本指南說明如何用 [Dokploy](https://dokploy.com) 部署到自架 VPS。Dokploy 內建 Traefik 反向代理，原生支援 WebSocket 升級與自動 HTTPS。

## 前置需求

- 一台已安裝 Dokploy 的 VPS。
- 一個指向該 VPS 的網域（例如 `game.example.com`）—— **手機掃 QR Code 加入需要可公開連線的網址**。

## 步驟

### 1. 建立 Application

Dokploy 後台 → **Create → Application** → 來源選 **GitHub**，連結本 repo，分支選 `master`（或你的部署分支）。

### 2. Build Type 選 **Dockerfile**

repo 根目錄已備妥 `Dockerfile`（multi-stage：建置 → 只裝正式相依）與 `.dockerignore`。Dokploy 會自動偵測，無需額外設定。

### 3. 設定環境變數（Environment）

| 變數 | 值 | 說明 |
|------|-----|------|
| `PORT` | `3000` | 容器內監聽埠（Dockerfile 已預設，可省略） |
| `PUBLIC_BASE_URL` | `https://game.example.com` | **必填**。玩家加入連結 / QR Code 用的對外網址。未設定時會退回容器內網 IP，手機將無法連線。 |

> 沒有 `PUBLIC_BASE_URL` 時，QR Code 會指向容器內部 IP（如 `http://10.x.x.x:3000`），外部手機掃了連不上。務必設成你的網域。

### 4. 設定 Domain

**Domains** 分頁 → 新增網域：

- Host：`game.example.com`
- Container Port：`3000`
- 開啟 **HTTPS**（Let's Encrypt 自動憑證）。

Traefik 會自動處理 WebSocket 升級，不需額外標註。

### 5.（選用）持久化已存遊戲

遊戲存檔寫在容器內 `/app/data/sessions/`，重新部署會清空。若要保留中斷的遊戲，到 **Advanced → Volumes** 新增掛載：

- Mount Path：`/app/data/sessions`

題庫（`/app/data/questions`）已打包進映像檔，**不要**把 volume 掛在整個 `/app/data` 上，否則會蓋掉題庫。

### 6. Deploy

按 **Deploy**。完成後開啟 `https://game.example.com/host.html` 即為主畫面。

## 本機驗證（Docker）

```bash
docker build -t bible-home-run .
docker run --rm -p 3000:3000 -e PUBLIC_BASE_URL=http://localhost:3000 bible-home-run
# 開 http://localhost:3000/host.html
```

## 更新題庫

題目放在 `data/questions/*.json`，會在容器啟動時全部載入。新增/修改後重新 Deploy 即生效。目前內建題庫為 `sample-questions.json`（20 題）。
