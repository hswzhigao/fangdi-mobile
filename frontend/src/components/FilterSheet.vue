<template>
  <van-popup
    v-model:show="visibleRef"
    position="bottom"
    :style="{ maxHeight: '80vh', height: 'auto', borderRadius: '12px 12px 0 0' }"
    :aria-label="isNewHouse ? '新房筛选' : '二手房筛选'"
    class="filter-sheet"
  >
    <div class="filter-sheet-content">
      <h3 class="filter-sheet-title">{{ isNewHouse ? '新房筛选' : '二手房筛选' }}</h3>

      <div class="filter-form">
        <!-- District (common) -->
        <van-field
          v-model="localFilter.district"
          label="区域"
          placeholder="如：浦东新区"
          :maxlength="80"
          :aria-label="'区域筛选'"
        />

        <!-- Property Type (common) -->
        <van-field
          v-model="localFilter.propertyType"
          is-link
          readonly
          label="类型"
          placeholder="不限"
          :aria-label="'物业类型'"
          @click="showPropertyTypes = true"
        />

        <!-- Status (new house only) -->
        <van-field
          v-if="isNewHouse"
          v-model="statusLabel"
          is-link
          readonly
          label="状态"
          placeholder="不限"
          :aria-label="'房屋状态'"
          @click="showStatuses = true"
        />

        <!-- Area range (common) -->
        <div class="filter-range-row">
          <van-field
            v-model.number="localFilter.minArea"
            label="最小面积"
            placeholder="0"
            type="number"
            class="range-field"
          />
          <van-field
            v-model.number="localFilter.maxArea"
            label="最大面积"
            placeholder="不限"
            type="number"
            class="range-field"
          />
        </div>

        <!-- Price range (old house only) -->
        <div v-if="!isNewHouse" class="filter-range-row">
          <van-field
            v-model.number="localFilter.minPrice"
            label="最低价格"
            placeholder="0"
            type="number"
            class="range-field"
          />
          <van-field
            v-model.number="localFilter.maxPrice"
            label="最高价格"
            placeholder="不限"
            type="number"
            class="range-field"
          />
        </div>

        <!-- Rooms (old house only) -->
        <van-field
          v-if="!isNewHouse"
          v-model.number="localFilter.rooms"
          label="居室"
          placeholder="如：3"
          type="number"
          :max="50"
        />

        <!-- Project Name (new house only) -->
        <van-field
          v-if="isNewHouse"
          v-model="localFilter.projectName"
          label="楼盘名称"
          placeholder="输入楼盘名称"
          :maxlength="80"
        />

        <!-- Keyword (old house only) -->
        <van-field
          v-if="!isNewHouse"
          v-model="localFilter.keyword"
          label="关键词"
          placeholder="输入关键词"
          :maxlength="80"
        />
      </div>

      <!-- Picker popups -->
      <van-popup v-model:show="showPropertyTypes" position="bottom">
        <van-picker
          :columns="propertyTypeOptions"
          @confirm="onPropertyTypeConfirm"
          @cancel="showPropertyTypes = false"
        />
      </van-popup>
      <van-popup v-model:show="showStatuses" position="bottom">
        <van-picker
          :columns="statusOptions"
          @confirm="onStatusConfirm"
          @cancel="showStatuses = false"
        />
      </van-popup>

      <!-- Action buttons -->
      <div class="filter-sheet-actions">
        <van-button
          type="primary"
          block
          :style="{ minHeight: '44px' }"
          @click="onApply"
        >
          应用筛选
        </van-button>
        <van-button
          type="default"
          block
          :style="{ minHeight: '44px' }"
          @click="onReset"
        >
          重置筛选
        </van-button>
      </div>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { NewHouseFilter, OldHouseFilter, PropertyType, HouseStatus } from '../api/types';

// ── Props ───────────────────────────────────────────────────────────────────

const props = defineProps<{
  visible: boolean;
  filter: NewHouseFilter | OldHouseFilter;
  purpose: 'new-house' | 'old-house';
}>();

const emit = defineEmits<{
  apply: [filter: NewHouseFilter | OldHouseFilter];
  reset: [];
  'update:visible': [value: boolean];
}>();

// ── Local filter copy ───────────────────────────────────────────────────────

