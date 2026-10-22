#!/bin/sh
# Refuse to start when the cache mount is not writable by the unprivileged user.
set -eu

cache=/app/data/cache
if [ ! -d "$cache" ] || [ ! -w "$cache" ]; then
  echo "api: ${cache} is not writable by uid $(id -u)." >&2
  echo "On the host run: mkdir -p data/cache data/props && chmod a+rwx data/cache data/props" >&2
  exit 1
fi

exec "$@"
