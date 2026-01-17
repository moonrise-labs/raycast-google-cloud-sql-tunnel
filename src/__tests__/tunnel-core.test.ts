import { describe, expect, it, vi } from 'vitest';

import {
  buildGcloudArgs,
  labelForStatus,
  normalizeConfig,
  parsePort,
  RECENT_ERROR_WINDOW_MS,
  resolveStatus,
  STARTING_GRACE_MS,
} from '../tunnel-core';

describe('parsePort', () => {
  it('parses valid numbers', () => {
    expect(parsePort('15432', 5432)).toBe(15432);
    expect(parsePort('0', 5432)).toBe(0);
  });

  it('falls back on invalid values', () => {
    expect(parsePort('', 5432)).toBe(5432);
    expect(parsePort('abc', 5432)).toBe(5432);
    expect(parsePort(undefined, 1234)).toBe(1234);
  });
});

describe('normalizeConfig', () => {
  it('trims whitespace and applies port defaults', () => {
    const config = normalizeConfig({
      dbPrivateIp: ' 10.0.0.5 ',
      bastionInstance: ' bastion-iap ',
      bastionZone: ' us-central1-a ',
      localPort: '',
      remotePort: '5432',
      gcloudPath: ' /opt/homebrew/bin/gcloud ',
    });

    expect(config.dbPrivateIp).toBe('10.0.0.5');
    expect(config.bastionInstance).toBe('bastion-iap');
    expect(config.bastionZone).toBe('us-central1-a');
    expect(config.localPort).toBe(15432);
    expect(config.remotePort).toBe(5432);
    expect(config.gcloudPath).toBe('/opt/homebrew/bin/gcloud');
  });
});

describe('resolveStatus', () => {
  it('returns connected when port is open', () => {
    expect(resolveStatus({ portOpen: true, pidRunning: false })).toBe('connected');
  });

  it('returns disconnected when no pid is running', () => {
    expect(resolveStatus({ portOpen: false, pidRunning: false })).toBe('disconnected');
  });

  it('returns starting within the grace window', () => {
    vi.useFakeTimers();
    const now = new Date('2024-01-01T00:00:00Z');
    vi.setSystemTime(now);

    const lastStartAt = new Date(now.getTime() - STARTING_GRACE_MS + 1_000).toISOString();
    expect(resolveStatus({ portOpen: false, pidRunning: true, lastStartAt })).toBe('starting');

    vi.useRealTimers();
  });

  it('returns error when pid is running beyond grace window', () => {
    vi.useFakeTimers();
    const now = new Date('2024-01-01T00:00:00Z');
    vi.setSystemTime(now);

    const lastStartAt = new Date(now.getTime() - STARTING_GRACE_MS - 1_000).toISOString();
    expect(resolveStatus({ portOpen: false, pidRunning: true, lastStartAt })).toBe('error');

    vi.useRealTimers();
  });

  it('returns error when pid is running with no start time', () => {
    expect(resolveStatus({ portOpen: false, pidRunning: true })).toBe('error');
  });

  it('returns error when process exited shortly after start', () => {
    vi.useFakeTimers();
    const now = new Date('2024-01-01T00:00:00Z');
    vi.setSystemTime(now);

    const lastStartAt = new Date(now.getTime() - RECENT_ERROR_WINDOW_MS + 1_000).toISOString();
    expect(resolveStatus({ portOpen: false, pidRunning: false, lastStartAt })).toBe('error');

    vi.useRealTimers();
  });

  it('returns disconnected when stopped after start', () => {
    vi.useFakeTimers();
    const now = new Date('2024-01-01T00:00:00Z');
    vi.setSystemTime(now);

    const lastStartAt = new Date(now.getTime() - 10_000).toISOString();
    const lastStopAt = new Date(now.getTime() - 5_000).toISOString();
    expect(resolveStatus({ portOpen: false, pidRunning: false, lastStartAt, lastStopAt })).toBe('disconnected');

    vi.useRealTimers();
  });
});

describe('buildGcloudArgs', () => {
  it('builds the expected gcloud ssh arguments', () => {
    const args = buildGcloudArgs({
      dbPrivateIp: '10.0.0.5',
      bastionInstance: 'bastion-iap',
      bastionZone: 'us-central1-a',
      localPort: 15432,
      remotePort: 5432,
    });

    expect(args).toContain('compute');
    expect(args).toContain('ssh');
    expect(args).toContain('bastion-iap');
    expect(args).toContain('--tunnel-through-iap');
    expect(args).toContain('--quiet');
    expect(args).toContain('-L');
    expect(args).toContain('127.0.0.1:15432:10.0.0.5:5432');
    expect(args).toContain('BatchMode=yes');
  });
});

describe('labelForStatus', () => {
  it('maps statuses to labels', () => {
    expect(labelForStatus('connected')).toBe('Connected');
    expect(labelForStatus('starting')).toBe('Starting');
    expect(labelForStatus('error')).toBe('Error');
    expect(labelForStatus('disconnected')).toBe('Disconnected');
  });
});
