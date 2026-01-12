FROM node:25-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:25-alpine AS server
WORKDIR /app/server
RUN apk add --no-cache tini ffmpeg
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY server/ ./
COPY --from=client-build /app/client/dist /app/client/dist
ENV NODE_ENV=production
ENV CLIENT_DIST=/app/client/dist
ENV ARCHIVE_ROOT=/archive
ENV CACHE_ROOT=/cache
EXPOSE 3001
ENTRYPOINT ["tini", "--"]
CMD ["node", "index.js"]
