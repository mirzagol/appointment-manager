FROM node:20-alpine AS frontend-builder
WORKDIR /app

COPY package.json ./
COPY frontend/package.json frontend/package.json
RUN npm install --workspace frontend

COPY frontend frontend
RUN npm run build --workspace frontend

FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=file:./backend/prisma/dev.db

COPY package.json ./
COPY backend/package.json backend/package.json
RUN npm install --workspace backend

COPY backend backend
RUN npx prisma generate --schema backend/prisma/schema.prisma

COPY --from=frontend-builder /app/frontend/dist frontend/dist

RUN chmod +x backend/start.sh

EXPOSE 3000

CMD ["sh", "backend/start.sh"]
