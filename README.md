# ⭐ 打卡集星星

Vue3 + Node(Express) + MongoDB，Docker 一键部署。

## 功能（对照需求）
- 每日打卡得 1 颗星星（后端限制每天 1 次）
- 二维展示：每 5 颗一行
- 每集齐 5 颗，该行旁边出现「换取」按钮，点击输入奖励内容
- 换取后该行 5 颗星星变灰
- 每颗星星可点击查看日期属性、状态、所属奖励
- 顶部统计：一共收集多少颗 / 可兑换 / 已兑换次数

## 目录
- `backend/` Node 后端，`server.js` + Express + Mongoose
- `frontend/` Vue3 前端
- `docker-compose.yml` 编排 mongo + backend + frontend

## 一键启动

```bash
docker compose up -d --build
```

- 前端：http://localhost:3457
- 后端：http://localhost:3000/api/stats
- Mongo：localhost:27017

## 本地开发（不使用 Docker）

```bash
# 启动 mongo（需本地有 mongo）
# 后端
cd backend
npm install
MONGO_URI=mongodb://localhost:27017/star_app npm start

# 前端
cd frontend
npm install
npm run dev
```
前端开发模式通过 vite proxy 把 `/api` 转到 `localhost:3000`。

## 接口
- `GET /api/stars` 所有星星（含日期、是否灰掉、所属奖励）
- `POST /api/checkin` 打卡
- `POST /api/redeem {content, starIds[5]}` 兑换
- `GET /api/rewards` 奖励列表
- `GET /api/stats` 统计总数

## 镜像发布 / 更新（GHCR）

成品镜像地址（免 build，直接拉）：
- `ghcr.io/yqx6/collectstars-backend:latest`
- `ghcr.io/yqx6/collectstars-frontend:latest`

### 1. 首次准备（只需做一次）

1. GitHub 建 Token：`Settings -> Developer settings -> Personal access tokens -> Tokens (classic) -> Generate new token (classic)`，勾选 `write:packages` + `read:packages`（仓库私有还需勾 `repo`）。
2. 登录：
```bash
echo <TOKEN> | docker login ghcr.io -u yqx6 --password-stdin
```
3. 把包设为公开（否则 NAS 免登录拉取会 `denied`）：`头像 -> Your profile -> Packages -> collectstars-backend/frontend -> Package settings -> Change visibility -> Public`。

### 2. 改完代码后重新构建并上传

在项目根目录执行：

```bash
docker login ghcr.io -u yqx6 --password-stdin
docker build -t ghcr.io/yqx6/collectstars-backend:latest ./backend
docker build -t ghcr.io/yqx6/collectstars-frontend:latest ./frontend
docker push ghcr.io/yqx6/collectstars-backend:latest
docker push ghcr.io/yqx6/collectstars-frontend:latest
```

建议同时打版本标签，便于回滚：
```bash
docker tag ghcr.io/yqx6/collectstars-backend:latest ghcr.io/yqx6/collectstars-backend:2026-09-25
docker push ghcr.io/yqx6/collectstars-backend:2026-09-25
```

### 3. 服务器 / NAS 上更新

```bash
docker pull ghcr.io/yqx6/collectstars-backend:latest
docker pull ghcr.io/yqx6/collectstars-frontend:latest
docker compose -f docker-compose.nas.yml pull
docker compose -f docker-compose.nas.yml up -d
docker images | grep collectstars
```

### 4. 常见报错

- `Head "https://ghcr.io/v2/..." denied / unauthorized`：包是 Private 且未登录。按上面第 1 步改 Public，或先 `docker login ghcr.io`。
- `timeout / TLS handshake timeout`：NAS 直连 ghcr.io 网络不通，给 NAS 配代理或改用国内 Registry。
- NAS 是 ARM 机型启动失败：当前镜像为 amd64，需用 `docker buildx build --platform linux/arm64` 重打。

## NAS 部署

使用 `docker-compose.nas.yml`（群晖 Container Manager / 威联通通用，只用成品镜像）：

```bash
docker compose -f docker-compose.nas.yml up -d
```

- 前端：http://NAS_IP:3457
- 后端：http://NAS_IP:3000/api/stats
