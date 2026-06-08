FROM node:20-bullseye-slim

# better-sqlite3 native build için gerekli araçlar
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

# Native modülleri derleyerek kur
RUN npm ci

COPY . .

RUN mkdir -p data

EXPOSE 3001

CMD ["node", "server.js"]
