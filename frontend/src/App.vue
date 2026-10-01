<template>
  <div class="page">
    <header class="header">
      <h1>⭐ 打卡集星星</h1>
      <div class="stats">
        <div class="stat">一共收集 <b>{{ stats.total }}</b> 颗</div>
        <div class="stat">可兑换 <b>{{ stats.available }}</b> 颗</div>
        <div class="stat">已兑换 <b>{{ stats.rewards }}</b> 次</div>
        <div class="stat bonus-stat">奖励星 <b>{{ stats.bonus || 0 }}</b> 颗</div>
      </div>
      <div class="actions">
        <button class="btn primary" :disabled="stats.checkedToday || loading" @click="openCheckin">
          {{ stats.checkedToday ? '今日已打卡 ✅' : '今日打卡 +1 ⭐' }}
        </button>
        <button class="btn ghost" @click="loadAll">刷新</button>
      </div>
      <p class="tip">规则：每天打卡得 1 颗星星，可选额外奖励 1-3 颗（同格重叠展示） · 每集满 5 格可在该行旁边点击「换取」输入奖励内容 · 换取后星星变灰</p>
    </header>

    <main>
      <div v-if="stars.length === 0" class="empty">还没有星星，快点击上方打卡开始收集吧～</div>

      <!-- 二维展示：每天一格，奖励星同格重叠，每 5 格一行 -->
      <div v-for="(row, rowIndex) in rows" :key="rowIndex" class="row">
        <div class="stars">
          <div
            v-for="(c, i) in row.slots"
            :key="i"
            class="star cell"
            :class="{ gray: c && c.allRedeemed, empty: !c, 'has-bonus': c && c.bonusCount > 0 && !c.allRedeemed }"
            :title="c ? formatDate(c.date) : '待收集'"
            @click="c && openDetail(c)"
          >
            <template v-if="c">
              <i v-if="c.total > 1" class="count-badge">×{{ c.total }}</i>
              <div class="stack">
                <span
                  v-for="(st, k) in c.stars"
                  :key="st._id || k"
                  class="layer"
                  :class="{ 'layer-bonus': st.isBonus }"
                  :style="stackStyle(k, c.stars.length)"
                >★</span>
              </div>
              <small>{{ shortDate(c.date) }}<em v-if="c.bonusCount > 0" class="bonus-tag">+{{ c.bonusCount }}奖</em></small>
            </template>
            <template v-else>
              <span class="placeholder">☆</span>
            </template>
          </div>
        </div>
        <div class="side">
          <template v-if="row.status === 'redeemable'">
            <button class="btn warn" @click="openRedeem(row)">换取 🎁</button>
          </template>
          <template v-else-if="row.status === 'redeemed'">
            <span class="badge">已换：{{ row.rewardContent }}</span>
          </template>
          <template v-else>
            <span class="progress">{{ row.filled }}/5格 · {{ row.starCount }}颗</span>
          </template>
        </div>
      </div>
    </main>

    <section class="rewards">
      <h2>🎁 换取记录</h2>
      <div v-if="rewards.length === 0" class="empty">暂无兑换记录</div>
      <div v-for="r in rewards" :key="r._id" class="reward-card">
        <div><b>{{ r.content }}</b></div>
        <div class="meta">{{ formatDate(r.createdAt) }} · 用掉 {{ r.stars?.length || 5 }} 颗星</div>
      </div>
    </section>

    <!-- 打卡格详情：日期 + 本格颗数 -->
    <div v-if="detail" class="mask" @click.self="detail = null">
      <div class="modal">
        <h3>{{ detail.allRedeemed ? '★ 已兑换' : detail.bonusCount > 0 ? '🌟 打卡（含奖励）' : '⭐ 打卡详情' }}</h3>
        <p>日期：{{ formatDate(detail.date) }}</p>
        <p>本格共 {{ detail.total }} 颗（基础 1 + 奖励 {{ detail.bonusCount }}）</p>
        <p>状态：{{ detail.allRedeemed ? '已兑换（灰掉）' : detail.anyRedeemed ? '部分已兑换' : '未兑换' }}</p>
        <p v-if="detail.rewardContent">所属奖励：{{ detail.rewardContent }}</p>
        <button class="btn primary" @click="detail = null">关闭</button>
      </div>
    </div>

    <!-- 打卡弹窗：选择是否给予额外奖励 1-3 颗 -->
    <div v-if="checkinModal" class="mask" @click.self="checkinModal = false">
      <div class="modal">
        <h3>今日打卡 ⭐</h3>
        <p class="modal-tip">基础 +1 颗，是否给予额外奖励？</p>
        <div class="bonus-options">
          <button
            v-for="n in [0, 1, 2, 3]"
            :key="n"
            class="btn bonus-opt"
            :class="{ active: bonusPick === n }"
            @click="bonusPick = n"
          >{{ n === 0 ? '不奖励' : `+${n} 颗` }}</button>
        </div>
        <p class="modal-preview">本次共获得 <b class="hl">{{ 1 + bonusPick }}</b> 颗星星（含奖励 {{ bonusPick }} 颗）</p>
        <div class="modal-actions">
          <button class="btn ghost" @click="checkinModal = false">取消</button>
          <button class="btn primary" :disabled="loading" @click="confirmCheckin">确认打卡</button>
        </div>
      </div>
    </div>

    <!-- 换取弹窗：输入奖励内容 -->
    <div v-if="redeemRow !== null" class="mask" @click.self="redeemRow = null">
      <div class="modal">
        <h3>换取本行 {{ redeemRow.starCount }} 颗星星 🎁</h3>
        <input v-model="rewardContent" placeholder="输入换取的奖励内容，例如：看一场电影" />
        <div class="modal-actions">
          <button class="btn ghost" @click="redeemRow = null">取消</button>
          <button class="btn warn" :disabled="!rewardContent.trim()" @click="confirmRedeem">确认换取</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const stars = ref([])
