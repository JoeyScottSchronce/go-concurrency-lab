# Static build + nginx. For GitHub Pages use .github/workflows/pages.yml (builds with Node in CI).
# Optional: docker build --build-arg VITE_GEMINI_API_KEY=... -t go-concurrency-trainer .
FROM node:24-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

ARG VITE_GEMINI_API_KEY=
ENV VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY

# Root base path (/) — same as local production preview; not GitHub Pages subpath
ENV VITE_BASE_PATH=/

RUN npm run build

# Production stage
FROM nginx:1.29.3-alpine3.22-slim

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Add custom nginx configuration to handle SPA routing
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]