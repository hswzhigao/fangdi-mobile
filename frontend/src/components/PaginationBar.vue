<template>
  <div v-if="totalPages > 1" class="pagination-bar" role="navigation" aria-label="分页导航">
    <van-button
      :disabled="page <= 1"
      size="small"
      :style="{ minHeight: '44px', minWidth: '44px' }"
      aria-label="上一页"
      @click="$emit('change', page - 1)"
    >
      上一页
    </van-button>
    <span class="pagination-info">{{ page }} / {{ totalPages }}</span>
    <van-button
      :disabled="page >= totalPages"
      size="small"
      :style="{ minHeight: '44px', minWidth: '44px' }"
      aria-label="下一页"
      @click="$emit('change', page + 1)"
    >
      下一页
    </van-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  page: number;
  pageSize: number;
  total?: number;
}>();

defineEmits<{
  change: [page: number];
}>();

const totalPages = computed(() => {
  if (props.total === undefined || props.total === null) return 1;
  return Math.max(1, Math.ceil(props.total / props.pageSize));
});
</script>

<style scoped>
.pagination-bar {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  padding: 16px;
}

.pagination-info {
  font-size: 14px;
  color: var(--van-text-color-2);
}
</style>
