const HEX = /^#([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/;

function channelToLinear(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const match = HEX.exec(hex);
  if (!match) {
    throw new Error(`Expected a #RRGGBB colour, got "${hex}"`);
  }
  const [r, g, b] = [match[1], match[2], match[3]].map((part) =>
    channelToLinear(parseInt(part, 16)),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio (1 to 21) between two '#RRGGBB' colours. */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
