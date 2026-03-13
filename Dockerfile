# Build stage: Rust 1.85+ required for edition 2024
FROM rust:slim-bookworm AS builder
WORKDIR /app

COPY . .
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/forellm /usr/local/bin/forellm

ENTRYPOINT ["forellm"]
CMD ["--help"]
