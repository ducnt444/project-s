# Builds the whole app as one image: the API serves the compiled frontend.
# docker build -t project-s . && docker run -p 3000:3000 --env-file backend/.env project-s

FROM node:22.23.4-bookworm-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json frontend/.npmrc ./
RUN npm ci
COPY frontend/ ./
RUN npx ng build

FROM node:22.23.4-bookworm-slim AS backend
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json backend/.npmrc ./
RUN npm ci
COPY backend/ ./
RUN npm run build && npm prune --omit=dev

FROM node:22.23.4-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    FRONTEND_DIR=/app/public \
    DB_SYNCHRONIZE=false \
    DB_MIGRATIONS_RUN=true
COPY --from=backend /app/backend/package.json ./
COPY --from=backend /app/backend/node_modules ./node_modules
COPY --from=backend /app/backend/dist ./dist
COPY --from=frontend /app/frontend/dist/frontend/browser ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD node -e "fetch('http://localhost:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/main.js"]
