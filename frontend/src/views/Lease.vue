<template>
  <div class="lease-page">
    <van-nav-bar title="租赁信息" fixed placeholder>
      <template #right>
        <FallbackLink :href="FALLBACK_URLS.lease" label="原站" />
      </template>
    </van-nav-bar>

    <LoadingState v-if="state.status === 'loading'" />

    <ErrorState
      v-else-if="state.status === 'error'"
      :error="error"
      :loading="loading"
      @retry="fetchLease"
    />

    <template v-else-if="state.status === 'success'">
      <!-- Source/freshness line -->
      <div class="source-line" v-if="metaInfo">
        <span>{{ metaInfo }}</span>
      </div>

      <!-- Limitation note -->
      <van-notice-bar
        v-if="leaseData?.limitation"
        :text="leaseData.limitation"
        mode="closeable"
        color="#1989fa"
        background="#ecf9ff"
        scrollable
      />

      <!-- FAQ Accordion -->
      <van-panel class="panel" title="常见问题" v-if="leaseData?.faqs.length">
        <van-collapse v-model="activeFaqs" accordion>
          <van-collapse-item
            v-for="faq in leaseData.faqs"
            :key="faq.id"
            :title="faq.question"
            :name="faq.id"
          >
            <p class="faq-answer">{{ faq.answer }}</p>
          </van-collapse-item>
        </van-collapse>
      </van-panel>

      <!-- Downloads -->
      <van-panel class="panel" title="合同与资料下载" v-if="leaseData?.downloads.length">
        <van-cell
          v-for="(item, idx) in leaseData.downloads"
          :key="idx"
          :title="item.title"
          :label="item.format || '资料'"
          is-link
          @click="openUrl(item.url)"
        />
      </van-panel>

      <!-- External links -->
      <van-panel class="panel" title="办理入口" v-if="leaseData?.links.length">
        <van-cell
          v-for="(item, idx) in leaseData.links"
          :key="idx"
          :title="item.title"
          is-link
          @click="openUrl(item.url)"
        />
      </van-panel>

      <!-- Limitation note at bottom -->
      <div class="limitation-footer" v-if="leaseData?.limitation">
        <van-divider />
        <p class="note-text">{{ leaseData.limitation }}</p>
      </div>
    </template>

    <EmptyState
      v-else-if="state.status === 'empty'"
      message="暂无可展示的租赁信息"
      :fallback-url="FALLBACK_URLS.lease"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, computed } from 'vue';
import { apiGet } from '../api/client';
import type { LeaseData, ApiState } from '../api/types';
import { FALLBACK_URLS } from '../api/types';
import LoadingState from '../components/LoadingState.vue';
import EmptyState from '../components/EmptyState.vue';
import ErrorState from '../components/ErrorState.vue';
import FallbackLink from '../components/FallbackLink.vue';

const state = reactive<ApiState<LeaseData>>({ status: 'idle' });
const loading = ref(false);
const activeFaqs = ref<string[]>([]);

const leaseData = computed(() =>
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

async function fetchLease() {
  loading.value = true;
  state.status = 'loading';
  try {
    const result = await apiGet<LeaseData>('/api/lease');
    const data = result.data;
    if (data.faqs.length > 0 || data.downloads.length > 0 || data.links.length > 0) {
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

function openUrl(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

onMounted(() => {
  fetchLease();
});
</script>

<style scoped>
.lease-page {
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

.faq-answer {
  font-size: 14px;
  line-height: 1.6;
  color: var(--van-text-color);
  padding: 4px 0;
}

.limitation-footer {
  padding: 16px;
}

.note-text {
  font-size: 12px;
  color: var(--van-text-color-3);
  text-align: center;
  line-height: 1.5;
}
</style>
