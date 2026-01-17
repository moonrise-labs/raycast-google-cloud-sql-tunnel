export const Clipboard = { copy: () => undefined };

export const Color = {
  Green: 'green',
  Yellow: 'yellow',
  Red: 'red',
  SecondaryText: 'secondary',
};

export const environment = { supportPath: '', launchType: 'user' };

export const getPreferenceValues = () => ({});

export const Icon = {};

export const LaunchType = { Background: 'background' };

export const MenuBarExtra = Object.assign(() => null, {
  Item: () => null,
  Section: () => null,
  Submenu: () => null,
});

export const openExtensionPreferences = () => undefined;

export const showToast = async () => undefined;

export const Toast = { Style: { Animated: 'animated', Failure: 'failure', Success: 'success' } };

export const open = async () => undefined;
