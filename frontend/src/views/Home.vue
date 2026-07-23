<template>
  <div class="home-page">
    <van-nav-bar title="网上房地产移动版" fixed placeholder />

    <!-- Loading -->
    <LoadingState v-if="state.status === 'loading'" />

    <!-- Error -->
    <ErrorState
      v-else-if="state.status === 'error'"
      :error="error"
      :loading="loading"
      @retry="fetchHome"
    />

    <!-- Success / Empty -->
    <template v-else-if="state.status === 'success' || state.status === 'empty'">
      <!-- Source/freshness line -->
      <div class="source-line" v-if="metaInfo">
        <span>{{ metaInfo }}</span>
      </div>

      <!-- Transaction Summary -->
      <van-panel v-if="homeData" class="panel" title="今日交易摘要">
        <div class="metrics-grid" v-if="homeData.houseBargain.length > 0">
          <div
            v-for="item in homeData.houseBargain.slice(0, 4)"
            :key="item.id"
            class="metric-item"
          >
            <span class="metric-name">{{ item.name }}</span>
            <span class="metric-count" v-if="item.count !== undefined">{{ item.count }}套</span>
            <span class="metric-area" v-if="item.area !== undefined">{{ item.area }}㎡</span>
          </div>
        </div>
        <van-empty v-else description="暂无交易数据" />
      </van-panel>

      <!-- Quick Links -->
      <van-grid :column-num="4" class="quick-links">
        <van-grid-item text="新房" icon="shop-o" to="/new-house" />
        <van-grid-item text="二手房" icon="shop-o" to="/old-house" />
        <van-grid-item text="租赁" icon="notes-o" to="/lease" />
        <van-grid-item text="统计" icon="chart-trending-o" to="/trade" />
      </van-grid>

      <!-- Notices / Policies / News -->
      <van-tabs class="tabs" v-if="homeData">
        <van-tab title="公告">
          <div class="notice-list" v-if="homeData.notices.length > 0">
            <van-cell
              v-for="item in homeData.notices.slice(0, 5)"
              :key="item.id"
              :title="item.title"
              :label="item.publishedAt"
              @click="onNoticeClick(item)"
            />
          </div>
          <EmptyState v-else message="暂无公告" />
        </van-tab>
        <van-tab title="政策">
          <div class="notice-list" v-if="homeData.policies.length > 0">
            <van-cell
              v-for="item in homeData.policies.slice(0, 5)"
              :key="item.id"
              :title="item.title"
              :label="item.publishedAt"
              @click="onNoticeClick(item)"
            />
          </div>
          <EmptyState v-else message="暂无政策" />
        </van-tab>
        <van-tab title="要闻">
          <div class="notice-list" v-if="homeData.news.length > 0">
            <van-cell
              v-for="item in homeData.news.slice(0, 5)"
              :key="item.id"
              :title="item.title"
              :label="item.publishedAt"
              @click="onNoticeClick(item)"
            />
          </div>
          <EmptyState v-else message="暂无需闻" />
        </van-tab>
      </van-tabs>

      <!-- Recent Houses -->
      <van-panel v-if="homeData?.recentHouses.length" class="panel" title="近期楼盘">
        <div class="card-row">
          <van-card
            v-for="house in homeData.recentHouses.slice(0, 3)"
            :key="house.id"
            :title="house.name"
            :desc="house.district || ''"
            :tag="house.status"
          />
        </div>
      </van-panel>

      <!-- New Premises -->
      <van-panel v-if="homeData?.newPremises.length" class="panel" title="可售新房">
        <div class="card-row">
          <van-card
            v-for="house in homeData.newPremises.slice(0, 3)"
            :key="house.id"
            :title="house.name"
            :desc="house.district || ''"
            :tag="house.status"
          />
        </div>
      </van-panel>

      <!-- Sell Upcoming -->
      <van-panel v-if="homeData?.sellUpcoming.length" class="panel" title="即将开盘">
        <div class="card-row">
          <van-card
            v-for="house in homeData.sellUpcoming.slice(0, 3)"
            :key="house.id"
            :title="house.name"
            :desc="house.district || ''"
            :tag="house.plannedDate"
          />
        </div>
      </van-panel>

      <!-- Original site fallback -->
      <div class="footer-actions">
        <FallbackLink :href="FALLBACK_URLS.home" label="打开原站查看更多" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, computed } from 'vue';
import { apiGet } from '../api/client';
import type { HomeData, ApiState, Notice } from '../api/types';
import { FALLBACK_URLS } from '../api/types';
import LoadingState from '../components/LoadingState.vue';
import EmptyState from '../components/EmptyState.vue';
import ErrorState from '../components/ErrorState.vue';
import FallbackLink from '../components/FallbackLink.vue';

const state = reactive<ApiState<HomeData>>({ status: 'idle' });
const loading = ref(false);

const homeData = computed(() =>
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

async function fetchHome() {
  loading.value = true;
  state.status = 'loading';
  try {
    const result = await apiGet<HomeData>('/api/home');
    const data = result.data;
    const hasData =
      data.notices.length > 0 ||
      data.recentHouses.length > 0 ||
      data.sellUpcoming.length > 0 ||
      data.newPremises.length > 0 ||
      data.houseBargain.length > 0 ||
      data.secondHouse.length > 0 ||
      data.policies.length > 0 ||
      data.news.length > 0;
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

function onNoticeClick(item: Notice) {
  if (item.detailUrl) {
    window.open(item.detailUrl, '_blank', 'noopener,noreferrer');
  }
}

onMounted(() => {
  fetchHome();
});
</script>

<style scoped>
.home-page {
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
}

.metric-name {
  font-size: 13px;
  color: var(--van-text-color-2);
}

.metric-count {
  font-size: 20px;
  font-weight: 700;
  color: var(--van-primary-color);
}

.metric-area {
  font-size: 13px;
  color: var(--van-text-color-2);
}

.quick-links {
  margin: 8px 0;
}

.tabs {
  margin: 8px 0;
}

.notice-list {
  padding: 0;
}

.card-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 16px 16px;
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
