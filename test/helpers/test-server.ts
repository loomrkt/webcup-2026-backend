import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';

export interface TestServer {
  base: string;
  close: () => Promise<void>;
}

const ROOT = path.resolve(__dirname, '..', '..');
export interface TestServerOptions {
  /** Working directory of the spawned server (default: nest-app root) */
  cwd?: string;
  /** Entry relative to cwd (default: dist/main.js) */
  entry?: string;
}

export async function startTestServer(
  port = 5100,
  env: Record<string, string> = {},
  opts: TestServerOptions = {},
): Promise<TestServer> {
  const cwd = opts.cwd ?? ROOT;
  const entry = opts.entry ?? 'dist/main.js';
  const proc: ChildProcess = spawn(process.execPath, [entry], {
    cwd,
    env: { ...process.env, PORT: String(port), ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let bootErr = '';
  let bootOut = '';
  if (proc.stderr) {
    proc.stderr.on('data', (d: Buffer) => {
      bootErr += d.toString();
    });
  }
  if (proc.stdout) {
    proc.stdout.on('data', (d: Buffer) => {
      bootOut += d.toString();
    });
  }
  const base = `http://127.0.0.1:${port}/api`;
  const deadline = Date.now() + 45000;

  for (;;) {
    if (Date.now() > deadline) {
      proc.kill('SIGKILL');
      throw new Error(
        `Test server did not start in time cwd=${cwd} entry=${entry}\nERR: ${bootErr.slice(-1500)}\nOUT: ${bootOut.slice(-800)}`,
      );
    }
    try {
      const res = await fetch(base + '/');
      if (res.status >= 200 && res.status < 500) break;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  return {
    base,
    close: () =>
      new Promise<void>((resolve) => {
        proc.kill('SIGTERM');
        setTimeout(resolve, 500);
      }),
  };
}

export async function post(
  srv: TestServer,
  url: string,
  body: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(srv.base + url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return {
    status: res.status,
    body: (await res.json()) as Record<string, unknown>,
  };
}

export async function get(
  srv: TestServer,
  url: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(srv.base + url, { headers });
  return {
    status: res.status,
    body: (await res.json()) as Record<string, unknown>,
  };
}
