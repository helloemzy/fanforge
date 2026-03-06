#!/usr/bin/env bash
set -euo pipefail

API_BASE="https://api.cloudflare.com/client/v4"
DOMAIN="shippex.app"
WWW_HOST="www.${DOMAIN}"
EXPECTED_ZONE_NAME="${DOMAIN}"

if [[ -z "${CLOUDFLARE_TOKEN:-}" ]]; then
  echo "Set CLOUDFLARE_TOKEN before running this script." >&2
  exit 1
fi

zone_response=$(curl -sS -H "Authorization: Bearer ${CLOUDFLARE_TOKEN}" "${API_BASE}/zones?name=${EXPECTED_ZONE_NAME}")
zone_id=$(echo "${zone_response}" | jq -r '.result[0].id // empty')

if [[ -z "${zone_id}" ]]; then
  echo "Unable to resolve zone id for ${EXPECTED_ZONE_NAME}. Response:" >&2
  echo "${zone_response}" >&2
  exit 1
fi

echo "Zone ID: ${zone_id}"

record_response=$(curl -sS -H "Authorization: Bearer ${CLOUDFLARE_TOKEN}" \
  "${API_BASE}/zones/${zone_id}/dns_records?name=${WWW_HOST}&type=A&type=CNAME")

record_success=$(echo "${record_response}" | jq -r '.success // false')
if [[ "${record_success}" != "true" ]]; then
  echo "Cloudflare DNS read failed for ${WWW_HOST}." >&2
  echo "${record_response}" >&2
  exit 1
fi

record_ids=$(echo "${record_response}" | jq -r '.result[]?.id' || true)

if [[ -z "${record_ids}" ]]; then
  echo "No A/CNAME records found for ${WWW_HOST}."
  exit 0
fi

echo "Deleting ${WWW_HOST} records:"
printf '%s\n' "${record_ids}"

while IFS= read -r rid; do
  [[ -z "${rid}" ]] && continue
  del_response=$(curl -sS -X DELETE -H "Authorization: Bearer ${CLOUDFLARE_TOKEN}" "${API_BASE}/zones/${zone_id}/dns_records/${rid}")
  del_success=$(echo "${del_response}" | jq -r '.success // false')
  if [[ "${del_success}" != "true" ]]; then
    echo "Failed to delete record ${rid}: ${del_response}" >&2
  fi

done <<< "${record_ids}"

echo "Done."
