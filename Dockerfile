FROM node:22-slim

# Build araçları (better-sqlite3 için gerekli)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Veri klasörü
RUN mkdir -p data

EXPOSE 3001

CMD ["node", "server.js"]
