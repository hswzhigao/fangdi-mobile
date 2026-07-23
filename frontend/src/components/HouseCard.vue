<template>
  <div
    class="house-card"
    role="article"
    :aria-label="`${house.name}${house.district ? '，' + house.district : ''}`"
    @click="$emit('click')"
  >
    <div class="house-card-header">
      <h4 class="house-card-name">{{ house.name }}</h4>
      <span v-if="house.status" class="house-card-status">{{ statusLabel }}</span>
    </div>

    <div class="house-card-meta">
      <span v-if="house.district" class="meta-item">
        <van-icon name="location-o" size="14" />
        {{ house.district }}
      </span>
      <span v-if="house.area !== undefined && house.area !== null" class="meta-item">
        {{ house.area }}㎡
      </span>
      <span v-if="house.rooms !== undefined && house.rooms !== null" class="meta-item">
        {{ house.rooms }}室
      </span>
    </div>

    <div class="house-card-footer">
      <span v-if="house.updatedAt" class="meta-updated">
        更新于 {{ house.updatedAt }}
      </span>
      <van-icon name="arrow" size="14" class="arrow-icon" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { HouseSummary } from '../api/types';

const props = defineProps<{
  house: HouseSummary & { rooms?: number; updatedAt?: string };
}>();

defineEmits<{
  click: [];
}>();

const STATUS_LABELS: Record<string, string> = {
  available: '可售',
  sold: '已售',
};

const statusLabel = computed(() => {
  if (!props.house.status) return '';
  return STATUS_LABELS[props.house.status] || props.house.status;
});
</script>

<style scoped>
.house-card {
  padding: 14px 16px;
  background: var(--van-background);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
  margin-bottom: 8px;
}

.house-card:active {
  background: var(--van-background-2);
}

.house-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.house-card-name {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--van-text-color);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.house-card-status {
  font-size: 12px;
  color: var(--van-primary-color);
  padding: 2px 8px;
  background: var(--van-primary-color-light, #e8f4ff);
  border-radius: 4px;
  flex-shrink: 0;
  margin-left: 8px;
}

.house-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--van-text-color-2);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.house-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.meta-updated {
  font-size: 11px;
  color: var(--van-text-color-3);
}

.arrow-icon {
  color: var(--van-text-color-3);
}
</style>
