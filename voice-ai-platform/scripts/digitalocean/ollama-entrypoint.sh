#!/bin/sh
set -eu

MODEL="${OLLAMA_MODEL:-huihui_ai/qwen3-abliterated:4b}"

/bin/ollama serve &
pid="$!"

until /bin/ollama list >/dev/null 2>&1; do
  sleep 1
done

if ! /bin/ollama list | grep -Fq "${MODEL}"; then
  echo "Pulling Ollama model: ${MODEL}"
  /bin/ollama pull "${MODEL}"
fi

wait "${pid}"
