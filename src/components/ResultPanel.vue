<script setup lang="ts">
import type { Restaurant } from '../types/restaurant'
import { mapUrl } from '../utils/wheel'
import AppIcon from './AppIcon.vue'
defineProps<{ restaurant: Restaurant; confirmed: boolean; disabled: boolean }>()
defineEmits<{ confirm: []; again: [] }>()
</script>
<template>
  <section class="result-panel" data-test="result" aria-live="polite">
    <div class="result-eyebrow"><AppIcon name="check" :size="17" />{{ confirmed ? '今晚就去这家' : '好运选中了它' }}</div><h3>{{ restaurant.name }}</h3>
    <p class="result-address"><AppIcon name="pin" :size="16" />{{ restaurant.address || '地址暂无数据' }}</p>
    <dl class="result-facts"><div><dt>距离</dt><dd>{{ restaurant.distance === null ? '暂无数据' : `${Math.round(restaurant.distance)} 米` }}</dd></div><div><dt>人均</dt><dd>{{ restaurant.averagePrice === null ? '价格未知' : `¥${restaurant.averagePrice}` }}</dd></div><div><dt>评分</dt><dd>{{ restaurant.rating ?? '暂无数据' }}</dd></div></dl>
    <p class="business-hours">营业时间：{{ restaurant.businessHours || '暂无数据' }}</p><p v-if="restaurant.telephone" class="business-hours">电话：{{ restaurant.telephone }}</p>
    <div class="result-actions"><button class="button primary" data-test="confirm" :disabled="disabled || confirmed" @click="$emit('confirm')"><AppIcon name="check" :size="16" />{{ confirmed ? '已决定' : '就是这家' }}</button><button class="button outline" :disabled="disabled" @click="$emit('again')">再抽一次</button><a class="button outline" :href="mapUrl(restaurant)" target="_blank" rel="noopener noreferrer">查看地图<AppIcon name="arrow" :size="16" /></a></div>
  </section>
</template>
