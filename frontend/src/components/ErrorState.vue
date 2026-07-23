<template>
  <div class="error-state">
    <van-empty
      :description="error?.message || '加载失败'"
    />
    <div class="actions">
      <van-button
        v-if="retryable"
        type="primary"
        size="small"
        @click="$emit('retry')"
        :loading="loading"
        :disabled="loading"
      >
        重试
      </van-button>
      <a
        v-if="fallbackUrl"
        :href="fallbackUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="fallback-link"
      >
        打开原站
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ApiError } from '../api/types';

const props = defineProps<{
  error?: ApiError;
  loading?: boolean;
}>();

defineEmits<{
  retry: [];
}>();

const retryable = computed(() => props.error?.retryable ?? false);
const fallbackUrl = computed(() => props.error?.fallbackUrl);
</script>

<style scoped>
.error-state {
  padding: 24px 16px;
  text-align: center;
}
.actions {
  margin-top: 12px;
  display: flex;
  gap: 12px;
  justify-content: center;
  align-items: center;
}
.fallback-link {
  color: var(--van-primary-color);
  font-size: 14px;
  text-decoration: none;
}
</style>
