import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { it } from 'node:test';

const read = (path: string) => readFile(path, 'utf8');

it('defines the exact brand palette and identity gradient as tokens', async () => {
  const css = await read('src/styles/tokens.css');
  for (const value of [
    '#050816',
    '#080c1a',
    '#0b1020',
    '#10172a',
    '#f8fafc',
    '#cbd5e1',
    '#94a3b8',
    '#64748b',
    '#22d3ee',
    '#3b82f6',
    '#8b5cf6',
    '#d946ef',
    'rgba(255, 255, 255, 0.035)',
    'rgba(255, 255, 255, 0.055)',
    'rgba(255, 255, 255, 0.085)',
    'rgba(255, 255, 255, 0.1)',
    'rgba(255, 255, 255, 0.18)',
  ]) {
    assert.match(css.toLowerCase(), new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(
    css.replace(/\s/g, '').toLowerCase(),
    /linear-gradient\(135deg,#22d3ee0%,#3b82f642%,#8b5cf672%,#d946ef100%\)/,
  );
});

it('defines the approved type, spacing, radius, layout, glass, glow, and motion scales', async () => {
  const css = await read('src/styles/tokens.css');
  for (const declaration of [
    '--font-size-hero: clamp(3.4rem, 7vw, 7.2rem)',
    '--font-size-h1: clamp(2.8rem, 5vw, 5.5rem)',
    '--font-size-h2: clamp(2rem, 3.6vw, 3.8rem)',
    '--font-size-h3: clamp(1.4rem, 2vw, 2rem)',
    '--content-wide: 1440px',
    '--content-default: 1280px',
    '--content-editorial: 760px',
    '--radius-sm: 12px',
    '--radius-md: 18px',
    '--radius-lg: 24px',
    '--radius-xl: 32px',
    '--radius-hero: 40px',
    '--duration-micro: 150ms',
    '--duration-normal: 250ms',
    '--duration-premium: 400ms',
    '--duration-section: 600ms',
    '--ease-premium: cubic-bezier(0.22, 1, 0.36, 1)',
  ]) {
    assert.ok(css.includes(declaration), `Missing token: ${declaration}`);
  }
  for (const size of [4, 8, 12, 16, 24, 32, 48, 64, 80, 96, 128, 160]) {
    assert.ok(css.includes(`--space-${size}: ${size}px`), `Missing spacing token ${size}px`);
  }
});

it('loads the three local variable font families with stable fallbacks', async () => {
  const css = await read('src/styles/fonts.css');
  for (const family of ['Manrope Variable', 'Space Grotesk Variable', 'JetBrains Mono Variable']) {
    assert.ok(css.includes(`font-family: '${family}'`), `Missing ${family}`);
  }
  assert.doesNotMatch(css, /https?:\/\//);
  assert.match(css, /font-display:\s*swap/g);
  const tokens = await read('src/styles/tokens.css');
  assert.match(tokens, /--font-body:[^;]*Manrope Variable/);
  assert.match(tokens, /--font-display:[^;]*Space Grotesk Variable/);
  assert.match(tokens, /--font-mono:[^;]*JetBrains Mono Variable/);
});

it('keeps interaction motion bounded and disables it for reduced motion', async () => {
  const [motionCss, motionScript] = await Promise.all([
    read('src/styles/motion.css'),
    read('src/scripts/motion.ts'),
  ]);
  assert.match(motionCss, /prefers-reduced-motion:\s*reduce/);
  assert.match(motionCss, /pointer:\s*fine/);
  assert.match(motionScript, /IntersectionObserver/);
  assert.match(motionScript, /requestAnimationFrame/);
  assert.match(motionScript, /prefers-reduced-motion:\s*reduce/);
  assert.match(motionScript, /pointer:\s*fine/);
  assert.match(motionScript, /MAX_TILT_X\s*=\s*2/);
  assert.match(motionScript, /MAX_TILT_Y\s*=\s*3/);
});

it('provides a geometric AL favicon without text nodes or raster data', async () => {
  const svg = await read('public/favicon.svg');
  assert.match(svg, /viewBox="0 0 64 64"/);
  assert.match(svg, /<path\b/);
  assert.doesNotMatch(svg, /<text\b|data:image|<image\b/i);
});

it('keeps text and CTA color combinations at WCAG AA contrast', async () => {
  const luminance = (hex: string): number => {
    const channels = hex
      .match(/../g)!
      .map((channel) => Number.parseInt(channel, 16) / 255)
      .map((channel) =>
        channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
      );
    return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
  };
  const contrast = (foreground: string, background: string): number => {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (values[0]! + 0.05) / (values[1]! + 0.05);
  };

  for (const text of ['F8FAFC', 'CBD5E1', '94A3B8']) {
    assert.ok(contrast(text, '050816') >= 4.5, `${text} must pass AA on Midnight 950`);
  }
  for (const accent of ['22D3EE', '3B82F6', '8B5CF6', 'D946EF']) {
    assert.ok(contrast('050816', accent) >= 4.5, `Midnight 950 must pass AA on ${accent}`);
  }

  const implementation = await Promise.all([
    read('src/styles/global.css'),
    read('src/pages/index.astro'),
  ]);
  assert.doesNotMatch(implementation.join('\n'), /var\(--text-subtle\)/);
});

it('defines the bounded active state for shared buttons', async () => {
  const component = await read('src/components/shared/Button.astro');
  assert.match(component, /:active\s*\{/);
  assert.match(component, /transform:\s*scale\(0\.98\)/);
});
