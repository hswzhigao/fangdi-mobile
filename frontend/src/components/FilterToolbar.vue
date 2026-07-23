<template>
  <div class="filter-toolbar">
    <!-- Active filter chips -->
    <div v-if="chips.length > 0" class="filter-chips" role="list" aria-label="当前筛选条件">
      <van-tag
        v-for="chip in chips"
        :key="chip.key"
        closeable
        size="medium"
        type="primary"
        @close="$emit('removeChip', chip.key)"
      >
        {{ chip.label }}
      </van-tag>
    </div>

    <div class="filter-toolbar-actions">
      <van-button
        icon="filter-o"
        size="small"
        type="default"
        :style="{ minHeight: '44px' }"
        aria-label="打开筛选面板"
        @click="$emit('openFilter')"
      >
        筛选
      </van-button>
      <van-button
        v-if="hasFilters"
        icon="replay"
        size="small"
        type="default"
        :style="{ minHeight: '44px' }"
        aria-label="重置筛选"
        @click="$emit('reset')"
      >
        重置
      </van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { PROPERTY_TYPES, HOUSE_STATUSES } from '../api/types';
import type { NewHouseFilter, OldHouseFilter } from '../api/types';

const props = defineProps<{
  filter: NewHouseFilter | OldHouseFilter;
}>();

defineEmits<{
  openFilter: [];
  reset: [];
  removeChip: [key: string];
}>();

// ── Chip data (label + key) ─────────────────────────────────────────────────

interface ChipItem {
  key: string;
  label: string;
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  residential: '住宅',
  office: '办公',
  commercial: '商业',
  other: '其他',
};

const STATUS_LABELS: Record<string, string> = {
  available: '可售',
  sold: '已售',
  all: '全部',
};

const chips = computed<ChipItem[]>(() => {
  const items: ChipItem[] = [];
  const f = props.filter as unknown as Record<string, unknown>;

  if (f.district) {
    items.push({ key: 'district', label: `区域: ${f.district}` });
  }
  if (f.propertyType) {
    const label = PROPERTY_TYPE_LABELS[f.propertyType as string] || (f.propertyType as string);
    items.push({ key: 'propertyType', label: `类型: ${label}` });
  }
  if (f.status) {
    const label = STATUS_LABELS[f.status as string] || (f.status as string);
    items.push({ key: 'status', label: `状态: ${label}` });
  }
  if (f.minArea !== undefined && f.minArea !== null) {
    items.push({ key: 'minArea', label: `最小面积: ${f.minArea}㎡` });
  }
  if (f.maxArea !== undefined && f.maxArea !== null) {
    items.push({ key: 'maxArea', label: `最大面积: ${f.maxArea}㎡` });
  }
  if (f.projectName) {
    items.push({ key: 'projectName', label: `楼盘: ${f.projectName}` });
  }
  if (f.minPrice !== undefined && f.minPrice !== null) {
    items.push({ key: 'minPrice', label: `最低价: ${f.minPrice}元` });
  }
  if (f.maxPrice !== undefined && f.maxPrice !== null) {
    items.push({ key: 'maxPrice', label: `最高价: ${f.maxPrice}元` });
  }
  if (f.rooms !== undefined && f.rooms !== null) {
    items.push({ key: 'rooms', label: `居室: ${f.rooms}室` });
  }
  if (f.keyword) {
    items.push({ key: 'keyword', label: `关键词: ${f.keyword}` });
  }

  return items;
});

const hasFilters = computed(() => chips.value.length > 0);
</script>

<style scoped>
.filter-toolbar {
  padding: 8px 16px 12px;
  background: var(--van-background);
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.filter-toolbar-actions {
  display: flex;
  gap: 8px;
}
</style>
