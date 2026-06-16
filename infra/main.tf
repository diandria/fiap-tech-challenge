terraform {
  required_providers {
    kubectl = {
      source  = "gavinbunney/kubectl"
      version = "~> 1.14"
    }
  }
}

provider "kubectl" {
  config_path    = pathexpand(var.kubeconfig_path)
  config_context = var.kubeconfig_context
}

# 1. Namespace — deve existir antes de todos os outros recursos
resource "kubectl_manifest" "namespace" {
  yaml_body = file("${path.module}/../k8s/namespace.yaml")
}

# 2. Configuração — depende do Namespace
resource "kubectl_manifest" "configmap" {
  yaml_body  = file("${path.module}/../k8s/configmap.yaml")
  depends_on = [kubectl_manifest.namespace]
}

resource "kubectl_manifest" "secret" {
  yaml_body        = file("${path.module}/../k8s/secret.yaml")
  sensitive_fields = ["data", "stringData"]
  depends_on       = [kubectl_manifest.namespace]
}

# 3. MongoDB — Services dependem apenas do Namespace; StatefulSet depende do Secret e do Headless Service
resource "kubectl_manifest" "mongo_headless_service" {
  yaml_body  = file("${path.module}/../k8s/mongo-headless-service.yaml")
  depends_on = [kubectl_manifest.namespace]
}

resource "kubectl_manifest" "mongo_service" {
  yaml_body  = file("${path.module}/../k8s/mongo-service.yaml")
  depends_on = [kubectl_manifest.namespace]
}

resource "kubectl_manifest" "mongo_statefulset" {
  yaml_body  = file("${path.module}/../k8s/mongo-statefulset.yaml")
  depends_on = [
    kubectl_manifest.secret,
    kubectl_manifest.mongo_headless_service,
  ]
}

# 4. Aplicação — depende do MongoDB estar declarado e do ConfigMap/Secret
resource "kubectl_manifest" "app_deployment" {
  yaml_body  = file("${path.module}/../k8s/app-deployment.yaml")
  depends_on = [
    kubectl_manifest.configmap,
    kubectl_manifest.secret,
    kubectl_manifest.mongo_statefulset,
    kubectl_manifest.mongo_service,
  ]
}

resource "kubectl_manifest" "app_service" {
  yaml_body  = file("${path.module}/../k8s/app-service.yaml")
  depends_on = [kubectl_manifest.app_deployment]
}

resource "kubectl_manifest" "app_hpa" {
  yaml_body  = file("${path.module}/../k8s/app-hpa.yaml")
  depends_on = [kubectl_manifest.app_deployment]
}

resource "kubectl_manifest" "app_pdb" {
  yaml_body  = file("${path.module}/../k8s/app-pdb.yaml")
  depends_on = [kubectl_manifest.app_deployment]
}
