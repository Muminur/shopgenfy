import type { FullConfig } from '@playwright/test';

/**
 * Stop everything global-setup started so `playwright test` exits cleanly.
 * A lingering stub process or mongod keeps the runner alive forever.
 */
export default async function globalTeardown(_config: FullConfig): Promise<void> {
  try {
    global.__e2eStubProc?.kill();
  } catch {
    /* ignore */
  }
  try {
    await global.__e2eMongo?.stop();
  } catch {
    /* ignore */
  }
}
