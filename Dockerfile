FROM node:22-slim

# Создаём ту же файловую структуру, что и на хосте
RUN useradd -m -u 1000 -d /home/artem artem
ENV HOME=/home/artem

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY src ./src
COPY openclaw.plugin.json tsconfig.json ./
RUN npx tsc

RUN apt-get update && apt-get install -y --no-install-recommends jq && rm -rf /var/lib/apt/lists/*

# Кладём плагин туда же, куда указывает installPath в openclaw.json
RUN mkdir -p /home/artem/.openclaw/extensions/personal-manager && \
    cp -r /app/. /home/artem/.openclaw/extensions/personal-manager/ && \
    rm -rf /home/artem/.openclaw/extensions/personal-manager/node_modules/openclaw/dist/extensions && \
    mkdir -p /home/artem/.openclaw/workspace

COPY scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV PM_DATA_DIR=/data
ENV OPENCLAW_CONFIG_PATH=/config/openclaw.json
VOLUME ["/data"]

ENTRYPOINT ["/entrypoint.sh"]