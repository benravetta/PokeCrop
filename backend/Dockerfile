# PokeCrop Node/Express API gateway.
# The backend is bundled into a single self-contained file with esbuild, so the
# runtime image needs no node_modules at all — just node + the bundle.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3001
WORKDIR /app
COPY --from=build /app/dist/server.cjs ./server.cjs
EXPOSE 3001
USER node
CMD ["node", "server.cjs"]
