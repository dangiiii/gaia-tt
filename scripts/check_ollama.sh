#!/usr/bin/env bash
# Quick health check for a remote Ollama server reached via SSH tunnel.
# Usage:
#   ./scripts/check_ollama.sh [model]          # default model: qwen3.8:27b
#   OLLAMA_HOST=http://localhost:11434 ./scripts/check_ollama.sh

set -u

OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"
MODEL="${1:-qwen3.8:27b}"

echo "==> 1/3 Checking Ollama server at $OLLAMA_HOST ..."
VERSION=$(curl -sf --max-time 5 "$OLLAMA_HOST/api/version")
if [ $? -ne 0 ]; then
  echo "FAIL: cannot reach $OLLAMA_HOST — is your SSH tunnel up?"
  echo "      e.g. ssh -L 11434:localhost:11434 user@uni-server"
  exit 1
fi
echo "OK: $VERSION"

echo "==> 2/3 Checking model '$MODEL' is available ..."
TAGS=$(curl -sf --max-time 5 "$OLLAMA_HOST/api/tags")
if echo "$TAGS" | grep -q "\"name\":\"$MODEL\""; then
  echo "OK: model '$MODEL' found"
else
  echo "FAIL: model '$MODEL' not found. Models on server:"
  echo "$TAGS" | grep -o '"name":"[^"]*"' | sed 's/"name":"//;s/"//'
  exit 1
fi

echo "==> 3/3 Sending test chat request to '$MODEL' ..."
RESPONSE=$(curl -sf --max-time 120 "$OLLAMA_HOST/api/chat" -d "{
  \"model\": \"$MODEL\",
  \"messages\": [{\"role\": \"user\", \"content\": \"Reply with exactly one word: pong\"}],
  \"stream\": false
}")
if [ $? -ne 0 ]; then
  echo "FAIL: chat request failed (model may not be loaded or request timed out)"
  exit 1
fi

if command -v jq >/dev/null 2>&1; then
  echo "OK: response -> $(echo "$RESPONSE" | jq -r '.message.content')"
  echo "$RESPONSE" | jq -r '"     (done in \((.total_duration // 0) / 1e9 | floor)s, eval_count=\(.eval_count // 0) tokens)"'
else
  echo "OK: response -> $(echo "$RESPONSE" | grep -o '"content":"[^"]*"' | head -1 | sed 's/"content":"//;s/"$//')"
fi

echo "All checks passed."
