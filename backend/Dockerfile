FROM node:18-slim

# Install curl for healthcheck h ved
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with clean install
RUN npm ci --only=production

# Copy application files
COPY . .

# Cloud Run environment
ENV PORT=8080
ENV NODE_ENV=production
ENV HOST=0.0.0.0

# Expose port
EXPOSE 8080

# Start the application
CMD ["node", "src/server.js"]