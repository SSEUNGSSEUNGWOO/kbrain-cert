/**
 * 응시자 답안 오프라인 큐 · IndexedDB 기반
 * - 자동저장이 네트워크 실패로 3회 재시도 소진 시 여기에 push
 * - 재연결 시 (`online` 이벤트 · mount 시) drain 해서 서버로 재전송
 * - 세션 종료 후 안 남도록 성공 시 즉시 제거
 */

export type QueuedAnswer = {
  sessionId: string;
  questionId: string;
  slotValues: Record<string, unknown>;
  savedAt: number;
};

export type QueuedAnswerRow = QueuedAnswer & { id: number };

const DB_NAME = "kbrain-exam-offline";
const STORE_NAME = "answers-queue";
const VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          autoIncrement: true,
          keyPath: "id",
        });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueAnswer(item: QueuedAnswer): Promise<boolean> {
  try {
    const db = await openDb();
    return new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).add(item);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export async function listQueue(
  sessionId: string
): Promise<QueuedAnswerRow[]> {
  try {
    const db = await openDb();
    return new Promise<QueuedAnswerRow[]>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => {
        const rows = (req.result ?? []) as QueuedAnswerRow[];
        resolve(rows.filter((row) => row.sessionId === sessionId));
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function removeFromQueue(id: number): Promise<void> {
  try {
    const db = await openDb();
    return new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* ignore */
  }
}