const rewards = ref([])
const stats = ref({ total: 0, available: 0, redeemed: 0, rewards: 0, bonus: 0, base: 0, checkedToday: false })
const loading = ref(false)
const detail = ref(null)
const redeemRow = ref(null)
const rewardContent = ref('')
const checkinModal = ref(false)
const bonusPick = ref(0)

// 同一次打卡（含奖励）合成一格：按 bonusGroup 聚合，老数据无 bonusGroup 则每颗独立一格
const cells = computed(() => {
  const map = new Map()
  for (const s of stars.value) {
    const key = s.bonusGroup || String(s._id)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(s)
  }
  return [...map.values()].map(group => {
    const sorted = [...group].sort((a, b) => (a.isBonus ? 1 : -1))
    const bonusCount = sorted.filter(s => s.isBonus).length
    return {
      key: sorted[0].bonusGroup || String(sorted[0]._id),
      stars: sorted,
      date: sorted[0].acquiredAt,
      total: sorted.length,
      bonusCount,
      allRedeemed: sorted.every(s => s.redeemed),
      anyRedeemed: sorted.some(s => s.redeemed),
      rewardContent: sorted.find(s => s.rewardContent)?.rewardContent || ''
    }
  })
})

// 每 5 格切一行，补空位形成二维展示
const rows = computed(() => {
  const list = cells.value
  const out = []
  for (let i = 0; i < list.length; i += 5) {
    const group = list.slice(i, i + 5)
    const slots = [...group]
    while (slots.length < 5) slots.push(null)
    const allStars = group.flatMap(c => c.stars)
    let status = 'collecting'
    let rewardContent = ''
    if (group.length === 5) {
      if (allStars.every(s => s.redeemed)) {
        status = 'redeemed'
        rewardContent = group[0].rewardContent || ''
      } else if (allStars.every(s => !s.redeemed)) {
        status = 'redeemable'
      } else {
        // 同一行出现部分兑换（跨行自动兑换时），按已兑换处理
        status = allStars.some(s => s.redeemed) ? 'redeemed' : 'collecting'
        rewardContent = group.find(c => c.rewardContent)?.rewardContent || ''
      }
    }
    out.push({
      slots,
      status,
      rewardContent,
      starIds: allStars.map(s => s._id),
      filled: group.length,
      starCount: allStars.length
    })
  }
  // 还没满一行时也展示一行进度（如果正好整除则加一个空行提示）
  if (list.length % 5 === 0) {
    out.push({ slots: [null, null, null, null, null], status: 'collecting', rewardContent: '', starIds: [], filled: 0, starCount: 0 })
  }
  return out
})

