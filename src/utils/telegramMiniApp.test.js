import {
  getMiniAppStartParam,
  isMiniAppServicesStart,
  isTelegramMiniApp,
} from './telegramMiniApp';

describe('telegramMiniApp utilities', () => {
  beforeEach(() => {
    delete window.Telegram;
    window.location.hash = '';
  });

  test('does not identify a normal browser as a Mini App', () => {
    expect(isTelegramMiniApp()).toBe(false);
  });

  test('identifies a signed Telegram Mini App session', () => {
    window.Telegram = { WebApp: { initData: 'signed-init-data' } };
    expect(isTelegramMiniApp()).toBe(true);
  });

  test('reads and normalizes Telegram start parameters', () => {
    window.Telegram = { WebApp: { initDataUnsafe: { start_param: 'Services' } } };
    expect(getMiniAppStartParam()).toBe('services');
    expect(isMiniAppServicesStart()).toBe(true);
  });

  test('falls back to the Telegram hash start parameter', () => {
    window.location.hash = '#tgWebAppStartParam=shop';
    expect(getMiniAppStartParam()).toBe('shop');
    expect(isMiniAppServicesStart()).toBe(true);
  });
});
