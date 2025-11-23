#!/usr/bin/env bash
set -euo pipefail

URL="http://localhost:4000/health"
echo "==> Checking backend health at ${URL}"

response="$(curl -s -w '\n%{http_code}' "${URL}" || true)"
status="$(echo "${response}" | tail -n 1)"
body="$(echo "${response}" | sed '$d')"

if [[ "${status}" != "200" ]]; then
  echo "Healthcheck failed (status ${status}). Body:"
  echo "${body}"
  exit 1
fi

echo "Backend healthy (status 200). Response body:"
echo "${body}"
