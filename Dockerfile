FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY src ./src
COPY openclaw.plugin.json tsconfig.json ./

COPY scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV PM_DATA_DIR=/data
ENV OPENCLAW_CONFIG_PATH=/config/openclaw.json
VOLUME ["/data"]

CMD ["/entrypoint.sh"]
