#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MOVE_DIR="${REPO_ROOT}/frontend/move/counter"
PUBLISH_FILE="${MOVE_DIR}/publish-testnet.json"

cleanup() {
  cd "${REPO_ROOT}"
}
trap cleanup EXIT

echo "==> Preparing to build Move package in ${MOVE_DIR}"
cd "${MOVE_DIR}"

echo "==> Running sui move build"
if ! sui move build; then
  echo "Move build failed. Fix issues above before deploying." >&2
  exit 1
fi

echo "==> Switching Sui client to testnet"
sui client switch --env testnet

echo "==> Publishing package to testnet (output: ${PUBLISH_FILE})"
sui client publish --gas-budget 10000000 --json > "${PUBLISH_FILE}"

echo "==> Publish complete. Results saved to ${PUBLISH_FILE}"
