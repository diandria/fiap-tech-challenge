apiVersion: v1
kind: Secret
metadata:
  name: oficina-secret
  namespace: oficina
  labels:
    app.kubernetes.io/part-of: fiap-tech-challenge
type: Opaque
stringData:
  JWT_SECRET: "${jwt_secret}"
  ADMIN_PASSWORD: "${admin_password}"
  MONGO_ROOT_USERNAME: "${mongo_root_username}"
  MONGO_ROOT_PASSWORD: "${mongo_root_password}"
  MONGODB_URI: "mongodb://${mongo_root_username}:${mongo_root_password}@mongo-service.oficina.svc.cluster.local:27017/car-repair-shop?authSource=admin"
