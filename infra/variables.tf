variable "kubeconfig_path" {
  description = "Caminho para o kubeconfig do Minikube"
  type        = string
  default     = "~/.kube/config"
}

variable "kubeconfig_context" {
  description = "Contexto do kubeconfig a usar (ex.: minikube)"
  type        = string
  default     = "minikube"
}
