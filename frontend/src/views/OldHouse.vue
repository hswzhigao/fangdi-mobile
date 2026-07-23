<template>
  <div class="old-house-page">
    <van-nav-bar title="二手房" fixed placeholder>
      <template #right>
        <FallbackLink :href="FALLBACK_URLS.oldHouse" label="原站" />
      </template>
    </van-nav-bar>

    <div class="placeholder-content">
      <van-empty description="二手房搜索功能即将上线">
        <template #bottom>
          <FallbackLink :href="FALLBACK_URLS.oldHouse" label="前往原站查看二手房" />
        </template>
      </van-empty>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FALLBACK_URLS } from '../api/types';
import FallbackLink from '../components/FallbackLink.vue';
</script>

<style scoped>
.old-house-page {
  min-height: 100vh;
  background: var(--van-background-2);
}
.placeholder-content {
  padding: 80px 16px 16px;
}
</style>
