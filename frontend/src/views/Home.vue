<template>
  <div class="home-page">
    <van-nav-bar title="网上房地产" fixed placeholder />
    <div class="content">
      <div class="attribution">
        <p>数据来源：上海市网上房地产</p>
        <p class="hint">fangdi-mobile 项目引导页</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.home-page {
  min-height: 100vh;
  background: var(--van-background-2);
}
.content {
  padding: 16px;
}
.attribution {
  margin-top: 24px;
  text-align: center;
  color: var(--van-text-color-2);
  font-size: 14px;
}
.hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--van-text-color-3);
}
</style>
