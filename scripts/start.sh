#!/bin/bash
set -e

echo "[1/4] Fixing WSL DNS..."
sudo bash -c 'echo "nameserver 8.8.8.8
nameserver 1.1.1.1" > /etc/resolv.conf'

echo "[2/4] Starting Minikube..."
minikube start --driver=docker

echo "[3/4] Pointing Docker to Minikube daemon..."
eval $(minikube docker-env)

echo "[4/4] Starting minikube tunnel (background)..."
nohup minikube tunnel > /tmp/minikube-tunnel.log 2>&1 &
echo "Tunnel PID: $! (logs: /tmp/minikube-tunnel.log)"

echo "[5/5] Starting GitHub Actions runner..."
cd ~/actions-runner && ./run.sh &

echo ""
echo "Ready! API available at http://localhost:8080"
