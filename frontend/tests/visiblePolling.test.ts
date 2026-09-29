import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startVisiblePolling } from '../src/services/visiblePolling.ts';

class Page extends EventTarget {
  visibilityState: 'visible' | 'hidden' = 'visible';
  change(state: 'visible' | 'hidden') {
    this.visibilityState = state;
    this.dispatchEvent(new Event('visibilitychange'));
  }
}

const settle = async () => { await Promise.resolve(); await Promise.resolve(); };

test('hidden page does not poll, returning to it refreshes, cleanup stops polling', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const page = new Page();
  page.visibilityState = 'hidden';
  let calls = 0;
  const stop = startVisiblePolling(async () => { calls++; }, 100, true, page);
  t.mock.timers.tick(1000);
  assert.equal(calls, 0);
  page.change('visible');
  await settle();
  assert.equal(calls, 1);
  page.change('hidden');
  t.mock.timers.tick(1000);
  assert.equal(calls, 1);
  page.change('visible');
  await settle();
  assert.equal(calls, 2);
  stop();
  t.mock.timers.tick(1000);
  page.change('visible');
  assert.equal(calls, 2);
});

test('slow resume never overlaps polling and stopped pending refresh stays stopped', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const page = new Page();
  let release!: () => void;
  let calls = 0;
  const stop = startVisiblePolling(() => {
    calls++;
    return new Promise<void>((resolve) => { release = resolve; });
  }, 100, true, page);
  t.mock.timers.tick(1000);
  page.change('hidden');
  page.change('visible');
  assert.equal(calls, 1);
  stop();
  release();
  await settle();
  t.mock.timers.tick(1000);
  assert.equal(calls, 1);
});

test('normal polling waits for completion then interval, deferred start preserves cadence', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const page = new Page();
  let calls = 0;
  const stop = startVisiblePolling(async () => { calls++; }, 100, false, page);
  assert.equal(calls, 0);
  t.mock.timers.tick(100);
  await settle();
  assert.equal(calls, 1);
  t.mock.timers.tick(100);
  await settle();
  assert.equal(calls, 2);
  stop();
});
