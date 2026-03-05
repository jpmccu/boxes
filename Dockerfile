FROM node:20-alpine

WORKDIR /app

# Copy package files for all workspaces
COPY package.json package-lock.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/web/package.json ./packages/web/
COPY packages/react/package.json ./packages/react/
COPY packages/vue/package.json ./packages/vue/
COPY packages/electron/package.json ./packages/electron/

# Install all dependencies
RUN npm ci

# Copy source files
COPY packages/core/ ./packages/core/
COPY packages/web/ ./packages/web/

# Build core library first, then web assets
RUN npm run build --workspace=packages/core
RUN npm run build --workspace=packages/web

EXPOSE 3001

CMD ["npm", "run", "web:start"]
