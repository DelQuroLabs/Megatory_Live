# Megatory Live on Coolify: the web app + the notebook sync API in one small container.
# Build: the Expo web export. Run: server/main.mjs (no npm dependencies) serving both.

FROM node:22-bookworm-slim AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
# The app calls the sync API here (same domain as the site by default).
ARG EXPO_PUBLIC_API_BASE_URL=https://megatory-live.delqurolabs.app/api
ENV EXPO_PUBLIC_API_BASE_URL=$EXPO_PUBLIC_API_BASE_URL
RUN npx expo export --platform web

FROM node:24-alpine
WORKDIR /app
COPY server ./server
COPY --from=web /app/dist ./web
RUN mkdir -p /data && chown node:node /data
ENV NODE_ENV=production DATA_DIR=/data WEB_DIR=/app/web PORT=8080 TRUST_PROXY=1
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1
USER node
CMD ["node", "server/main.mjs"]
