import { spawn } from 'child_process';
import fs from 'fs/promises';
import net from 'net';
import path from 'path';

import { environment, open } from '@raycast/api';

import { buildGcloudArgs, resolveStatus, type TunnelConfig, type TunnelStatus } from './tunnel-core';

const LOG_TAIL_LINES = 20;
const SUPPORT_PATH = environment.supportPath;
const PID_PATH = path.join(SUPPORT_PATH, 'tunnel.pid');
const STATE_PATH = path.join(SUPPORT_PATH, 'tunnel-state.json');
const LOG_PATH = path.join(SUPPORT_PATH, 'tunnel.log');
const DEFAULT_ENV_PATH = `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH ?? ''}`;

interface TunnelStateFile {
  lastStartAt?: string;
  lastStopAt?: string;
  lastPid?: number;
}

export interface StatusInfo {
  status: TunnelStatus;
  pid?: number;
  portOpen: boolean;
  pidRunning: boolean;
  lastStartAt?: string;
  logTail?: string;
}

export async function getStatusInfo(config: TunnelConfig): Promise<StatusInfo> {
  await ensureSupportDir();

  const pid = await readPid();
  const pidRunning = pid ? isProcessRunning(pid) : false;

  if (pid && !pidRunning) {
    await clearPid();
  }

  const portOpen = await isPortOpen(config.localPort);
  const state = await readState();
  const status = resolveStatus({
    portOpen,
    pidRunning,
    ...(state.lastStartAt ? { lastStartAt: state.lastStartAt } : {}),
    ...(state.lastStopAt ? { lastStopAt: state.lastStopAt } : {}),
  });
  const logTail = status === 'error' ? await readLogTail() : undefined;

  return {
    status,
    portOpen,
    pidRunning,
    ...(typeof pid === 'number' ? { pid } : {}),
    ...(state.lastStartAt ? { lastStartAt: state.lastStartAt } : {}),
    ...(logTail ? { logTail } : {}),
  };
}

export async function startTunnel(config: TunnelConfig): Promise<void> {
  await ensureSupportDir();

  if (!config.dbPrivateIp || !config.bastionInstance || !config.bastionZone) {
    throw new Error('Missing required configuration. Open preferences to set DB and bastion details.');
  }

  const statusInfo = await getStatusInfo(config);
  if (statusInfo.status === 'connected' || statusInfo.status === 'starting') {
    return;
  }

  const gcloudPath = await resolveGcloudPath(config.gcloudPath);
  const args = buildGcloudArgs(config);
  const commandPreview = `${gcloudPath} ${args.join(' ')}`;

  await appendLog(`\n[${nowIso()}] Starting tunnel...`);
  await appendLog(`\n[${nowIso()}] Command: ${commandPreview}\n`);

  const logHandle = await fs.open(LOG_PATH, 'a');
  let child: ReturnType<typeof spawn> | undefined;
  const shellCommand = buildShellCommand(gcloudPath, args);

  try {
    child = spawn('/bin/zsh', ['-lc', shellCommand], {
      detached: true,
      stdio: ['ignore', logHandle.fd, logHandle.fd],
      env: {
        ...process.env,
        PATH: DEFAULT_ENV_PATH,
        CLOUDSDK_CORE_DISABLE_PROMPTS: '1',
        LC_ALL: 'C',
        LANG: 'C',
      },
    });

    await new Promise<void>((resolve, reject) => {
      child?.once('error', reject);
      child?.once('spawn', () => resolve());
    });
  } finally {
    await logHandle.close();
  }

  if (!child?.pid) {
    throw new Error('Failed to start gcloud tunnel.');
  }

  child.unref();

  await writePid(child.pid);
  await writeState({ lastStartAt: nowIso(), lastPid: child.pid });

  if (await didExitQuickly(child, 1500)) {
    await appendLog(`\n[${nowIso()}] Tunnel process exited early.`);
  }
}

