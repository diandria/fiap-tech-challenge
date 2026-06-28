#!/bin/bash

echo "[1/3] Stopping GitHub Actions runner..."
pkill -f "actions-runner" 2>/dev/null && echo "Runner stopped." || echo "Runner was not running."

echo "[2/3] Stopping minikube tunnel..."
pkill -f "minikube tunnel" 2>/dev/null && echo "Tunnel stopped." || echo "Tunnel was not running."

echo "[3/3] Stopping Minikube..."
minikube stop

echo ""
echo "System shut down."
