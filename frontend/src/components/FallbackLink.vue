<template>
  <a
    :href="href"
    target="_blank"
    rel="noopener noreferrer"
    class="fallback-link"
    :aria-label="`${label}，在新窗口打开原站`"
  >
    {{ label }}
    <span class="icon">↗</span>
  </a>
</template>

<script setup lang="ts">
defineProps<{
  href: string;
  label?: string;
}>();
</script>

<style scoped>
.fallback-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--van-primary-color);
  font-size: 14px;
  text-decoration: none;
}
.fallback-link .icon {
  font-size: 12px;
}
</style>