export async function stopTunnel(config: TunnelConfig): Promise<void> {
  await ensureSupportDir();

  const pid = await readPid();
  if (pid) {
    await terminateProcess(pid);
  }

  await clearPid();
  await appendLog(`\n[${nowIso()}] Stopping tunnel...`);
  await writeState({ lastStopAt: nowIso() });

  await waitForPortClosed(config.localPort, 2_000);
}

export async function openLogFile(): Promise<void> {
  await ensureSupportDir();
  await fs.appendFile(LOG_PATH, '');
  await open(LOG_PATH);
}

function nowIso(): string {
  return new Date().toISOString();
}

async function ensureSupportDir(): Promise<void> {
  await fs.mkdir(SUPPORT_PATH, { recursive: true });
}

async function resolveGcloudPath(preferred?: string): Promise<string> {
  if (preferred && (await pathExists(preferred))) {
    return preferred;
  }

  const candidates = ['/opt/homebrew/bin/gcloud', '/usr/local/bin/gcloud', '/usr/bin/gcloud'];
  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return 'gcloud';
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function buildShellCommand(gcloudPath: string, args: string[]): string {
  return [shellEscape(gcloudPath), ...args.map(shellEscape)].join(' ');
}

function shellEscape(value: string): string {
  const quote = "'";
  const escapedQuote = `${quote}"${quote}"${quote}`;
  return `${quote}${value.replace(/'/g, escapedQuote)}${quote}`;
}

async function appendLog(message: string): Promise<void> {
  await ensureSupportDir();
  await fs.appendFile(LOG_PATH, message);
}

async function readLogTail(): Promise<string | undefined> {
  try {
    const content = await fs.readFile(LOG_PATH, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    if (lines.length === 0) return undefined;
    return lines.slice(-LOG_TAIL_LINES).join('\n');
  } catch {
    return undefined;
  }
}

async function readPid(): Promise<number | undefined> {
  try {
    const value = await fs.readFile(PID_PATH, 'utf8');
    const pid = Number.parseInt(value.trim(), 10);
    return Number.isFinite(pid) ? pid : undefined;
  } catch {
    return undefined;
  }
}

async function writePid(pid: number): Promise<void> {
  await ensureSupportDir();
  await fs.writeFile(PID_PATH, `${pid}`, 'utf8');
}

async function clearPid(): Promise<void> {
  try {
    await fs.unlink(PID_PATH);
  } catch {
    // Ignore missing PID file.
  }
}

async function readState(): Promise<TunnelStateFile> {
  try {
    const value = await fs.readFile(STATE_PATH, 'utf8');
    return JSON.parse(value) as TunnelStateFile;
  } catch {
    return {};
  }
}

async function writeState(update: TunnelStateFile): Promise<void> {
  const current = await readState();
  const next = { ...current, ...update };
  await fs.writeFile(STATE_PATH, JSON.stringify(next, null, 2), 'utf8');
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function terminateProcess(pid: number): Promise<void> {
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      return;
    }
  }

  await waitForExit(pid, 1_500);

  if (isProcessRunning(pid)) {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        return;
      }
    }
  }
}

async function waitForExit(pid: number, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!isProcessRunning(pid)) return;
    await delay(200);
  }
}

async function waitForPortClosed(port: number, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!(await isPortOpen(port))) return;
    await delay(200);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function didExitQuickly(child: ReturnType<typeof spawn>, timeoutMs: number): Promise<boolean> {
  const exitPromise = new Promise<boolean>((resolve) => {
    child.once('exit', () => resolve(true));
  });
  const timeoutPromise = new Promise<boolean>((resolve) => {
    setTimeout(() => resolve(false), timeoutMs);
  });

  return Promise.race([exitPromise, timeoutPromise]);
}

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    const onFail = () => {
      socket.destroy();
      resolve(false);
    };

    socket.setTimeout(500);
    socket.once('error', onFail);
    socket.once('timeout', onFail);
    socket.connect(port, '127.0.0.1', () => {
      socket.end();
      resolve(true);
    });
  });
}
