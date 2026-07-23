<template>
  <div class="new-house-page">
    <van-nav-bar title="新房" fixed placeholder>
      <template #right>
        <FallbackLink :href="FALLBACK_URLS.newHouse" label="原站" />
      </template>
    </van-nav-bar>

    <div class="page-content">
      <!-- Filter toolbar -->
      <FilterToolbar
        :filter="filter"
        @open-filter="showFilterSheet = true"
        @reset="onReset"
        @remove-chip="onRemoveChip"
      />

      <!-- Filter sheet -->
      <FilterSheet
        v-model:visible="showFilterSheet"
        :filter="filter"
        purpose="new-house"
        @apply="onFilterApply"
        @reset="onFilterReset"
      />

      <!-- State: Loading -->
      <LoadingState v-if="state.status === 'loading'" />

      <!-- State: Error -->
      <ErrorState
        v-else-if="state.status === 'error'"
        :error="state.error"
        @retry="onRetry"
      />

      <!-- State: Empty -->
      <EmptyState
        v-else-if="state.status === 'empty'"
        message="暂无匹配的新房数据"
        :fallback-url="FALLBACK_URLS.newHouse"
      />

      <!-- State: Success -->
      <template v-else-if="state.status === 'success'">
        <div class="list-header">
          <span class="result-count">{{ fetchedAt }}</span>
        </div>
        <div class="house-list">
          <HouseCard
            v-for="item in state.data.items"
            :key="item.id"
            :house="item"
            @click="onDetailClick(item.id)"
          />
        </div>
        <PaginationBar
          :page="state.data.page"
          :page-size="state.data.pageSize"
          :total="state.data.total"
          @change="onPageChange"
        />
      </template>
    </div>

    <!-- Captcha dialog -->
    <CaptchaDialog
      :purpose="'new-house'"
      :visible="captchaState.visible"
      :image="captchaState.image"
      :session-id="captchaState.sessionId"
      :loading="captchaState.loading"
      :submitting="captchaState.submitting"
      :error-code="captchaState.errorCode"
      :error-message="captchaState.errorMessage"
      @submit="onCaptchaSubmit"
      @refresh="onCaptchaRefresh"
      @close="onCaptchaClose"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { apiGet, apiPost } from '../api/client';
import type {
  ApiState,
  Page,
  HouseSummary,
  NewHouseFilter,
  CaptchaData,
  ApiError,
  ApiErrorCode,
} from '../api/types';
import { FALLBACK_URLS } from '../api/types';
import FallbackLink from '../components/FallbackLink.vue';
import FilterToolbar from '../components/FilterToolbar.vue';
import FilterSheet from '../components/FilterSheet.vue';
import HouseCard from '../components/HouseCard.vue';
import PaginationBar from '../components/PaginationBar.vue';
import LoadingState from '../components/LoadingState.vue';
import EmptyState from '../components/EmptyState.vue';
import ErrorState from '../components/ErrorState.vue';
import CaptchaDialog from '../components/CaptchaDialog.vue';
import { serializeFilter, deserializeFilter } from '../utils/filter';

// ── Router ─────────────────────────────────────────────────────────────────

const router = useRouter();
const route = useRoute();

// ── Filter state ────────────────────────────────────────────────────────────

function getDefaultFilter(): NewHouseFilter {
  return { page: 1, pageSize: 10 };
}

function getFilterFromQuery(): NewHouseFilter {
  const params = new URLSearchParams(route.query as Record<string, string>);
  // Enforce page type: a URL with type=old-house on the new-house route must
  // be parsed as a NewHouseFilter so foreign fields (minPrice, rooms, keyword)
  // cannot leak into the filter state.
  params.set('type', 'new-house');
  const deserialized = deserializeFilter(params) as NewHouseFilter;
  return { ...getDefaultFilter(), ...deserialized };
}

const filter = ref<NewHouseFilter>(getFilterFromQuery());

// ── Search state ────────────────────────────────────────────────────────────

const state = ref<ApiState<Page<HouseSummary>>>({ status: 'idle' });
let abortController: AbortController | null = null;
let captchaAbortController: AbortController | null = null;

// ── Filter UI state ─────────────────────────────────────────────────────────

const showFilterSheet = ref(false);

// ── Captcha state ───────────────────────────────────────────────────────────

interface CaptchaUIState {
  visible: boolean;
  loading: boolean;
  submitting: boolean;
  image?: string;
  sessionId?: string;
  errorCode?: ApiErrorCode;
  errorMessage?: string;
}

