import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './main.css'
import './dark.css'
import App from './App.vue'
import router from './router'
import { initTheme } from './states/theme'

const app = createApp(App)

// 初始化主题状态 (从 localStorage 恢复)
initTheme()

app.use(router)
app.use(ElementPlus)
app.mount('#app')