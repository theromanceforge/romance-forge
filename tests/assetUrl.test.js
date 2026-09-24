import { describe, it, expect } from 'vitest';
import { assetUrl } from '../src/assetUrl.js';

describe('assetUrl', () => {
  // vite.config.js sets base to '/romance-forge/' (or VITE_BASE)
  it('prefixes root-relative brand/art paths with Vite BASE_URL', () => {
    expect(assetUrl('/brand/logo-heart-anvil.png')).toBe(
      '/romance-forge/brand/logo-heart-anvil.png'
    );
    expect(assetUrl('/art/until-the-quiet-breaks/scene1.png')).toBe(
      '/romance-forge/art/until-the-quiet-breaks/scene1.png'
    );
  });

  it('leaves http(s) URLs unchanged', () => {
    expect(assetUrl('https://cdn.example/cover.png')).toBe(
      'https://cdn.example/cover.png'
    );
    expect(assetUrl('http://cdn.example/cover.png')).toBe(
      'http://cdn.example/cover.png'
    );
  });

  it('is idempotent when path already includes the base', () => {
    const once = assetUrl('/brand/cover.png');
    expect(assetUrl(once)).toBe(once);
    expect(
      assetUrl('/romance-forge/brand/logo-heart-anvil.png')
    ).toBe('/romance-forge/brand/logo-heart-anvil.png');
  });

  it('passes through empty or non-string values', () => {
    expect(assetUrl('')).toBe('');
    expect(assetUrl(null)).toBe(null);
    expect(assetUrl(undefined)).toBe(undefined);
  });
});
