import type { FullConfig } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import * as path from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Ports the app is pointed at via `playwright.config.ts` -> `webServer.env`.
 * Keep these in sync with that file.
 */
export const STUB_PORT = 4545;
export const E2E_MONGO_PORT = 47017;

// Stash the running servers on globalThis so global-teardown (same runner
// process) can stop them and let `playwright test` exit cleanly.
declare global {
  var __e2eStubProc: ChildProcess | undefined;

  var __e2eMongo: MongoMemoryServer | undefined;
}

async function waitForStub(port: number, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  // The stub answers any GET with a PNG; a plain probe suffices.
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/models`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`[e2e-stub] did not become ready on port ${port} within ${timeoutMs}ms`);
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  // 1. Upstream stub (Gemini / Pollinations / GitHub), spawned as its own
  //    single-file process so it stays runnable standalone for debugging.
  const stubPath = path.resolve(__dirname, 'stub-server.mjs');
  const child = spawn(process.execPath, [stubPath], {
    stdio: 'inherit',
    env: { ...process.env, STUB_PORT: String(STUB_PORT) },
  });
  global.__e2eStubProc = child;
  await waitForStub(STUB_PORT);

  // 2. Database. In CI a real mongo service provides MONGODB_URI; locally we
  //    spin up an in-memory mongod on a FIXED port so `webServer.env` can
  //    reference it statically (connect-on-first-request makes setup/webServer
  //    ordering irrelevant).
  if (!process.env.MONGODB_URI) {
    global.__e2eMongo = await MongoMemoryServer.create({
      instance: { port: E2E_MONGO_PORT, ip: '127.0.0.1' },
    });
    // eslint-disable-next-line no-console
    console.log(`[e2e-mongo] in-memory mongod on 127.0.0.1:${E2E_MONGO_PORT}`);
  }
}
