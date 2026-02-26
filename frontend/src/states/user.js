import { reactive } from 'vue'
import { request } from '../utils/request'

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('userInfo') || '{}')
  } catch (e) {
    return {}
  }
}

export const userState = reactive({
  userInfo: getStoredUser(),

  setUserInfo(info) {
    this.userInfo = info
    localStorage.setItem('userInfo', JSON.stringify(info))
  },

  clearUserInfo() {
    this.userInfo = {}
    localStorage.removeItem('userInfo')
    // 关键修复：退出登录时必须清除账号列表缓存，防止敏感数据泄露给下一个用户
    localStorage.removeItem('cached_accounts')
  },

  async logout() {
    try {
      // 请求后端清除 HttpOnly Cookie
      await request('/api/oauth/logout', { method: 'POST' })
    } catch (e) {
      console.error('Logout request failed', e)
    } finally {
      // 无论后端是否成功，前端都必须清理状态并跳转
      this.clearUserInfo()
    }
  },

  async fetchUserInfo() {
    try {
      // 使用 silent: true 避免未登录时弹出 "Unauthorized" 错误提示
      // 增加时间戳参数 ?_t=... 防止 PWA Service Worker 缓存了 "已登录" 的状态，导致退出后路由守卫误判
      const data = await request(`/api/oauth/me?_t=${Date.now()}`, { silent: true })
      if (data.success) {
        this.setUserInfo(data.userInfo)
        return true
      }
    } catch (e) {
      this.clearUserInfo()
      return false
    }
  }
})