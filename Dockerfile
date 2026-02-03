FROM node:20-alpine

WORKDIR /app

# Copy everything
COPY . .

# Távolítsd el a package-lock.json-t, ha ott van
RUN rm -f package-lock.json

# Használj npm install helyett npm ci-nek, és lépj be a backend mappu
WORKDIR /app/backend
RUN npm install --only=production && npm cache clean --force

# Back to app root
WORKDIR /app

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

EXPOSE 3000

CMD ["node", "server.js"]
