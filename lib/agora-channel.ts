export const AGORA_SHARD_COUNT = 20;

export function getAgoraShard(sessionId: string): number {
  let hash = 0;
  for (const character of sessionId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash % AGORA_SHARD_COUNT;
}

export function isAgoraShard(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < AGORA_SHARD_COUNT
  );
}
