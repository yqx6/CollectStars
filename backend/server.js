const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/star_app';

app.use(cors());
app.use(express.json());

// ---------- Models ----------
const starSchema = new mongoose.Schema({
  acquiredAt: { type: Date, default: Date.now },
  redeemed: { type: Boolean, default: false },
  rewardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reward', default: null }
});
const Star = mongoose.model('Star', starSchema);

const rewardSchema = new mongoose.Schema({
  content: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
  stars: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Star' }]
});
const Reward = mongoose.model('Reward', rewardSchema);

// ---------- Helpers ----------
function dayRange(d = new Date()) {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// ---------- Routes ----------
app.get('/api/health', (req, res) => res.json({ ok: true }));

// 所有星星（含日期、是否灰掉、所属奖励）
app.get('/api/stars', async (req, res) => {
  const stars = await Star.find().sort({ acquiredAt: 1 }).lean();
  const rewards = await Reward.find().lean();
  const rewardMap = Object.fromEntries(rewards.map(r => [String(r._id), r]));
  res.json(stars.map(s => ({
    ...s,
    rewardContent: s.rewardId ? (rewardMap[String(s.rewardId)]?.content || '') : ''
  })));
});

// 打卡：每天限 1 颗
app.post('/api/checkin', async (req, res) => {
  const { start, end } = dayRange();
  const existed = await Star.findOne({ acquiredAt: { $gte: start, $lte: end } });
  if (existed) return res.status(400).json({ message: '今天已经打过卡了，明天再来吧' });
  const star = await Star.create({});
  res.json(star);
});

// 兑换：前端传 starIds（5个）+ content；若不传 starIds 则自动取最早的5颗未兑换
app.post('/api/redeem', async (req, res) => {
  const { content, starIds } = req.body;
  if (!content || !String(content).trim()) {
    return res.status(400).json({ message: '请输入奖励内容' });
  }
  let stars;
  if (Array.isArray(starIds) && starIds.length === 5) {
    stars = await Star.find({ _id: { $in: starIds }, redeemed: false });
    if (stars.length !== 5) return res.status(400).json({ message: '所选星星数量不足5颗或已有兑换' });
  } else {
    stars = await Star.find({ redeemed: false }).sort({ acquiredAt: 1 }).limit(5);
    if (stars.length < 5) return res.status(400).json({ message: '可用星星不足5颗' });
  }
  const reward = await Reward.create({
    content: String(content).trim(),
    stars: stars.map(s => s._id)
  });
  await Star.updateMany(
    { _id: { $in: stars.map(s => s._id) } },
    { $set: { redeemed: true, rewardId: reward._id } }
  );
  res.json(reward);
});

// 奖励列表
app.get('/api/rewards', async (req, res) => {
  const rewards = await Reward.find().sort({ createdAt: -1 }).populate('stars');
  res.json(rewards);
});

// 统计：一共收集多少颗
app.get('/api/stats', async (req, res) => {
  const total = await Star.countDocuments();
  const redeemed = await Star.countDocuments({ redeemed: true });
  const rewards = await Reward.countDocuments();
  const { start, end } = dayRange();
  const checkedToday = await Star.exists({ acquiredAt: { $gte: start, $lte: end } });
  res.json({
    total,                    // 一共收集了多少颗
    redeemed,                 // 已兑换（灰掉）的数量
    available: total - redeemed, // 可用于兑换的数量
    rewards,                  // 兑换次数
    checkedToday: !!checkedToday
  });
});

// 仅开发/演示用：清空
app.delete('/api/reset', async (req, res) => {
  await Star.deleteMany({});
  await Reward.deleteMany({});
  res.json({ ok: true });
});

mongoose.connect(MONGO_URI).then(() => {
  console.log('MongoDB connected');
  app.listen(PORT, () => console.log(`Backend listening on ${PORT}`));
}).catch(err => {
  console.error('Mongo connect failed:', err.message);
  process.exit(1);
});
