export function getSessionDeadlineMs({
  examDate,
  startTime,
  durationMinutes,
  extensionMinutes,
}: {
  examDate: string | null;
  startTime: string | null;
  durationMinutes: number;
  extensionMinutes: number;
}): number | null {
  const baseTime = examDate ?? startTime;
  if (!baseTime) return null;
  return (
    new Date(baseTime).getTime() +
    (durationMinutes + extensionMinutes) * 60 * 1000
  );
}
