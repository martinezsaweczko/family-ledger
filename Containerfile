FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json .npmrc ./
RUN npm ci
COPY . .
# DATABASE_URL is validated at build time; this placeholder is not baked in (read at runtime).
RUN DATABASE_URL=mysql://build:build@localhost:3306/build npm run build && npm prune --omit=dev

FROM node:24-alpine
LABEL org.opencontainers.image.title="Hearth" \
      org.opencontainers.image.description="Household finance dashboard (SvelteKit, MySQL)"
WORKDIR /app
ENV NODE_ENV=production PORT=3000 BODY_SIZE_LIMIT=25M
COPY --from=build /app/build ./build
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
USER node
EXPOSE 3000
# node-based probe: no curl/wget needed. Start period covers waiting for MySQL + migrations.
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "build"]
