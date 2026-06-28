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

locals {
  namespace_files = fileset("${path.module}/../k8s/00-namespaces", "*.yaml")
  config_files    = fileset("${path.module}/../k8s/01-config", "*.yaml")
  mongo_files     = fileset("${path.module}/../k8s/02-mongo", "*.yaml")
  app_files       = fileset("${path.module}/../k8s/03-app", "*.yaml")
}

resource "kubectl_manifest" "namespaces" {
  for_each  = local.namespace_files
  yaml_body = file("${path.module}/../k8s/00-namespaces/${each.value}")
}

resource "kubectl_manifest" "secret" {
  yaml_body = templatefile("${path.module}/templates/secret.yaml.tpl", {
    jwt_secret          = var.jwt_secret
    admin_password      = var.admin_password
    mongo_root_username = var.mongo_root_username
    mongo_root_password = var.mongo_root_password
  })
  sensitive_fields = ["data", "stringData"]
  depends_on       = [kubectl_manifest.namespaces]
}

resource "kubectl_manifest" "config" {
  for_each   = local.config_files
  yaml_body  = file("${path.module}/../k8s/01-config/${each.value}")
  depends_on = [kubectl_manifest.namespaces]
}

resource "kubectl_manifest" "mongo" {
  for_each  = local.mongo_files
  yaml_body = file("${path.module}/../k8s/02-mongo/${each.value}")
  depends_on = [
    kubectl_manifest.secret,
    kubectl_manifest.config,
  ]
}

resource "kubectl_manifest" "app" {
  for_each  = local.app_files
  yaml_body = file("${path.module}/../k8s/03-app/${each.value}")
  depends_on = [kubectl_manifest.mongo]
}
