const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/nav_app';

app.use(cors());
app.use(express.json());

const siteSchema = new mongoose.Schema({
  key: { type: String, unique: true, sparse: true },
  path: { type: String, required: true, trim: true },
  icon: { type: String, default: '🌐' },
  name: { type: String, required: true, trim: true },
  desc: { type: String, default: '' },
  order: { type: Number, default: 0 }
}, { timestamps: true });
const Site = mongoose.model('Site', siteSchema);

const DEFAULTS = [
  { key: 'main',  path: '/',       icon: '🏠', name: '主站',       desc: '8002 · 默认站点',   order: 1 },
  { key: 'sms',   path: '/sms',    icon: '💬', name: 'SMS',        desc: '单页应用 sms.html', order: 2 },
  { key: 'game1', path: '/game1/', icon: '🎮', name: 'Game1',      desc: '静态小游戏',        order: 3 },
  { key: 'mi',    path: '/mi/',    icon: '📦', name: 'MI',         desc: '8090 · mistatic 服务', order: 4 },
  { key: 'site',  path: '/site/',  icon: '🌐', name: 'Site',       desc: '8090 · mistatic 服务', order: 5 },
  { key: 'star',  path: '/star/',  icon: '⭐', name: '打卡集星星', desc: 'Vue3 + Express + Mongo', order: 6 },
  { key: 'nav',   path: '/nav/',   icon: '🧭', name: '站点导航',   desc: '本站 · 当前页面',    order: 7 }
];

async function ensureSeed() {
  const n = await Site.countDocuments();
  if (n === 0) await Site.insertMany(DEFAULTS);
}

function clean({ path, icon, name, desc }) {
  const out = {};
  if (path !== undefined) out.path = String(path).trim();
  if (icon !== undefined) out.icon = String(icon).trim() || '🌐';
  if (name !== undefined) out.name = String(name).trim();
  if (desc !== undefined) out.desc = String(desc).trim();
  return out;
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/sites', async (req, res) => {
  res.json(await Site.find().sort({ order: 1, createdAt: 1 }).lean());
});

app.post('/api/sites', async (req, res) => {
  const data = clean(req.body || {});
  if (!data.name) return res.status(400).json({ message: '名称不能为空' });
  if (!data.path) return res.status(400).json({ message: '路径不能为空' });
  if (!data.path.startsWith('/')) return res.status(400).json({ message: '路径须以 / 开头' });
  const maxOrder = await Site.findOne().sort({ order: -1 }).select('order').lean();
  const site = await Site.create({ ...data, order: (maxOrder?.order ?? 0) + 1 });
  res.status(201).json(site);
});

app.put('/api/sites/:id', async (req, res) => {
  const data = clean(req.body || {});
  if (data.name !== undefined && !data.name) return res.status(400).json({ message: '名称不能为空' });
  if (data.path !== undefined) {
    if (!data.path) return res.status(400).json({ message: '路径不能为空' });
    if (!data.path.startsWith('/')) return res.status(400).json({ message: '路径须以 / 开头' });
  }
  const site = await Site.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
  if (!site) return res.status(404).json({ message: '站点不存在' });
  res.json(site);
});

app.delete('/api/sites/:id', async (req, res) => {
  const site = await Site.findByIdAndDelete(req.params.id);
  if (!site) return res.status(404).json({ message: '站点不存在' });
  res.json({ ok: true });
});

app.post('/api/reset', async (req, res) => {
  await Site.deleteMany({});
  await Site.insertMany(DEFAULTS);
  res.json({ ok: true });
});

mongoose.connect(MONGO_URI).then(async () => {
  await ensureSeed();
  console.log('MongoDB connected');
  app.listen(PORT, () => console.log(`nav-backend listening on ${PORT}`));
}).catch(err => {
  console.error('Mongo connect failed:', err.message);
  process.exit(1);
});
