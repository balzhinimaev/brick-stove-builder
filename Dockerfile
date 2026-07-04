# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_APP_BASE=/
ENV VITE_APP_BASE=$VITE_APP_BASE
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4174
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
# не под root: образу достаточно прав пользователя node
USER node
EXPOSE 4174
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4174/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["npm", "run", "server"]
