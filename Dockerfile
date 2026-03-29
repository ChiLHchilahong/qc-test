FROM node:18-alpine

# Install dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++ sqlite-dev

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create data directory
RUN mkdir -p data

# Expose ports
EXPOSE 3001 5173

# Start both server and client
CMD ["npm", "run", "dev"]