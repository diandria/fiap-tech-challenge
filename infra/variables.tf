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

variable "jwt_secret" {
  description = "Segredo para assinar tokens JWT"
  type        = string
  sensitive   = true
}

variable "admin_password" {
  description = "Senha do usuario administrador da aplicacao"
  type        = string
  sensitive   = true
}

variable "mongo_root_username" {
  description = "Usuario root do MongoDB"
  type        = string
  sensitive   = true
  default     = "admin"
}

variable "mongo_root_password" {
  description = "Senha root do MongoDB"
  type        = string
  sensitive   = true
}

