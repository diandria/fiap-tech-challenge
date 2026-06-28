#!/bin/bash

echo "[1/2] Stopping GitHub Actions runner..."
pkill -f "actions-runner" 2>/dev/null && echo "Runner stopped." || echo "Runner was not running."

echo "[2/2] Stopping Minikube..."
minikube stop

echo ""
echo "System shut down."
