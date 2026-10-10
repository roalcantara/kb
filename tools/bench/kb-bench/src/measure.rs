//! Timing one case, as `tools/bench/ts/measure.ts` does.

use std::hint::black_box;
use std::time::Instant;

use serde::Serialize;

use crate::stats::{Stats, summarize};

/// One measured case: every sample in nanoseconds, and their summary.
#[derive(Debug, Clone, Serialize)]
pub struct CaseResult {
    /// The case name.
    pub name: String,
    /// Always `ns`.
    pub unit: &'static str,
    /// Every timed run.
    pub samples: Vec<u64>,
    /// Their summary.
    pub stats: Stats,
}

/// Runs `run` `warmup` times untimed, then `samples` times timed, calling `setup` untimed
/// before every run.
pub fn measure<T>(
    name: &str,
    warmup: usize,
    samples: usize,
    mut setup: impl FnMut(),
    mut run: impl FnMut() -> T,
) -> CaseResult {
    for _ in 0..warmup {
        setup();
        black_box(run());
    }
    let samples: Vec<u64> = (0..samples)
        .map(|_| {
            setup();
            let start = Instant::now();
            black_box(run());
            u64::try_from(start.elapsed().as_nanos()).unwrap_or(u64::MAX)
        })
        .collect();
    let stats = summarize(&samples);
    CaseResult {
        name: name.to_owned(),
        unit: "ns",
        samples,
        stats,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn records_one_sample_per_timed_run_and_sets_up_every_run() {
        let mut order = Vec::new();
        let calls = std::cell::Cell::new(0);
        let result = measure("count", 1, 2, || order.push('s'), || calls.set(calls.get() + 1));
        assert_eq!(calls.get(), 3);
        assert_eq!(order, ['s', 's', 's']);
        assert_eq!(
            (result.name.as_str(), result.unit, result.samples.len()),
            ("count", "ns", 2)
        );
    }
}
