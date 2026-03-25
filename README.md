# DMT - Dictionary Management Tool

Web application for browsing Snowflake dictionaries.

The project consists of:
- backend: Node.js + Express + Snowflake SDK
- frontend: plain HTML/CSS/JS (modularized components)

## Requirements

- Node.js 20+
- npm 10+
- Snowflake account (JWT key pair auth)
- Windows PowerShell for local helper scripts
- SnowSQL CLI (optional, for local DB recreate scripts)

## Configuration

Application runtime config is loaded from `DMT_CONFIG_JSON`.

Create `.env` in repo root:

```env
DMT_CONFIG_JSON={"SNOWFLAKE_ACCOUNT":"...","SNOWFLAKE_USER":"...","SNOWFLAKE_ROLE":"...","SNOWFLAKE_WAREHOUSE":"...","SNOWFLAKE_DATABASE":"...","SNOWFLAKE_SCHEMA":"...","SNOWFLAKE_PRIVATE_KEY_PATH":"...","SNOWFLAKE_PRIVATE_KEY_PASSPHRASE":"..."}
```

### Required keys

- `SNOWFLAKE_ACCOUNT`
- `SNOWFLAKE_USER`
- `SNOWFLAKE_ROLE`
- `SNOWFLAKE_WAREHOUSE`
- `SNOWFLAKE_DATABASE`
- `SNOWFLAKE_SCHEMA`
- `SNOWFLAKE_PRIVATE_KEY_PATH`
- `SNOWFLAKE_PRIVATE_KEY_PASSPHRASE`

### Optional keys

- `DMT_PORT` (default: `3000`)
- `APP_STATIC_USER` (default: `SUPTOSR@flsmidth.com`)
- `SNOWFLAKE_POOL_SIZE` (default: `2`)
- `SNOWFLAKE_POOL_WAIT_TIMEOUT_MS` (default: `15000`)
- `SNOWFLAKE_POOL_DEBUG` (default: `false`)
- `SNOWFLAKE_CLIENT_SESSION_KEEP_ALIVE` (default: `false`)
- `SNOWFLAKE_QUERY_TAG` (default: empty)
- `READINESS_CACHE_MS` (default: `5000`)

`DMT_CONFIG_JSON` supports `${ENV_VAR}` substitutions for secrets.

## Run locally

### npm

```bash
npm install
npm start
```

Dev mode:

```bash
npm run dev
```

### PowerShell helper

```powershell
# Start app and browser
.\scripts\local-run-app.ps1

# Restart app
.\scripts\local-run-app.ps1 -Restart

# Start in watch mode
.\scripts\local-run-app.ps1 -UseDevServer
```

## Tests

```bash
npm run test:unit
npm run test:api-contract
```

All-in-one on Windows:

```powershell
.\scripts\local-run-tests.ps1
```

Useful flags:

```powershell
.\scripts\local-run-tests.ps1 -SkipNpmInstall
.\scripts\local-run-tests.ps1 -UseNpmCi
.\scripts\local-run-tests.ps1 -IncludeUnitTests:$false
```

## API endpoints

- `GET /api/health`
- `GET /api/ready`
- `GET /api/meta`
- `GET /api/user-context`
- `GET /api/dictionaries/:name/versions`
- `GET /api/dictionaries/:name/rows`
- `GET /api/dictionaries/:name/version-history`
- `GET /api/dictionaries/:name/columns?dictionaryVersionKey=...`

Rows endpoint supports:
- pagination (`page`, `pageSize`)
- filter rules (`filters` JSON array)
- sorting (`sortColumn`, `sortDirection`)

## Service architecture (after migration)

Main backend facade remains:
- `backend/services/table.service.js`

Implementation was split into focused modules:
- `backend/services/table/constants.js`
- `backend/services/table/helpers.js`
- `backend/services/table/access-context.js`
- `backend/services/table/version-details.js`
- `backend/services/table/rows-page.js`
- `backend/services/table/versions.js`
- `backend/services/table/version-history.js`

Additional services:
- `backend/services/table.validation.js`
- `backend/services/table/dictionary-columns.js`

Backup (not modified by migration):
- `backend/services/table.service.backup.js`

## Project structure

```text
DMT/
├── backend/
│   ├── api/
│   │   ├── app.js
│   │   └── api.contract.test.js
│   ├── config/
│   │   ├── env.js
│   │   └── snowflake.js
│   ├── errors/
│   │   └── app-error.js
│   ├── routes/
│   │   └── table.routes.js
│   ├── services/
│   │   ├── dictionary-columns.js
│   │   ├── dictionary-columns.service.js
│   │   ├── table.service.js
│   │   ├── table.service.backup.js
│   │   ├── table.validation.js
│   │   ├── table.validation.test.js
│   │   └── table/
│   │       ├── access-context.js
│   │       ├── constants.js
│   │       ├── dictionary-columns.js
│   │       ├── helpers.js
│   │       ├── rows-page.js
│   │       ├── version-details.js
│   │       ├── version-history.js
│   │       └── versions.js
│   └── utils/
│       └── async-handler.js
├── frontend/
│   ├── app.js
│   ├── app.backup.js
│   ├── index.html
│   ├── components/
│   ├── config/
│   ├── services/
│   ├── styles/
│   └── utils/
├── scripts/
│   ├── local-clear-logs.ps1
│   ├── local-recreate-db.ps1
│   ├── local-run-app.ps1
│   └── local-run-tests.ps1
├── package.json
└── README.md
```

## Local DB recreate script

NPM wrappers:

```bash
npm run local:db:plan
npm run local:db
```

Direct PowerShell:

```powershell
.\scripts\local-recreate-db.ps1 -list
.\scripts\local-recreate-db.ps1 -apply
```

Notes:
- script executes SQL files from configured DBeaver Scripts directory
- files with `_CHECK_` in name are excluded from execution

## Frontend notes

Frontend uses runtime text config from:
- `frontend/config/ui-texts.js`

For consistency, UI labels should be changed there instead of hardcoding in components.

## Maintenance notes

- Keep `table.service.js` as facade, place query-specific logic in `backend/services/table/*` modules.
- `backend/services/dictionary-columns.service.js` is kept as a compatibility wrapper and forwards to `backend/services/dictionary-columns.js`.
- Keep `table.service.backup.js` as historical backup only.
- When adding new query flow, prefer one module per use case.
