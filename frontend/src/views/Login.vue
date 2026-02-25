<template>
  <div class="login-container">
    <el-card class="login-card" shadow="hover">
      <div class="logo-container">
        <el-icon :size="54" color="#409EFC"><Lock /></el-icon>
        <h2>2FAuth</h2>
        <p class="subtitle">您的专属云端双因素认证管家</p>
      </div>

      <div class="action-container">
        <el-button
          v-for="provider in providers"
          :key="provider.id"
          type="primary"
          size="large"
          class="oauth-btn"
          :style="{ backgroundColor: provider.color, borderColor: provider.color }"
          :loading="loading"
          @click="handleLogin(provider.id)"
        >
          <template #icon>
            <el-icon v-if="provider.icon"><span v-html="provider.icon" style="display: flex;"></span></el-icon>
            <el-icon v-else><Platform /></el-icon>
          </template>
          通过 {{ provider.name }} 授权登录
        </el-button>
      </div>

      <div class="footer-tips">
        <el-alert
          title="安全隐私提示"
          type="info"
          description="系统基于 OAuth 2.0 协议验证身份，绝不会获取、记录或传输您的 GitHub 密码信息。"
          show-icon
          :closable="false"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Lock, Platform } from '@element-plus/icons-vue'

const loading = ref(false)
const providers = ref([])

onMounted(async () => {
  try {
    const res = await fetch('/api/oauth/providers')
    const data = await res.json()
    if (data.success) {
      providers.value = data.providers
    }
  } catch (e) {
    console.error('Failed to load providers', e)
  }
})

const handleLogin = async (providerId) => {
  loading.value = true
  try {
    // 1. 获取授权链接
    const response = await fetch(`/api/oauth/authorize/${providerId}`)
    const data = await response.json()

    if (data.success && data.authUrl) {
      // 2. 存储 state 防御 CSRF 并跳转
      localStorage.setItem('oauth_state', data.state)
      localStorage.setItem('oauth_provider', providerId)
      // 如果有 PKCE verifier，也存起来
      if (data.codeVerifier) {
        localStorage.setItem('oauth_code_verifier', data.codeVerifier)
      }
      window.location.href = data.authUrl
    } else {
      ElMessage.error(data.error || '获取授权链接失败')
      loading.value = false
    }
  } catch (error) {
    console.error('Login error:', error)
    ElMessage.error('网络请求失败，请检查后端 API 是否正常运行')
    loading.value = false
  }
}
</script>