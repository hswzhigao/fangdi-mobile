<template>
  <div class="empty-state">
    <van-empty :description="message || '暂无可展示数据'" />
    <div class="actions" v-if="fallbackUrl">
      <a :href="fallbackUrl" target="_blank" rel="noopener noreferrer">打开原站查看</a>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  message?: string;
  fallbackUrl?: string;
}>();
</script>

<style scoped>
.empty-state {
  padding: 24px 16px;
  text-align: center;
}
.actions {
  margin-top: 12px;
}
.actions a {
  color: var(--van-primary-color);
  font-size: 14px;
  text-decoration: none;
}
</style>
