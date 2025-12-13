
# ---------- BUILD STAGE (Debian-based Node) ----------
FROM node:22 AS build

WORKDIR /app

# 1) Build-time configuration for Vite
ARG VITE_ENTRA_CLIENT_ID
ARG VITE_ENTRA_TENANT_ID
ARG VITE_API_SCOPE
ARG VITE_API_BASE_URL
ARG VITE_REDIRECT_URI
ARG VITE_POST_LOGOUT_REDIRECT_URI
ARG VITE_TENANT_ID
ARG VITE_TENANT_NAME
ARG VITE_TENANT_LOGO_URL
ARG VITE_TENANT_FAVICON_URL
ARG VITE_TENANT_PRIMARY_COLOR
ARG VITE_TENANT_SECONDARY_COLOR

# Vite reads VITE_* envs at build time
ENV VITE_ENTRA_CLIENT_ID=$VITE_ENTRA_CLIENT_ID \
    VITE_ENTRA_TENANT_ID=$VITE_ENTRA_TENANT_ID \
    VITE_API_SCOPE=$VITE_API_SCOPE \
    VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_REDIRECT_URI=$VITE_REDIRECT_URI \
    VITE_POST_LOGOUT_REDIRECT_URI=$VITE_POST_LOGOUT_REDIRECT_URI \
    VITE_TENANT_ID=$VITE_TENANT_ID \
    VITE_TENANT_NAME=$VITE_TENANT_NAME \
    VITE_TENANT_LOGO_URL=$VITE_TENANT_LOGO_URL \
    VITE_TENANT_FAVICON_URL=$VITE_TENANT_FAVICON_URL \
    VITE_TENANT_PRIMARY_COLOR=$VITE_TENANT_PRIMARY_COLOR \
    VITE_TENANT_SECONDARY_COLOR=$VITE_TENANT_SECONDARY_COLOR

# 2) Copy only manifest files first (best layer caching)
COPY package*.json ./

# 3) Install clean, reproducible dependencies
#    - Ensure devDependencies are present (TypeScript/Vite usually live there)
RUN npm ci

# 4) Copy the full source AFTER deps
COPY . .

# 5) Normalize line endings & ensure executables:
#    - CRLF in node_modules/.bin scripts breaks shebang on Linux (causes exit 126)
#    - Missing +x on scripts also causes exit 126
#    dos2unix is in Debian repos; if it’s missing, the command still succeeds (|| true)
RUN apt-get update && apt-get install -y --no-install-recommends dos2unix && rm -rf /var/lib/apt/lists/* || true
RUN find node_modules/.bin -type f -exec chmod +x {} \; || true
RUN find node_modules/.bin -type f -exec dos2unix {} \; || true

# 6) Add quick diagnostics (kept as separate RUN so you can read logs in ACR)
RUN node -v && npm -v
RUN which tsc || true
RUN ls -l node_modules/.bin/tsc || true
RUN head -n 1 node_modules/.bin/tsc || true
RUN printf "PATH is: %s\n" "$PATH"

# 7) Prefer running TypeScript via npx (robust PATH resolution)
#    If your "build" script already calls vite/tsc, keep npm run build.
#    Otherwise, explicitly build with npx to avoid PATH quirks.
#    (Uncomment the line that matches your project.)
# RUN npx tsc -p tsconfig.json
RUN npm run build

# ---------- RUNTIME STAGE (Nginx for static assets) ----------
FROM nginx:alpine AS runtime

# Copy the built site
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration (ensure it has LF line-endings)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Security/operability niceties
EXPOSE 80

# Optional: healthcheck (customize path if you have a health page)
# HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
#   CMD wget -qO- http://127.0.0.1/health || exit 1

