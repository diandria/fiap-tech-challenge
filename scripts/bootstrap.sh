#!/usr/bin/env bash
set -euo pipefail

WITH_SONAR=0
for arg in "$@"; do
  case "$arg" in
    --with-sonar) WITH_SONAR=1 ;;
    -h|--help)
      cat <<EOF
Usage: ./scripts/bootstrap.sh [--with-sonar]

Bootstraps the local dev environment:
  - copies .env from .env.example (if missing)
  - runs npm install
  - starts app + mongo via docker-compose
  - waits for healthy, then runs npm run seed:dev

With --with-sonar, also starts SonarQube (profile: sonar).
EOF
      exit 0
      ;;
  esac
done

step() { echo "==> $*"; }
fail() { echo "ERROR: $*" >&2; exit 1; }

require() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing dependency: $1. Install and re-run."
}

# Pick docker compose v2 if available, fall back to v1
if docker compose version >/dev/null 2>&1; then
  DC=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  DC=(docker-compose)
else
  fail "Missing dependency: docker compose (v2) or docker-compose (v1). Install and re-run."
fi

step "Checking prerequisites"
require docker
require node
require npm
require curl

[ -f package.json ] || fail "Run this script from the repo root (package.json not found)."

step "Ensuring .env exists"
if [ -f .env ]; then
  echo "    .env already exists, leaving it untouched."
else
  cp .env.example .env
  echo "    Copied .env.example -> .env. Review it before going to production."
fi

step "Installing npm dependencies"
npm install

step "Starting app + mongo"
"${DC[@]}" up -d app mongo

if [ "$WITH_SONAR" = "1" ]; then
  step "Starting SonarQube (profile: sonar)"
  "${DC[@]}" --profile sonar up -d sonarqube sonar-db
fi

wait_for() {
  local label="$1"; shift
  local timeout="$1"; shift
  local elapsed=0
  while ! "$@" >/dev/null 2>&1; do
    sleep 2
    elapsed=$((elapsed + 2))
    if [ "$elapsed" -ge "$timeout" ]; then
      fail "$label did not become healthy in ${timeout}s. Check '${DC[*]} logs'."
    fi
  done
}

step "Waiting for mongo"
wait_for "mongo" 60 "${DC[@]}" exec -T mongo mongosh --quiet --eval "db.runCommand({ping:1})"

step "Waiting for app"
wait_for "app" 60 curl --silent --fail http://localhost:3000/docs

if [ "$WITH_SONAR" = "1" ]; then
  step "Waiting for SonarQube (this can take 1-2 min on first start)"
  sonar_up() {
    curl --silent --fail http://localhost:9000/api/system/status \
      | grep -q '"status":"UP"'
  }
  wait_for "sonarqube" 180 sonar_up
fi

step "Seeding dev data"
npm run seed:dev

cat <<EOF

Setup complete.
  API:        http://localhost:3000
  Swagger:    http://localhost:3000/docs

Seed users (password: dev123):
  admin@dev.local
  attendant@dev.local
  mechanic@dev.local
EOF

if [ "$WITH_SONAR" = "1" ]; then
  cat <<EOF

SonarQube:    http://localhost:9000 (admin/admin on first login)
  1. Generate a token at My Account -> Security.
  2. Add to .env:
       SONAR_HOST_URL=http://localhost:9000
       SONAR_TOKEN=<token>
  3. Run: npm run test:coverage && npm run sonar
EOF
fi
