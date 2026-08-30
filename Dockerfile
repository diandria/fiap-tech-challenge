# ---- Build stage ----
FROM node:22-alpine AS builder
WORKDIR /app
# O engine do Prisma e ligado ao libssl. Sem openssl no Alpine a deteccao erra
# o alvo e escolhe o binario de openssl 1.1, que nao existe aqui.
RUN apk add --no-cache openssl
COPY package*.json ./
# O schema precisa existir antes do npm ci: o postinstall do @prisma/client
# roda prisma generate, e sem schema ele gera um stub sem os tipos do
# dominio, o que faz o tsc falhar so aqui dentro.
COPY prisma ./prisma
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Runtime stage ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/main.js"]
