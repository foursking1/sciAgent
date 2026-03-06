FROM docker.1ms.run/library/node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm config set registry https://registry.npmmirror.com && \
    npm ci

# Copy application code
COPY . .

# Clear build cache and build
ENV NEXT_TELEMETRY_DISABLED=1
RUN rm -rf .next node_modules/.cache 2>/dev/null || true
RUN npm run build

# Expose port
EXPOSE 3000

# Run the application
CMD ["npm", "start"]
