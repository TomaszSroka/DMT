# DMT — Dictionary Management Tool

Web application for browsing Snowflake dictionaries. Runs as a Node.js/Express server that serves a plain-HTML frontend and exposes a JSON API backed by Snowflake.

---

## Requirements

- **Node.js** 20 LTS or newer
- **npm** 10+
- Access to a Snowflake account with JWT key-pair authentication
- **SnowSQL CLI** (for local DB object scripts from `scripts/sql`)

---

## Configuration

All runtime configuration is passed through a single environment variable: `DMT_CONFIG_JSON`.

Create a `.env` file at the repo root (it is git-ignored):

```
DMT_CONFIG_JSON={"SNOWFLAKE_ACCOUNT":"...","SNOWFLAKE_USER":"...","SNOWFLAKE_ROLE":"...","SNOWFLAKE_WAREHOUSE":"...","SNOWFLAKE_DATABASE":"...","SNOWFLAKE_SCHEMA":"...","SNOWFLAKE_PRIVATE_KEY_PATH":"...","SNOWFLAKE_PRIVATE_KEY_PASSPHRASE":"..."}
```

### Required keys

| Key | Description |
|---|---|
| `SNOWFLAKE_ACCOUNT` | Snowflake account identifier (e.g. `xy12345.eu-west-1`) |
| `SNOWFLAKE_USER` | Snowflake user login |
| `SNOWFLAKE_ROLE` | Default Snowflake role |
| `SNOWFLAKE_WAREHOUSE` | Snowflake virtual warehouse |
| `SNOWFLAKE_DATABASE` | Target database |
| `SNOWFLAKE_SCHEMA` | Target schema |
| `SNOWFLAKE_PRIVATE_KEY_PATH` | Absolute path to the RSA private key file (`.p8`) |
| `SNOWFLAKE_PRIVATE_KEY_PASSPHRASE` | Passphrase for the private key |

### Optional keys

| Key | Default | Description |
|---|---|---|
| `DMT_PORT` | `3000` | HTTP port the server listens on |
| `APP_STATIC_USER` | `SUPTOSR@flsmidth.com` | Hardcoded user identity (app has no auth layer) |
| `SNOWFLAKE_POOL_SIZE` | `2` | Number of persistent Snowflake connections |
| `SNOWFLAKE_POOL_WAIT_TIMEOUT_MS` | `15000` | Max wait time for a free connection (ms) |
| `SNOWFLAKE_POOL_DEBUG` | `false` | Enable verbose pool logging |
| `SNOWFLAKE_CLIENT_SESSION_KEEP_ALIVE` | `false` | Keep Snowflake sessions alive between queries |
| `SNOWFLAKE_QUERY_TAG` | _(empty)_ | Tag attached to every query in Snowflake query history |
| `READINESS_CACHE_MS` | `5000` | How long `/api/ready` result is cached (ms) |

Values can reference OS environment variables using `${}` syntax:
```json
{ "SNOWFLAKE_PRIVATE_KEY_PASSPHRASE": "${MY_SECRET_ENV_VAR}" }
```

---

## Running locally

### Using npm scripts

```bash
npm install
npm start          # production mode
npm run dev        # watch mode (auto-restart on file changes)
```

### Using PowerShell scripts

```powershell
# Start server + open Firefox
.\scripts\local-run-app.ps1

# Start in watch mode
.\scripts\local-run-app.ps1 -UseDevServer

# Kill and restart (only kills Node processes from this repo)
.\scripts\local-run-app.ps1 -Restart

# Force-kill any process on port 3000 (use with caution)
.\scripts\local-run-app.ps1 -Restart -ForceKillAnyProcessOnPort

# Skip terminal window resizing
.\scripts\local-run-app.ps1 -NoWindowTweaks

# Custom port
.\scripts\local-run-app.ps1 -Port 4000 -Url "http://localhost:4000"
```

Or via npm:
```bash
npm run local:start
npm run local:restart
```

### Local DB object scripts (development only)

# SQL scripts for local development

Folder for Snowflake DDL/DML scripts executed przez `scripts/local-run-db.ps1`.

## Konwencje

- Scripts should be idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE` where safe).
- Use numbered prefixes for order, e.g. `001_...sql`, `010_...sql`, `900_...sql`.
- Folder SQL jest tylko do developmentu (nie wrzucaj tu migracji produkcyjnych).

## Uruchamianie

```powershell
# Preview of what will be executed
.\scripts\local-run-db.ps1

# Execute all SQL files
.\scripts\local-run-db.ps1 -Apply

