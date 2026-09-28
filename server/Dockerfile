FROM node:24-bookworm-slim
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./
COPY docs/ /app/docs/
RUN mkdir -p /data && chown node:node /data
USER node
ENV NODE_ENV=production HOST=0.0.0.0 DATA_DIR=/data PORT=3000
EXPOSE 3000
CMD ["node", "--env-file-if-exists=.env", "index.mjs"]
