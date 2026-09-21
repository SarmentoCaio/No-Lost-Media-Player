FROM rust:1.90-bookworm AS builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /source
RUN git clone --depth 1 --branch rust https://github.com/EmulatorJS/EmulatorJS-Netplay.git . \
    && git checkout 4090ca7bda795a8b7a7596f4d41a4605b515d9c5
RUN cargo build --release --locked

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /source/target/release/rust-socket-server /usr/local/bin/netplay-server

ENV PORT=10000
EXPOSE 10000
USER nobody
CMD ["netplay-server"]
