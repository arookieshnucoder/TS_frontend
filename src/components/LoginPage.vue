<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import type { AuthState } from '../composables/useAuth'

const props = defineProps<{ auth: AuthState }>()
const mode = ref<'login' | 'register'>('login')
const email = ref('')
const password = ref('')
const confirmation = ref('')
const localError = ref('')
const showPassword = ref(false)
const title = computed(() => mode.value === 'login' ? '欢迎回到松间' : '从这里，开始生长')
watch(mode, () => { password.value = ''; confirmation.value = ''; localError.value = ''; props.auth.error.value = '' })
async function submit() {
  localError.value = ''
  if (mode.value === 'register' && password.value !== confirmation.value) {
    localError.value = '两次输入的密码不一致。'; return
  }
  if (await props.auth.submit(mode.value, email.value.trim(), password.value)) {
    password.value = ''; confirmation.value = ''
  }
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-story" aria-label="松间学习空间">
      <a class="auth-brand" href="/" aria-label="松间首页"><AppIcon name="leaf" /> 松间 <span>SONGJIAN</span></a>
      <div class="auth-story-copy"><p>给思考一点自己的空间</p><h1>心有一隅，<br />万物生长。</h1><span>在文字中看见世界，在推演中发现秩序。<br />让每一次好奇，都有回响。</span></div>
      <div class="auth-subjects"><span>知墨 · 语文</span><span>序理 · 数学</span><span>言境 · 英语</span></div>
      <div class="auth-orbit" aria-hidden="true"><i></i><i></i><i></i></div>
    </section>
    <section class="auth-form-panel" aria-labelledby="auth-title">
      <div class="auth-card">
        <div class="auth-eyebrow"><AppIcon name="lock" /> 统一账户 · SSO</div>
        <h2 id="auth-title">{{ title }}</h2>
        <p class="auth-description">{{ mode === 'login' ? '使用邮箱登录，继续你的探索。' : '创建一个账户，开启你的学习空间。' }}</p>
        <div class="auth-tabs" aria-label="账户操作">
          <button type="button" :aria-pressed="mode === 'login'" :disabled="auth.busy.value" @click="mode = 'login'">登录</button>
          <button type="button" :aria-pressed="mode === 'register'" :disabled="auth.busy.value" @click="mode = 'register'">注册</button>
        </div>
        <form class="auth-form" :aria-busy="auth.busy.value" @submit.prevent="submit">
          <label for="auth-email">邮箱地址</label>
          <input id="auth-email" v-model="email" name="username" type="email" autocomplete="username" placeholder="you@example.com" maxlength="64" required :disabled="auth.busy.value" />
          <label for="auth-password">密码 <span>8–128 个字符</span></label>
          <div class="auth-password-field"><input id="auth-password" v-model="password" name="password" :type="showPassword ? 'text' : 'password'" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" minlength="8" maxlength="128" required :disabled="auth.busy.value" /><button type="button" :aria-label="showPassword ? '隐藏密码' : '显示密码'" :aria-pressed="showPassword" @click="showPassword = !showPassword">{{ showPassword ? '隐藏' : '显示' }}</button></div>
          <template v-if="mode === 'register'"><label for="auth-confirmation">确认密码</label><input id="auth-confirmation" v-model="confirmation" type="password" autocomplete="new-password" minlength="8" maxlength="128" required :disabled="auth.busy.value" /></template>
          <p v-if="localError || auth.error.value" class="auth-error" role="alert">{{ localError || auth.error.value }}</p>
          <button class="auth-submit" type="submit" :disabled="auth.busy.value">{{ auth.busy.value ? '正在处理…' : mode === 'login' ? '登录松间' : '创建账户' }}<AppIcon name="arrow-up-right" /></button>
        </form>
        <p class="auth-note"><AppIcon name="leaf" /> 保持好奇，慢慢生长。</p>
      </div>
      <span class="auth-footer">松间 · 你的专属学习空间</span>
    </section>
  </main>
</template>

<style scoped>
.auth-page { min-height: 100dvh; display: grid; grid-template-columns: minmax(0, 1fr) minmax(420px, 1fr); background: #fbfaf6; color: #293e35; }
.auth-story { position: relative; overflow: hidden; min-height: 100dvh; padding: 48px clamp(32px, 6vw, 100px); display: flex; flex-direction: column; background: #e9eee4; }
.auth-brand { display: flex; align-items: center; gap: 12px; font-size: 23px; font-weight: 650; z-index: 1; }.auth-brand svg { width: 30px; height: 30px; }.auth-brand span { margin-left: 8px; font-size: 10px; letter-spacing: .22em; color: #657969; }
.auth-story-copy { margin: auto 0; padding: 80px 0; z-index: 1; }.auth-story-copy p { font-size: 12px; letter-spacing: .2em; color: #5a7160; }.auth-story-copy h1 { font: 400 clamp(40px, 4.6vw, 68px)/1.6 'STSong', 'SimSun', serif; margin: 24px 0; letter-spacing: .08em; }.auth-story-copy > span { color: #647469; font-size: 13px; line-height: 2.2; }
.auth-subjects { display: flex; gap: 24px; font-size: 11px; letter-spacing: .08em; color: #5e7463; z-index: 1; }.auth-orbit { position: absolute; right: -200px; bottom: -60px; width: 600px; height: 600px; border: 1px solid #b7c8b463; border-radius: 50%; transform: rotate(-25deg); }.auth-orbit i { position: absolute; inset: 65px; border: 1px solid #b7c8b463; border-radius: 50%; }.auth-orbit i:nth-child(2) { inset: 130px; }.auth-orbit i:nth-child(3) { inset: 195px; background: #c9d6c43d; }
.auth-form-panel { position: relative; display: grid; place-items: center; padding: 64px 36px 90px; }.auth-card { width: min(100%, 360px); }.auth-eyebrow { display: flex; align-items: center; gap: 8px; color: #748273; font-size: 11px; letter-spacing: .08em; }.auth-eyebrow svg { width: 14px; height: 14px; }h2 { font: 400 30px/1.5 'STSong', 'SimSun', serif; margin: 18px 0 8px; }.auth-description { color: #7a8378; line-height: 1.8; font-size: 12px; margin: 0 0 30px; }.auth-tabs { display: flex; border-bottom: 1px solid #e0e5da; margin-bottom: 28px; gap: 26px; }.auth-tabs button { padding: 10px 1px; border-bottom: 2px solid transparent; color: #7c8779; }.auth-tabs button[aria-pressed='true'] { color: #2c5b50; border-bottom-color: #2c5b50; }
.auth-form { display: flex; flex-direction: column; }.auth-form label { font-size: 12px; margin-bottom: 9px; }.auth-form label span { float: right; color: #859080; font-size: 11px; }.auth-form input { min-width: 0; width: 100%; border: 1px solid #dce2d6; border-radius: 8px; padding: 12px 14px; background: #fffefb; color: #293e35; margin-bottom: 23px; }.auth-form input:focus { border-color: #6d927e; outline: 2px solid #dce8dc; outline-offset: 1px; }.auth-password-field { display: flex; position: relative; }.auth-password-field input { padding-right: 58px; }.auth-password-field button { position: absolute; right: 8px; top: 4px; height: 35px; font-size: 11px; color: #63745f; }
.auth-submit { display: flex; align-items: center; justify-content: space-between; padding: 13px 16px; border-radius: 8px; background: #2c5b50; color: #fffef8; margin-top: 4px; }.auth-submit:hover { background: #386e5d; }.auth-submit svg { width: 17px; height: 17px; }.auth-error { margin: 0 0 18px; color: #a74d3c; font-size: 12px; line-height: 1.7; }.auth-note { display: flex; align-items: center; justify-content: center; gap: 7px; color: #7f8b7a; margin: 26px 0 0; font-size: 11px; }.auth-note svg { width: 13px; height: 13px; }.auth-footer { position: absolute; bottom: 30px; font-size: 10px; color: #8e9788; letter-spacing: .12em; }
@media (max-width: 760px) { .auth-page { grid-template-columns: 1fr; }.auth-story { min-height: auto; padding: 24px; }.auth-story-copy { padding: 28px 0 12px; }.auth-story-copy p, .auth-story-copy > span, .auth-subjects { display: none; }.auth-story-copy h1 { font-size: 30px; line-height: 1.4; margin: 0; }.auth-story-copy h1 br { display: none; }.auth-form-panel { padding: 36px 24px 80px; }.auth-brand { font-size: 20px; }.auth-orbit { width: 360px; height: 360px; right: -100px; bottom: -180px; } }
</style>
