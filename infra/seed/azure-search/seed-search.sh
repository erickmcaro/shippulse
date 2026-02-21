#!/usr/bin/env bash
set -euo pipefail

# Seeds the APMA Azure AI Search indexes using the JSON payloads in this folder.
#
# Auth options:
# - Recommended: Azure AD token via `az login` (requires Search Index Data Contributor)
# - Optional: API key via AZURE_SEARCH_API_KEY (admin/query key)
#
# Required:
# - AZURE_SEARCH_ENDPOINT (e.g. https://apma-search-dev.search.windows.net)
#   OR (AZURE_RESOURCE_GROUP + AZURE_SEARCH_SERVICE_NAME) so the script can discover it via Azure CLI.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

# Load repo root .env if present (ignored by git; useful for local runs)
if [[ -f "${REPO_ROOT}/.env" ]]; then
  # shellcheck disable=SC1091
  source "${REPO_ROOT}/.env"
fi

API_VERSION="${AZURE_SEARCH_API_VERSION:-2023-11-01}"
ENDPOINT="${AZURE_SEARCH_ENDPOINT:-}"
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-}"
SERVICE_NAME="${AZURE_SEARCH_SERVICE_NAME:-}"
API_KEY="${AZURE_SEARCH_API_KEY:-}"
CONFIG_PATH="${AZURE_SEARCH_CONFIG_PATH:-}"
USE_VECTORS="${AZURE_SEARCH_USE_VECTORS:-0}"

if [[ -z "${CONFIG_PATH}" ]]; then
  if [[ -f "${REPO_ROOT}/backend/src/Apma.Api/appsettings.Development.json" ]]; then
    CONFIG_PATH="${REPO_ROOT}/backend/src/Apma.Api/appsettings.Development.json"
  elif [[ -f "${REPO_ROOT}/backend/src/Apma.Api/appsettings.json" ]]; then
    CONFIG_PATH="${REPO_ROOT}/backend/src/Apma.Api/appsettings.json"
  fi
fi

if [[ -n "${CONFIG_PATH}" && -f "${CONFIG_PATH}" ]]; then
  ENDPOINT="${ENDPOINT:-$(python - <<PY
import json
with open("${CONFIG_PATH}") as f:
    data=json.load(f)
print(data.get("AzureSearch", {}).get("Endpoint", ""))
PY
)}"
  API_KEY="${API_KEY:-$(python - <<PY
import json
with open("${CONFIG_PATH}") as f:
    data=json.load(f)
print(data.get("AzureSearch", {}).get("ApiKey", ""))
PY
)}"
  GOLDEN_INDEX="${AZURE_SEARCH_INDEX_GOLDEN_EXAMPLES:-$(python - <<PY
import json
with open("${CONFIG_PATH}") as f:
    data=json.load(f)
print(data.get("AzureSearch", {}).get("GoldenExamplesIndexName", "golden-examples"))
PY
)}"
  TEMPLATES_INDEX="${AZURE_SEARCH_INDEX_TEMPLATES:-$(python - <<PY
import json
with open("${CONFIG_PATH}") as f:
    data=json.load(f)
print(data.get("AzureSearch", {}).get("TemplatesIndexName", "templates"))
PY
)}"
  FEEDBACK_INDEX="${AZURE_SEARCH_INDEX_FEEDBACK:-$(python - <<PY
import json
with open("${CONFIG_PATH}") as f:
    data=json.load(f)
print(data.get("AzureSearch", {}).get("FeedbackIndexName", "feedback"))
PY
)}"
  DOMAIN_INDEX="${AZURE_SEARCH_INDEX_DOMAIN_CONTEXT:-$(python - <<PY
import json
with open("${CONFIG_PATH}") as f:
    data=json.load(f)
print(data.get("AzureSearch", {}).get("DomainContextIndexName", "domain-context"))
PY
)}"
else
  GOLDEN_INDEX="${AZURE_SEARCH_INDEX_GOLDEN_EXAMPLES:-golden-examples}"
  TEMPLATES_INDEX="${AZURE_SEARCH_INDEX_TEMPLATES:-templates}"
  FEEDBACK_INDEX="${AZURE_SEARCH_INDEX_FEEDBACK:-feedback}"
  DOMAIN_INDEX="${AZURE_SEARCH_INDEX_DOMAIN_CONTEXT:-domain-context}"
