<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import type { SearchLocation } from '../types/restaurant'
const props = defineProps<{
  location: SearchLocation | null; radius: number; progress: string; locating: boolean
  disabled: boolean; choices: SearchLocation[]; error: string; diagnostic: string
}>()
const emit = defineEmits<{ locate: []; cancel: []; dismiss: []; search: [address: string]; choose: [location: SearchLocation] }>()
const address = ref('')
const diagnosticText = ref<HTMLTextAreaElement | null>(null)
const copyStatus = ref('')
watch(() => props.error, () => { copyStatus.value = '' })
const accuracyNote = computed(() => {
  if (!props.location) return '找到身边的小店，给晚餐一点新鲜感。'
  const accuracy = props.location.accuracy
  if (accuracy === undefined) return props.location.label === '当前位置' ? '设备未提供定位精度' : '已使用你选择的地址'
  const note = `定位精度约 ${Math.round(accuracy)} 米`
  return accuracy > props.radius ? note + '，超出搜索半径。输入附近地标可缩小误差。' : note
})
async function copyDiagnostic() {
  try {
    await navigator.clipboard.writeText(props.diagnostic)
    copyStatus.value = '诊断信息已复制'
  } catch {
    diagnosticText.value?.focus()
    diagnosticText.value?.select()
    copyStatus.value = '请复制选中的诊断信息'
  }
}
</script>
<template>
  <section class="location-panel">
    <div class="section-heading"><span class="step">01</span><h2>从哪里开始？</h2></div>
    <div class="location-status"><span class="icon-tile"><AppIcon name="pin" /></span><div><strong>{{ location?.label || '先选一个出发点' }}</strong><p>{{ accuracyNote }}</p></div></div>
    <button class="button primary locate-button" data-test="locate" :disabled="disabled" @click="emit('locate')"><AppIcon name="target" />{{ progress || '定位附近餐厅' }}<AppIcon name="arrow" :size="17" /></button>
    <button v-if="locating" class="text-button cancel-location" data-test="cancel-location" @click="emit('cancel')">取消定位</button>
    <div v-if="error" class="message error">
      <div class="location-error"><p role="alert">{{ error }}</p>
        <details v-if="diagnostic"><summary>查看诊断信息</summary>
          <textarea ref="diagnosticText" :value="diagnostic" rows="2" aria-label="脱敏诊断信息" readonly></textarea>
          <button class="text-button" @click="copyDiagnostic">复制诊断信息</button>
          <p role="status">{{ copyStatus }}</p>
        </details>
      </div>
      <button aria-label="关闭错误提示" @click="emit('dismiss')"><AppIcon name="close" :size="17" /></button>
    </div>
    <div class="or-divider"><span>或手动输入地址</span></div>
    <form class="address-form" data-test="address-form" @submit.prevent="address.trim() && emit('search', address.trim())">
      <label class="sr-only" for="address">城市、街道或地标</label><input id="address" data-test="address" v-model="address" :disabled="disabled" maxlength="200" placeholder="输入城市、街道或地标" autocomplete="off" required />
      <button type="submit" class="address-submit" :disabled="disabled || !address.trim()" aria-label="搜索地址"><AppIcon name="arrow" /></button>
    </form>
    <div v-if="choices.length > 1" class="address-choices"><p>找到多个地点，请选择：</p><button v-for="(choice, i) in choices" :key="i" :disabled="disabled" @click="emit('choose', choice)"><AppIcon name="pin" :size="16" />{{ choice.label }}</button></div>
    <p class="privacy-note"><span class="tiny-dot"></span>仅在你点击后定位，精确位置不会保存</p>
  </section>
</template>
<style scoped>
.cancel-location { margin-top: 8px; min-height: 36px; }
.location-error { min-width: 0; flex: 1; }
details { margin-top: 8px; }
summary { cursor: pointer; }
textarea { display: block; width: 100%; margin-top: 6px; font: inherit; }
</style>
