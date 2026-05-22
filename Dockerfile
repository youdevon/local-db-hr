FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci


FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build


FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache \
    tzdata \
    bash \
    curl \
    unzip \
    rsync \
    docker-cli \
    docker-cli-compose \
    postgresql-client

ENV NODE_ENV=production
ENV TZ=America/Port_of_Spain

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json* ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/config ./config
COPY --from=builder /app/next.config.* ./
COPY --from=builder /app/scripts ./scripts

RUN chmod +x /app/scripts/docker-entrypoint.sh /app/scripts/ensure-env-license-key.sh /app/scripts/install.sh

EXPOSE 3000

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
