#!/usr/bin/env bash
# Loop HTTP odds scrapers. PrizePicks (Brave/CDP) is excluded by default.
set -euo pipefail

cd /app

interval="${ODDS_INTERVAL_SECONDS:-300}"
case "$interval" in
  ''|*[!0-9]*)
    echo "ODDS_INTERVAL_SECONDS must be a positive integer, got: ${interval}" >&2
    exit 1
    ;;
esac
if [ "$interval" -le 0 ]; then
  echo "ODDS_INTERVAL_SECONDS must be > 0" >&2
  exit 1
fi

league="${ODDS_LEAGUE:-all}"
exclude="${ODDS_EXCLUDE:-wnba_prizepick,nba_prizepick,mlb_prizepick}"

props=/app/data/props
if [ ! -d "$props" ] || [ ! -w "$props" ]; then
  echo "odds worker: ${props} is not writable by uid $(id -u)." >&2
  echo "On the host run: mkdir -p data/cache data/props && chmod a+rwx data/cache data/props" >&2
  exit 1
fi

echo "odds worker: league=${league} exclude=${exclude} interval=${interval}s"

while true; do
  echo "── odds scrape $(date -u +%Y-%m-%dT%H:%M:%SZ) ──"
  set +e
  python -m src.scrapers.run_all_odds --league "$league" --exclude "$exclude"
  code=$?
  set -e
  if [ "$code" -ne 0 ]; then
    echo "odds scrape failed with exit ${code}; sleeping ${interval}s" >&2
  else
    echo "odds scrape exited ${code}; sleeping ${interval}s"
  fi
  sleep "$interval"
done
