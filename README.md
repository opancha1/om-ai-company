# Om AI Company

Om AI Company is a local, persistent company workspace. The current implementation provides a small Python service, SQLite storage, a browser UI, employee and task records, command-based project/task creation, background AI work, activity/messages, and Markdown artifacts.

The dashboard is an office-first pixel-art-style interface built from HTML, CSS, and SVG elements. Employee stations, task status, project progress, chat history, activity, artifacts, and meeting records are loaded from the backend. It does not use the reference screenshot as an image. Workspace changes refresh from the API every few seconds and activity changes are also sent over Server-Sent Events.

## Existing architecture

The repository was empty when implementation began. There was no frontend, backend, database, authentication, or AI integration to retain. This first usable increment uses Python's standard library HTTP server and `sqlite3` so it starts without installing packages. The frontend is plain HTML/CSS/JavaScript served by the local backend. SQLite is stored at `data/company.sqlite3`; generated deliverables are under `workspace/`.

## Start locally

1. Copy `.env.example` to `.env` and set `OPENAI_API_KEY` to enable agent work. Without it, agents record a blocked run and explain the missing configuration.
2. Start with `./start.sh` (or `python3 backend/app.py`).
3. Open <http://127.0.0.1:8000>.

Only Python 3.10+ is required. The database schema and demo company are initialized on startup. There are no third-party packages to install.

## How agents work

Submitting a CEO command persists a project, seven assigned tasks, and a CEO Assistant message. The backend starts task workers and calls OpenAI's Responses API using the model selected in `OPENAI_MODEL`. Successful output is saved as a task result, an employee message, and a Markdown artifact. Missing credentials block tasks; provider errors fail them. Employee status and project/task counts are read from SQLite, not simulated in the browser.

## API

- `GET /api/company`, `/api/employees`, `/api/projects`, `/api/tasks`, `/api/messages`, `/api/activity`, `/api/artifacts`
- `POST /api/commands` with `{"command":"..."}`
- `POST /api/tasks` with project, title, optional description and employee id
- `POST /api/tasks/{id}/run`
- `POST /api/projects`
- `POST /api/messages`
- `GET /api/meetings`, `POST /api/meetings`
- `GET /api/events` (Server-Sent Events for persisted activity records)
- `POST /api/reports/daily` (writes and registers a Markdown artifact using current database records)
- `GET /workspace/{artifact filename}` returns the artifact content

The frontend refreshes persisted state every three seconds. The frontend consumes the backend's Server-Sent Events activity stream and also refreshes persisted state periodically. WebSocket is not required for the current local architecture.

## Extension points

Employees and their instructions are seeded in `backend/app.py`. Task planning is in `command()`. Task execution and provider calls live in `run_task()`. Add new tools as bounded backend functions and persist their outputs before exposing them to agents. To add another provider, replace the provider call in `run_task()` behind a small provider interface. The current service has no login; it is intended for local use only.

## Current scope

This implementation establishes a real persistent foundation, rather than implementing every requested enterprise feature in a single pass. Approval workflows, restricted code execution, data uploads/analysis, git tools, retries/reassignment, detailed project/task pages, auth, budgets, and migrations remain future work. The current repository includes automated backend tests for the persisted company flow. The local server binds to loopback and does not provide production authentication or deployment controls.
