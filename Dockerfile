# Use official Node.js LTS lightweight Alpine image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package manifests first for caching
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy application source code
COPY . .

# Cloud Run defaults to PORT 8080 or process.env.PORT
ENV PORT=8080
EXPOSE 8080

# Run server
CMD ["node", "server.js"]
