// @vitest-environment node
// Reads the stylesheet from disk; no DOM needed.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Colour tokens parsed from tokens.css (the file the app actually ships). */
const tokens = Object.fromEntries(
  [
    ...readFileSync(new URL('../../src/theme/tokens.css', import.meta.url), 'utf8').matchAll(
      /--(color-[a-z-]+):\s*(#[0-9a-f]{6});/gi,
    ),
  ].map(([, name, hex]) => [name, hex]),
) as Record<string, string>;

/** WCAG 2.1 relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}

function token(name: string): string {
  const value = tokens[name];
  if (!value) throw new Error(`Missing colour token --${name}`);
  return value;
}

describe('theme tokens (NEW-16: WCAG 2.1 AA contrast)', () => {
  it('known reference: black on white is 21:1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  // Text needs 4.5:1 (AA, normal text).
  it.each([
    ['color-text', 'color-bg'],
    ['color-text', 'color-surface'],
    ['color-text-muted', 'color-bg'],
    ['color-text-muted', 'color-surface'],
    ['color-primary', 'color-bg'], // links
    ['color-primary-hover', 'color-bg'],
    ['color-on-primary', 'color-primary'], // buttons
    ['color-on-primary', 'color-primary-hover'],
    ['color-error', 'color-bg'],
    ['color-success', 'color-bg'],
  ])('text --%s on --%s is at least 4.5:1', (foreground, background) => {
    expect(contrast(token(foreground), token(background))).toBeGreaterThanOrEqual(4.5);
  });

  // Focus indicators are non-text UI: 3:1 (WCAG 1.4.11).
  it.each([
    ['color-focus', 'color-bg'],
    ['color-focus', 'color-surface'],
  ])('focus ring --%s on --%s is at least 3:1', (foreground, background) => {
    expect(contrast(token(foreground), token(background))).toBeGreaterThanOrEqual(3);
  });
});
