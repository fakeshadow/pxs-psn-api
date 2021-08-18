pub mod server;

mod date;

use std::{net::SocketAddr, sync::Arc};

use ahash::AHashMap;
use parking_lot::Mutex;
use tokio::time::Instant;
use tracing::trace;

#[derive(Clone)]
pub struct SharedState {
    inner: Arc<Mutex<SharedStateInner>>,
}

struct SharedStateInner {
    last_tick: Instant,
    latencies: AHashMap<SocketAddr, Latency>
}

impl SharedState {
    fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(SharedStateInner {
                last_tick: Instant::now(),
                latencies: AHashMap::with_capacity(1)
            }))
        }
    }
}

#[derive(Copy, Clone)]
pub struct Latency {
    pub average: u128,
    pub round: u128,
}

impl SharedState {
    pub(super) fn tick(&self, instant: Instant) {
        trace!("Updating tick at {:?}", instant);
        self.inner.lock().last_tick = instant;
    }

    pub(super) fn collect(&self) -> Latencies {
        let latencies = self
            .inner
            .lock()
            .latencies
            .iter()
            .map(|(addr, latency)| (addr.to_string(), *latency))
            .collect();

        Latencies { latencies }
    }

    pub(super) fn update_average(&self, addr: SocketAddr) {
        let mut inner = self.inner.lock();

        let elapsed = inner.last_tick.elapsed().as_nanos();

        let latency = inner.latencies.entry(addr).or_insert(Latency {
            average: 0,
            round: 0,
        });

        latency.round += 1;
        latency.average = (latency.average + elapsed) / latency.round;

        trace!(
            "Updating average latency for {:?}. New value: {:?}",
            addr,
            latency.average
        );
    }
}

#[derive(sailfish::TemplateOnce)]
#[template(path = "latency.stpl")]
pub struct Latencies {
    latencies: Vec<(String, Latency)>,
}
