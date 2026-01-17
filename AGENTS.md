# AGENTS.md

## 1) Scope
This repo is a TypeScript + React Raycast extension that provides a Menu Bar Command for a Google Cloud SQL IAP tunnel via `gcloud`.

## 2) Principles (always apply)
- Prefer boring, explicit code over cleverness.
- Fail fast at boundaries (validate inputs early; use guard clauses).
- Separate “what” from “how”: keep pure logic separate from I/O and vendor SDKs.
- Keep the Menu Bar Command short‑lived; spawn the tunnel as a detached process and track state via PID/logs.
- Don’t log secrets or tokens.

## 3) Code Organization (SRP)
- `src/tunnel.tsx`: UI, hooks, and Raycast actions only.
- `src/tunnel-core.ts`: pure logic (config normalization, args building, status resolution).
- `src/tunnel-service.ts`: side effects (process, filesystem, logs, status polling).
- `src/__tests__`: unit tests, focused on pure logic.

## 4) TypeScript Patterns
- Use interfaces for object shapes; use `type` for unions and computed types.
- Prefer `type`-only imports for types.
- Lean on utility types (`Pick`, `Omit`, `Partial`) instead of bespoke aliases.
- Keep functions small and single‑purpose; avoid deep nesting.

## 5) React Patterns
- Components are pure render functions; no side effects in render.
- `useEffect` is for external systems (timers, process status, I/O).
- Keep state minimal; derive values from source‑of‑truth state.
- Avoid `useMemo`/`useCallback` unless they solve real perf issues.

## 6) Testing & Quality
- Prefer unit tests for pure logic; avoid heavy mocks.
- Use Vitest for tests and `tsc` for type checking.
- Keep logs actionable and concise.

## 7) Tooling
- `bun` for dependencies.
- `just` for common tasks.
- Lint with ESLint; format is enforced via the lint config.
- After code changes, run: `just lint`, `just test`, and `just typecheck`.

## References
- Raycast Developer Docs: https://developers.raycast.com/
- Menu Bar Commands API: https://developers.raycast.com/api-reference/menu-bar-commands
- Raycast CLI: https://developers.raycast.com/information/developer-tools/cli
- Bun Docs: https://bun.sh/docs
- Vitest Coverage: https://vitest.dev/guide/coverage
- ESLint Configuration: https://eslint.org/docs/latest/use/configure/
