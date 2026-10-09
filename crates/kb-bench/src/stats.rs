//! Nearest-rank statistics, as `bench/ts/stats.ts` computes them.

use serde::Serialize;

/// A sample set reduced to the figures every result reports.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct Stats {
    /// Number of samples.
    pub n: usize,
    /// Smallest sample.
    pub min: u64,
    /// Nearest-rank 50th percentile.
    pub p50: u64,
    /// Nearest-rank 95th percentile.
    pub p95: u64,
    /// Nearest-rank 99th percentile.
    pub p99: u64,
    /// Largest sample.
    pub max: u64,
    /// Arithmetic mean.
    pub mean: f64,
}

/// The smallest sample with at least `p` percent of the set at or below it; no interpolation.
///
/// # Panics
///
/// On an empty sample set.
#[must_use]
pub fn percentile(sorted: &[u64], p: u32) -> u64 {
    assert!(!sorted.is_empty(), "percentile of an empty sample set");
    let rank = (u64::from(p) * sorted.len() as u64).div_ceil(100).max(1);
    sorted[usize::try_from(rank).unwrap_or(usize::MAX).min(sorted.len()) - 1]
}

/// Sorts the samples and reads every figure.
///
/// # Panics
///
/// On an empty sample set.
#[must_use]
pub fn summarize(samples: &[u64]) -> Stats {
    assert!(!samples.is_empty(), "summary of an empty sample set");
    let mut sorted = samples.to_vec();
    sorted.sort_unstable();
    #[allow(clippy::cast_precision_loss)]
    let mean = sorted.iter().map(|&s| s as f64).sum::<f64>() / sorted.len() as f64;
    Stats {
        n: sorted.len(),
        min: sorted[0],
        p50: percentile(&sorted, 50),
        p95: percentile(&sorted, 95),
        p99: percentile(&sorted, 99),
        max: sorted[sorted.len() - 1],
        mean,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn is_nearest_rank() {
        let hundred: Vec<u64> = (1..=100).collect();
        assert_eq!([50, 95, 99, 100].map(|p| percentile(&hundred, p)), [50, 95, 99, 100]);
        assert_eq!(percentile(&[10, 20, 30], 50), 20);
        assert_eq!(percentile(&[10, 20, 30], 95), 30);
        assert_eq!(percentile(&[7], 1), 7);
    }

    #[test]
    fn summarizes_unsorted_samples() {
        let stats = summarize(&[30, 10, 20, 40]);
        assert_eq!((stats.min, stats.p50, stats.p95, stats.max), (10, 20, 40, 40));
        assert!((stats.mean - 25.0).abs() < f64::EPSILON);
    }

    #[test]
    #[should_panic(expected = "empty")]
    fn rejects_no_samples() {
        let _ = summarize(&[]);
    }
}
