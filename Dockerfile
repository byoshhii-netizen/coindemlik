<<<<<<< HEAD
FROM golang:1.21-alpine AS builder
=======
FROM node:20-bullseye-slim

# PostgreSQL client dependencies and build tools may be installed if needed
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

>>>>>>> f1249be (Migrate DemliCoin from SQLite to PostgreSQL)
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o demcoin .

FROM alpine:latest
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /app
COPY --from=builder /app/demcoin .
COPY --from=builder /app/public ./public
EXPOSE 8080
CMD ["./demcoin"]
