<script setup lang="ts">
import { ref } from 'vue'
import AppIcon from './AppIcon.vue'
import type { SearchLocation } from '../types/restaurant'
defineProps<{ location: SearchLocation | null; busy: boolean; disabled: boolean; choices: SearchLocation[] }>()
const emit = defineEmits<{ locate: []; search: [address: string]; choose: [location: SearchLocation] }>()
const address = ref('')
</script>
<template>
  <section class="location-panel">
    <div class="section-heading"><span class="step">01</span><h2>从哪里开始？</h2></div>
    <div class="location-status"><span class="icon-tile"><AppIcon name="pin" /></span><div><strong>{{ location?.label || '先选一个出发点' }}</strong><p>{{ location ? (location.accuracy ? `定位精度约 ${Math.round(location.accuracy)} 米` : '已使用你选择的地址') : '找到身边的小店，给晚餐一点新鲜感。' }}</p></div></div>
    <button class="button primary locate-button" data-test="locate" :disabled="disabled" @click="emit('locate')"><AppIcon name="target" />{{ busy ? '正在查找附近…' : '定位附近餐厅' }}<AppIcon name="arrow" :size="17" /></button>
    <div class="or-divider"><span>或手动输入地址</span></div>
    <form class="address-form" data-test="address-form" @submit.prevent="address.trim() && emit('search', address.trim())">
      <label class="sr-only" for="address">城市、街道或地标</label><input id="address" data-test="address" v-model="address" :disabled="disabled" maxlength="200" placeholder="输入城市、街道或地标" autocomplete="off" required />
      <button type="submit" class="address-submit" :disabled="disabled || !address.trim()" aria-label="搜索地址"><AppIcon name="arrow" /></button>
    </form>
    <div v-if="choices.length > 1" class="address-choices"><p>找到多个地点，请选择：</p><button v-for="(choice, i) in choices" :key="i" :disabled="disabled" @click="emit('choose', choice)"><AppIcon name="pin" :size="16" />{{ choice.label }}</button></div>
    <p class="privacy-note"><span class="tiny-dot"></span>仅在你点击后定位，精确位置不会保存</p>
  </section>
</template>
