# melb.dev website

This repository contains the source code for the [melb.dev](https://melb.dev) website.

It's a static Astro website which uses build-time content collections in YAML for storing event, group, topic, and venue data.

- Content is one YAML record per file under `src/content`
- Run `make new` in a terminal for a guided TUI content creator. It uses existing groups, topics, and venues when creating records and refuses to overwrite a file.
- Automation can use `bun run new-content <event|group|venue|topic> "Name or title"`. Event creation optionally accepts a group slug as a third argument; otherwise it uses an existing group and tomorrow's Melbourne date.
- Never change an existing `uid` or delete an event: cancel it, increment `revision`, and set `updated`.
- Event filenames are `YYYYMMDD-group-normalised-title.yaml`.

Please report public content problems in [GitHub Issues](https://github.com/melb-dev/website/issues); report security issues privately to `security@melb.dev`.

When development:
- Run `make setup` to configure git hooks.
- Run `make dev` to start the local development server.
- Git pre-commit will run `make precommit` before committing.
- Run `make build` to see what will be published to production.

All rights reserved; no licence is granted.