// 堆叠偏移：首颗（基础）在最前右下，奖励星依次向左上垫后
function stackStyle(k, n) {
  const step = 7
  const off = (n - 1 - k) * step
  return { transform: `translate(${off}px, ${off}px)`, zIndex: n - k }
}

function formatDate(d) {
  return new Date(d).toLocaleString('zh-CN', { hour12: false })
}
function shortDate(d) {
  const dt = new Date(d)
  return `${dt.getMonth() + 1}/${dt.getDate()}`
}

async function loadAll() {
  const [s, r, st] = await Promise.all([
    fetch('/api/stars').then(r => r.json()),
    fetch('/api/rewards').then(r => r.json()),
    fetch('/api/stats').then(r => r.json())
  ])
  stars.value = s
  rewards.value = r
  stats.value = st
}

async function checkin() {
  loading.value = true
  try {
    const res = await fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bonus: bonusPick.value })
    })
    const data = await res.json()
    if (!res.ok) return alert(data.message)
    checkinModal.value = false
    await loadAll()
  } finally {
    loading.value = false
  }
}

function openCheckin() {
  bonusPick.value = 0
  checkinModal.value = true
}
function confirmCheckin() { return checkin() }

function openDetail(c) { detail.value = c }
function openRedeem(row) {
  redeemRow.value = row
  rewardContent.value = ''
}
async function confirmRedeem() {
  const res = await fetch('/api/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: rewardContent.value, starIds: redeemRow.value.starIds })
  })
  const data = await res.json()
  if (!res.ok) return alert(data.message)
  redeemRow.value = null
  await loadAll()
}

onMounted(loadAll)
</script>

