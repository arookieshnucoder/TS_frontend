<script setup lang="ts">
import { onBeforeUnmount, onMounted, provide } from 'vue'
import App from './App.vue'
import LoginPage from './components/LoginPage.vue'
import { authKey, useAuth } from './composables/useAuth'

const enabled = import.meta.env.VITE_AUTH_ENABLED !== 'false'
const auth = useAuth()
if (enabled) provide(authKey, auth)
onMounted(() => {
  if (enabled) {
    window.addEventListener('songjian-auth-required', auth.expire)
    void auth.initialize()
  }
})
onBeforeUnmount(() => window.removeEventListener('songjian-auth-required', auth.expire))
</script>

<template>
  <App v-if="!enabled || (auth.ready.value && auth.user.value)" :key="auth.user.value?.userId" />
  <main v-else-if="!auth.ready.value" class="auth-loading" role="status">正在连接登录服务…</main>
  <LoginPage v-else :auth="auth" />
</template>

<style>
.auth-loading { min-height: 100dvh; display: grid; place-items: center; color: #526358; background: #f7f5ef; }
</style>
