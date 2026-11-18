<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { Restaurant } from '../types/restaurant'
import { nextRotation, randomIndex } from '../utils/wheel'
import AppIcon from './AppIcon.vue'
const props = defineProps<{ restaurants: Restaurant[]; disabled: boolean }>()
const emit = defineEmits<{ spinning: [value: boolean]; result: [restaurant: Restaurant] }>()
const colors = ['#edc76e', '#9bb8a3', '#eea18a', '#b6bed7', '#e5d5a7', '#8fb8b0', '#d4acc1', '#b6c48c', '#e7b88a', '#a4bdd1', '#d3c49f', '#c4b8cf']
const rotation = ref(0)
const spinning = ref(false)
let pending: Restaurant | null = null
let timer: ReturnType<typeof setTimeout> | undefined
const count = computed(() => props.restaurants.length || 8)
const sectors = computed(() => Array.from({ length: count.value }, (_, i) => {
  const start = (i / count.value) * 2 * Math.PI - Math.PI / 2
  const end = ((i + 1) / count.value) * 2 * Math.PI - Math.PI / 2
  const mid = (start + end) / 2
  return {
    path: `M160,160 L${160 + 148 * Math.cos(start)},${160 + 148 * Math.sin(start)} A148,148 0 ${count.value === 1 ? 1 : 0},1 ${160 + 148 * Math.cos(end)},${160 + 148 * Math.sin(end)} Z`,
    x: 160 + 98 * Math.cos(mid), y: 160 + 98 * Math.sin(mid), angle: mid * 180 / Math.PI + 90,
    name: props.restaurants[i]?.name ?? '',
  }
}))
watch(() => props.restaurants.map(r => r.id || r.name + r.address).join('|'), () => { if (!spinning.value) rotation.value = 0 })
function finish() {
  if (!spinning.value || !pending) return
  clearTimeout(timer)
  const result = pending
  pending = null
  spinning.value = false
  emit('spinning', false)
  emit('result', result)
}
function spin() {
  if (props.disabled || spinning.value || props.restaurants.length < 2) return
  const index = randomIndex(props.restaurants.length)
  pending = props.restaurants[index]!
  spinning.value = true
  emit('spinning', true)
  rotation.value = nextRotation(rotation.value, index, props.restaurants.length)
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  timer = setTimeout(finish, reduced ? 100 : 4900)
}
function transitionEnd(event: TransitionEvent) { if (event.target === event.currentTarget && event.propertyName === 'transform') finish() }
onBeforeUnmount(() => clearTimeout(timer))
defineExpose({ spin })
</script>
<template>
  <div class="wheel-stage" :class="{ 'wheel-empty': !restaurants.length, 'is-spinning': spinning }">
    <div class="wheel-orbit orbit-one"></div><div class="wheel-orbit orbit-two"></div>
    <span class="wheel-spark spark-one">✦</span><span class="wheel-spark spark-two">✧</span>
    <div class="wheel-pointer" aria-hidden="true"></div>
    <svg class="wheel-svg" :class="{ animated: spinning }" viewBox="0 0 320 320" :style="{ transform: `rotate(${rotation}deg)` }" role="img" :aria-label="restaurants.length ? `餐厅转盘，共 ${restaurants.length} 家候选` : '等待加入真实餐厅的空转盘'" @transitionend="transitionEnd">
      <circle cx="160" cy="160" r="158" fill="#fffdf5" stroke="#d5d8ca" stroke-width="1" />
      <circle v-if="count === 1" cx="160" cy="160" r="148" :fill="colors[0]" />
      <g v-for="(sector, index) in sectors" :key="index"><path v-if="count !== 1" :d="sector.path" :fill="colors[index % colors.length]" stroke="#fffdf5" stroke-width="1.5" /><text v-if="sector.name" :x="sector.x" :y="sector.y" :transform="`rotate(${sector.angle} ${sector.x} ${sector.y})`" text-anchor="middle" dominant-baseline="middle" :font-size="count > 8 ? 10 : 11.5" fill="#243c30" font-weight="600">{{ sector.name.length > 8 ? sector.name.slice(0, 7) + '…' : sector.name }}</text></g>
    </svg>
    <div class="wheel-hub"><AppIcon name="bowl" :size="30" /><span>好好吃饭</span></div>
  </div>
  <button class="button primary spin-button" data-test="spin" :disabled="disabled || spinning || restaurants.length < 2" @click="spin"><AppIcon name="shuffle" />{{ spinning ? '让好运转一会儿…' : '转一下，吃这家！' }}<AppIcon v-if="!spinning" name="arrow" :size="18" /></button>
  <p class="wheel-caption">{{ restaurants.length < 2 ? '加入至少 2 家真实餐厅，即可开启转盘' : `当前 ${restaurants.length} 家，每家都有相同的好运气` }}</p>
</template>
