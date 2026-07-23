<template>
  <div class="app-shell">
    <div class="app-content">
      <router-view v-slot="{ Component, route }">
        <keep-alive :include="['Home', 'Lease', 'Trade', 'NewHouse', 'OldHouse']">
          <component :is="Component" :key="route.path" />
        </keep-alive>
      </router-view>
    </div>
    <div class="attribution-bar">
      <span>数据来源：网上房地产公开信息</span>
      <span class="divider">|</span>
      <span class="disclaimer">非官方客户端</span>
    </div>
    <van-tabbar v-model="activeTab" route :fixed="true" :safe-area-inset-bottom="true">
      <van-tabbar-item to="/" icon="home-o" replace>首页</van-tabbar-item>
      <van-tabbar-item to="/new-house" icon="shop-o" replace>新房</van-tabbar-item>
      <van-tabbar-item to="/old-house" icon="shop-o" replace>二手房</van-tabbar-item>
      <van-tabbar-item to="/lease" icon="notes-o" replace>租赁</van-tabbar-item>
      <van-tabbar-item to="/trade" icon="chart-trending-o" replace>统计</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

const tabRouteMap: Record<string, number> = {
  '/': 0,
  '/new-house': 1,
  '/old-house': 2,
  '/lease': 3,
  '/trade': 4,
};

const activeTab = computed(() => tabRouteMap[route.path] ?? 0);
</script>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--van-background-2);
}

.app-content {
  flex: 1;
  padding-bottom: 80px; /* space for tabbar + attribution */
}

.attribution-bar {
  position: fixed;
  bottom: 50px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  padding: 4px 16px;
  font-size: 11px;
  color: var(--van-text-color-3);
  background: var(--van-background);
  border-top: 1px solid var(--van-border-color);
  z-index: 2;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.attribution-bar .divider {
  opacity: 0.4;
}

.attribution-bar .disclaimer {
  opacity: 0.6;
}
</style>
