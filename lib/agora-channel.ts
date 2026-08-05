export const AGORA_SHARD_COUNT = 20;
// 샤드(감독 영상 페이지)당 정원 · 감독관 웹캠 동시 라이브 한도(MAX_LIVE_WEBCAMS)와 일치
export const AGORA_SHARD_CAPACITY = 8;

export function getAgoraShard(sessionId: string): number {
  let hash = 0;
  for (const character of sessionId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash % AGORA_SHARD_COUNT;
}

/** DB에 저장된 샤드가 있으면 사용, 없으면(구 세션) 해시 폴백 */
export function resolveAgoraShard(
  sessionId: string,
  stored?: number | null
): number {
  return isAgoraShard(stored) ? stored : getAgoraShard(sessionId);
}

export function isAgoraShard(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < AGORA_SHARD_COUNT
  );
}
