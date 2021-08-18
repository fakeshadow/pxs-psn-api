#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

use hft_mock_rs::rem::server;

fn main() -> std::io::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter("hft_mock_rs=info")
        .init();

    server::run(
        "0.0.0.0:8080", // tcp和udp tick共用此地址
        "0.0.0.0:8081", // 交易udp 独占此地址
        "233.1.1.1:5000",  // tick组播地址
        "0.0.0.0:8082", // http地址
    )
}
