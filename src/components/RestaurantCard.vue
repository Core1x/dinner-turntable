<script setup lang="ts">
import type { Restaurant } from '../types/restaurant'
defineProps<{ restaurant: Restaurant; selected: boolean; disabled: boolean; color: string }>()
defineEmits<{ toggle: [] }>()
</script>
<template>
  <label class="restaurant-card" :class="{ selected, disabled }" data-test="restaurant">
    <input type="checkbox" :checked="selected" :disabled="disabled" @change="$emit('toggle')" :aria-label="`${selected ? '移出' : '加入'}转盘：${restaurant.name}`" />
    <span class="restaurant-swatch" :style="{ background: selected ? color : '#e9eae4' }"></span>
    <span class="restaurant-copy"><strong>{{ restaurant.name }}</strong><span class="restaurant-meta">{{ restaurant.categoryLabel }}<i>·</i>{{ restaurant.distance === null ? '距离暂无数据' : restaurant.distance < 1000 ? `${Math.round(restaurant.distance)} m` : `${(restaurant.distance / 1000).toFixed(1)} km` }}<i>·</i>{{ restaurant.averagePrice === null ? '价格未知' : `¥${restaurant.averagePrice}/人` }}</span><span class="restaurant-address">{{ restaurant.address || '地址暂无数据' }}</span></span>
    <span class="selection-check" aria-hidden="true">{{ selected ? '✓' : '+' }}</span>
  </label>
</template>
