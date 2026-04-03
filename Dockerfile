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

RUN chmod +x backend/start.sh

EXPOSE 3000

CMD ["sh", "backend/start.sh"]
