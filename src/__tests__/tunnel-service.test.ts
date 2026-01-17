import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TunnelConfig } from '../tunnel-core';

declare global {
  // Set per-test to control where tunnel-service writes state.
  var __TEST_SUPPORT_PATH__: string | undefined;
}

const openMock = vi.fn();
const spawnMock = vi.fn();

vi.mock('@raycast/api', () => ({
  environment: {
    get supportPath() {
      return globalThis.__TEST_SUPPORT_PATH__ ?? '';
    },
  },
  open: (...args: unknown[]) => openMock(...args),
}));

vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

async function loadService(tempDir: string) {
  globalThis.__TEST_SUPPORT_PATH__ = tempDir;
  vi.resetModules();
  return await import('../tunnel-service');
}

function baseConfig(overrides: Partial<TunnelConfig> = {}): TunnelConfig {
  return {
    dbPrivateIp: '10.0.0.5',
    bastionInstance: 'bastion-iap',
    bastionZone: 'us-east4-a',
    localPort: 65534,
    remotePort: 5432,
    ...overrides,
  };
}

async function getClosedPort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const port = (server.address() as net.AddressInfo).port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

describe('tunnel-service', () => {
  beforeEach(() => {
    openMock.mockReset();
    spawnMock.mockReset();
  });

  afterEach(() => {
    globalThis.__TEST_SUPPORT_PATH__ = undefined;
    vi.restoreAllMocks();
  });

  it('reports connected when the local port is open', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'raycast-tunnel-'));
    const { getStatusInfo } = await loadService(tempDir);

    const server = net.createServer();
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const port = (server.address() as net.AddressInfo).port;
    const info = await getStatusInfo(baseConfig({ localPort: port }));

    expect(info.status).toBe('connected');
    expect(info.portOpen).toBe(true);

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('returns log tail when the last start ended in error', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'raycast-tunnel-'));
    const { getStatusInfo } = await loadService(tempDir);

    const lastStartAt = new Date(Date.now() - 60_000).toISOString();
    await fs.writeFile(path.join(tempDir, 'tunnel-state.json'), JSON.stringify({ lastStartAt }, null, 2), 'utf8');
    await fs.writeFile(path.join(tempDir, 'tunnel.log'), 'line-1\nline-2\n', 'utf8');

    const info = await getStatusInfo(baseConfig({ localPort: await getClosedPort() }));

    expect(info.status).toBe('error');
    expect(info.logTail).toContain('line-1');
  });

  it('spawns the tunnel and writes pid/state', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'raycast-tunnel-'));
    const { startTunnel } = await loadService(tempDir);

    const gcloudPath = path.join(tempDir, 'gcloud');
    await fs.writeFile(gcloudPath, '#!/bin/sh\necho gcloud\n', 'utf8');
    await fs.chmod(gcloudPath, 0o755);

    spawnMock.mockImplementation(() => {
      const child = new EventEmitter() as EventEmitter & { pid: number; unref: () => void };
      child.pid = 4321;
      child.unref = vi.fn();
      queueMicrotask(() => {
        child.emit('spawn');
      });
      setTimeout(() => {
        child.emit('exit');
      }, 0);
      return child;
    });

    await startTunnel(baseConfig({ gcloudPath, localPort: await getClosedPort() }));

    const pidValue = await fs.readFile(path.join(tempDir, 'tunnel.pid'), 'utf8');
    expect(pidValue.trim()).toBe('4321');

    const state = JSON.parse(await fs.readFile(path.join(tempDir, 'tunnel-state.json'), 'utf8')) as {
      lastPid: number;
      lastStartAt: string;
    };
    expect(state.lastPid).toBe(4321);
    expect(state.lastStartAt).toBeTruthy();

    const log = await fs.readFile(path.join(tempDir, 'tunnel.log'), 'utf8');
    expect(log).toContain('Starting tunnel');
  });

  it('stops the tunnel and clears the pid file', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'raycast-tunnel-'));
    const { stopTunnel } = await loadService(tempDir);

    await fs.writeFile(path.join(tempDir, 'tunnel.pid'), '9999', 'utf8');

    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
      throw new Error('ESRCH');
    });

    await stopTunnel(baseConfig({ localPort: await getClosedPort() }));

    await expect(fs.readFile(path.join(tempDir, 'tunnel.pid'), 'utf8')).rejects.toThrow();

    const state = JSON.parse(await fs.readFile(path.join(tempDir, 'tunnel-state.json'), 'utf8')) as {
      lastStopAt: string;
    };
    expect(state.lastStopAt).toBeTruthy();

    killSpy.mockRestore();
  });

  it('opens the log file with Raycast', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'raycast-tunnel-'));
    const { openLogFile } = await loadService(tempDir);

    await openLogFile();

    expect(openMock).toHaveBeenCalledWith(path.join(tempDir, 'tunnel.log'));
  });
});
