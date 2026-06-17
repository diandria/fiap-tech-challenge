#!/bin/bash
set -e

echo "[1/4] Corrigindo DNS do WSL..."
sudo bash -c 'echo "nameserver 8.8.8.8
nameserver 1.1.1.1" > /etc/resolv.conf'

echo "[2/4] Iniciando Minikube..."
minikube start --driver=docker

echo "[3/4] Apontando Docker para o Minikube..."
eval $(minikube docker-env)

echo "[4/4] Iniciando runner do GitHub Actions..."
cd ~/actions-runner && ./run.sh &

echo ""
echo "Pronto! Para acessar a aplicacao rode:"
echo "  minikube service oficina-service -n oficina --url"
