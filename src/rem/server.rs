use std::collections::VecDeque;
use std::convert::Infallible;
use std::future::{ready, Future};
use std::io;
use std::net::{IpAddr, SocketAddr, ToSocketAddrs};
use std::sync::Arc;
use std::time::Duration;

use bytes::Bytes;
use parking_lot::Mutex;
use rand::Rng;
use rem::buf::Buf;
use rem::proto::{request, response};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::UdpSocket,
    select,
    time::interval,
};
use tracing::{error, info};
use xitca_http::{
    h1::RequestBody,
    http::{header, Request, Response, StatusCode},
    HttpServiceBuilder, ResponseBody,
};
use xitca_server::net::TcpStream;
use xitca_service::fn_service;

use super::date::date;
use super::SharedState;

pub fn run<A, A2, A3, A4>(
    addr: A,
    udp_addr: A2,
    multicast_addr: A3,
    http_addr: A4,
) -> io::Result<()>
where
    A: ToSocketAddrs + Clone,
    A2: ToSocketAddrs,
    A3: ToSocketAddrs,
    A4: ToSocketAddrs,
{
    _run(addr, udp_addr, multicast_addr, http_addr, handle)
}

fn _run<A, A2, A3, A4, F, Fut, T, E>(
    addr: A,
    udp_addr: A2,
    multicast_addr: A3,
    http_addr: A4,
    handler: F,
) -> io::Result<()>
where
    A: ToSocketAddrs + Clone,
    A2: ToSocketAddrs,
    A3: ToSocketAddrs,
    A4: ToSocketAddrs,
    F: Fn(TcpStream, Arc<UdpSocket>, SharedState) -> Fut + Clone + Send + 'static,
    Fut: Future<Output = Result<T, E>>,
{
    tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .max_blocking_threads(1)
        .build()?
        .block_on(tokio::task::LocalSet::new().run_until(async move {
            let cores = core_affinity::get_core_ids().unwrap();
            let cores = Arc::new(Mutex::new(cores));

            // 服务器主线程绑定cpu核心
            if let Some(core) = cores.lock().pop() {
                info!("Main thread pinned on Core: {:?}.", core);
                core_affinity::set_for_current(core);
            }

            let shared_state = SharedState::new();

            let udp_addr = udp_addr.to_socket_addrs()?.next().unwrap();
            let shared_udp = UdpSocket::bind(udp_addr).await?;
            let shared_udp = Arc::new(shared_udp);

            // 仿真rem udp tick服务绑定在
            udp_listener(addr.clone(), multicast_addr, shared_state.clone()).await?;

            xitca_server::Builder::new()
                .worker_threads(1)
                .on_worker_start(move || {
                    // 服务器工人线程绑定cpu核心
                    if let Some(core) = cores.lock().pop() {
                        info!("Worker thread pinned on Core: {:?}.", core);
                        core_affinity::set_for_current(core);
                    }
                    ready(())
                })
                // http服务
                .bind::<_, _, _, TcpStream>("hft-mock-http", http_addr, {
                    let shared_state = shared_state.clone();
                    move || {
                        let shared_state = shared_state.clone();
                        HttpServiceBuilder::h1(fn_service(move |req: Request<RequestBody>| {
                            let shared_state = shared_state.clone();
                            async move {
                                let (parts, _) = req.into_parts();

                                let res = match parts.uri.path() {
                                    "/" => {
                                        use sailfish::TemplateOnce;
                                        let state = shared_state.collect().render_once().unwrap();

                                        Response::builder()
                                            .status(StatusCode::OK)
                                            .header(
                                                header::CONTENT_TYPE,
                                                header::HeaderValue::from_static(
                                                    "text/html; charset=utf-8",
                                                ),
                                            )
                                            .body(Bytes::from(state).into())
                                            .unwrap()
                                    }
                                    "/clear" => Response::builder()
                                        .status(StatusCode::BAD_REQUEST)
                                        .body(Bytes::new().into())
                                        .unwrap(),
                                    _ => Response::builder()
                                        .status(StatusCode::NOT_FOUND)
                                        .body(Bytes::new().into())
                                        .unwrap(),
                                };

                                Ok::<Response<ResponseBody>, ()>(res)
                            }
                        }))
                    }
                })?
                // 仿真rem tcp服务
                .bind("hft-mock-tcp", addr, move || {
                    let shared_state = shared_state.clone();
                    let shared_udp = shared_udp.clone();
                    let handler = handler.clone();
                    fn_service(move |tcp: TcpStream| {
                        handler(tcp, shared_udp.clone(), shared_state.clone())
                    })
                })?
                .build()
                .await
        }))
}

