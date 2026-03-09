FROM node:20-alpine

WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json package-lock.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/web/package.json ./packages/web/
COPY packages/vue/package.json ./packages/vue/
COPY packages/react/package.json ./packages/react/

# Install all workspace dependencies
RUN npm install --ignore-scripts

# Copy source
COPY packages/core/ ./packages/core/
COPY packages/web/ ./packages/web/

# Build the core library (web server serves it at /core)
RUN npm run build --workspace=packages/core

EXPOSE 3001

ENV NODE_ENV=development
ENV PORT=3001

CMD ["node", "packages/web/src/server.js"]
