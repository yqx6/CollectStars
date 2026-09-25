# syntax=docker/dockerfile:1
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN --mount=type=cache,target=/root/.npm npm config set registry https://mirrors.cloud.tencent.com/npm/ && npm install --no-audit --no-fund --fetch-retries 8 --fetch-retry-mintimeout 10000 --fetch-timeout 30000 --maxsockets 3 --os=linux --cpu=x64
COPY . ./
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
