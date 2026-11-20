# AGENTS.md — Rules for AI coding agents working on this repo

## Architecture contracts

- **Source of truth:** `docs/architecture (8).md` and `docs/task (1).md`.
- **Payload schema:** `collector/schemas.py` defines the ONLY shape that may cross the trust boundary. Never add fields without updating both the collector schema and the SaaS validation.
- **LLM abstraction:** `saas/explain/llm_client.py` defines the `LLMClient` protocol. All LLM calls go through this interface.

## Folder boundaries (HARD RULES)

| Path | May import cloud LLM? | May access raw data? | Network access |
|------|----------------------|---------------------|----------------|
| `/collector/**` | **NO** — NEVER import `saas.explain.llm_client`, Gemini SDK, or any cloud LLM client | Yes (stays local) | Only to Ingest API |
| `/saas/**` | Yes (via `LLMClient`) | No (metadata only) | Yes |
| `/web/**` | No (frontend) | No | Supabase client only |
| `/simulator/**` | No | Generates synthetic data | Local only |

**CI enforces:** any import of a cloud LLM client in `/collector` fails the build.

## Containers-only rule

- **NEVER run `pip install` on the host.** All Python runs inside Docker containers.
- To add a dependency: edit the service's `requirements.in` → run `make lock` → run `make build`.
- All `make` targets invoke Docker, never host Python.
- `make test` runs tests inside the `tests` container.

## Development workflow

1. Work one phase at a time per `task.md`. Do not start "Fancy" items until the Gate passes.
2. Write the test alongside each feature. A feature is not done until its test passes.
3. Small commits per task ID: `feat(1.9): keyed HMAC pseudonyms`.
4. Security-critical code (allow-list, redaction, RLS, ingest auth, tenant derivation) must be reviewed by a human.

## Test commands

```bash
make test            # run all tests
make leak-test       # canary secret leak test
make build           # build all Docker images
make up              # start all services
make down            # stop all services
make reset           # stop + remove volumes + rebuild
make lock            # regenerate hash-locked requirements
make shell-<service> # open a shell in a service container
```

## Secrets

- Only env var **names** go in `.env.example` and in code.
- **Values** go in `.env` (gitignored).
- Never put API keys, passwords, or tokens in code, Dockerfiles, or prompts.

## Schema version

Current: `1.0`. Bump on breaking payload changes and update both collector and SaaS validation.
