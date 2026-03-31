#!/usr/bin/env bash
# lucid-import.sh — Create or upload a Lucid Standard Import document.
#
# Usage:
#   LUCID_API_KEY=<token> ./scripts/lucid-import.sh [options] <file>
#
# Arguments:
#   file        Path to a Boxes LSI JSON file (document.json output from the
#               lucidExporter) or a pre-built .lucid ZIP archive.
#
# Options:
#   -t TITLE    Document title shown in Lucid  (default: filename without ext)
#   -p PRODUCT  Lucid product: lucidchart | lucidspark  (default: lucidchart)
#   -h          Print this help and exit
#
# Environment:
#   LUCID_API_KEY   Required. Lucid OAuth2 bearer token.
#                   Obtain one at https://developer.lucid.co/api/v1/#authentication
#
# How it works:
#   1. If <file> is a .json file it is zipped into a temporary .lucid archive
#      (the Lucid API requires a ZIP containing a file named document.json).
#   2. The archive is uploaded via multipart POST to https://api.lucid.co/documents.
#   3. On success the API response (JSON with the new document URL) is printed.
#
# Example:
#   export LUCID_API_KEY="eyJhbGciOiJSUzI1NiIs..."
#   node -e "
#     import { exportToLucid } from './packages/core/src/index.js';
#     // … build graph …
#     process.stdout.write(JSON.stringify(exportToLucid(graph), null, 2));
#   " > my-graph.json
#   ./scripts/lucid-import.sh -t "My Graph" my-graph.json

set -euo pipefail

# ─── Defaults ─────────────────────────────────────────────────────────────────
PRODUCT="lucidchart"
TITLE=""
FILE=""

# ─── Argument parsing ─────────────────────────────────────────────────────────
usage() {
  sed -n '/^# Usage:/,/^[^#]/{ /^[^#]/d; s/^# \{0,1\}//; p }' "$0"
  exit 0
}

while getopts ":t:p:h" opt; do
  case "$opt" in
    t) TITLE="$OPTARG" ;;
    p) PRODUCT="$OPTARG" ;;
    h) usage ;;
    :) echo "Error: option -$OPTARG requires an argument" >&2; exit 1 ;;
    \?) echo "Error: unknown option -$OPTARG" >&2; exit 1 ;;
  esac
done
shift $((OPTIND - 1))

FILE="${1:-}"

# ─── Validation ───────────────────────────────────────────────────────────────
if [ -z "${LUCID_API_KEY:-}" ]; then
  echo "Error: LUCID_API_KEY environment variable is not set." >&2
  echo "       Obtain a token at https://developer.lucid.co/api/v1/#authentication" >&2
  exit 1
fi

if [ -z "$FILE" ]; then
  echo "Error: no input file specified." >&2
  echo "Usage: LUCID_API_KEY=<token> $0 [-t title] [-p product] <file.json|file.lucid>" >&2
  exit 1
fi

if [ ! -f "$FILE" ]; then
  echo "Error: file not found: $FILE" >&2
  exit 1
fi

# Default title: filename without extension
if [ -z "$TITLE" ]; then
  TITLE="$(basename "$FILE")"
  TITLE="${TITLE%.*}"
fi

# Validate product
if [ "$PRODUCT" != "lucidchart" ] && [ "$PRODUCT" != "lucidspark" ]; then
  echo "Error: -p must be 'lucidchart' or 'lucidspark' (got: $PRODUCT)" >&2
  exit 1
fi

# ─── Packaging ────────────────────────────────────────────────────────────────
LUCID_FILE="$FILE"
TMPDIR_CREATED=""

if [[ "$FILE" == *.json ]]; then
  # Wrap the document.json in a ZIP so the Lucid API can accept it.
  if ! command -v zip &>/dev/null; then
    echo "Error: 'zip' command not found. Install zip or supply a .lucid file." >&2
    exit 1
  fi

  WORKDIR="$(mktemp -d)"
  TMPDIR_CREATED="$WORKDIR"
  # shellcheck disable=SC2064
  trap "rm -rf '$WORKDIR'" EXIT

  cp "$FILE" "$WORKDIR/document.json"
  LUCID_FILE="$WORKDIR/standard.lucid"
  (cd "$WORKDIR" && zip -q standard.lucid document.json)
fi

# ─── Upload ───────────────────────────────────────────────────────────────────
echo "Uploading '${TITLE}' to ${PRODUCT}…"

HTTP_RESPONSE="$(
  # The MIME type x-application/vnd.lucid.standardImport is non-standard but
  # required by the Lucid API (see lucidsoftware/sample-lucid-rest-applications).
  curl -sS --fail-with-body \
    -w "\n__HTTP_STATUS__%{http_code}__" \
    -H "Authorization: Bearer ${LUCID_API_KEY}" \
    -H "Lucid-Api-Version: 1" \
    -F "file=@${LUCID_FILE};type=x-application/vnd.lucid.standardImport" \
    -F "title=${TITLE}" \
    -F "product=${PRODUCT}" \
    "https://api.lucid.co/documents" 2>&1
)" || true

# Split body and status code
HTTP_CODE="$(echo "$HTTP_RESPONSE" | grep -oP '(?<=__HTTP_STATUS__)\d+(?=__)' || echo "000")"
BODY="$(echo "$HTTP_RESPONSE" | sed 's/__HTTP_STATUS__[0-9]*__//')"

# ─── Result ───────────────────────────────────────────────────────────────────
if [[ "$HTTP_CODE" =~ ^2 ]]; then
  echo "Success (HTTP ${HTTP_CODE})"
  echo "$BODY"
  exit 0
else
  echo "Error: HTTP ${HTTP_CODE}" >&2
  echo "$BODY" >&2
  exit 1
fi
