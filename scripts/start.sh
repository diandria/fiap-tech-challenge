#!/bin/bash
set -e

echo "[1/4] Fixing WSL DNS..."
sudo bash -c 'echo "nameserver 8.8.8.8
nameserver 1.1.1.1" > /etc/resolv.conf'

echo "[2/4] Starting Minikube..."
minikube start --driver=docker

echo "[3/4] Pointing Docker to Minikube daemon..."
eval $(minikube docker-env)

echo "[4/4] Starting GitHub Actions runner..."
cd ~/actions-runner && ./run.sh &

echo ""
echo "Ready! To access the application run:"
echo "  minikube service oficina-service -n oficina --url"
