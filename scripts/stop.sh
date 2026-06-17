#!/bin/bash

echo "[1/2] Parando runner do GitHub Actions..."
pkill -f "actions-runner" 2>/dev/null && echo "Runner parado." || echo "Runner nao estava rodando."

echo "[2/2] Parando Minikube..."
minikube stop

echo ""
echo "Sistema desligado."
