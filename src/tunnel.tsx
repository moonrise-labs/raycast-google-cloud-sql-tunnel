import {
  Clipboard,
  Color,
  environment,
  getPreferenceValues,
  Icon,
  LaunchType,
  MenuBarExtra,
  openExtensionPreferences,
  showToast,
  Toast,
} from '@raycast/api';
import { useEffect, useMemo, useState } from 'react';

import { labelForStatus, normalizeConfig, type Preferences, type TunnelConfig, type TunnelStatus } from './tunnel-core';
import { getStatusInfo, openLogFile, startTunnel, type StatusInfo, stopTunnel } from './tunnel-service';

export default function Command() {
  const config = useConfig();
  const isBackground = environment.launchType === LaunchType.Background;
  const [statusInfo, setStatusInfo, isLoading, setIsLoading] = useStatusInfo(config);

  const tooltip = buildTooltip(config, statusInfo.status);
  const icon = iconForStatus(statusInfo.status);

  const canStart = statusInfo.status === 'disconnected' || statusInfo.status === 'error';
  const canStop = statusInfo.status === 'connected' || statusInfo.status === 'starting' || statusInfo.pidRunning;

  return (
    <MenuBarExtra title="" tooltip={tooltip} icon={icon} isLoading={isLoading}>
      <MenuBarExtra.Section>
        <MenuBarExtra.Item title={`Status: ${labelForStatus(statusInfo.status)}`} />
        <MenuBarExtra.Item title={`Local: 127.0.0.1:${config.localPort}`} />
        <MenuBarExtra.Item title={`Remote: ${config.dbPrivateIp}:${config.remotePort}`} />
      </MenuBarExtra.Section>

      <MenuBarExtra.Section>
        <MenuBarExtra.Item
          title="Start Tunnel"
          icon={Icon.Play}
          {...(canStart ? { onAction: () => handleStart(config, setStatusInfo, setIsLoading, isBackground) } : {})}
        />
        <MenuBarExtra.Item
          title="Stop Tunnel"
          icon={Icon.Stop}
          {...(canStop ? { onAction: () => handleStop(config, setStatusInfo, setIsLoading, isBackground) } : {})}
        />
        <MenuBarExtra.Item
          title="Restart Tunnel"
          icon={Icon.RotateClockwise}
          onAction={() => handleRestart(config, setStatusInfo, setIsLoading, isBackground)}
        />
      </MenuBarExtra.Section>

      <MenuBarExtra.Section>
        <MenuBarExtra.Item
          title="Copy Local Connection"
          icon={Icon.Clipboard}
          onAction={() => Clipboard.copy(`127.0.0.1:${config.localPort}`)}
        />
        <MenuBarExtra.Item title="Open Logs" icon={Icon.Document} onAction={openLogFile} />
        <MenuBarExtra.Item title="Open Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
      </MenuBarExtra.Section>

      {statusInfo.status === 'error' && statusInfo.logTail ? (
        <MenuBarExtra.Section>
          <MenuBarExtra.Item title="Last Log Lines" />
          {statusInfo.logTail.split('\n').map((line, index) => (
            <MenuBarExtra.Item key={`log-${index}`} title={line} />
          ))}
        </MenuBarExtra.Section>
      ) : null}
    </MenuBarExtra>
  );
}

function useConfig(): TunnelConfig {
  const preferences = getPreferenceValues<Preferences>();
  const { dbPrivateIp, bastionInstance, bastionZone, localPort, remotePort, gcloudPath } = preferences;

  return useMemo(
    () =>
      normalizeConfig({
        dbPrivateIp,
        bastionInstance,
        bastionZone,
        localPort,
        remotePort,
        gcloudPath,
      }),
    [dbPrivateIp, bastionInstance, bastionZone, localPort, remotePort, gcloudPath],
  );
}

function useStatusInfo(
  config: TunnelConfig,
): [StatusInfo, (value: StatusInfo) => void, boolean, (value: boolean) => void] {
  const [statusInfo, setStatusInfo] = useState<StatusInfo>({
    status: 'disconnected',
    portOpen: false,
    pidRunning: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const refresh = async () => {
      setIsLoading(true);
      try {
        const info = await getStatusInfo(config);
        if (isMounted) {
          setStatusInfo(info);
        }
      } catch {
        if (isMounted) {
          setStatusInfo({ status: 'error', portOpen: false, pidRunning: false });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void refresh();

    return () => {
      isMounted = false;
    };
  }, [config]);

  return [statusInfo, setStatusInfo, isLoading, setIsLoading];
}

async function handleStart(
  config: TunnelConfig,
  setStatusInfo: (value: StatusInfo) => void,
  setIsLoading: (value: boolean) => void,
  isBackground: boolean,
): Promise<void> {
  await runTunnelAction({
    config,
    setStatusInfo,
    setIsLoading,
    isBackground,
    action: () => startTunnel(config),
    loadingTitle: 'Starting tunnel',
    successTitle: 'Tunnel started',
    failureTitle: 'Failed to start',
  });
}

async function handleStop(
  config: TunnelConfig,
  setStatusInfo: (value: StatusInfo) => void,
  setIsLoading: (value: boolean) => void,
  isBackground: boolean,
): Promise<void> {
  await runTunnelAction({
    config,
    setStatusInfo,
    setIsLoading,
    isBackground,
    action: () => stopTunnel(config),
    loadingTitle: 'Stopping tunnel',
    successTitle: 'Tunnel stopped',
    failureTitle: 'Failed to stop',
  });
}

async function handleRestart(
  config: TunnelConfig,
  setStatusInfo: (value: StatusInfo) => void,
  setIsLoading: (value: boolean) => void,
  isBackground: boolean,
): Promise<void> {
  await handleStop(config, setStatusInfo, setIsLoading, isBackground);
  await handleStart(config, setStatusInfo, setIsLoading, isBackground);
}

async function runTunnelAction({
  config,
  setStatusInfo,
  setIsLoading,
  isBackground,
  action,
  loadingTitle,
  successTitle,
  failureTitle,
}: {
  config: TunnelConfig;
  setStatusInfo: (value: StatusInfo) => void;
  setIsLoading: (value: boolean) => void;
  isBackground: boolean;
  action: () => Promise<void>;
  loadingTitle: string;
  successTitle: string;
  failureTitle: string;
}): Promise<void> {
  try {
    setIsLoading(true);
    if (!isBackground) {
      await showToast({ style: Toast.Style.Animated, title: loadingTitle });
    }
    await action();
    const info = await getStatusInfo(config);
    setStatusInfo(info);
    if (!isBackground) {
      await showToast({ style: Toast.Style.Success, title: successTitle });
    }
  } catch (error) {
    if (!isBackground) {
      await showToast({ style: Toast.Style.Failure, title: failureTitle, message: String(error) });
    }
  } finally {
    setIsLoading(false);
  }
}

function buildTooltip(config: TunnelConfig, status: TunnelStatus): string {
  return `Google Cloud SQL Tunnel: ${labelForStatus(status)} • 127.0.0.1:${config.localPort} → ${config.dbPrivateIp}:${config.remotePort}`;
}

function iconForStatus(status: TunnelStatus): { source: Icon; tintColor: Color } {
  switch (status) {
    case 'connected':
      return { source: Icon.CircleProgress100, tintColor: Color.PrimaryText };
    case 'starting':
      return { source: Icon.CircleProgress25, tintColor: Color.PrimaryText };
    case 'error':
      return { source: Icon.CircleDisabled, tintColor: Color.PrimaryText };
    default:
      return { source: Icon.Circle, tintColor: Color.SecondaryText };
  }
}