<style scoped>
.page { max-width: 860px; margin: 0 auto; padding: 24px 16px calc(60px + env(safe-area-inset-bottom)); width: 100%; }
.header { text-align: center; }
.header h1 { font-size: clamp(20px, 5.5vw, 28px); margin: 0; }
.stats { display: flex; gap: 12px; justify-content: center; margin: 12px 0; flex-wrap: wrap; }
.stat { background: #1e293b; padding: 8px 16px; border-radius: 10px; }
.stat b { color: #facc15; font-size: 20px; }
.actions { display: flex; gap: 10px; justify-content: center; margin-top: 8px; flex-wrap: wrap; }
.tip { color: #94a3b8; font-size: 13px; line-height: 1.6; padding: 0 4px; }
.btn { border: none; border-radius: 10px; padding: 10px 18px; font-size: 15px; min-height: 44px; }
.btn:active { transform: scale(.97); }
.btn.primary { background: #facc15; color: #111; font-weight: bold; }
.btn.primary:disabled { background: #475569; color: #cbd5e1; cursor: not-allowed; }
.btn.warn { background: #f97316; color: #fff; font-weight: bold; }
.btn.ghost { background: #1e293b; color: #e2e8f0; }
.row { display: flex; align-items: center; gap: 12px; background: #1e293b; border-radius: 14px; padding: 14px; margin-top: 12px; min-width: 0; }
.stars { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; flex: 1; min-width: 0; }
.star { width: 100%; min-width: 0; aspect-ratio: 0.9 / 1; min-height: 64px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: clamp(24px, 7vw, 38px); color: #facc15; text-shadow: 0 0 12px rgba(250,204,21,.6); cursor: pointer; background: #0f172a; border-radius: 12px; padding: 4px 2px; position: relative; overflow: visible; }
.star small { font-size: 11px; color: #94a3b8; text-shadow: none; }
.star.gray { color: #475569; text-shadow: none; filter: grayscale(1); }
.star.empty { color: #334155; cursor: default; }
.star.cell.has-bonus { border: 1px solid rgba(251,146,60,.45); }
.stack { position: relative; width: 52px; height: 44px; }
.layer { position: absolute; left: 50%; top: 50%; margin: -22px 0 0 -18px; width: 36px; height: 44px; display: flex; align-items: center; justify-content: center; color: #facc15; text-shadow: 0 0 12px rgba(250,204,21,.6); }
.layer-bonus { color: #fb923c; text-shadow: 0 0 14px rgba(251,146,60,.7); }
.star.gray .layer { color: #475569; text-shadow: none; }
.count-badge { position: absolute; top: -8px; right: -6px; min-width: 22px; height: 22px; padding: 0 5px; border-radius: 11px; background: #f97316; color: #fff; font-size: 12px; font-style: normal; font-weight: bold; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,.4); z-index: 10; }
.bonus-tag { font-style: normal; color: #fb923c; margin-left: 3px; }
.bonus-stat b { color: #fb923c !important; }
.modal-tip { color: #94a3b8; font-size: 14px; margin: 8px 0 0; }
.modal-preview { font-size: 14px; }
.modal-preview .hl { color: #facc15; font-size: 18px; }
.bonus-options { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 12px 0; }
.bonus-opt { background: #0f172a; color: #e2e8f0; border: 1px solid #334155; padding: 10px 4px; font-size: 14px; min-height: 44px; }
.bonus-opt.active { background: #f97316; border-color: #f97316; color: #fff; font-weight: bold; }
.side { width: 150px; flex-shrink: 0; text-align: center; }
.progress { color: #94a3b8; }
.badge { font-size: 13px; color: #86efac; display: inline-block; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle; }
.rewards { margin-top: 28px; }
.rewards h2 { font-size: clamp(17px, 4.5vw, 20px); margin: 0 0 4px; }
.reward-card { background: #1e293b; border-radius: 12px; padding: 12px 16px; margin-top: 8px; word-break: break-all; }
.reward-card .meta { font-size: 12px; color: #94a3b8; margin-top: 4px; }
.empty { text-align: center; color: #94a3b8; margin: 16px 0; }
.mask { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 50; }
.modal { background: #1e293b; border-radius: 14px; padding: 20px; width: 100%; max-width: 380px; max-height: calc(100dvh - 32px); overflow-y: auto; }
.modal h3 { margin: 0; font-size: clamp(16px, 4.5vw, 18px); }
.modal input { width: 100%; padding: 12px 10px; border-radius: 8px; border: 1px solid #334155; margin: 12px 0; background: #0f172a; color: #fff; font-size: 16px; }
.modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
.modal-actions .btn { flex: 1; }
@media (min-width: 641px) {
  .modal-actions .btn { flex: none; }
}

/* 手机端：≤640px */
@media (max-width: 640px) {
  .page { padding: 16px 12px calc(40px + env(safe-area-inset-bottom)); }
  .stats { gap: 8px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .stat { padding: 8px 6px; font-size: 12px; text-align: center; }
  .stat b { font-size: 17px; display: block; margin-top: 2px; }
  .bonus-options { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .actions .btn.primary { flex: 1 1 100%; }
  .actions .btn.ghost { flex: 1; }
  .tip { font-size: 12px; }
  .row { flex-direction: column; align-items: stretch; padding: 12px; gap: 10px; }
  .stars { gap: 6px; }
  .star { border-radius: 10px; min-height: 60px; }
  .star small { font-size: 10px; transform: scale(.92); }
  .side { width: 100%; }
  .side .btn.warn { width: 100%; padding: 12px; }
  .progress { display: block; text-align: center; font-size: 13px; }
  .badge { max-width: 100%; white-space: normal; display: block; line-height: 1.5; }
  .rewards { margin-top: 20px; }
}

/* 超小屏：≤360px */
@media (max-width: 360px) {
  .stars { gap: 4px; }
  .row { padding: 10px; }
  .btn { font-size: 14px; padding: 10px 14px; }
}
</style>
