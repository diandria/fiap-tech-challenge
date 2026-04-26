#!/usr/bin/env bash
set -euo pipefail

[ -f .env ] || cp .env.example .env
npm install
docker-compose up -d
echo "Aguardando MongoDB..."
sleep 5
npm run seed:dev

echo
echo "Pronto."
echo "  API:     http://localhost:3000"
echo "  Swagger: http://localhost:3000/docs"
