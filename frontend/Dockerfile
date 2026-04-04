FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
COPY frontend/package.json frontend/package.json
RUN npm install --workspace frontend
COPY frontend frontend

ARG VITE_API_BASE_URL=http://localhost:3000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build --workspace frontend

FROM nginx:alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