async fn udp_listener(
    addr: impl ToSocketAddrs,
    multicast_addr: impl ToSocketAddrs,
    shared_state: SharedState,
) -> io::Result<()> {
    let addr = addr.to_socket_addrs()?.next().unwrap();
    let multicast_addr = multicast_addr.to_socket_addrs()?.next().unwrap();

    // 绑定udp到服务器ip和组播端口
    let addr = SocketAddr::new(addr.ip(), multicast_addr.port());
    let udp = UdpSocket::bind(addr).await?;

    match (udp.local_addr()?.ip(), multicast_addr.ip()) {
        (IpAddr::V4(addr), IpAddr::V4(multicast_addr)) => {
            udp.join_multicast_v4(multicast_addr, addr)?;
        }
        // Ipv6暂时不支持
        _ => {
            return Err(io::Error::new(
                io::ErrorKind::AddrNotAvailable,
                "Multicast through Ipv6 is not supported",
            ))
        }
    };

    tokio::task::spawn_local(async move {
        let tick = rem::proto::response::TickLevel2::dummy(0);
        let mut interval = interval(Duration::from_millis(500));
        loop {
            udp.send_to(tick.as_slice(), multicast_addr).await.unwrap();
            let now = interval.tick().await;
            shared_state.tick(now);
        }
    });

    info!("Started Udp multicasting on: {:?}", Some(multicast_addr));

    Ok(())
}

async fn handle(
    stream: TcpStream,
    shared_udp: Arc<UdpSocket>,
    state: SharedState,
) -> Result<(), Infallible> {
    let addr = stream.peer_addr().unwrap();
    info!("New connection from {:?}", addr);
    if let Err(e) = handle_inner(stream, shared_udp, addr, state).await {
        error!("Connection from {:?} terminated on error: {:?}", addr, e);
    }
    Ok(())
}

