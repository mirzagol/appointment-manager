FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=file:/data/dev.db

COPY package.json ./
COPY backend/package.json backend/package.json
RUN npm install --workspace backend

COPY backend backend
RUN npx prisma generate --schema backend/prisma/schema.prisma

RUN chmod +x backend/start.sh

EXPOSE 3000

VOLUME ["/data"]

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
  CMD curl -fsS http://127.0.0.1:3000/sessions || exit 1

CMD ["sh", "backend/start.sh"]
