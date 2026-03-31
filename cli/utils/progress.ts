const FILLED = "\u2588";
const EMPTY = "\u2591";

export function formatProgressBar(value: number, max: number, width: number = 20): string {
  const filled = Math.round((value / max) * width);
  const bar = FILLED.repeat(filled) + EMPTY.repeat(width - filled);
  return `${bar} ${value}/${max}`;
}
