# syntax=docker/dockerfile:1
# Next.js standalone 이미지. ARM64(Graviton) Fargate에서 실행.
# NEXT_PUBLIC_SITE_URL 은 빌드 시점에 번들에 박히므로 build-arg로 받는다.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
# 빌드 정보(버전 페이지용) — 배포 시각은 여기 넣지 않는다(ECS API가 진실). ecs-deploy.yml이 채운다.
ARG APP_VERSION=dev
ARG APP_COMMIT=unknown
ARG APP_BUILT_AT=unknown
ARG APP_BUILD_URL=
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 DB_CA_PATH=/app/rds-ca.pem \
    APP_VERSION=$APP_VERSION APP_COMMIT=$APP_COMMIT APP_BUILT_AT=$APP_BUILT_AT APP_BUILD_URL=$APP_BUILD_URL
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
COPY --from=build --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nextjs /app/public ./public
# 마이그레이션 러너 — 배포 워크플로가 이 이미지로 `node db/migrate.mjs` 일회성 태스크를 돌린다 (pg 는 standalone 에 포함)
COPY --from=build --chown=nextjs:nextjs /app/db ./db
# RDS TLS 검증용 CA 번들 — repo에 두지 않고(.gitignore *.pem) 빌드 시 AWS 트러스트스토어에서 받는다
ADD --chown=nextjs:nextjs https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem ./rds-ca.pem
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
