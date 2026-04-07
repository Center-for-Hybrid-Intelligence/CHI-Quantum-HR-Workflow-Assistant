#!/bin/sh
# Reads Docker secret files from /run/secrets/ and exports them as environment variables.
# Falls back gracefully if a secret file doesn't exist.

load_secret() {
  local secret_name="$1"
  local env_var="$2"
  local secret_file="/run/secrets/${secret_name}"
  if [ -f "$secret_file" ]; then
    export "${env_var}=$(cat "$secret_file")"
  fi
}

load_secret "database_url"        "DATABASE_URL"
load_secret "openai_api_key"      "AI_INTEGRATIONS_OPENAI_API_KEY"
load_secret "anthropic_api_key"   "AI_INTEGRATIONS_ANTHROPIC_API_KEY"
load_secret "gemini_api_key"      "AI_INTEGRATIONS_GEMINI_API_KEY"

exec "$@"
