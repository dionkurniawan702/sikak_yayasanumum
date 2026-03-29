# ========================================
# Phase 1: Build Frontend (React + Vite)
# ========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ========================================
# Phase 2: Setup Backend & Serve
# ========================================
FROM node:20-alpine
WORKDIR /app

# Install system dependencies for Prisma on Alpine
RUN apk add --no-cache openssl libc6-compat

# Install backend dependencies first (layered cache)
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm install --omit=dev

# Copy backend source (influenced by .dockerignore)
COPY server/ ./
RUN npx prisma generate --schema=./prisma/schema.prisma

# Copy the built frontend from Phase 1
COPY --from=frontend-builder /app/dist /app/dist

# Expose the API port
EXPOSE 5000

# Start unified app
CMD ["npm", "start"]
