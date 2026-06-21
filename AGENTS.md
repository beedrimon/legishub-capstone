# Agent Instructions for legishub-capstone

Purpose: a concise, discoverable guide for AI coding agents to become productive in this repository.

Quick run commands
- Activate virtualenv (PowerShell): `env\Scripts\Activate.ps1` or (bash): `source env/bin/activate`
- Install deps: `pip install -r requirements.txt` (or use `pipenv install` / `pipenv shell` if preferred)
- Run migrations: `python manage.py migrate`
- Start dev server: `python manage.py runserver`
- Background worker (django-q2): `python manage.py qcluster`
- Release step (as in Procfile): `python manage.py migrate`

Key project files (quick links)
- [manage.py](manage.py)
- [Procfile](Procfile)
- [requirements.txt](requirements.txt)
- [Pipfile](Pipfile)
- [legishub/settings.py](legishub/settings.py)
- [core/tasks.py](core/tasks.py)
- [core/backup_utils.py](core/backup_utils.py)
- [core/management/commands/auto_approve_docs.py](core/management/commands/auto_approve_docs.py)

Important environment & conventions
- Python: `3.14` (declared in `Pipfile`). A virtualenv is present at `env/` or `venv/`.
- Settings: `DEBUG` controlled by `.env` (loaded in `legishub/settings.py`). Production requires `SECRET_KEY`.
- DB: SQLite by default; configured to use Postgres when `DB_NAME`/PG env vars are present.
- Background jobs: uses `django-q2` (Q_CLUSTER) — do not enable CPU-affinity comments on Windows.
- WebSockets: uses `channels` + `daphne` (ASGI application defined in `legishub/asgi.py`).
- Optional S3: `USE_S3` enables Supabase-compatible S3 via `django-storages` and `boto3`.

Agent guidance: how to modify AI chat behavior
- Preferred file for repo-wide agent guidance: `AGENTS.md` (this file). For GitHub-specific Copilot guidance, create or edit `.github/copilot-instructions.md`.
- Keep instructions minimal and link-heavy: link to docs rather than copying large sections.
- When asked to "change AI CHAT", clarify the scope: (1) update agent instructions here, (2) add a `.github/copilot-instructions.md` for GitHub UI behavior, or (3) create a custom skill/agent under `.vscode` or `.github/` with the specific prompts.

Notes for maintainers and agents
- There are no top-level `README.md` or CONTRIBUTING docs — prefer linking to code files when explaining behaviour.
- Tests: `core/tests.py` exists; run `python manage.py test` to execute test suite.
- Be conservative when changing database-backed flows (backup/restore, migrations). Use `python manage.py migrate --plan` to preview.

Next steps (suggestions)
- If you want tailored chat behavior (custom prompts, persona, or stricter rules), I can create `.github/copilot-instructions.md` or a small skill file describing the desired AI chat changes. Tell me what you want changed (tone, permissions, file edit rules, privacy rules, etc.).

Contact / feedback
- If anything here is incorrect or you'd like a different structure, tell me what to change and I will update this file.
