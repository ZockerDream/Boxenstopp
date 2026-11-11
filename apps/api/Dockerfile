# Boxenstopp – API und Worker (gleiches Image). Build-Kontext ist das Repository-Wurzelverzeichnis.
FROM node:22-alpine
RUN apk add --no-cache postgresql16-client tzdata
WORKDIR /app
COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY apps/api/src ./src
COPY apps/api/migrations ./migrations
COPY apps/web/public ./public
RUN mkdir -p /backups && chown node:node /backups
USER node
ENV NODE_ENV=production PORT=3000 BACKUP_DIR=/backups
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "src/main.js"]