interface LocalFilter {
  district: string;
  propertyType: string;
  status: string;
  minArea: number | undefined;
  maxArea: number | undefined;
  minPrice: number | undefined;
  maxPrice: number | undefined;
  rooms: number | undefined;
  projectName: string;
  keyword: string;
}

function filterToLocal(f: NewHouseFilter | OldHouseFilter): LocalFilter {
  return {
    district: (f.district as string) || '',
    propertyType: f.propertyType || '',
    status: ('status' in f ? f.status : '') || '',
    minArea: f.minArea,
    maxArea: f.maxArea,
    minPrice: ('minPrice' in f ? f.minPrice : undefined),
    maxPrice: ('maxPrice' in f ? f.maxPrice : undefined),
    rooms: ('rooms' in f ? f.rooms : undefined),
    projectName: ('projectName' in f ? f.projectName : '') || '',
    keyword: ('keyword' in f ? f.keyword : '') || '',
  };
}

const localFilter = ref<LocalFilter>(filterToLocal(props.filter));

const isNewHouse = computed(() => props.purpose === 'new-house');

// ── Sync when filter prop changes externally ────────────────────────────────

watch(
  () => props.filter,
  (newFilter) => {
    localFilter.value = filterToLocal(newFilter);
  },
  { deep: true },
);

// ── Picker state ────────────────────────────────────────────────────────────

const showPropertyTypes = ref(false);
const showStatuses = ref(false);

const propertyTypeOptions = [
  { text: '不限', value: '' },
  { text: '住宅', value: 'residential' },
  { text: '办公', value: 'office' },
  { text: '商业', value: 'commercial' },
  { text: '其他', value: 'other' },
];

const statusOptions = [
  { text: '不限', value: '' },
  { text: '可售', value: 'available' },
  { text: '已售', value: 'sold' },
  { text: '全部', value: 'all' },
];

const statusLabel = computed(() => {
  const s = localFilter.value.status;
  if (!s) return '不限';
  const opt = statusOptions.find((o) => o.value === s);
  return opt ? opt.text : s;
});

const visibleRef = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
});

// ── Handlers ────────────────────────────────────────────────────────────────

function onPropertyTypeConfirm({ selectedOptions }: any) {
  const value = (selectedOptions?.[0]?.value ?? '') as string;
  localFilter.value.propertyType = value;
  showPropertyTypes.value = false;
}

function onStatusConfirm({ selectedOptions }: any) {
  const value = (selectedOptions?.[0]?.value ?? '') as string;
  localFilter.value.status = value;
  showStatuses.value = false;
}

function onApply() {
  const lf = localFilter.value;
  if (isNewHouse.value) {
    const nf: NewHouseFilter = {
      district: lf.district.trim() || undefined,
      propertyType: lf.propertyType as PropertyType || undefined,
      status: lf.status as HouseStatus || undefined,
      minArea: lf.minArea,
      maxArea: lf.maxArea,
      projectName: lf.projectName.trim() || undefined,
      page: props.filter.page,
      pageSize: props.filter.pageSize,
    };
    emit('apply', nf);
  } else {
    const of: OldHouseFilter = {
      district: lf.district.trim() || undefined,
      minArea: lf.minArea,
      maxArea: lf.maxArea,
      minPrice: lf.minPrice,
      maxPrice: lf.maxPrice,
      rooms: lf.rooms,
      propertyType: lf.propertyType as PropertyType || undefined,
      keyword: lf.keyword.trim() || undefined,
      page: props.filter.page,
      pageSize: props.filter.pageSize,
    };
    emit('apply', of);
  }
  emit('update:visible', false);
}

function onReset() {
  // Reset local filter to defaults
  localFilter.value = {
    district: '',
    propertyType: '',
    status: '',
    minArea: undefined,
    maxArea: undefined,
    minPrice: undefined,
    maxPrice: undefined,
    rooms: undefined,
    projectName: '',
    keyword: '',
  };
  emit('reset');
}
</script>

<style scoped>
.filter-sheet-content {
  padding: 20px 16px 24px;
}

.filter-sheet-title {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--van-text-color);
}

.filter-form {
  margin-bottom: 16px;
}

.filter-range-row {
  display: flex;
  gap: 8px;
}

.range-field {
  flex: 1;
}

.filter-sheet-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
