# HTTP security configuration

The API applies Helmet, an explicit CORS allowlist, and in-memory global rate limiting from the `http` configuration
namespace. Set the environment variables below, then restart the process for changes to take effect.

## Quick path

1. Set `CORS_ORIGINS` to the browser origins that may call the API.
2. Set `TRUST_PROXY_HOPS` only when the deployment proxy topology is known.
3. Tune the throttling window and limit for the deployment, then restart the API.

## Environment variables

| Variable               | Default                                    | Rules                                                                  |
| ---------------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| `NODE_ENV`             | `development`                              | Non-empty environment name.                                            |
| `PORT`                 | `3000`                                     | Integer from 1 through 65535.                                          |
| `CORS_ORIGINS`         | `http://localhost:3000` outside production | Comma-separated HTTP(S) origins. Required and non-empty in production. |
| `THROTTLE_TTL_SECONDS` | `60`                                       | Positive integer request window in seconds.                            |
| `THROTTLE_LIMIT`       | `100`                                      | Positive integer requests allowed per window.                          |
| `TRUST_PROXY_HOPS`     | `0`                                        | Integer from 0 through 255.                                            |

Origins are trimmed and normalized. Empty entries, duplicates, wildcards, credentials in URLs, non-HTTP(S) protocols,
paths other than `/`, query strings, and fragments are rejected. CORS credentials are always disabled.

## Examples

Development with a local browser client:

```sh
CORS_ORIGINS=http://localhost:3000 PORT=3001 pnpm start:dev
```

Production with two browser clients and a reverse proxy:

```sh
NODE_ENV=production \
CORS_ORIGINS=https://app.example.com,https://admin.example.com \
TRUST_PROXY_HOPS=1 \
THROTTLE_TTL_SECONDS=60 \
THROTTLE_LIMIT=100 \
pnpm start:prod
```

## Deployment notes

### Production CORS is explicit

Production startup fails unless `CORS_ORIGINS` is explicitly supplied with at least one valid origin. CORS is not
authentication or authorization: it only instructs compatible browsers which cross-origin requests they may expose.
Protect APIs with appropriate authentication and authorization controls.

### Trust proxy requires topology knowledge

Set `TRUST_PROXY_HOPS` only to the number of trusted proxy hops directly in front of the API. An overly permissive value
can let clients influence the apparent client address, which affects rate-limit tracking.

### Throttling is local to one process

The configured Nest throttler uses in-memory storage. Each replica has its own counters, so a client can receive up to
the limit at each replica. Use a shared throttler storage or an edge rate limiter when limits must apply across multiple
replicas.

All values are read and validated during application startup. Restart the API after changing them; runtime environment
changes do not reconfigure a running process.
