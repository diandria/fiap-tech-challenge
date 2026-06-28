variable "kubeconfig_path" {
  description = "Path to the Minikube kubeconfig file"
  type        = string
  default     = "~/.kube/config"
}

variable "kubeconfig_context" {
  description = "Kubeconfig context to use (e.g. minikube)"
  type        = string
  default     = "minikube"
}

variable "jwt_secret" {
  description = "Secret used to sign JWT tokens"
  type        = string
  sensitive   = true
}

variable "admin_password" {
  description = "Password for the application admin user"
  type        = string
  sensitive   = true
}

variable "mongo_root_username" {
  description = "MongoDB root username"
  type        = string
  sensitive   = true
  default     = "admin"
}

variable "mongo_root_password" {
  description = "MongoDB root password"
  type        = string
  sensitive   = true
}

