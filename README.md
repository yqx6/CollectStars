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
- `GET /api/stars` 所有星星（含日期、是否兑换）
- `POST /api/checkin` 打卡
- `POST /api/redeem {content, starIds[5]}` 兑换
- `GET /api/rewards` 奖励列表
- `GET /api/stats` 统计总数
