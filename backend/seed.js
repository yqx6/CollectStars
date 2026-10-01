// 打卡数据归档导入：在 backend/ 目录执行
//   node seed.js            stars 为空时导入 seed.json（有数据则拒绝，避免误覆盖）
//   node seed.js --force     先清空 stars/rewards 再导入（异地重建用）
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/star_app';
const force = process.argv.includes('--force');

const starSchema = new mongoose.Schema({
  acquiredAt: { type: Date, default: Date.now },
  redeemed: { type: Boolean, default: false },
  rewardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reward', default: null },
  isBonus: { type: Boolean, default: false },
  bonusGroup: { type: String, default: null }
});
const Star = mongoose.model('Star', starSchema);

async function main() {
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed.json'), 'utf8'));
  await mongoose.connect(MONGO_URI);
  const count = await Star.countDocuments();
  if (count > 0 && !force) {
    console.error(`stars 已有 ${count} 条，拒绝覆盖。如需重建请加 --force`);
    process.exit(2);
  }
  if (force) {
    await Star.deleteMany({});
    await mongoose.connection.db.collection('rewards').deleteMany({});
  }
  await Star.insertMany(seed.map(s => ({
    acquiredAt: new Date(s.acquiredAt),
    redeemed: false,
    rewardId: null,
    isBonus: !!s.isBonus,
    bonusGroup: s.bonusGroup || null
  })));
  console.log(`导入完成，共 ${seed.length} 条`);
  await mongoose.disconnect();
}

main().catch(e => { console.error(e.message); process.exit(1); });
