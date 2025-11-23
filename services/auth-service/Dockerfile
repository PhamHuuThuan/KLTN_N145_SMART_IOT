FROM node:18-alpine

WORKDIR /app

# Copy package files (copy explicitly to ensure package-lock.json is included)
COPY package.json package-lock.json* ./

# Install dependencies
# Use npm install instead of npm ci to handle cases where package-lock.json might be missing
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev; \
    else \
      npm install --omit=dev; \
    fi

# Copy application code
COPY . .

# Expose port
EXPOSE 4001

# Start the application
CMD ["node", "src/index.js"]

