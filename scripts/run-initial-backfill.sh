#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <strava_id> [base_time_iso8601]"
  echo "Example: $0 123456 2026-04-06T00:00:00Z"
  exit 1
fi

STRAVA_ID="$1"
BASE_TIME="${2:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
BACKEND_API_URL="${BACKEND_API_URL:-http://localhost:3001}"
INTERNAL_KEY="${INTERNAL_BACKFILL_API_KEY:-}"

if [[ -z "$INTERNAL_KEY" ]]; then
  echo "Error: INTERNAL_BACKFILL_API_KEY is required"
  exit 1
fi

response="$(curl -sS -X POST "${BACKEND_API_URL%/}/users/initial-backfill" \
  -H "Content-Type: application/json" \
  -H "x-internal-backfill-key: ${INTERNAL_KEY}" \
  -d "{\"strava_id\": ${STRAVA_ID}, \"base_time\": \"${BASE_TIME}\"}")"

if command -v jq >/dev/null 2>&1; then
  echo "$response" | jq .
else
  echo "$response"
fi