const captchaState = reactive<CaptchaUIState>({
  visible: false,
  loading: false,
  submitting: false,
});

// ── Search function ─────────────────────────────────────────────────────────

async function doSearch(f: NewHouseFilter) {
  // Abort previous request
  if (abortController) {
    abortController.abort();
  }
  abortController = new AbortController();
  const signal = abortController.signal;

  state.value = { status: 'loading' };

  try {
    // Build search body — strip undefined optional fields
    const body: Record<string, unknown> = {
      page: f.page,
      pageSize: f.pageSize,
    };

    if (f.district) body.district = f.district;
    if (f.propertyType) body.propertyType = f.propertyType;
    if (f.status) body.status = f.status;
    if (f.minArea !== undefined) body.minArea = f.minArea;
    if (f.maxArea !== undefined) body.maxArea = f.maxArea;
    if (f.projectName) body.projectName = f.projectName;
    if (f.captchaSession) body.captchaSession = f.captchaSession;
    if (f.captchaText) body.captchaText = f.captchaText;

    const result = await apiPost<Page<HouseSummary>>(
      '/api/new-house/search',
      body,
      signal,
    );

    if (result.data.items.length === 0) {
      state.value = { status: 'empty' };
    } else {
      state.value = { status: 'success', data: result.data, meta: result.meta };
    }

    // Clear captcha after successful search
    captchaState.visible = false;
    captchaState.sessionId = undefined;
    captchaState.image = undefined;
    captchaState.errorCode = undefined;
    captchaState.errorMessage = undefined;
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err) {
      const apiErr = err as ApiError;

      // Handle captcha required
      if (apiErr.code === 'CAPTCHA_REQUIRED') {
        state.value = { status: 'idle' }; // Keep filter visible
        captchaState.visible = true;
        captchaState.errorCode = apiErr.code;
        captchaState.errorMessage = apiErr.message;
        await fetchCaptcha();
        return;
      }

      // Handle captcha invalid/expired
      if (apiErr.code === 'CAPTCHA_INVALID' || apiErr.code === 'CAPTCHA_EXPIRED') {
        captchaState.errorCode = apiErr.code;
        captchaState.errorMessage = apiErr.message;
        captchaState.submitting = false;
        if (apiErr.code === 'CAPTCHA_EXPIRED') {
          // Clear session, fetch new captcha
          clearCaptcha();
          await fetchCaptcha();
        }
        return;
      }

      // Handle upstream blocked — show error, clear captcha
      if (apiErr.code === 'UPSTREAM_BLOCKED') {
        clearCaptcha();
      }

      // Handle rate limited — explicit retry-later message
      if (apiErr.code === 'RATE_LIMITED') {
        state.value = {
          status: 'error',
          error: {
            code: 'RATE_LIMITED',
            message: '请求过于频繁，请稍后重试',
            retryable: true,
          },
        };
        return;
      }

      state.value = { status: 'error', error: apiErr };
    } else {
      state.value = {
        status: 'error',
        error: {
          code: 'INTERNAL_ERROR',
          message: '查询失败，请稍后重试',
          retryable: true,
        },
      };
    }
  }
}

// ── Captcha functions ───────────────────────────────────────────────────────

async function fetchCaptcha() {
  // Abort previous captcha request
  if (captchaAbortController) {
    captchaAbortController.abort();
  }
  captchaAbortController = new AbortController();
  const signal = captchaAbortController.signal;

  captchaState.loading = true;
  captchaState.errorCode = undefined;
  captchaState.errorMessage = undefined;

  try {
    const result = await apiGet<CaptchaData>('/api/captcha?purpose=new-house', signal);
    captchaState.image = result.data.image;
    captchaState.sessionId = result.data.sessionId;
    captchaState.loading = false;
  } catch (err: unknown) {
    captchaState.loading = false;
    // Ignore AbortError — stale captcha response must not mutate current state
    if (err instanceof DOMException && err.name === 'AbortError') return;
    if (err && typeof err === 'object' && 'code' in err) {
      const apiErr = err as ApiError;
      if (apiErr.code === 'RATE_LIMITED') {
        captchaState.errorCode = apiErr.code;
        captchaState.errorMessage = '请求过于频繁，请稍后重试';
        return;
      }
      captchaState.errorCode = apiErr.code;
      captchaState.errorMessage = apiErr.message;
    } else {
      captchaState.errorMessage = '获取验证码失败';
    }
  }
}

