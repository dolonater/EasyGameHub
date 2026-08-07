function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function hslTriplet(h: number, s: number, l: number) {
  return `${h} ${s}% ${l}%`;
}

export interface ExtractedAppearancePalette {
  primary: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
  foreground: string;
  cardForeground: string;
  secondaryForeground: string;
  mutedForeground: string;
  ring: string;
}

export function extractAppearancePaletteFromImage(image: HTMLImageElement): ExtractedAppearancePalette {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return {
      primary: "240 5.9% 10%",
      primaryForeground: "0 0% 98%",
      accent: "240 4.8% 95.9%",
      accentForeground: "240 5.9% 10%",
      foreground: "240 10% 3.9%",
      cardForeground: "240 10% 3.9%",
      secondaryForeground: "240 5.9% 10%",
      mutedForeground: "240 3.8% 46.1%",
      ring: "240 5.9% 10%",
    };
  }

  const sampleWidth = 32;
  const sampleHeight = 32;
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  ctx.drawImage(image, 0, 0, sampleWidth, sampleHeight);

  const { data } = ctx.getImageData(0, 0, sampleWidth, sampleHeight);
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 16) continue;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    count += 1;
  }

  if (count === 0) {
    return {
      primary: "240 5.9% 10%",
      primaryForeground: "0 0% 98%",
      accent: "240 4.8% 95.9%",
      accentForeground: "240 5.9% 10%",
      foreground: "240 10% 3.9%",
      cardForeground: "240 10% 3.9%",
      secondaryForeground: "240 5.9% 10%",
      mutedForeground: "240 3.8% 46.1%",
      ring: "240 5.9% 10%",
    };
  }

  const avg = {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count),
  };
  const { h, s, l } = rgbToHsl(avg.r, avg.g, avg.b);

  const boostedS = Math.max(s, 48);
  const primaryL = l > 55 ? Math.max(32, l - 24) : Math.min(68, l + 12);
  const accentL = l > 55 ? Math.max(26, l - 18) : Math.min(74, l + 18);
  const isDarkImage = l < 45;

  return {
    primary: hslTriplet(h, boostedS, primaryL),
    primaryForeground: isDarkImage ? "0 0% 98%" : "240 5.9% 10%",
    accent: hslTriplet((h + 12) % 360, Math.max(boostedS - 6, 36), accentL),
    accentForeground: isDarkImage ? "0 0% 98%" : "240 5.9% 10%",
    foreground: isDarkImage ? "0 0% 98%" : "240 10% 3.9%",
    cardForeground: isDarkImage ? "0 0% 98%" : "240 10% 3.9%",
    secondaryForeground: isDarkImage ? "0 0% 98%" : "240 5.9% 10%",
    mutedForeground: isDarkImage ? "240 5% 78%" : "240 3.8% 32%",
    ring: hslTriplet(h, boostedS, primaryL),
  };
}
