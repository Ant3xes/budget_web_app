#!/usr/bin/env bash
# Smoke test for a running instance of the app.
#   scripts/smoke.sh https://my-app.vercel.app [expected-commit-sha]
#
# With an expected commit SHA, the script waits until /api/health reports that
# commit, so it can't pass by testing the previous deployment while the
# production alias is still being switched over.
#
# Used by .github/workflows/smoke.yml (after each production deploy) and by the
# CI e2e job (against the locally started app), so the checks themselves are
# exercised on every pull request.
set -euo pipefail

BASE_URL="${1:?usage: smoke.sh <base-url>}"
BASE_URL="${BASE_URL%/}"
EXPECTED_SHA="${2:-}"

fail() {
  echo "::error::$1"
  exit 1
}

status() {
  curl -s -o /dev/null -w '%{http_code}' "$BASE_URL$1" || true
}

echo "Smoke testing $BASE_URL"

# 1. Wait for the instance to serve traffic (a fresh deploy can take a moment),
#    and, when a commit is expected, for the alias to point at that deployment.
ready=0
for i in $(seq 1 12); do
  code=$(status /api/health)
  if [ "$code" = "200" ]; then
    if [ -z "$EXPECTED_SHA" ] || curl -sf "$BASE_URL/api/health" | grep -q "\"commit\":\"$EXPECTED_SHA\""; then
      ready=1
      break
    fi
    echo "health is up but not serving $EXPECTED_SHA yet (attempt $i), retrying in 10s..."
  else
    echo "health returned $code (attempt $i), retrying in 10s..."
  fi
  sleep 10
done
[ "$ready" = "1" ] || fail "$BASE_URL/api/health never returned 200${EXPECTED_SHA:+ for commit $EXPECTED_SHA}"

# 2. Health endpoint payload.
body=$(curl -sf "$BASE_URL/api/health")
echo "health: $body"
echo "$body" | grep -q '"status":"ok"' || fail "unexpected /api/health payload: $body"

# 3. The login page renders a form.
curl -sf "$BASE_URL/login" | grep -qi '<form' || fail "no <form> on /login"

# 4. Protected pages redirect anonymous visitors (proves the auth proxy is live).
for path in /dashboard /transactions; do
  code=$(status "$path")
  case "$code" in
    301|302|303|307|308) ;;
    *) fail "$path returned $code, expected a redirect" ;;
  esac
done

# 5. Protected API rejects anonymous calls.
code=$(status /api/accounts)
[ "$code" = "401" ] || fail "/api/accounts returned $code, expected 401"

echo "Smoke test passed."
