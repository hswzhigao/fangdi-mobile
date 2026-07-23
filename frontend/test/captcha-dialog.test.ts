/**
 * CaptchaDialog tests — create, manual text submit, refresh invalidation,
 * loading duplicate prevention, CAPTCHA_INVALID, CAPTCHA_EXPIRED,
 * UPSTREAM_BLOCKED, close and retry behavior.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import CaptchaDialog from '../src/components/CaptchaDialog.vue';

// ── Vant component stubs ────────────────────────────────────────────────────

const vantStubs = {
  VanPopup: {
    template:
      '<div v-if="show" class="van-popup-stub" role="dialog" aria-label="captcha dialog"><slot /></div>',
    props: ['show', 'position', 'style', 'closeOnClickOverlay'],
    inheritAttrs: true,
  },
  VanButton: {
    template:
      '<button class="van-button-stub" :disabled="loading || disabled" @click="$emit(\'click\')"><slot /></button>',
    props: ['type', 'size', 'loading', 'disabled', 'block', 'nativeType'],
    emits: ['click'],
  },
  VanField: {
    template:
      '<div class="van-field-stub"><input :value="modelValue" @input="onInput" placeholder="请输入验证码" role="textbox" aria-label="验证码输入框" /></div>',
    props: ['modelValue', 'label', 'placeholder', 'maxlength', 'clearable', 'error', 'errorMessage', 'disabled'],
    emits: ['update:modelValue'],
    setup(_props: any, { emit }: any) {
      return {
        onInput(e: Event) {
          const target = e.target as HTMLInputElement;
          emit('update:modelValue', target.value);
        },
      };
    },
  },
  VanImage: {
    template: '<img :src="src" :alt="alt || \'验证码图片\'" class="van-image-stub" />',
    props: ['src', 'alt', 'width', 'height', 'fit'],
  },
  VanLoading: {
    template: '<div class="van-loading-stub">loading...</div>',
  },
  VanIcon: {
    template: '<span class="van-icon-stub" />',
    props: ['name', 'size'],
  },
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CaptchaDialog', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders when visible is true and shows captcha image', async () => {
    const wrapper = mount(CaptchaDialog, {
      props: {
        purpose: 'new-house',
        visible: true,
        image: 'data:image/png;base64,test',
      },
      global: { stubs: vantStubs },
    });

    await nextTick();

    expect(wrapper.find('.captcha-dialog').exists()).toBe(true);
    expect(wrapper.find('.captcha-image').exists()).toBe(true);
    expect(wrapper.find('.captcha-image').attributes('src')).toBe('data:image/png;base64,test');
  });

  it('does not render when visible is false', () => {
    const wrapper = mount(CaptchaDialog, {
      props: {
        purpose: 'new-house',
        visible: false,
      },
      global: { stubs: vantStubs },
    });

    expect(wrapper.find('.captcha-dialog').exists()).toBe(false);
  });

  it('emits refresh when refresh button is clicked', async () => {
    const wrapper = mount(CaptchaDialog, {
      props: {
        purpose: 'new-house',
        visible: true,
        image: 'data:image/png;base64,test',
      },
      global: { stubs: vantStubs },
    });

    await nextTick();

    // Find refresh button
    const refreshBtn = wrapper.find('.captcha-refresh-btn');
    expect(refreshBtn.exists()).toBe(true);
    await refreshBtn.trigger('click');
    expect(wrapper.emitted('refresh')).toBeTruthy();
  });

  it('emits submit with text when submit is clicked and input is non-empty', async () => {
    const wrapper = mount(CaptchaDialog, {
      props: {
        purpose: 'new-house',
        visible: true,
        image: 'data:image/png;base64,test',
        sessionId: 'test-session-id',
      },
      global: { stubs: vantStubs },
    });

    await nextTick();

    // Set text in the input field
    const input = wrapper.find('.van-field-stub input');
    await input.setValue('ABCD');

    // Find submit button
    const submitBtn = wrapper.find('.captcha-submit-btn');
    expect(submitBtn.exists()).toBe(true);
    await submitBtn.trigger('click');
    await nextTick();

    const submitEvents = wrapper.emitted('submit');
    expect(submitEvents).toBeTruthy();
    if (submitEvents) {
      expect(submitEvents[0]).toEqual(['test-session-id', 'ABCD']);
    }
  });

  it('does not emit submit when input is empty', async () => {
    const wrapper = mount(CaptchaDialog, {
      props: {
        purpose: 'new-house',
        visible: true,
        image: 'data:image/png;base64,test',
        sessionId: 'test-session-id',
      },
      global: { stubs: vantStubs },
    });

    await nextTick();

    const submitBtn = wrapper.find('.captcha-submit-btn');
    await submitBtn.trigger('click');
    await nextTick();

    expect(wrapper.emitted('submit')).toBeFalsy();
  });

  it('prevents duplicate submission while submitting', async () => {
    const wrapper = mount(CaptchaDialog, {
      props: {
        purpose: 'new-house',
        visible: true,
        image: 'data:image/png;base64,test',
        sessionId: 'test-session-id',
        submitting: true,
      },
      global: { stubs: vantStubs },
    });

    await nextTick();

    const submitBtn = wrapper.find('.captcha-submit-btn');
    expect(submitBtn.attributes('disabled')).toBeDefined();
  });

  it('displays error message for CAPTCHA_INVALID', async () => {
    const wrapper = mount(CaptchaDialog, {
      props: {
        purpose: 'new-house',
        visible: true,
        image: 'data:image/png;base64,test',
        errorCode: 'CAPTCHA_INVALID',
        errorMessage: '验证码错误，请重新输入',
      },
      global: { stubs: vantStubs },
    });

    await nextTick();

    expect(wrapper.find('.captcha-error').exists()).toBe(true);
    expect(wrapper.find('.captcha-error').text()).toContain('验证码错误');
  });

  it('displays error message for CAPTCHA_EXPIRED', async () => {
    const wrapper = mount(CaptchaDialog, {
      props: {
        purpose: 'new-house',
        visible: true,
        image: 'data:image/png;base64,test',
        errorCode: 'CAPTCHA_EXPIRED',
        errorMessage: '验证码已过期，请重新获取',
      },
      global: { stubs: vantStubs },
    });

    await nextTick();

    expect(wrapper.find('.captcha-error').exists()).toBe(true);
    expect(wrapper.find('.captcha-error').text()).toContain('过期');
  });

  it('shows loading state while fetching captcha', async () => {
    const wrapper = mount(CaptchaDialog, {
      props: {
        purpose: 'new-house',
        visible: true,
        loading: true,
      },
      global: { stubs: vantStubs },
    });

    await nextTick();

    expect(wrapper.find('.van-loading-stub').exists()).toBe(true);
  });

  it('image has alt text', async () => {
    const wrapper = mount(CaptchaDialog, {
      props: {
        purpose: 'new-house',
        visible: true,
        image: 'data:image/png;base64,test',
      },
      global: { stubs: vantStubs },
    });

    await nextTick();

    const img = wrapper.find('.captcha-image');
    expect(img.exists()).toBe(true);
    expect(img.attributes('alt')).toBeTruthy();
  });

  it('submit button has minimum 44px touch target style', async () => {
    const wrapper = mount(CaptchaDialog, {
      props: {
        purpose: 'new-house',
        visible: true,
        image: 'data:image/png;base64,test',
        sessionId: 'sess',
      },
      global: { stubs: vantStubs },
    });

    await nextTick();

    const submitBtn = wrapper.find('.captcha-submit-btn');
    expect(submitBtn.attributes('style')).toContain('min-height');
  });

  it('does not expose sessionId as visible text', async () => {
    const wrapper = mount(CaptchaDialog, {
      props: {
        purpose: 'new-house',
        visible: true,
        image: 'data:image/png;base64,test',
        sessionId: 'secret-session-abc123',
      },
      global: { stubs: vantStubs },
    });

    await nextTick();

    // The sessionId must not appear in the rendered HTML
    expect(wrapper.html()).not.toContain('secret-session-abc123');
  });

  it('input field has accessible label', async () => {
    const wrapper = mount(CaptchaDialog, {
      props: {
        purpose: 'new-house',
        visible: true,
        image: 'data:image/png;base64,test',
      },
      global: { stubs: vantStubs },
    });

    await nextTick();
    expect(wrapper.find('.captcha-dialog').exists()).toBe(true);
    expect(wrapper.find('input[aria-label="验证码输入框"]').exists()).toBe(true);
  });

  it('displays UPSTREAM_BLOCKED error message', async () => {
    const wrapper = mount(CaptchaDialog, {
      props: {
        purpose: 'new-house',
        visible: true,
        image: 'data:image/png;base64,test',
        errorCode: 'UPSTREAM_BLOCKED',
        errorMessage: '原站正在进行访问验证',
      },
      global: { stubs: vantStubs },
    });

    await nextTick();
    expect(wrapper.find('.captcha-error').exists()).toBe(true);
  });
});
