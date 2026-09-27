# syntax=docker/dockerfile:1
# Build from service directory root: docker build -f Dockerfile -t projects-ui:local .

FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat git
RUN npm install -g pnpm@10
COPY package.json pnpm-lock.yaml* .npmrc* ./
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@10
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js bakes NEXT_PUBLIC_* at build time.
# Without these the browser would call localhost and fail in production.
ARG NEXT_PUBLIC_API_URL=https://projectsapi.codevertexafrica.com
ARG NEXT_PUBLIC_AUTH_URL=https://sso.codevertexafrica.com
ARG NEXT_PUBLIC_NOTIFICATIONS_URL=https://notifications.codevertexafrica.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_AUTH_URL=$NEXT_PUBLIC_AUTH_URL
ENV NEXT_PUBLIC_NOTIFICATIONS_URL=$NEXT_PUBLIC_NOTIFICATIONS_URL

RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

RUN mkdir .next
RUN chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
