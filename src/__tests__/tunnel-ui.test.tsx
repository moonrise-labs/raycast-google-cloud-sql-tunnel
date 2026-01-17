// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import Command from '../tunnel';

const getStatusInfoMock = vi.fn().mockResolvedValue({
  status: 'connected',
  portOpen: true,
  pidRunning: true,
});

vi.mock('../tunnel-service', () => ({
  getStatusInfo: (...args: unknown[]) => getStatusInfoMock(...args),
  openLogFile: vi.fn(),
  startTunnel: vi.fn(),
  stopTunnel: vi.fn(),
}));

vi.mock('@raycast/api', () => {
  const MenuBarExtra = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  (MenuBarExtra as { Section?: unknown }).Section = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  (MenuBarExtra as { Item?: unknown }).Item = ({ title }: { title: string }) => <div>{title}</div>;

  return {
    Clipboard: { copy: vi.fn() },
    Color: {
      Green: 'green',
      Yellow: 'yellow',
      Red: 'red',
      SecondaryText: 'secondary',
    },
    Icon: {
      Clipboard: 'clipboard',
      Document: 'document',
      Gear: 'gear',
      HardDrive: 'hard-drive',
      Play: 'play',
      RotateClockwise: 'rotate',
      Stop: 'stop',
    },
    LaunchType: { Background: 'background' },
    MenuBarExtra,
    environment: { launchType: 'user' },
    getPreferenceValues: () => ({
      dbPrivateIp: '10.0.0.5',
      bastionInstance: 'bastion-iap',
      bastionZone: 'us-east4-a',
      localPort: '15432',
      remotePort: '5432',
      gcloudPath: '',
    }),
    openExtensionPreferences: vi.fn(),
    showToast: vi.fn().mockResolvedValue(undefined),
    Toast: { Style: { Animated: 'animated', Failure: 'failure', Success: 'success' } },
  };
});

describe('Command UI', () => {
  it('renders status and endpoints', async () => {
    render(<Command />);

    expect(await screen.findByText('Status: Connected')).toBeTruthy();
    expect(screen.getByText('Local: 127.0.0.1:15432')).toBeTruthy();
    expect(screen.getByText('Remote: 10.0.0.5:5432')).toBeTruthy();
  });
});
