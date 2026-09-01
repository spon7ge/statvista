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
exclude="${ODDS_EXCLUDE:-wnba_prizepick,mlb_prizepick}"

echo "odds worker: league=${league} exclude=${exclude} interval=${interval}s"

while true; do
  echo "── odds scrape $(date -u +%Y-%m-%dT%H:%M:%SZ) ──"
  set +e
  python -m src.scrapers.run_all_odds --league "$league" --exclude "$exclude"
  code=$?
  set -e
  echo "odds scrape exited ${code}; sleeping ${interval}s"
  sleep "$interval"
done