function clearCaptcha() {
  captchaState.visible = false;
  captchaState.submitting = false;
  captchaState.loading = false;
  captchaState.sessionId = undefined;
  captchaState.image = undefined;
  captchaState.errorCode = undefined;
  captchaState.errorMessage = undefined;
  // Remove captcha fields from filter
  filter.value.captchaSession = undefined;
  filter.value.captchaText = undefined;
  // Abort in-flight captcha request
  if (captchaAbortController) {
    captchaAbortController.abort();
    captchaAbortController = null;
  }
}

async function onCaptchaSubmit(sessionId: string, text: string) {
  captchaState.submitting = true;
  captchaState.errorCode = undefined;
  captchaState.errorMessage = undefined;

  // Set captcha on filter and search
  filter.value.captchaSession = sessionId;
  filter.value.captchaText = text;
  await doSearch(filter.value);
}

async function onCaptchaRefresh() {
  // Clear current session, fetch new
  filter.value.captchaSession = undefined;
  filter.value.captchaText = undefined;
  await fetchCaptcha();
}

function onCaptchaClose() {
  clearCaptcha();
}

// ── Filter handlers ─────────────────────────────────────────────────────────

function onFilterApply(newFilter: NewHouseFilter) {
  // Reset page on filter change
  filter.value = { ...newFilter, page: 1 };
  // Clear captcha on filter change
  clearCaptcha();
  updateQuery(filter.value);
  doSearch(filter.value);
}

function onReset() {
  filter.value = getDefaultFilter();
  clearCaptcha();
  updateQuery(filter.value);
  doSearch(filter.value);
}

function onFilterReset() {
  filter.value = getDefaultFilter();
  clearCaptcha();
  updateQuery(filter.value);
  doSearch(filter.value);
}

function onRemoveChip(key: string) {
  const f = filter.value;
  if (key === 'district') f.district = undefined;
  if (key === 'propertyType') f.propertyType = undefined;
  if (key === 'status') f.status = undefined;
  if (key === 'minArea') f.minArea = undefined;
  if (key === 'maxArea') f.maxArea = undefined;
  if (key === 'projectName') f.projectName = undefined;
  f.page = 1;
  clearCaptcha();
  updateQuery(f);
  doSearch(f);
}

function onPageChange(page: number) {
  filter.value.page = page;
  updateQuery(filter.value);
  doSearch(filter.value);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function onRetry() {
  doSearch(filter.value);
}

function onDetailClick(id: string) {
  router.push(`/new-house/${id}`);
}

// ── URL sync ────────────────────────────────────────────────────────────────

function updateQuery(f: NewHouseFilter) {
  const serialized = serializeFilter(f);
  router.replace({ query: Object.fromEntries(new URLSearchParams(serialized)) });
}

// ── Watch route query for back/forward navigation ───────────────────────────

watch(
  () => route.query,
  (newQuery) => {
    const params = new URLSearchParams(newQuery as Record<string, string>);
    params.set('type', 'new-house');
    const deserialized = deserializeFilter(params) as NewHouseFilter;
    if (deserialized.page !== filter.value.page ||
          deserialized.district !== filter.value.district ||
          deserialized.propertyType !== filter.value.propertyType ||
          deserialized.status !== filter.value.status ||
          deserialized.minArea !== filter.value.minArea ||
          deserialized.maxArea !== filter.value.maxArea ||
          deserialized.projectName !== filter.value.projectName) {
        filter.value = { ...getDefaultFilter(), ...deserialized };
        clearCaptcha();
        doSearch(filter.value);
      }
  },
);

const fetchedAt = computed(() => {
  if (state.value.status !== 'success' || !state.value.meta?.fetchedAt) return '';
  return `更新于 ${formatDate(state.value.meta.fetchedAt)}`;
});

// ── Lifecycle ───────────────────────────────────────────────────────────────

onMounted(() => {
  doSearch(filter.value);
});

onUnmounted(() => {
  if (abortController) {
    abortController.abort();
  }
  if (captchaAbortController) {
    captchaAbortController.abort();
    captchaAbortController = null;
  }
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}
</script>

<style scoped>
.new-house-page {
  min-height: 100vh;
  background: var(--van-background-2);
}
.page-content {
  padding: 8px 0;
}
.list-header {
  padding: 8px 16px;
}
.result-count {
  font-size: 12px;
  color: var(--van-text-color-3);
}
.house-list {
  padding: 0 16px;
}
</style>