async fn handle_inner(
    mut stream: TcpStream,
    shared_udp: Arc<UdpSocket>,
    addr: SocketAddr,
    state: SharedState,
) -> Result<(), Box<dyn std::error::Error>> {
    stream.set_nodelay(true)?;

    let mut buf = Buf::<512>::new();

    let mut read = stream.read(buf.chunk_mut()).await?;
    buf.advance_mut(read);

    // 匹配信息类型
    match request::MessageType::from(buf.chunk()[0]) {
        // 查询登录直接模拟成功返回并关闭连接
        request::MessageType::QueryLogin => {
            // 查询登录验证
            // TODO: parse登录消息，而不是忽略。
            while read < request::QueryLogin::MSG_LEN {
                let n = stream.read(buf.chunk_mut()).await?;
                buf.advance_mut(n);
                read += n;
            }
            buf.clear();

            // 发送查询登录成功响应
            response::QueryLogin {
                order_rate: response::RateLimit {
                    count: 10,
                    interval: Duration::from_micros(1000),
                },
                cancel_rate: response::RateLimit {
                    count: 10,
                    interval: Duration::from_micros(1000),
                },
            }
            .encode(&mut buf);
            stream.write_all(buf.chunk()).await?;
            buf.clear();

            info!("Connection from {:?} finish query API authentication", addr);

            info!("Query connection is terminated actively. ");

            Ok(())
        }
        // 版本认证以及交易登录。成功模拟下单撤单。
        request::MessageType::Version => {
            while read < request::Version::MSG_LEN {
                let n = stream.read(buf.chunk_mut()).await?;
                buf.advance_mut(n);
                read += n;
            }

            let version = request::Version::parse(buf.chunk());
            stream.write_all(buf.chunk()).await?;
            buf.clear();

            info!("Connection from {:?} pass API version matching", addr);

            // 登录验证。
            // TODO: parse登录消息，而不是忽略。
            let mut read = 0;
            while read < request::Login::MSG_LEN {
                let n = stream.read(buf.chunk_mut()).await?;
                buf.advance_mut(n);
                read += n;
            }

            buf.clear();

            // 发送登录成功响应
            let uuid = rand::thread_rng()
                .sample_iter(&rand::distributions::Alphanumeric)
                .take(32)
                .map(char::from)
                .collect::<String>();

            response::Login {
                version: version.version,
                uuid: uuid.clone(),
                user_id: 0,
                date: date(),
                max_token: 0,
            }
            .encode(&mut buf);
            stream.write_all(buf.chunk()).await?;
            buf.clear();

            info!("Connection from {:?} finish trade API authentication", addr);

            let mut write_buf = buf;
            let mut read_buf = Buf::<512>::new();

            let mut response = VecDeque::new();

            loop {
                // 编码响应
                encode(&mut write_buf, &mut response);

                select! {
                    biased;
                    // 持续写入响应，直到写缓存为空
                    res = stream.write(write_buf.chunk()), if !write_buf.chunk().is_empty() => {
                        let n = res?;
                        write_buf.advance(n);
                        write_buf.reset();
                    }
                    // 读取udp连接并解码消息
                    res = shared_udp.recv_from(read_buf.chunk_mut()) => {
                        let (n, addr) = res?;
                        read_buf.advance_mut(n);

                        // 解码消息，生成响应
                        decode(n, &mut read_buf, &mut response, addr, &state)?;
                    }
                }
            }
        }
        _ => Ok(()),
    }
}

enum MsgResponse {
    Order(response::OrderAccept),
    Cancel(response::Cancel),
}

fn decode<const N: usize>(
    msg_len: usize,
    read_buf: &mut Buf<N>,
    response: &mut VecDeque<MsgResponse>,
    addr: SocketAddr,
    shared_state: &SharedState,
) -> io::Result<()> {
    match msg_len {
        request::Order::MSG_LEN => {
            read_buf.advance(request::Order::MSG_LEN);
            read_buf.reset();

            shared_state.update_average(addr);

            use request::{ExecutionDestination, Side};
            use response::{OrderAccept, OrderState};

            response.push_back(MsgResponse::Order(OrderAccept {
                user_id: 0,
                timestamp: Default::default(),
                token: 0,
                quantity: 0,
                price: 0,
                side: Side::买单开今,
                execution_destination: ExecutionDestination::CFFEX,
                order_state: OrderState::ACTIVE,
                order_reference_number: 0,
                code: [1u8; 8],
                session_id: 0,
            }));

            Ok(())
        }
        request::Cancel::MSG_LEN => {
            read_buf.advance(request::Cancel::MSG_LEN);
            read_buf.reset();

            use response::Cancel;

            response.push_back(MsgResponse::Cancel(Cancel {
                user_id: 0,
                timestamp: Default::default(),
                token: 0,
                order_reference_number: 0,
                cancel_quantity: 0,
                reason: 0,
                account_id: [0u8; 15],
                mkt_session_id: 0,
            }));

            Ok(())
        }
        _ => Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "Unknown message type from Client",
        )),
    }
}

fn encode<const N: usize>(write_buf: &mut Buf<N>, response: &mut VecDeque<MsgResponse>) {
    while let Some(res) = response.pop_front() {
        match res {
            MsgResponse::Order(order)
                if write_buf.chunk_mut().len() >= response::OrderAccept::MSG_LEN =>
            {
                order.encode(write_buf);
            }
            MsgResponse::Cancel(cancel)
                if write_buf.chunk_mut().len() >= response::Cancel::MSG_LEN =>
            {
                cancel.encode(write_buf);
            }
            res => {
                response.push_front(res);
                break;
            }
        }
    }
}
