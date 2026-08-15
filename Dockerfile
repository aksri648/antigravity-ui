# Multi-stage Dockerfile for DELTA Cloud IDE on Render

# Stage 1: Build React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Go Backend
FROM golang:1.24-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server .

# Stage 3: Lightweight Runtime Container
FROM alpine:latest
WORKDIR /app
RUN apk add --no-cache ca-certificates tzdata bash
COPY --from=backend-builder /app/backend/server ./backend/server
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 8080
ENV PORT=8080
ENV GIN_MODE=release
ENV SQLITE_DB_PATH=/tmp/agy_cloud.db

CMD ["./backend/server"]
