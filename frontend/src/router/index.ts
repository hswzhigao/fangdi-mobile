import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: () => import('../views/Home.vue'),
    },
    {
      path: '/new-house',
      name: 'NewHouse',
      component: () => import('../views/NewHouse.vue'),
    },
    {
      path: '/new-house/:id',
      name: 'NewHouseDetail',
      component: () => import('../views/HouseDetail.vue'),
    },
    {
      path: '/old-house',
      name: 'OldHouse',
      component: () => import('../views/OldHouse.vue'),
    },
    {
      path: '/old-house/:id',
      name: 'OldHouseDetail',
      component: () => import('../views/HouseDetail.vue'),
    },
    {
      path: '/lease',
      name: 'Lease',
      component: () => import('../views/Lease.vue'),
    },
    {
      path: '/trade',
      name: 'Trade',
      component: () => import('../views/Trade.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'NotFound',
      redirect: '/',
    },
  ],
});

export default router;
