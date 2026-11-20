# Web frontend Dockerfile — Node LTS with frozen lockfile
FROM node:20-slim AS runner

WORKDIR /app

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy package manifests
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies required for build)
RUN npm ci

# Copy application source
COPY . .

# Build the Next.js production bundle
RUN npm run build

# Switch to production runtime
ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "run", "start"]
