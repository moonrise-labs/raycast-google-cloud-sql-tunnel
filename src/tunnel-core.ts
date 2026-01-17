export const STARTING_GRACE_MS = 20_000;
export const RECENT_ERROR_WINDOW_MS = 5 * 60_000;

export interface Preferences {
  dbPrivateIp: string;
  bastionInstance: string;
  bastionZone: string;
  localPort: string;
  remotePort: string;
  gcloudPath: string;
}

export interface TunnelConfig {
  dbPrivateIp: string;
  bastionInstance: string;
  bastionZone: string;
  localPort: number;
  remotePort: number;
  gcloudPath?: string;
}

export type TunnelStatus = 'connected' | 'starting' | 'error' | 'disconnected';

export function parsePort(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeConfig(preferences: Preferences): TunnelConfig {
  const gcloudPath = preferences.gcloudPath.trim();

  return {
    dbPrivateIp: preferences.dbPrivateIp.trim(),
    bastionInstance: preferences.bastionInstance.trim(),
    bastionZone: preferences.bastionZone.trim(),
    localPort: parsePort(preferences.localPort, 15432),
    remotePort: parsePort(preferences.remotePort, 5432),
    ...(gcloudPath ? { gcloudPath } : {}),
  };
}

export function resolveStatus({
  portOpen,
  pidRunning,
  lastStartAt,
  lastStopAt,
}: {
  portOpen: boolean;
  pidRunning: boolean;
  lastStartAt?: string;
  lastStopAt?: string;
}): TunnelStatus {
  if (portOpen) return 'connected';

  const startedAt = lastStartAt ? Date.parse(lastStartAt) : Number.NaN;
  const stoppedAt = lastStopAt ? Date.parse(lastStopAt) : Number.NaN;
  const hasRecentStart = Number.isFinite(startedAt) && Date.now() - startedAt < STARTING_GRACE_MS;
  const hasRecentErrorWindow = Number.isFinite(startedAt) && Date.now() - startedAt < RECENT_ERROR_WINDOW_MS;
  const stopAfterStart = Number.isFinite(startedAt) && Number.isFinite(stoppedAt) && stoppedAt >= startedAt;

  if (!pidRunning) {
    if (stopAfterStart) return 'disconnected';
    return hasRecentErrorWindow ? 'error' : 'disconnected';
  }

  if (hasRecentStart) return 'starting';
  return 'error';
}

export function buildGcloudArgs(config: TunnelConfig): string[] {
  return [
    'compute',
    'ssh',
    config.bastionInstance,
    `--zone=${config.bastionZone}`,
    '--tunnel-through-iap',
    '--quiet',
    '--',
    '-N',
    '-L',
    `127.0.0.1:${config.localPort}:${config.dbPrivateIp}:${config.remotePort}`,
    '-o',
    'ExitOnForwardFailure=yes',
    '-o',
    'BatchMode=yes',
    '-o',
    'StrictHostKeyChecking=accept-new',
    '-o',
    'ServerAliveInterval=30',
    '-o',
    'ServerAliveCountMax=3',
  ];
}

export function labelForStatus(status: TunnelStatus): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'starting':
      return 'Starting';
    case 'error':
      return 'Error';
    default:
      return 'Disconnected';
  }
}
