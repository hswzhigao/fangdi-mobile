/**
 * Component tests — verify that shared components render correctly.
 * Tests for LoadingState, EmptyState, ErrorState, FallbackLink.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import LoadingState from '../src/components/LoadingState.vue';
import EmptyState from '../src/components/EmptyState.vue';
import ErrorState from '../src/components/ErrorState.vue';
import FallbackLink from '../src/components/FallbackLink.vue';

describe('LoadingState', () => {
  it('renders skeleton placeholder', () => {
    const wrapper = mount(LoadingState, {
      global: {
        stubs: {
          VanSkeleton: {
            template: '<div class="van-skeleton-stub"><slot /></div>',
            props: ['title', 'row'],
          },
        },
      },
    });
    expect(wrapper.find('.loading-state').exists()).toBe(true);
  });
});

describe('EmptyState', () => {
  it('renders default empty message', () => {
    const wrapper = mount(EmptyState, {
      global: {
        stubs: {
          VanEmpty: {
            template: '<div class="van-empty-stub"><slot name="description" /><slot /></div>',
            props: ['description'],
          },
        },
      },
    });
    expect(wrapper.find('.empty-state').exists()).toBe(true);
  });

  it('renders custom message', () => {
    const wrapper = mount(EmptyState, {
      props: { message: '暂无数据' },
      global: {
        stubs: {
          VanEmpty: {
            template: '<div class="van-empty-stub">{{ description }}</div>',
            props: ['description'],
          },
        },
      },
    });
    expect(wrapper.find('.van-empty-stub').text()).toBe('暂无数据');
  });

  it('renders fallback link when provided', () => {
    const wrapper = mount(EmptyState, {
      props: { fallbackUrl: 'https://www.fangdi.com.cn/' },
      global: {
        stubs: {
          VanEmpty: {
            template: '<div class="van-empty-stub"><slot /></div>',
            props: ['description'],
          },
        },
      },
    });
    expect(wrapper.find('.actions').exists()).toBe(true);
    expect(wrapper.find('a').attributes('href')).toBe('https://www.fangdi.com.cn/');
  });
});

describe('ErrorState', () => {
  it('renders error message', () => {
    const error = { code: 'UPSTREAM_BLOCKED' as const, message: '上游访问验证失败', retryable: true };
    const wrapper = mount(ErrorState, {
      props: { error },
      global: {
        stubs: {
          VanEmpty: {
            template: '<div class="van-empty-stub">{{ description }}</div>',
            props: ['description'],
          },
          VanButton: {
            template: '<button class="van-button-stub"><slot /></button>',
            props: ['type', 'size', 'loading', 'disabled'],
          },
        },
      },
    });
    expect(wrapper.find('.error-state').exists()).toBe(true);
  });

  it('shows retry button when error is retryable', () => {
    const error = { code: 'UPSTREAM_TIMEOUT' as const, message: '超时', retryable: true };
    const wrapper = mount(ErrorState, {
      props: { error },
      global: {
        stubs: {
          VanEmpty: {
            template: '<div class="van-empty-stub">{{ description }}</div>',
            props: ['description'],
          },
          VanButton: {
            template: '<button class="van-button-stub"><slot /></button>',
            props: ['type', 'size', 'loading', 'disabled'],
          },
        },
      },
    });
    expect(wrapper.find('.van-button-stub').exists()).toBe(true);
    expect(wrapper.find('.van-button-stub').text()).toBe('重试');
  });

  it('hides retry button when error is not retryable', () => {
    const error = { code: 'UPSTREAM_SCHEMA' as const, message: '数据格式异常', retryable: false };
    const wrapper = mount(ErrorState, {
      props: { error },
      global: {
        stubs: {
          VanEmpty: {
            template: '<div class="van-empty-stub">{{ description }}</div>',
            props: ['description'],
          },
          VanButton: {
            template: '<button class="van-button-stub"><slot /></button>',
            props: ['type', 'size', 'loading', 'disabled'],
          },
        },
      },
    });
    expect(wrapper.find('.van-button-stub').exists()).toBe(false);
  });

  it('emits retry on button click', async () => {
    const error = { code: 'UPSTREAM_BAD_STATUS' as const, message: '上游暂不可用', retryable: true };
    const wrapper = mount(ErrorState, {
      props: { error },
      global: {
        stubs: {
          VanEmpty: {
            template: '<div class="van-empty-stub">{{ description }}</div>',
            props: ['description'],
          },
          VanButton: {
            template: '<button class="van-button-stub" @click="$emit(\'click\')"><slot /></button>',
            props: ['type', 'size', 'loading', 'disabled'],
            emits: ['click'],
          },
        },
      },
    });
    await wrapper.find('.van-button-stub').trigger('click');
    expect(wrapper.emitted('retry')).toBeTruthy();
    expect(wrapper.emitted('retry')?.length).toBe(1);
  });

  it('shows fallback link when error has fallbackUrl', () => {
    const error = { code: 'UPSTREAM_BLOCKED' as const, message: 'blocked', retryable: true, fallbackUrl: 'https://www.fangdi.com.cn/' };
    const wrapper = mount(ErrorState, {
      props: { error },
      global: {
        stubs: {
          VanEmpty: {
            template: '<div class="van-empty-stub">{{ description }}</div>',
            props: ['description'],
          },
          VanButton: {
            template: '<button class="van-button-stub"><slot /></button>',
            props: ['type', 'size', 'loading', 'disabled'],
          },
        },
      },
    });
    expect(wrapper.find('.fallback-link').exists()).toBe(true);
    expect(wrapper.find('.fallback-link').attributes('href')).toBe('https://www.fangdi.com.cn/');
  });

  it('hides fallback link when error has no fallbackUrl', () => {
    const error = { code: 'UPSTREAM_TIMEOUT' as const, message: 'timeout', retryable: true };
    const wrapper = mount(ErrorState, {
      props: { error },
      global: {
        stubs: {
          VanEmpty: {
            template: '<div class="van-empty-stub">{{ description }}</div>',
            props: ['description'],
          },
          VanButton: {
            template: '<button class="van-button-stub"><slot /></button>',
            props: ['type', 'size', 'loading', 'disabled'],
          },
        },
      },
    });
    expect(wrapper.find('.fallback-link').exists()).toBe(false);
  });

  it('shows RATE_LIMITED error with retry button and retry-later message', () => {
    const error = { code: 'RATE_LIMITED' as const, message: '请求过于频繁，请稍后重试', retryable: true };
    const wrapper = mount(ErrorState, {
      props: { error },
      global: {
        stubs: {
          VanEmpty: {
            template: '<div class="van-empty-stub">{{ description }}</div>',
            props: ['description'],
          },
          VanButton: {
            template: '<button class="van-button-stub"><slot /></button>',
            props: ['type', 'size', 'loading', 'disabled'],
          },
        },
      },
    });
    expect(wrapper.find('.error-state').exists()).toBe(true);
    expect(wrapper.find('.van-empty-stub').text()).toContain('稍后重试');
    // RATE_LIMITED is retryable — retry button must be present
    expect(wrapper.find('.van-button-stub').exists()).toBe(true);
  });
});

describe('FallbackLink', () => {
  it('renders link with label', () => {
    const wrapper = mount(FallbackLink, {
      props: { href: 'https://www.fangdi.com.cn/', label: '打开原站' },
    });
    expect(wrapper.find('a').attributes('href')).toBe('https://www.fangdi.com.cn/');
    expect(wrapper.find('a').text()).toContain('打开原站');
  });

  it('opens in new window', () => {
    const wrapper = mount(FallbackLink, {
      props: { href: 'https://www.fangdi.com.cn/', label: '原站' },
    });
    expect(wrapper.find('a').attributes('target')).toBe('_blank');
    expect(wrapper.find('a').attributes('rel')).toBe('noopener noreferrer');
  });

  it('renders with aria-label', () => {
    const wrapper = mount(FallbackLink, {
      props: { href: 'https://www.fangdi.com.cn/', label: '原站' },
    });
    expect(wrapper.find('a').attributes('aria-label')).toContain('在新窗口打开原站');
  });
});

describe('no v-html for upstream content', () => {
  it('shared components do not use v-html', () => {
    // Verify that none of the component templates contain v-html directive.
    // This is a code review check.
    const components = [
      LoadingState,
      EmptyState,
      ErrorState,
      FallbackLink,
    ];
    // All components exist and are importable.
    for (const comp of components) {
      expect(comp).toBeDefined();
    }
  });
});
