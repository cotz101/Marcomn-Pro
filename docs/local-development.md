# MarComn local development

MarComn uses its own local port range. These commands only set the frontend
port; both environments use the same local MarComn Supabase stack.

| Environment | Command | Frontend |
| --- | --- | --- |
| Antigravity (AG) | `npm run dev:ag` | `http://localhost:5000` |
| Codex | `npm run dev:codex` | `http://localhost:5005` |

## MarComn local Supabase

| Service | Endpoint / port |
| --- | --- |
| API | `http://127.0.0.1:54321` |
| PostgreSQL | `127.0.0.1:54322` |
| Studio | `http://127.0.0.1:54323` |
| Mailpit | `http://127.0.0.1:54324` |

Both frontend commands resolve `NEXT_PUBLIC_SUPABASE_URL` to the local API
endpoint above. Do not substitute hosted credentials or URLs for local work.

SFEPI intentionally uses a separate range: frontend `3000` / `3005` and
Supabase `55321`–`55324`. This repository does not configure SFEPI.
