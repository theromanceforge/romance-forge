import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAdsConfig, areAdsEnabled } from '../src/ads/config.js';
import {
  shouldShowInterstitial,
  isEndingDestination,
} from '../src/ads/shouldShow.js';
import {
  getAdsStats,
  bumpAdsStat,
  __resetAdsStatsForTests,
} from '../src/ads/stats.js';
import {
  showInterstitial,
  __resetAdSenseScriptForTests,
} from '../src/ads/interstitial.js';

describe('getAdsConfig / kill switch', () => {
  it('defaults to disabled when env unset', () => {
    const cfg = getAdsConfig({});
    expect(cfg.enabled).toBe(false);
    expect(areAdsEnabled({})).toBe(false);
    expect(cfg.hasClient).toBe(false);
  });

  it('enables only when VITE_ADS_ENABLED is the string true', () => {
    expect(getAdsConfig({ VITE_ADS_ENABLED: 'true' }).enabled).toBe(true);
    expect(getAdsConfig({ VITE_ADS_ENABLED: 'TRUE' }).enabled).toBe(true);
    expect(getAdsConfig({ VITE_ADS_ENABLED: 'false' }).enabled).toBe(false);
    expect(getAdsConfig({ VITE_ADS_ENABLED: '1' }).enabled).toBe(false);
    expect(getAdsConfig({ VITE_ADS_ENABLED: true }).enabled).toBe(true);
  });

  it('reads optional AdSense client + slot', () => {
    const cfg = getAdsConfig({
      VITE_ADS_ENABLED: 'true',
      VITE_ADSENSE_CLIENT_ID: ' ca-pub-123 ',
      VITE_ADSENSE_SLOT: ' 999 ',
    });
    expect(cfg.clientId).toBe('ca-pub-123');
    expect(cfg.slot).toBe('999');
    expect(cfg.hasClient).toBe(true);
  });
});

describe('shouldShowInterstitial matrix', () => {
  const midPath = {
    adsEnabled: true,
    fromSceneId: 'scene1',
    toSceneId: 'scene2a',
    pathLength: 2,
    isEnding: false,
    isAuthFlow: false,
    isStartScene: false,
  };

  it('ads off = no', () => {
    expect(shouldShowInterstitial({ ...midPath, adsEnabled: false })).toBe(false);
  });

  it('mid-path choice = yes when enabled', () => {
    expect(shouldShowInterstitial(midPath)).toBe(true);
  });

  it('first scene of session / start = no', () => {
    expect(
      shouldShowInterstitial({
        ...midPath,
        fromSceneId: '',
        toSceneId: 'scene1',
        pathLength: 1,
        isStartScene: true,
      })
    ).toBe(false);
    expect(
      shouldShowInterstitial({
        ...midPath,
        toSceneId: 'scene1',
        pathLength: 1,
        isStartScene: true,
      })
    ).toBe(false);
    expect(
      shouldShowInterstitial({
        ...midPath,
        pathLength: 1,
      })
    ).toBe(false);
  });

  it('ending / L10 destination = no', () => {
    expect(shouldShowInterstitial({ ...midPath, isEnding: true })).toBe(false);
    expect(
      shouldShowInterstitial({
        ...midPath,
        toSceneId: 'scene10a',
        pathLength: 10,
      })
    ).toBe(false);
  });

  it('auth flow = no', () => {
    expect(shouldShowInterstitial({ ...midPath, isAuthFlow: true })).toBe(false);
  });

  it('replay = no', () => {
    expect(shouldShowInterstitial({ ...midPath, isReplay: true })).toBe(false);
  });

  it('post-play reason allowed when enabled', () => {
    expect(
      shouldShowInterstitial({
        adsEnabled: true,
        reason: 'post-play',
      })
    ).toBe(true);
    expect(
      shouldShowInterstitial({
        adsEnabled: false,
        reason: 'post-play',
      })
    ).toBe(false);
  });
});

describe('isEndingDestination', () => {
  it('detects ending flag, empty choices, layer 10, scene10* ids', () => {
    expect(isEndingDestination({ ending: true, id: 'x' })).toBe(true);
    expect(isEndingDestination({ choices: [], id: 'scene9a' })).toBe(true);
    expect(isEndingDestination({ layer: 10, id: 'scene10a', choices: [] })).toBe(
      true
    );
    expect(isEndingDestination(null, 'scene10f')).toBe(true);
    expect(
      isEndingDestination({ layer: 2, id: 'scene2a', choices: [{}, {}] })
    ).toBe(false);
  });
});

describe('ads stats + interstitial placeholder', () => {
  beforeEach(() => {
    __resetAdsStatsForTests();
    __resetAdSenseScriptForTests();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    __resetAdSenseScriptForTests();
    document.body.innerHTML = '';
  });

  it('bumps counters and mirrors window.__rfAdsStats', () => {
    bumpAdsStat('shown');
    bumpAdsStat('continue');
    bumpAdsStat('sceneAdvance');
    const s = getAdsStats();
    expect(s.shown).toBe(1);
    expect(s.continue).toBe(1);
    expect(s.sceneAdvance).toBe(1);
    expect(window.__rfAdsStats.shown).toBe(1);
  });

  it('shows branded placeholder when enabled without client id; continue works', async () => {
    const cfg = {
      enabled: true,
      clientId: '',
      slot: '',
      hasClient: false,
    };
    const p = showInterstitial({ config: cfg });
    const root = document.querySelector('[data-testid="ads-interstitial"]');
    expect(root).toBeTruthy();
    expect(document.querySelector('[data-testid="ads-placeholder"]')).toBeTruthy();
    expect(
      document.querySelector('[data-testid="ads-slot"]')?.getAttribute('data-ads-mode')
    ).toBe('placeholder');
    document.querySelector('[data-testid="ads-continue"]')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );
    await expect(p).resolves.toBe('continue');
    expect(document.querySelector('[data-testid="ads-interstitial"]')).toBeNull();
    expect(getAdsStats().shown).toBe(1);
    expect(getAdsStats().continue).toBe(1);
  });

  it('skip resolves without leaving overlay behind', async () => {
    const p = showInterstitial({
      config: { enabled: true, clientId: '', slot: '', hasClient: false },
    });
    document.querySelector('[data-testid="ads-skip"]')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );
    await expect(p).resolves.toBe('skip');
    expect(getAdsStats().skip).toBe(1);
  });
});