fi

if [[ -z "${ENDPOINT}" ]]; then
  if [[ -z "${RESOURCE_GROUP}" || -z "${SERVICE_NAME}" ]]; then
    echo "ERROR: AZURE_SEARCH_ENDPOINT is not set and endpoint discovery is not possible." >&2
    echo "Set AZURE_SEARCH_ENDPOINT or set AZURE_RESOURCE_GROUP and AZURE_SEARCH_SERVICE_NAME." >&2
    exit 1
  fi

  if ! command -v az >/dev/null 2>&1; then
    echo "ERROR: Azure CLI (az) not found; cannot discover search endpoint." >&2
    exit 1
  fi

  ENDPOINT="https://${SERVICE_NAME}.search.windows.net"
fi

if [[ "${ENDPOINT}" != https://* ]]; then
  echo "ERROR: AZURE_SEARCH_ENDPOINT must start with https://" >&2
  exit 1
fi

_auth_headers=()
if [[ -n "${API_KEY}" ]]; then
  _auth_headers+=( -H "api-key: ${API_KEY}" )
else
  if ! command -v az >/dev/null 2>&1; then
    echo "ERROR: Azure CLI (az) not found; cannot acquire Azure AD token." >&2
    echo "Either install Azure CLI + run 'az login' or set AZURE_SEARCH_API_KEY." >&2
    exit 1
  fi

  ACCESS_TOKEN="$(az account get-access-token --resource https://search.azure.com --query accessToken -o tsv)"
  if [[ -z "${ACCESS_TOKEN}" ]]; then
    echo "ERROR: Failed to acquire Azure AD access token for Azure AI Search." >&2
    exit 1
  fi
  _auth_headers+=( -H "Authorization: Bearer ${ACCESS_TOKEN}" )
fi

seed_index () {
  local index_name="$1"
  local file_path="$2"

  if [[ ! -f "${file_path}" ]]; then
    echo "ERROR: Seed file not found: ${file_path}" >&2
    return 1
  fi

  local url="${ENDPOINT%/}/indexes/${index_name}/docs/index?api-version=${API_VERSION}"

  echo "Seeding index '${index_name}' from $(basename "${file_path}")..."

  local resp
  resp="$(curl -sS -X POST "${url}" \
    -H 'Content-Type: application/json' \
    "${_auth_headers[@]}" \
    --data-binary "@${file_path}")"

  # Best-effort validation: fail if any document failed.
  RESP="${resp}" python - <<'PY'
import json, os, sys
payload = json.loads(os.environ.get('RESP', ''))
if isinstance(payload, dict) and payload.get("error"):
    message = payload["error"].get("message") or "Search error"
    raise SystemExit(message)
items = payload.get('value') or []
failed = [i for i in items if i.get('status') is False]
if failed:
    ids = ', '.join(i.get('key','<unknown>') for i in failed[:10])
    raise SystemExit(f"Seed failed for {len(failed)} docs. First failed keys: {ids}")
print(f"  OK: {len(items)} docs")
PY
}

GOLDEN_FILE="${SCRIPT_DIR}/golden-examples.json"
DOMAIN_FILE="${SCRIPT_DIR}/domain-context.json"
if [[ "${USE_VECTORS}" == "1" ]]; then
  if [[ -f "${SCRIPT_DIR}/generated/golden-examples.vectors.json" ]]; then
    GOLDEN_FILE="${SCRIPT_DIR}/generated/golden-examples.vectors.json"
  fi
  if [[ -f "${SCRIPT_DIR}/generated/domain-context.vectors.json" ]]; then
    DOMAIN_FILE="${SCRIPT_DIR}/generated/domain-context.vectors.json"
  fi
fi

seed_index "${GOLDEN_INDEX}" "${GOLDEN_FILE}"
seed_index "${TEMPLATES_INDEX}" "${SCRIPT_DIR}/templates.json"
seed_index "${FEEDBACK_INDEX}" "${SCRIPT_DIR}/feedback.json"
if ! seed_index "${DOMAIN_INDEX}" "${DOMAIN_FILE}"; then
  echo "Warning: domain-context seed failed (index may be missing)."
fi

echo "Done."
