# Build stage - Using Node 22 Debian (better ACR compatibility than Alpine)
FROM node:22 as build

WORKDIR /app

# Accept build arguments for Entra ID configuration
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

# Set environment variables from build args (Vite reads VITE_* env vars at build time)
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

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
