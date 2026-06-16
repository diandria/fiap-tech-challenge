output "app_url" {
  description = "URL de acesso à aplicação via Minikube NodePort"
  value       = "Execute: minikube service oficina-service -n ${var.namespace} --url"
}

output "namespace" {
  description = "Namespace onde os recursos foram criados"
  value       = var.namespace
}
