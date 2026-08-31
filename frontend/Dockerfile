# Vite bakes VITE_* vars into the built JS at build time, not read at
# runtime — pass it as a build arg so docker-compose can supply it per environment.
ARG VITE_API_BASE_URL
FROM node:20-slim AS build
WORKDIR /app
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY package*.json .npmrc ./
# puppeteer is a dependency but its Chrome download isn't needed to build the
# app, and fails in this minimal image (no unzip); skip it.
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
