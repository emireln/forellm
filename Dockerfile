# Multi-stage build for ForeLLM
# Stage 1: Build the Rust binary
FROM rust:1.88-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /build

# Copy workspace configuration
COPY Cargo.toml Cargo.lock ./

# Copy all workspace members
COPY forellm-core/ ./forellm-core/
COPY forellm-tui/ ./forellm-tui/
COPY forellm-desktop/ ./forellm-desktop/
COPY data/ ./data/

# Build release binary for forellm-tui
RUN cargo build --release -p forellm

# Stage 2: Runtime image
FROM debian:bookworm-slim

# Install runtime dependencies for hardware detection
RUN apt-get update && apt-get install -y \
    pciutils \
    lshw \
    && rm -rf /var/lib/apt/lists/*

# Copy the binary from builder
COPY --from=builder /build/target/release/forellm /usr/local/bin/forellm

# Create a non-root user
RUN useradd -m -u 1000 forellm && \
    chown -R forellm:forellm /usr/local/bin/forellm

USER forellm

# Set default command to output JSON recommendations
# In Kubernetes, this will run once per node and log results
ENTRYPOINT ["/usr/local/bin/forellm"]
CMD ["recommend", "--json"]
