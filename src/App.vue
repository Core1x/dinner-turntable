<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import AppIcon from './components/AppIcon.vue'
import LocationSelector from './components/LocationSelector.vue'
import SearchFilters from './components/SearchFilters.vue'
import RestaurantCard from './components/RestaurantCard.vue'
import RestaurantWheel from './components/RestaurantWheel.vue'
import ResultPanel from './components/ResultPanel.vue'
import { geocodeAddress, searchRestaurants } from './services/restaurant'
import { locate } from './services/location'
import { QueryError } from './types/query'
import { clearHistory, readHistory, saveHistory } from './services/history'
import { dedupeRestaurants, filterRestaurants } from './utils/filter'
import type { Category, Restaurant, SearchLocation } from './types/restaurant'

const location = ref<SearchLocation | null>(null)
const choices = ref<SearchLocation[]>([])
const restaurants = ref<Restaurant[]>([])
const radius = ref(1000)
const loadedRadius = ref(1000)
const category = ref<Category>('all')
const budget = ref<number | null>(null)
const limit = ref(8)
const selectedKeys = ref<string[]>([])
type Stage = 'locating' | 'address' | 'nearby'
const stage = ref<Stage | null>(null)
const busy = computed(() => stage.value !== null)
const stageLabels = { locating: '正在获取设备位置…', address: '正在查询地址…', nearby: '正在查询附近餐厅…' }
const progress = computed(() => stage.value ? stageLabels[stage.value] : '')
let locationController: AbortController | undefined
const spinning = ref(false)
const cooldown = ref(false)
const error = ref('')
const diagnostic = ref('')
const notice = ref('')
const searched = ref(false)
const truncated = ref(false)
const result = ref<Restaurant | null>(null)
const confirmed = ref(false)
const history = ref(readHistory())
const historyOpen = ref(false)
const wheel = ref<InstanceType<typeof RestaurantWheel> | null>(null)
let cooldownTimer: ReturnType<typeof setTimeout> | undefined
const locked = computed(() => busy.value || spinning.value)
const queryDisabled = computed(() => locked.value || cooldown.value)
const dirty = computed(() => searched.value && radius.value !== loadedRadius.value)
const filtered = computed(() => filterRestaurants(restaurants.value, category.value, budget.value, radius.value))
const keyOf = (row: Restaurant) => row.id || `${row.name}\u001f${row.address}`
const candidates = computed(() => filtered.value.filter(row => selectedKeys.value.includes(keyOf(row))))
const colors = ['#edc76e', '#9bb8a3', '#eea18a', '#b6bed7', '#e5d5a7', '#8fb8b0', '#d4acc1', '#b6c48c', '#e7b88a', '#a4bdd1', '#d3c49f', '#c4b8cf']
watch([filtered, limit], () => {
  selectedKeys.value = filtered.value.slice(0, limit.value).map(keyOf)
  result.value = null
  confirmed.value = false
})
function coolDown() {
  cooldown.value = true
  clearTimeout(cooldownTimer)
  cooldownTimer = setTimeout(() => { cooldown.value = false }, 2000)
}
onBeforeUnmount(() => {
  locationController?.abort()
  clearTimeout(cooldownTimer)
})
async function fetchNearby(point: SearchLocation) {
  stage.value = 'nearby'
  location.value = point
  restaurants.value = []
  result.value = null
  searched.value = false
  const response = await searchRestaurants(point, radius.value)
  restaurants.value = dedupeRestaurants(response.restaurants)
  location.value = { ...point, ...response.center }
  loadedRadius.value = radius.value
  truncated.value = response.truncated
  searched.value = true
}
async function query(initialStage: Stage, action: () => Promise<void>) {
  if (queryDisabled.value) return
  stage.value = initialStage
  error.value = ''
  diagnostic.value = ''
  notice.value = ''
  try { await action() } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '查询失败，请稍后重试。'
    if (cause instanceof QueryError) diagnostic.value = cause.diagnostic
  } finally {
    if (stage.value !== 'locating') coolDown()
    stage.value = null
  }
}
function locateNearby() {
  void query('locating', async () => {
    choices.value = []
    const controller = new AbortController()
    locationController = controller
    let point: SearchLocation
    try { point = await locate(controller.signal) }
    catch (cause) {
      if (controller.signal.aborted) return
      throw cause
    }
    finally { locationController = undefined }
    if (!controller.signal.aborted) await fetchNearby(point)
  })
}
function searchAddress(address: string) {
  void query('address', async () => {
    choices.value = []
    const response = await geocodeAddress(address)
    choices.value = response.locations
    if (response.locations.length === 1) { await fetchNearby(response.locations[0]!); choices.value = [] }
    else if (!response.locations.length) notice.value = '没有找到这个地址，请补充城市、街道或地标后重试。'
    else notice.value = '找到多个地址，请选择你想出发的地点。'
  })
}
function chooseLocation(point: SearchLocation) { void query('nearby', async () => { choices.value = []; await fetchNearby(point) }) }
function refresh() { if (location.value) void query('nearby', () => fetchNearby(location.value!)) }
function toggle(row: Restaurant) {
  if (locked.value) return
  const key = keyOf(row)
  if (selectedKeys.value.includes(key)) selectedKeys.value = selectedKeys.value.filter(value => value !== key)
  else if (selectedKeys.value.length < limit.value) selectedKeys.value = [...selectedKeys.value, key]
  else { notice.value = `转盘最多放入 ${limit.value} 家，请先移除一家或调整候选数量。`; return }
  result.value = null
  confirmed.value = false
}
function shuffleCandidates() {
  if (locked.value) return
  const pool = [...filtered.value]
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j]!, pool[i]!] }
  selectedKeys.value = pool.slice(0, limit.value).map(keyOf)
  result.value = null
  confirmed.value = false
}
function showResult(row: Restaurant) {
  result.value = row
  confirmed.value = false
  const saved = saveHistory(row, history.value)
  history.value = saved.entries
  if (!saved.saved) notice.value = '本次结果已抽出，但浏览器未允许保存历史记录。'
}
function removeHistory() {
  const cleared = clearHistory()
  if (cleared) history.value = []
  else notice.value = '浏览器未允许清除存储，请在浏览器设置中清除站点数据。'
}
function historyDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }
</script>

