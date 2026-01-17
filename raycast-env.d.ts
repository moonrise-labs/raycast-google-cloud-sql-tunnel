/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `tunnel` command */
  export type Tunnel = ExtensionPreferences & {
  /** DB Private IP - Cloud SQL private IP address. */
  "dbPrivateIp": string,
  /** Bastion Instance - Compute Engine VM name for the IAP bastion. */
  "bastionInstance": string,
  /** Bastion Zone - GCP zone containing the bastion VM (e.g. us-central1-a). */
  "bastionZone": string,
  /** Local Port - Local port to bind for the tunnel. */
  "localPort": string,
  /** Remote Port - Remote database port to forward to. */
  "remotePort": string,
  /** gcloud Path (optional) - Optional absolute path to the gcloud binary. */
  "gcloudPath"?: string
}
}

declare namespace Arguments {
  /** Arguments passed to the `tunnel` command */
  export type Tunnel = {}
}

