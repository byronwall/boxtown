// Project mutations read project.json, change it, and write it back. Two
// overlapping writes would each start from the same file and the later rename
// would drop the earlier edit, so every mutation runs one at a time.
let tail: Promise<unknown> = Promise.resolve();

export function withProjectWriteLock<T>(run: () => Promise<T>): Promise<T> {
  const result = tail.then(run, run);
  tail = result.catch(() => undefined);
  return result;
}

export function serializeProjectWrite<A extends unknown[], R>(
  mutate: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return (...args) => withProjectWriteLock(() => mutate(...args));
}