<template>
  <div class="app-shell">
    <header class="site-header"><a class="brand" href="/" aria-label="今晚吃什么首页"><span class="brand-icon"><AppIcon name="bowl" :size="24" /></span><span>今晚吃什么<span class="brand-en">DINNER WHEEL</span></span></a><button class="history-button" :aria-expanded="historyOpen" aria-controls="history-panel" @click="historyOpen = !historyOpen"><AppIcon name="history" :size="19" /><span>吃饭足迹</span><span v-if="history.length" class="history-count">{{ history.length }}</span></button></header>
    <main>
      <section class="intro"><div class="eyebrow"><span></span>一日三餐，偶尔随缘</div><h1>把纠结留给转盘，<br class="mobile-br" /><span>把好胃口留给今晚。</span></h1><p>发现附近真实餐厅，转一下，遇见今天的那一口。</p></section>
      <div class="workspace">
        <aside class="setup-column">
          <LocationSelector :location="location" :radius="radius" :progress="progress" :locating="stage === 'locating'"
            :disabled="queryDisabled" :choices="choices" :error="error" :diagnostic="diagnostic"
            @locate="locateNearby" @cancel="locationController?.abort()" @dismiss="error = ''"
            @search="searchAddress" @choose="chooseLocation" />
          <div class="panel-divider"></div><SearchFilters v-model:radius="radius" v-model:category="category" v-model:budget="budget" :disabled="locked" :can-refresh="!!location && !cooldown" :dirty="dirty" @refresh="refresh" />
        </aside>
        <section class="wheel-column"><div class="wheel-heading"><span class="little-label">TODAY'S LITTLE ADVENTURE</span><span class="equal-badge"><span class="tiny-dot"></span>公平随缘</span></div><div class="wheel-title"><h2>{{ spinning ? '美味正在靠近' : result ? '今晚，有着落了' : '今天的美味，由它决定' }}</h2><p>{{ spinning ? '指针停下的地方，就是今晚的目的地。' : '不用再说“随便”，让选择变得简单一点。' }}</p></div><RestaurantWheel ref="wheel" :restaurants="candidates" :disabled="busy || dirty" @spinning="spinning = $event" @result="showResult" /><div class="wheel-bottom"><span>真实餐厅</span><i>✦</i><span>等概率抽取</span><i>✦</i><span>好好吃饭</span></div></section>
      </div>
      <div v-if="notice" class="message notice" role="status"><AppIcon name="info" :size="19" /><span>{{ notice }}</span><button aria-label="关闭提示" @click="notice = ''"><AppIcon name="close" :size="17" /></button></div>
      <ResultPanel v-if="result && !spinning" :restaurant="result" :confirmed="confirmed" :disabled="locked || dirty" @confirm="confirmed = true" @again="wheel?.spin()" />
      <section class="candidates-panel" :aria-busy="busy"><div class="candidates-heading"><div><div class="section-heading"><span class="step">03</span><h2>今晚的候选名单</h2><span class="count-badge">{{ filtered.length }}</span></div><p>{{ searched ? `已找到 ${restaurants.length} 家真实餐厅，筛选后 ${filtered.length} 家；${candidates.length} 家已加入转盘。` : '先找到附近的餐厅，再把心动的小店放进转盘。' }}</p></div><div class="candidate-tools"><label for="candidate-count">转盘席位 <select id="candidate-count" v-model.number="limit" :disabled="locked"><option v-for="n in 11" :key="n" :value="n + 1">{{ n + 1 }} 家</option></select></label><button class="text-button" :disabled="locked || filtered.length < 2" @click="shuffleCandidates"><AppIcon name="shuffle" :size="16" />换一组</button></div></div>
        <div v-if="busy" class="empty-state" role="status"><span class="loading-ring"></span><h3>{{ progress }}</h3></div>
        <div v-else-if="!filtered.length" class="empty-state"><span class="empty-icon"><AppIcon :name="searched ? 'bowl' : 'pin'" :size="29" /></span><h3>{{ searched ? '暂时没有符合条件的餐厅' : '好吃的，就在你附近' }}</h3><p>{{ searched ? '试试放宽预算、切换类别，或扩大范围后更新餐厅。' : '点击“定位附近餐厅”，或输入一个熟悉的地址。' }}</p><button v-if="searched && radius < 3000" class="text-button" :disabled="locked" @click="radius = radius === 500 ? 1000 : radius === 1000 ? 2000 : 3000">扩大搜索范围<AppIcon name="arrow" :size="16" /></button></div>
        <div v-else class="restaurant-grid"><RestaurantCard v-for="row in filtered" :key="keyOf(row)" :restaurant="row" :selected="selectedKeys.includes(keyOf(row))" :disabled="locked" :color="colors[Math.max(0, candidates.findIndex(item => keyOf(item) === keyOf(row))) % colors.length]!" @toggle="toggle(row)" /></div>
        <p v-if="searched" class="data-note">数据来自高德地图 · 最多获取附近最近 50 条{{ truncated ? '，可能还有更多结果，可缩小半径' : '' }} · 商家信息与实际情况可能有差异</p>
      </section>
      <section v-if="historyOpen" id="history-panel" class="history-panel"><div class="section-heading"><AppIcon name="history" /><h2>吃饭足迹</h2><button class="text-button clear-history" :disabled="!history.length" @click="removeHistory">清除记录</button></div><p v-if="!history.length" class="history-empty">还没有抽取记录，下一餐从这里开始。</p><ol v-else><li v-for="(entry, index) in history" :key="entry.drawnAt + index"><div><strong>{{ entry.name }}</strong><p>{{ entry.address || '地址暂无数据' }}</p></div><time :datetime="entry.drawnAt">{{ historyDate(entry.drawnAt) }}</time></li></ol><p class="data-note">仅保存在当前浏览器，不保存定位坐标。</p></section>
    </main>
    <footer><span class="footer-brand"><AppIcon name="bowl" :size="16" />少一点纠结，多一点好好吃饭。</span><span>MADE FOR YOUR NEXT GOOD MEAL</span></footer>
  </div>
</template>

