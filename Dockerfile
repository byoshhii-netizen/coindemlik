FROM golang:1.21-alpine AS builder
RUN apk add --no-cache gcc musl-dev
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=1 GOOS=linux go build -o demcoin .

FROM alpine:latest
RUN apk --no-cache add ca-certificates tzdata postgresql-client
WORKDIR /app
COPY --from=builder /app/demcoin .
COPY --from=builder /app/public ./public
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O- http://localhost:8080/api/state || exit 1
CMD ["./demcoin"]