# Execute selected files
.\scripts\local-run-db.ps1 -Apply -Filter "001_*.sql"
```

You can also use npm:
```bash
npm run local:db:plan
npm run local:db
```

Wymagania:
- SnowSQL CLI w PATH.
- `DMT_CONFIG_JSON` w env albo w pliku `.env`.

---

## Testing

```bash
# Unit tests (validation helpers)
npm run test:unit

# API contract tests (starts a real server on port 3310)
npm run test:api-contract

# Both via PowerShell (smart install + unit + contract)
.\scripts\local-run-tests.ps1

# Skip npm install if node_modules already present
.\scripts\local-run-tests.ps1 -SkipNpmInstall

# Use npm ci instead of npm install
.\scripts\local-run-tests.ps1 -UseNpmCi

# Skip unit tests, run only contract tests
.\scripts\local-run-tests.ps1 -IncludeUnitTests:$false
```

Or via npm:
```bash
npm run local:test
```

---

## Project structure

```
DMT/
├── .env                              # Local secrets (git-ignored)
├── package.json
├── backend/
│   ├── api/
│   │   ├── app.js                    # Express server entry point
│   │   └── api.contract.test.js      # HTTP contract tests (node:test)
│   ├── config/
│   │   ├── env.js                    # Loads and validates DMT_CONFIG_JSON
│   │   └── snowflake.js              # Snowflake SDK + connection pool
│   ├── errors/
│   │   └── app-error.js              # AppError class + error payload helpers
│   ├── routes/
│   │   └── table.routes.js           # Express router — all /api/* endpoints
│   ├── services/
│   │   ├── table.service.js          # Business logic + Snowflake queries
│   │   ├── table.validation.js       # Input sanitization (filters, sort, LIKE)
│   │   └── table.validation.test.js  # Unit tests for validation helpers
│   └── utils/
│       └── async-handler.js          # asyncHandler(fn) middleware wrapper
├── frontend/
│   ├── index.html                    # SPA shell
│   ├── app.js                        # Main application logic
│   ├── app.backup.js                 # Backup of main app logic
│   ├── components/                   # Modular UI components (AccountPanel, DictionaryList, etc.)
│   │   ├── AccountPanel.js           # User account panel logic
│   │   ├── DictionaryList.js         # Dictionary dropdown logic
│   │   ├── DictionaryVersionList.js  # Dictionary version dropdown logic
│   │   ├── RecordDetailsDialog.js    # Record details modal logic
│   │   ├── UserInfo.js               # User info loader
│   │   └── VersionHistoryButton.js   # Version history button logic
│   ├── config/                      # UI and runtime configuration
│   │   ├── config-frontend.js        # Static UI config defaults
│   │   ├── config-runtime.js         # Runtime config normalization
│   │   └── ui-texts.js               # UI text definitions
│   ├── services/                    # API client wrappers
│   │   └── ApiClient.js              # fetchJson and API helpers
│   ├── utils/                       # Utility functions
│   │   └── ui-helpers.js             # HTML/text formatting helpers
│   ├── styles/                      # Modular CSS files
│   │   ├── variables.css             # CSS variables
│   │   ├── layout.css                # Layout styles
│   │   ├── account.css               # Account panel styles
│   │   ├── dialogs.css               # Dialog/modal styles
│   │   ├── buttons.css               # Button styles
│   │   ├── cards.css                 # Card styles
│   │   ├── forms.css                 # Form/input styles
│   │   └── tables.css                # Table styles
│   ├── styles.css                   # Global/custom styles (empty or minimal)
│   ├── styles.backup.css            # Backup of original styles
├── logs/
│   └── snowflake.log                 # Snowflake SDK log output (git-ignored)
└── scripts/
    ├── local-run-app.ps1             # Start server + browser (Windows)
    ├── local-run-db.ps1              # Run local SQL scripts against Snowflake (Windows)
    └── local-run-tests.ps1           # Install deps + run tests (Windows)
    └── sql/
        ├── 001_create_dev_objects.sql # Dev-only sample objects (idempotent)
        └── README.md                  # SQL folder conventions
```

---

## API endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness check — always returns 200 |
| `GET` | `/api/ready` | Readiness check — verifies Snowflake connectivity |
| `GET` | `/api/user-context` | Returns current user login and assigned roles |
| `GET` | `/api/meta` | Lists dictionaries accessible to the current user |
| `GET` | `/api/dictionaries/:id/versions` | Lists version instances for a dictionary |
| `GET` | `/api/dictionaries/:id/rows` | Paginated rows with optional filters and sort |
| `GET` | `/api/dictionaries/:id/version-history` | Full version history for a dictionary |
