# Middleware Dockerfile
FROM oven/bun:latest
WORKDIR /app
COPY middleware/ .
RUN bun install
CMD ["bun", "run", "index.ts"]
