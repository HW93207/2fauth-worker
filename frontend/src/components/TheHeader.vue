<template>
  <header class="header">
    <div class="logo">
      <el-button v-if="layoutState.isMobile && route.path !== '/login'" link @click="layoutState.showMobileMenu = true" style="margin-right: 5px; padding: 0;">
        <el-icon :size="24" class="menu-icon"><Menu /></el-icon>
      </el-button>
      <el-icon :size="24" color="#409EFC" style="margin-right: 10px;"><Lock /></el-icon>
      <h2>2FAuth</h2>
    </div>
    <div class="user-actions" v-if="route.path !== '/login'">
      <div class="user-profile" v-if="!layoutState.isMobile">
        <el-avatar :size="32" :src="userState.userInfo?.avatar">
          {{ userState.userInfo?.username?.charAt(0)?.toUpperCase() }}
        </el-avatar>
        <span class="username">{{ userState.userInfo?.username }}</span>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { Lock, Menu } from '@element-plus/icons-vue'
import { layoutState } from '../states/layout'
import { userState } from '../states/user'

const route = useRoute()
</script>