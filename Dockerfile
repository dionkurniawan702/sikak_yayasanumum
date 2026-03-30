# Stage 1: Build Frontend (React + Vite)
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Unified Backend & Serve
FROM node:20-alpine
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache openssl libc6-compat tini dos2unix

# Copy backend dependencies
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm install --omit=dev

# Copy backend source
COPY server/ ./
RUN dos2unix start.sh
RUN chmod +x start.sh
RUN npx prisma generate --schema=./prisma/schema.prisma

# Copy the built frontend
COPY --from=frontend-builder /app/dist /app/dist

# Configuration
EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

# Start unified app using startup script
CMD ["sh", "start.sh"]
