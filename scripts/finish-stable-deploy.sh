#!/bin/bash
set -euo pipefail
LOG=/tmp/planka-build-stable.log
DEPLOY_LOG=/tmp/planka-deploy-stable.log
exec >>"$DEPLOY_LOG" 2>&1
echo "==== $(date -Is) finish-stable-deploy start ===="

while pgrep -f '^docker compose build' >/dev/null; do
  echo "$(date -Is) waiting for compose build..."
  sleep 30
done
while pgrep -af '[v]ite build' >/dev/null; do
  echo "$(date -Is) waiting for vite build..."
  sleep 30
done

sleep 5
echo "==== build log tail ===="
tail -50 "$LOG" || true

if grep -qE 'ERROR:|failed to solve' "$LOG" 2>/dev/null; then
  echo "BUILD FAILED — abort deploy"
  exit 1
fi

cd /opt/planka
echo "$(date -Is) docker compose up -d --force-recreate"
docker compose up -d --force-recreate planka

for i in $(seq 1 36); do
  st=$(docker inspect planka --format '{{.State.Health.Status}}' 2>/dev/null || echo missing)
  echo "health $i: $st"
  [ "$st" = "healthy" ] && break
  sleep 5
done

curl -sk https://task.bigtech.id/ | grep -E 'title>|font-family:|\.ui,button|Icons !important|bigtech Task' | head -20 || true
echo "==== $(date -Is) DONE health=$(docker inspect planka --format '{{.State.Health.Status}}') ===="
