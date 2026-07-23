<template>
  <div class="house-detail-page">
    <van-nav-bar
      :title="detail?.name || '详情'"
      left-text="返回"
      left-arrow
      fixed
      placeholder
      @click-left="$router.back()"
    >
      <template #right>
        <FallbackLink v-if="fallbackUrl" :href="fallbackUrl" label="原站" />
      </template>
    </van-nav-bar>

    <div class="detail-content">
      <!-- Loading -->
      <LoadingState v-if="loading" />

      <!-- Error -->
      <ErrorState
        v-else-if="error"
        :error="error"
        @retry="fetchDetail"
      />

      <!-- Detail -->
      <template v-else-if="detail">
        <div class="detail-card">
          <h2 class="detail-name">{{ detail.name }}</h2>

          <div class="detail-fields">
            <div v-if="detail.district" class="detail-field">
              <span class="field-label">区域</span>
              <span class="field-value">{{ detail.district }}</span>
            </div>
            <div v-if="detail.address" class="detail-field">
              <span class="field-label">地址</span>
              <span class="field-value">{{ detail.address }}</span>
            </div>
            <div v-if="detail.status" class="detail-field">
              <span class="field-label">状态</span>
              <span class="field-value">{{ statusLabel }}</span>
            </div>
            <div v-if="detail.area !== undefined && detail.area !== null" class="detail-field">
              <span class="field-label">面积</span>
              <span class="field-value">{{ detail.area }}㎡</span>
            </div>
            <div v-if="detail.rooms !== undefined && detail.rooms !== null" class="detail-field">
              <span class="field-label">居室</span>
              <span class="field-value">{{ detail.rooms }}室</span>
            </div>
            <div v-if="detail.updatedAt" class="detail-field">
              <span class="field-label">更新于</span>
              <span class="field-value">{{ detail.updatedAt }}</span>
            </div>
          </div>
        </div>

        <!-- Fallback link -->
        <div class="detail-actions" v-if="detail.detailUrl || fallbackUrl">
          <a
            :href="detail.detailUrl || fallbackUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="fallback-btn"
          >
            打开原站详情
            <span class="icon">↗</span>
          </a>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { apiGet } from '../api/client';
import type { HouseDetail, ApiError } from '../api/types';
import { FALLBACK_URLS } from '../api/types';
import FallbackLink from '../components/FallbackLink.vue';
import LoadingState from '../components/LoadingState.vue';
import ErrorState from '../components/ErrorState.vue';

const route = useRoute();

const detail = ref<HouseDetail | null>(null);
const loading = ref(true);
const error = ref<ApiError | null>(null);
let abortController: AbortController | null = null;

const purpose = computed(() => {
  if (route.path.startsWith('/new-house')) return 'new-house';
  if (route.path.startsWith('/old-house')) return 'old-house';
  return 'new-house';
});

const fallbackUrl = computed(() => {
  return purpose.value === 'new-house'
    ? FALLBACK_URLS.newHouse
    : FALLBACK_URLS.oldHouse;
});

const STATUS_LABELS: Record<string, string> = {
  available: '可售',
  sold: '已售',
};

const statusLabel = computed(() => {
  if (!detail.value?.status) return '';
  return STATUS_LABELS[detail.value.status] || detail.value.status;
});

async function fetchDetail() {
  if (abortController) {
    abortController.abort();
  }
  abortController = new AbortController();
  const signal = abortController.signal;

  const id = route.params.id as string;

  // Validate id format
  if (!id || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) {
    error.value = {
      code: 'BAD_REQUEST',
      message: '无效的房源ID',
      retryable: false,
    };
    loading.value = false;
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const path = purpose.value === 'new-house'
      ? `/api/new-house/${id}`
      : `/api/old-house/${id}`;

    const result = await apiGet<HouseDetail>(path, signal);
    detail.value = result.data;
    loading.value = false;
  } catch (err: unknown) {
    loading.value = false;
    if (err && typeof err === 'object' && 'code' in err) {
      error.value = err as ApiError;
    } else {
      error.value = {
        code: 'INTERNAL_ERROR',
        message: '加载详情失败',
        retryable: true,
      };
    }
  }
}

onMounted(() => {
  fetchDetail();
});

onUnmounted(() => {
  if (abortController) {
    abortController.abort();
  }
});
</script>

<style scoped>
.house-detail-page {
  min-height: 100vh;
  background: var(--van-background-2);
}

.detail-content {
  padding: 16px;
}

.detail-card {
  padding: 16px;
  background: var(--van-background);
  border-radius: 8px;
}

.detail-name {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 600;
  color: var(--van-text-color);
}

.detail-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-field {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.field-label {
  font-size: 14px;
  color: var(--van-text-color-2);
}

.field-value {
  font-size: 14px;
  color: var(--van-text-color);
  font-weight: 500;
}

.detail-actions {
  margin-top: 16px;
  text-align: center;
}

.fallback-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 10px 20px;
  background: var(--van-primary-color);
  color: #fff;
  border-radius: 6px;
  font-size: 14px;
  text-decoration: none;
  min-height: 44px;
}

.fallback-btn .icon {
  font-size: 12px;
}
</style>
