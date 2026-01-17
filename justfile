# Use bash with strict error checking
set shell := ["bash", "-uc"]

# Allow passing arguments to recipes
set positional-arguments

# Show available recipes
default:
    @just --list

# Install dependencies
deps:
  bun install

# Run linting
[group('lint')]
lint *args:
  bun run eslint . --ext .ts,.tsx {{ args }}

# Run type checking
[group('lint')]
typecheck:
  bun run tsc --noEmit

# Run tests
[group('test')]
test *args:
  bun run vitest run {{ args }}

# Live develop Raycast extension
[group('build')]
dev:
  bunx ray develop

# Build Raycast extension
[group('build')]
build:
  bunx ray build