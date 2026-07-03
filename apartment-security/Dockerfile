FROM node:18-alpine AS builder
# Set working directory
WORKDIR /app
# Install pnpm and turbo
RUN npm install -g pnpm turbo

# Copy monorepo config
COPY package.json pnpm-workspace.yaml turbo.json ./
# Copy all apps and packages
COPY apps ./apps
COPY packages ./packages

# Install dependencies
RUN pnpm install

# Build the api-server project
RUN pnpm turbo run build --filter=api-server...

FROM node:18-alpine AS runner
WORKDIR /app
# Only copy the built output and node_modules from builder
COPY --from=builder /app/apps/api-server/package.json ./package.json
COPY --from=builder /app/apps/api-server/dist ./dist
COPY --from=builder /app/apps/api-server/node_modules ./node_modules
COPY --from=builder /app/apps/api-server/prisma ./prisma

EXPOSE 5000
CMD ["npm", "start"]
