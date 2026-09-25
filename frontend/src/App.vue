<template>
  <div class="page">
    <header class="header">
      <h1>⭐ 打卡集星星</h1>
      <div class="stats">
        <div class="stat">一共收集 <b>{{ stats.total }}</b> 颗</div>
        <div class="stat">可兑换 <b>{{ stats.available }}</b> 颗</div>
        <div class="stat">已兑换 <b>{{ stats.rewards }}</b> 次</div>
      </div>
      <div class="actions">
        <button class="btn primary" :disabled="stats.checkedToday || loading" @click="checkin">
          {{ stats.checkedToday ? '今日已打卡 ✅' : '今日打卡 +1 ⭐' }}
        </button>
        <button class="btn ghost" @click="loadAll">刷新</button>
      </div>
      <p class="tip">规则：每天打卡得 1 颗星星 · 每集齐 5 颗可在该行旁边点击「换取」输入奖励内容 · 换取后星星变灰</p>
    </header>

    <main>
      <div v-if="stars.length === 0" class="empty">还没有星星，快点击上方打卡开始收集吧～</div>

      <!-- 二维展示：每 5 个一行 -->
      <div v-for="(row, rowIndex) in rows" :key="rowIndex" class="row">
        <div class="stars">
          <div
            v-for="(s, i) in row.slots"
            :key="i"
            class="star"
            :class="{ gray: s && s.redeemed, empty: !s }"
            :title="s ? formatDate(s.acquiredAt) : '待收集'"
            @click="s && openDetail(s)"
          >
            <span v-if="s">★</span>
            <span v-else class="placeholder">☆</span>
            <small v-if="s">{{ shortDate(s.acquiredAt) }}</small>
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
            <span class="progress">{{ row.filled }}/5</span>
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

    <!-- 星星详情：日期属性查看 -->
    <div v-if="detail" class="mask" @click.self="detail = null">
      <div class="modal">
        <h3>{{ detail.redeemed ? '★ 已兑换的星星' : '⭐ 星星详情' }}</h3>
        <p>获得日期：{{ formatDate(detail.acquiredAt) }}</p>
        <p>状态：{{ detail.redeemed ? '已兑换（灰掉）' : '未兑换' }}</p>
        <p v-if="detail.redeemed">所属奖励：{{ detail.rewardContent }}</p>
        <button class="btn primary" @click="detail = null">关闭</button>
      </div>
    </div>

    <!-- 换取弹窗：输入奖励内容 -->
    <div v-if="redeemRow !== null" class="mask" @click.self="redeemRow = null">
      <div class="modal">
        <h3>换取本行 5 颗星星 🎁</h3>
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
const stats = ref({ total: 0, available: 0, redeemed: 0, rewards: 0, checkedToday: false })
const loading = ref(false)
const detail = ref(null)
const redeemRow = ref(null)
const rewardContent = ref('')

// 每 5 个切一行，补空位形成二维展示
const rows = computed(() => {
  const out = []
  for (let i = 0; i < stars.value.length; i += 5) {
    const group = stars.value.slice(i, i + 5)
    const slots = [...group]
    while (slots.length < 5) slots.push(null)
    let status = 'collecting'
    let rewardContent = ''
    if (group.length === 5) {
      if (group.every(s => s.redeemed)) {
        status = 'redeemed'
        rewardContent = group[0].rewardContent || ''
      } else if (group.every(s => !s.redeemed)) {
        status = 'redeemable'
      } else {
        // 同一行出现部分兑换（跨行自动兑换时），按已兑换处理
        status = group.some(s => s.redeemed) ? 'redeemed' : 'collecting'
        rewardContent = group.find(s => s.rewardContent)?.rewardContent || ''
      }
    }
    out.push({ slots, status, rewardContent, starIds: group.map(s => s._id), filled: group.length })
  }
  // 还没满一行时也展示一行进度（如果正好整除则加一个空行提示）
  if (stars.value.length % 5 === 0) {
    out.push({ slots: [null, null, null, null, null], status: 'collecting', rewardContent: '', starIds: [], filled: 0 })
  }
  return out
})

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
    const res = await fetch('/api/checkin', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) return alert(data.message)
    await loadAll()
  } finally {
    loading.value = false
  }
}

function openDetail(s) { detail.value = s }
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
.page { max-width: 860px; margin: 0 auto; padding: 24px 16px 60px; }
.header { text-align: center; }
.stats { display: flex; gap: 12px; justify-content: center; margin: 12px 0; flex-wrap: wrap; }
.stat { background: #1e293b; padding: 8px 16px; border-radius: 10px; }
.stat b { color: #facc15; font-size: 20px; }
.actions { display: flex; gap: 10px; justify-content: center; margin-top: 8px; }
.tip { color: #94a3b8; font-size: 13px; }
.btn { border: none; border-radius: 10px; padding: 10px 18px; font-size: 15px; }
.btn.primary { background: #facc15; color: #111; font-weight: bold; }
.btn.primary:disabled { background: #475569; color: #cbd5e1; cursor: not-allowed; }
.btn.warn { background: #f97316; color: #fff; font-weight: bold; }
.btn.ghost { background: #1e293b; color: #e2e8f0; }
.row { display: flex; align-items: center; gap: 12px; background: #1e293b; border-radius: 14px; padding: 14px; margin-top: 12px; }
.stars { display: flex; gap: 10px; flex: 1; justify-content: space-around; }
.star { width: 64px; height: 72px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 38px; color: #facc15; text-shadow: 0 0 12px rgba(250,204,21,.6); cursor: pointer; background: #0f172a; border-radius: 12px; }
.star small { font-size: 11px; color: #94a3b8; text-shadow: none; }
.star.gray { color: #475569; text-shadow: none; filter: grayscale(1); }
.star.empty { color: #334155; cursor: default; }
.side { width: 150px; text-align: center; }
.progress { color: #94a3b8; }
.badge { font-size: 13px; color: #86efac; display: inline-block; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rewards { margin-top: 28px; }
.reward-card { background: #1e293b; border-radius: 12px; padding: 12px 16px; margin-top: 8px; }
.reward-card .meta { font-size: 12px; color: #94a3b8; margin-top: 4px; }
.empty { text-align: center; color: #94a3b8; margin: 16px 0; }
.mask { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; }
.modal { background: #1e293b; border-radius: 14px; padding: 20px; width: 90%; max-width: 380px; }
.modal input { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #334155; margin: 12px 0; background: #0f172a; color: #fff; }
.modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
</style>
