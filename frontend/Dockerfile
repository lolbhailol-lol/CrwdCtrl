FROM node:22-alpine AS build

WORKDIR /app

# Railway only exposes service variables to Docker build steps when declared as ARG.
# Vite reads these public VITE_* values while creating the browser bundle.
ARG VITE_API_BASE_URL
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_MEASUREMENT_ID
ARG VITE_FIREBASE_VAPID_KEY
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_RECAPTCHA_SITE_KEY
ARG VITE_CASHFREE_MODE
ARG VITE_SENTRY_DSN
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM caddy:2-alpine

COPY --from=build /app/dist /app/dist
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]