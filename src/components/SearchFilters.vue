<script setup lang="ts">
import AppIcon from './AppIcon.vue'
import type { Category } from '../types/restaurant'
defineProps<{ radius: number; category: Category; budget: number | null; disabled: boolean; canRefresh: boolean; dirty: boolean }>()
const emit = defineEmits<{ 'update:radius': [value: number]; 'update:category': [value: Category]; 'update:budget': [value: number | null]; refresh: [] }>()
const categories: { value: Category; label: string }[] = [{ value: 'all', label: '全部' }, { value: 'chinese', label: '中餐' }, { value: 'fastfood', label: '快餐' }, { value: 'noodles', label: '面食' }, { value: 'other', label: '其他' }]
</script>
<template>
  <section class="filters-panel">
    <div class="section-heading"><span class="step">02</span><h2>想吃点什么？</h2></div>
    <div class="filter-row"><label for="radius">搜索范围</label><select id="radius" :value="radius" :disabled="disabled" @change="emit('update:radius', Number(($event.target as HTMLSelectElement).value))"><option :value="500">500 米以内</option><option :value="1000">1 公里以内</option><option :value="2000">2 公里以内</option><option :value="3000">3 公里以内</option></select></div>
    <div class="filter-row"><label for="budget">人均预算</label><select id="budget" data-test="budget" :value="budget ?? ''" :disabled="disabled" @change="emit('update:budget', ($event.target as HTMLSelectElement).value === '' ? null : Number(($event.target as HTMLSelectElement).value))"><option value="">不限预算</option><option value="25">¥25 以内</option><option value="40">¥40 以内</option><option value="60">¥60 以内</option></select></div>
    <div class="category-label">餐饮类别</div><div class="category-options"><button v-for="item in categories" :key="item.value" :class="{ active: category === item.value }" :aria-pressed="category === item.value" :disabled="disabled" @click="emit('update:category', item.value)">{{ item.label }}</button></div>
    <p v-if="budget !== null" class="filter-note">价格未知的餐厅不纳入当前预算筛选。</p>
    <button class="button outline refresh-button" :disabled="!canRefresh || disabled" @click="emit('refresh')"><AppIcon name="refresh" :size="16" />{{ dirty ? '范围已调整，更新餐厅' : '更新附近餐厅' }}</button>
  </section>
</template>
