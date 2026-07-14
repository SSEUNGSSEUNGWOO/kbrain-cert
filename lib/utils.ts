export function cn(...args: Array<string | undefined | null | false>): string {
  return args.filter(Boolean).join(" ");
}

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function toPercentage(raw: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round((raw / max) * 100);
}
