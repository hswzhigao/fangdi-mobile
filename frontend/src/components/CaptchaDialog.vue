<template>
  <van-popup
    v-model:show="visibleProxy"
    position="bottom"
    :close-on-click-overlay="!submitting"
    :style="{ maxHeight: '80vh', height: 'auto', borderRadius: '12px 12px 0 0' }"
    :aria-label="dialogTitle"
    class="captcha-dialog"
  >
    <div class="captcha-content">
      <!-- Title -->
      <div class="captcha-header">
        <h3 class="captcha-title">{{ dialogTitle }}</h3>
        <p v-if="reason" class="captcha-reason">{{ reason }}</p>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="captcha-loading">
        <van-loading size="24" />
        <span>正在加载验证码...</span>
      </div>

      <!-- Image + input area -->
      <div v-else>
        <!-- CAPTCHA image -->
        <div class="captcha-image-section">
          <img
            v-if="image"
            :src="image"
            alt="验证码图片"
            class="captcha-image"
            @error="onImageError"
          />
          <div v-else class="captcha-image-placeholder">
            验证码图片加载失败
          </div>
          <button
            class="captcha-refresh-btn"
            :disabled="loading || submitting"
            @click="$emit('refresh')"
            type="button"
          >
            换一张
          </button>
        </div>

        <!-- Error message -->
        <div v-if="errorCode || errorMessage" class="captcha-error" role="alert">
          <span v-if="errorCode === 'CAPTCHA_INVALID'">验证码错误，请重新输入</span>
          <span v-else-if="errorCode === 'CAPTCHA_EXPIRED'">验证码已过期，请刷新后重新输入</span>
          <span v-else-if="errorCode === 'UPSTREAM_BLOCKED'">原站正在进行访问验证，移动版无法代替验证</span>
          <span v-else>{{ errorMessage }}</span>
        </div>

        <!-- Text input -->
        <van-field
          v-model="inputText"
          label="验证码"
          placeholder="请输入验证码"
          :maxlength="12"
          clearable
          :error="!!errorCode"
          :error-message="errorCode ? undefined : undefined"
          :disabled="submitting"
          @update:model-value="onInputChange"
          class="captcha-input"
        >
          <template #label>
            <span class="captcha-input-label" aria-label="验证码输入框">验证码</span>
          </template>
        </van-field>

        <!-- Actions -->
        <div class="captcha-actions">
          <van-button
            type="primary"
            block
            :loading="submitting"
            :disabled="!canSubmit || submitting"
            @click="onSubmit"
            native-type="button"
            class="captcha-submit-btn"
            :style="{ minHeight: '44px' }"
          >
            {{ submitting ? '验证中...' : '提交验证' }}
          </van-button>
        </div>
      </div>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { ApiErrorCode } from '../api/types';

// ── Props ───────────────────────────────────────────────────────────────────

const props = defineProps<{
  purpose: 'new-house' | 'old-house';
  visible: boolean;
  image?: string;
  sessionId?: string;
  loading?: boolean;
  submitting?: boolean;
  errorCode?: ApiErrorCode;
  errorMessage?: string;
}>();

// ── Emits ───────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  submit: [sessionId: string, text: string];
  refresh: [];
  close: [];
}>();

// ── Internal state ──────────────────────────────────────────────────────────

const inputText = ref('');

const visibleProxy = computed({
  get: () => props.visible,
  set: (val) => {
    if (!val && !props.submitting) {
      emit('close');
    }
  },
});

const dialogTitle = computed(() =>
  props.purpose === 'new-house' ? '新房查询验证' : '二手房查询验证',
);

const reason = computed(() => {
  if (props.errorCode === 'CAPTCHA_REQUIRED') return '当前查询需要输入验证码';
  if (props.errorCode === 'CAPTCHA_EXPIRED') return '验证码已过期，请重新获取';
  if (props.errorCode === 'CAPTCHA_INVALID') return '验证码输入错误，请重试';
  return undefined;
});

const canSubmit = computed(() => {
  const text = inputText.value.trim();
  return text.length >= 2 && text.length <= 12 && !!props.sessionId && !props.submitting;
});

// ── Watch: clear input when image/session changes (refresh) ─────────────────

watch(
  () => props.sessionId,
  () => {
    inputText.value = '';
  },
);

watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      inputText.value = '';
    }
  },
);

// ── Handlers ────────────────────────────────────────────────────────────────

function onInputChange() {
  // Error clears on input change (parent handles errorCode reset)
}

function onSubmit() {
  if (!canSubmit.value || !props.sessionId) return;
  const text = inputText.value.trim();
  if (!text) return;
  emit('submit', props.sessionId, text);
}

function onImageError() {
  // Image failed to load; user can refresh
}
</script>

<style scoped>
.captcha-dialog {
  font-family: inherit;
}

.captcha-content {
  padding: 20px 16px 24px;
}

.captcha-header {
  margin-bottom: 16px;
}

.captcha-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--van-text-color);
}

.captcha-reason {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--van-text-color-2);
}

.captcha-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px 0;
  color: var(--van-text-color-2);
  font-size: 14px;
}

.captcha-image-section {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.captcha-image {
  flex: 1;
  max-width: 200px;
  height: 60px;
  border: 1px solid var(--van-border-color);
  border-radius: 4px;
  object-fit: contain;
  background: var(--van-background);
}

.captcha-image-placeholder {
  flex: 1;
  max-width: 200px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--van-border-color);
  border-radius: 4px;
  background: var(--van-background-2);
  color: var(--van-text-color-3);
  font-size: 13px;
}

.captcha-refresh-btn {
  min-height: 44px;
  padding: 6px 14px;
  border: 1px solid var(--van-border-color);
  border-radius: 6px;
  background: var(--van-background);
  color: var(--van-primary-color);
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}

.captcha-refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.captcha-refresh-btn:active {
  background: var(--van-background-2);
}

.captcha-error {
  margin-bottom: 8px;
  padding: 8px 12px;
  background: var(--van-danger-color, #ee0a24);
  color: #fff;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.5;
}

.captcha-input {
  margin-bottom: 8px;
}

.captcha-input-label {
  font-size: 14px;
}

.captcha-actions {
  margin-top: 12px;
}

.captcha-submit-btn {
  min-height: 44px;
}
</style>
