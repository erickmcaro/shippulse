#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SEARCH_ENDPOINT:-}" || -z "${SEARCH_INDEX:-}" ]]; then
  echo "Usage: SEARCH_ENDPOINT=https://<service>.search.windows.net SEARCH_INDEX=apma-rag-index $(basename "$0")"
  exit 1
fi

python "$(dirname "$0")/run_evaluation.py" \
  --search-endpoint "${SEARCH_ENDPOINT}" \
  --index-name "${SEARCH_INDEX}" \
  "${@}"
