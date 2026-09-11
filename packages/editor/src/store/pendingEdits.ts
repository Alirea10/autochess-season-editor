import { flushSync } from "react-dom";
const pending = new Set<() => void>();
export function registerPendingEdit(flush: () => void) {
  pending.add(flush);
  return () => {
    flush();
    pending.delete(flush);
  };
}
export function flushPendingEdits() {
  if (pending.size)
    flushSync(() => {
      for (const flush of [...pending]) flush();
    });
}
