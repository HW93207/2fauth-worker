<template>
  <div class="tool-pane">
    <div class="qr-parser-container">
      <el-radio-group v-model="parserMode" style="margin-bottom: 20px; width: 100%; display: flex; justify-content: center;">
        <el-radio-button label="camera">摄像头扫描</el-radio-button>
        <el-radio-button label="image">图片识别</el-radio-button>
      </el-radio-group>

      <!-- Camera Mode -->
      <div v-if="parserMode === 'camera'" class="scan-area">
        <div class="video-wrapper" v-show="isScanning">
          <video ref="videoEl" playsinline muted style="width: 100%; border-radius: 8px; background: #000;"></video>
        </div>
        <div v-if="!isScanning" class="camera-placeholder" @click="toggleCamera">
          <el-icon :size="48" color="#909399"><Camera /></el-icon>
          <p>点击开启摄像头</p>
        </div>
        <el-button :type="isScanning ? 'danger' : 'primary'" @click="toggleCamera" style="margin-top: 15px; width: 100%;">
          {{ isScanning ? '停止扫描' : '开启摄像头' }}
        </el-button>
      </div>

      <!-- Image Mode -->
      <div v-else class="upload-area">
        <div class="image-preview" @click="triggerFileUpload">
          <img v-if="previewImg" :src="previewImg" class="preview-img" />
          <div v-else class="upload-placeholder">
            <el-icon :size="48"><Upload /></el-icon>
            <p>点击选择或拖拽二维码图片</p>
          </div>
        </div>
        <input type="file" ref="fileInput" accept="image/*" style="display: none" @change="handleFileChange" />
      </div>

      <!-- Result -->
      <div v-if="scanResult" class="result-section" style="margin-top: 20px;">
        <el-divider content-position="left">解析结果</el-divider>
        <el-input v-model="scanResult" type="textarea" :rows="3" readonly resize="none" />
        <el-button type="success" plain style="width: 100%; margin-top: 10px;" @click="copyResult">
          <el-icon><CopyDocument /></el-icon> 复制内容
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Camera, Upload, CopyDocument } from '@element-plus/icons-vue'
import jsQR from 'jsqr'

const parserMode = ref('camera')
const scanResult = ref('')
const isScanning = ref(false)
const videoEl = ref(null)
const fileInput = ref(null)
const previewImg = ref('')
let stream = null
let rafId = null

const toggleCamera = async () => {
  if (isScanning.value) stopCamera()
  else await startCamera()
}

const startCamera = async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    isScanning.value = true
    setTimeout(() => {
      if (videoEl.value) {
        videoEl.value.srcObject = stream
        videoEl.value.play()
        requestAnimationFrame(tick)
      }
    }, 100)
  } catch (err) { ElMessage.error('无法访问摄像头，请检查权限') }
}

const stopCamera = () => {
  isScanning.value = false
  if (stream) { stream.getTracks().forEach(track => track.stop()); stream = null }
  if (rafId) { cancelAnimationFrame(rafId); rafId = null }
}

const tick = () => {
  if (!isScanning.value || !videoEl.value) return
  if (videoEl.value.readyState === videoEl.value.HAVE_ENOUGH_DATA) {
    const canvas = document.createElement('canvas')
    canvas.width = videoEl.value.videoWidth
    canvas.height = videoEl.value.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(videoEl.value, 0, 0, canvas.width, canvas.height)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' })
    if (code) {
      scanResult.value = code.data
      ElMessage.success('二维码识别成功')
      stopCamera()
      return
    }
  }
  rafId = requestAnimationFrame(tick)
}

const triggerFileUpload = () => fileInput.value.click()
const handleFileChange = (e) => {
  const file = e.target.files[0]; if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    previewImg.value = ev.target.result
    const img = new Image(); img.onload = () => {
      const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height
      const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height)
      if (code) { scanResult.value = code.data; ElMessage.success('图片识别成功') } else { ElMessage.warning('未识别到二维码') }
    }; img.src = ev.target.result
  }; reader.readAsDataURL(file); e.target.value = ''
}

const copyResult = async () => {
  if (!scanResult.value) return
  try { await navigator.clipboard.writeText(scanResult.value); ElMessage.success('内容已复制') } catch (e) {}
}

onUnmounted(stopCamera)
</script>