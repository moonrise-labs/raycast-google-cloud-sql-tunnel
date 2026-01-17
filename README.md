# ☁️🗄️ Google Cloud SQL Tunnel

A Raycast menu bar command to start/stop a Google Cloud SQL tunnel through IAP using `gcloud`.

## ⚙️ Setup
- Install `gcloud` and authenticate (IAP + Compute SSH permissions are required).
- Install dependencies with `bun install` (or run `just deps`).

## 🧭 Add to Raycast
- Run `just dev` (`bunx ray develop`) to load the extension and enable hot reload.

## 🧩 Configure
Open the command’s preferences and set:
- **DB Private IP**
- **Bastion Instance**
- **Bastion Zone**
- **Local Port**
- **Remote Port**
- **gcloud Path** (optional, use if `gcloud` isn’t on PATH or lives under Nix)

Notes:
- If auth expires, run `gcloud auth login` and try Start again.
- The menu shows the last log lines when a start attempt fails.

## 🚦 Use
- Open Raycast → **Google Cloud SQL Tunnel**.
- Run it once to add the menu bar item.
- Start/Stop/Restart from the menu.
- Use **Open Logs** to inspect `tunnel.log` (Raycast support directory).

## 🛠️ Development
- `just dev` to start Raycast dev mode.
- `just lint` to run ESLint.
- `just test` to run Vitest.
- `just typecheck` to run TypeScript checks.
