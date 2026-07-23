<template>
  <div class="trade-page">
    <van-nav-bar title="交易统计" fixed placeholder>
      <template #right>
        <FallbackLink :href="FALLBACK_URLS.trade" label="原站" />
      </template>
    </van-nav-bar>

    <LoadingState v-if="state.status === 'loading'" />

    <ErrorState
      v-else-if="state.status === 'error'"
      :error="error"
      :loading="loading"
      @retry="fetchTrade"
    />

    <template v-else-if="state.status === 'success' && tradeData">
      <!-- Source/freshness line -->
      <div class="source-line" v-if="metaInfo">
        <span>{{ metaInfo }}</span>
      </div>

      <!-- Update time -->
      <div class="update-time" v-if="tradeData.asOf">
        <span>数据更新时间：{{ tradeData.asOf }}</span>
      </div>

      <van-notice-bar
        v-if="tradeData.note"
        :text="tradeData.note"
        color="#1989fa"
        background="#ecf9ff"
        scrollable
      />

      <!-- New House Metrics -->
      <van-panel class="panel" title="新房成交" v-if="tradeData.newHouse">
        <div class="metrics-grid">
          <div class="metric-item" v-if="tradeData.newHouse.count !== undefined">
            <span class="label">成交套数</span>
            <span class="value">{{ tradeData.newHouse.count.toLocaleString() }}</span>
          </div>
          <div class="metric-item" v-if="tradeData.newHouse.area !== undefined">
            <span class="label">成交面积(㎡)</span>
            <span class="value">{{ tradeData.newHouse.area.toLocaleString() }}</span>
          </div>
          <div class="metric-item" v-if="tradeData.newHouse.averagePrice !== undefined">
            <span class="label">均价(元/㎡)</span>
            <span class="value">{{ tradeData.newHouse.averagePrice.toLocaleString() }}</span>
          </div>
        </div>
      </van-panel>

      <!-- Old House Metrics -->
      <van-panel class="panel" title="二手房成交" v-if="tradeData.oldHouse">
        <div class="metrics-grid">
          <div class="metric-item" v-if="tradeData.oldHouse.count !== undefined">
            <span class="label">成交套数</span>
            <span class="value">{{ tradeData.oldHouse.count.toLocaleString() }}</span>
          </div>
          <div class="metric-item" v-if="tradeData.oldHouse.area !== undefined">
            <span class="label">成交面积(㎡)</span>
            <span class="value">{{ tradeData.oldHouse.area.toLocaleString() }}</span>
          </div>
          <div class="metric-item" v-if="tradeData.oldHouse.averagePrice !== undefined">
            <span class="label">均价(元/㎡)</span>
            <span class="value">{{ tradeData.oldHouse.averagePrice.toLocaleString() }}</span>
          </div>
        </div>
      </van-panel>

      <!-- District Rankings -->
      <van-panel class="panel" title="区域排行" v-if="tradeData.byDistrict?.length">
        <div class="district-table">
          <table>
            <thead>
              <tr>
                <th>区域</th>
                <th>套数</th>
                <th>面积(㎡)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(d, idx) in tradeData.byDistrict" :key="idx">
                <td>{{ d.name }}</td>
                <td>{{ d.count?.toLocaleString() ?? '-' }}</td>
                <td>{{ d.area?.toLocaleString() ?? '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </van-panel>

      <!-- Note -->
      <div class="freshness-note" v-if="tradeData.note">
        <van-divider />
        <p class="note-text">{{ tradeData.note }}</p>
      </div>

      <!-- Original site -->
      <div class="footer-actions">
        <FallbackLink :href="FALLBACK_URLS.trade" label="打开原站完整统计" />
      </div>
    </template>

    <EmptyState
      v-else-if="state.status === 'empty'"
      message="暂无交易统计数据"
      :fallback-url="FALLBACK_URLS.trade"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, computed } from 'vue';
import { apiGet } from '../api/client';
import type { TradeData, ApiState } from '../api/types';
import { FALLBACK_URLS } from '../api/types';
import LoadingState from '../components/LoadingState.vue';
import EmptyState from '../components/EmptyState.vue';
import ErrorState from '../components/ErrorState.vue';
import FallbackLink from '../components/FallbackLink.vue';

const state = reactive<ApiState<TradeData>>({ status: 'idle' });
const loading = ref(false);

const tradeData = computed(() =>
  state.status === 'success' ? state.data : undefined,
);

const error = computed(() =>
  state.status === 'error' ? state.error : undefined,
);

const metaInfo = computed(() => {
  if (state.status !== 'success' || !state.meta) return undefined;
  const m = state.meta;
  const sourceLabel = m.source === 'upstream' ? '网上房地产' : '缓存';
  const cacheTag = m.cached ? ' (缓存)' : '';
  const time = formatFetchedAt(m.fetchedAt);
  return `数据来源：${sourceLabel}${cacheTag} | 更新于 ${time}`;
});

function formatFetchedAt(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('zh-CN', { hour12: false });
  } catch {
    return iso;
  }
}

async function fetchTrade() {
  loading.value = true;
  state.status = 'loading';
  try {
    const result = await apiGet<TradeData>('/api/trade');
    const data = result.data;
    const hasData =
      !!data.newHouse ||
      !!data.oldHouse ||
      (data.byDistrict && data.byDistrict.length > 0);
    if (hasData) {
      Object.assign(state, { status: 'success' as const, data, meta: result.meta });
    } else {
      state.status = 'empty';
    }
  } catch (err: unknown) {
    Object.assign(state, { status: 'error' as const, error: err });
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchTrade();
});
</script>

<style scoped>
.trade-page {
  min-height: 100vh;
  background: var(--van-background-2);
}

.source-line {
  padding: 6px 16px;
  font-size: 12px;
  color: var(--van-text-color-3);
  text-align: center;
  background: var(--van-background);
  border-bottom: 1px solid var(--van-border-color);
}

.update-time {
  padding: 8px 16px;
  font-size: 12px;
  color: var(--van-text-color-3);
  text-align: center;
}

.panel {
  margin: 12px 0;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 12px 16px;
}

.metric-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background: var(--van-background);
  border-radius: 8px;
  text-align: center;
}

.metric-item .label {
  font-size: 12px;
  color: var(--van-text-color-2);
}

.metric-item .value {
  font-size: 22px;
  font-weight: 700;
  color: var(--van-primary-color);
}

.district-table {
  overflow-x: auto;
  padding: 8px 16px 16px;
}

.district-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.district-table th,
.district-table td {
  padding: 8px 6px;
  text-align: left;
  border-bottom: 1px solid var(--van-border-color);
}

.district-table th {
  color: var(--van-text-color-2);
  font-weight: 600;
  font-size: 12px;
}

.district-table td {
  color: var(--van-text-color);
}

.freshness-note {
  padding: 16px;
}

.note-text {
  font-size: 12px;
  color: var(--van-text-color-3);
  text-align: center;
  line-height: 1.5;
}

.footer-actions {
  display: flex;
  justify-content: center;
  padding: 16px;
}

@media (min-width: 431px) {
  .metrics-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>
