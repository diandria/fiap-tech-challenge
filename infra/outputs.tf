output "app_url" {
  description = "Application URL via Minikube NodePort"
  value       = "Execute: minikube service oficina-service -n oficina --url"
}

output "namespace" {
  description = "Namespace where resources were created"
  value       = "oficina"
}
