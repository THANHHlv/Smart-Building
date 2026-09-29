/** Poll only while the page is visible, with one refresh in flight at a time. */
export function startVisiblePolling(
  refresh: () => Promise<unknown>,
  intervalMs: number,
  immediate = true,
  page: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'> = document,
): () => void {
  let stopped = false;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const schedule = () => {
    if (!stopped && page.visibilityState === 'visible') {
      timer = setTimeout(run, intervalMs);
    }
  };
  const run = async () => {
    if (stopped || running || page.visibilityState !== 'visible') return;
    running = true;
    try {
      await refresh();
    } catch {
      console.error('Background refresh failed');
    } finally {
      running = false;
      schedule();
    }
  };
  const onVisibilityChange = () => {
    clearTimeout(timer);
    if (page.visibilityState === 'visible') void run();
  };

  page.addEventListener('visibilitychange', onVisibilityChange);
  if (immediate) void run();
  else schedule();

  return () => {
    stopped = true;
    clearTimeout(timer);
    page.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
