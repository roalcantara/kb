//! The rebuild screen: a sync on the background executor, its progress, and its report.

use std::fmt::Write as _;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use futures::StreamExt as _;
use futures::channel::mpsc;
use gpui_kit::component::progress::Progress;
use gpui_kit::component::{ActiveTheme as _, h_flex, v_flex};
use gpui_kit::prelude::FluentBuilder as _;
use gpui_kit::{
    AppContext as _, Context, EventEmitter, InteractiveElement as _, IntoElement, ParentElement as _, Render,
    SharedString, StatefulInteractiveElement as _, Styled as _, Task, Window, div,
};
use kb_domain::report::{FileIssue, FileReport};
use kb_domain::sync::{SyncError, SyncSummary, sync_knowledge_base};

/// Where a sync stands.
#[derive(Debug)]
pub enum SyncStatus {
    /// Files are being read.
    Running {
        /// Files processed.
        files_scanned: usize,
        /// Files in all, once known.
        files_total: usize,
        /// Entries indexed so far.
        entries: usize,
        /// The file just processed.
        current: String,
    },
    /// The index was rebuilt.
    Done(SyncSummary),
    /// The previous index is unchanged.
    Cancelled,
    /// The sync stopped; the previous index is unchanged.
    Failed(String),
}

/// Emitted once, when a sync stops for any reason.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SyncFinished {
    /// Whether the index was rebuilt.
    pub rebuilt: bool,
    /// What to tell the user: the summary line, or why it stopped.
    pub message: String,
}

/// Owns one sync run.
#[derive(Debug)]
pub struct SyncView {
    status: SyncStatus,
    cancel: Arc<AtomicBool>,
    _run: Task<()>,
}

impl EventEmitter<SyncFinished> for SyncView {}

/// One progress report, owned, sent from the sync thread.
struct SyncTick {
    files_scanned: usize,
    files_total: usize,
    entries: usize,
    current: String,
}

impl SyncView {
    /// Starts rebuilding `database` from `sources`.
    pub fn start(sources: PathBuf, database: PathBuf, cx: &mut Context<Self>) -> Self {
        let cancel = Arc::new(AtomicBool::new(false));
        let flag = cancel.clone();
        let run = cx.spawn(async move |view, cx| {
            let (sender, mut progress) = mpsc::unbounded::<SyncTick>();
            let job = cx.background_spawn(async move {
                sync_knowledge_base(&sources, &database, &flag, |p| {
                    let _ = sender.unbounded_send(SyncTick {
                        files_scanned: p.files_scanned,
                        files_total: p.files_total,
                        entries: p.entries_count,
                        current: p.file.rel_path.clone(),
                    });
                })
            });
            while let Some(p) = progress.next().await {
                let _ = view.update(cx, |view, cx| {
                    view.status = SyncStatus::Running {
                        files_scanned: p.files_scanned,
                        files_total: p.files_total,
                        entries: p.entries,
                        current: p.current,
                    };
                    cx.notify();
                });
            }
            let outcome = job.await;
            let _ = view.update(cx, |view, cx| {
                let rebuilt = outcome.is_ok();
                view.status = match outcome {
                    Ok(summary) => SyncStatus::Done(summary),
                    Err(SyncError::Cancelled) => SyncStatus::Cancelled,
                    Err(error) => SyncStatus::Failed(error.to_string()),
                };
                let message = match &view.status {
                    SyncStatus::Done(summary) => summary_line(summary),
                    SyncStatus::Cancelled => "Rebuild stopped".to_owned(),
                    SyncStatus::Failed(message) => format!("Couldn’t rebuild the index: {message}"),
                    SyncStatus::Running { .. } => String::new(),
                };
                cx.emit(SyncFinished { rebuilt, message });
                cx.notify();
            });
        });
        let status = SyncStatus::Running {
            files_scanned: 0,
            files_total: 0,
            entries: 0,
            current: String::new(),
        };
        Self {
            status,
            cancel,
            _run: run,
        }
    }

    /// Whether the sync is still running.
    #[must_use]
    pub fn is_running(&self) -> bool {
        matches!(self.status, SyncStatus::Running { .. })
    }

    /// Asks a running sync to stop; it rolls back and reports [`SyncStatus::Cancelled`].
    pub fn cancel(&self) {
        self.cancel.store(true, Ordering::Relaxed);
    }
}

/// One line per file worth a look, failed files first.
fn report_lines(summary: &SyncSummary) -> Vec<(SharedString, String, Option<String>)> {
    let mut lines: Vec<(SharedString, String, Option<String>)> = Vec::new();
    for file in summary.files.iter().filter(|f| f.error.is_some()) {
        let message = file
            .error
            .as_ref()
            .map(|e| e.message.lines().next().unwrap_or_default().to_owned())
            .unwrap_or_default();
        lines.push((
            file.rel_path.clone().into(),
            format!("Failed: {message}"),
            file.excerpt.clone(),
        ));
    }
    for file in summary
        .files
        .iter()
        .filter(|f| f.error.is_none() && !f.issues.is_empty())
    {
        lines.push((file.rel_path.clone().into(), issues_line(file), None));
    }
    lines
}

fn issues_line(file: &FileReport) -> String {
    let skipped: Vec<String> = file
        .issues
        .iter()
        .filter_map(|issue| match issue {
            FileIssue::SkippedEntry { entry_type, key } => Some(format!("{entry_type}/{key}")),
            FileIssue::Empty => None,
        })
        .collect();
    if skipped.is_empty() {
        "No entries".to_owned()
    } else {
        format!("Skipped, not a map: {}", skipped.join(", "))
    }
}

/// "4,233 entries from 68 files in 0.8 s", with failed files when there are any.
#[must_use]
pub fn summary_line(summary: &SyncSummary) -> String {
    let mut line = format!(
        "{} entries from {} files in {:.1} s",
        thousands(summary.total_indexed),
        summary.files_scanned,
        Duration::from_millis(u64::try_from(summary.duration_ms).unwrap_or(u64::MAX)).as_secs_f64()
    );
    if summary.files_failed > 0 {
        let _ = write!(line, ", {} failed", summary.files_failed);
    }
    line
}

fn thousands(n: usize) -> String {
    let digits = n.to_string();
    let mut out = String::new();
    for (ix, c) in digits.chars().enumerate() {
        if ix > 0 && (digits.len() - ix).is_multiple_of(3) {
            out.push(',');
        }
        out.push(c);
    }
    out
}

impl Render for SyncView {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let muted = cx.theme().muted_foreground;
        let body = match &self.status {
            SyncStatus::Running {
                files_scanned,
                files_total,
                entries,
                current,
            } => {
                // Whole percents: exact in f32, and all a progress bar can show.
                let percent = files_scanned
                    .saturating_mul(100)
                    .checked_div(*files_total)
                    .map_or(0, |p| p.min(100));
                let percent = f32::from(u8::try_from(percent).unwrap_or(100));
                v_flex()
                    .gap_2()
                    .child("Rebuilding the index…")
                    .child(Progress::new("sync-progress").value(percent))
                    .child(div().text_color(muted).child(format!(
                        "{files_scanned} of {files_total} files, {entries} entries · {current}"
                    )))
                    .child(div().text_color(muted).child("Press Esc to stop."))
            }
            SyncStatus::Done(summary) => v_flex()
                .gap_2()
                .min_h_0()
                .child(summary_line(summary))
                .children(report_lines(summary).into_iter().map(|(path, line, excerpt)| {
                    v_flex()
                        .id(path.clone())
                        .gap_1()
                        .child(h_flex().gap_2().child(path).child(div().text_color(muted).child(line)))
                        .when_some(excerpt, |row, excerpt| {
                            row.child(
                                div()
                                    .font_family(cx.theme().mono_font_family.clone())
                                    .text_sm()
                                    .child(excerpt),
                            )
                        })
                }))
                .child(div().text_color(muted).child("Press Esc to return to the list.")),
            SyncStatus::Cancelled => v_flex()
                .gap_2()
                .child("Rebuild stopped. The previous index is unchanged.")
                .child(div().text_color(muted).child("Press ⌘R to try again.")),
            SyncStatus::Failed(message) => v_flex()
                .gap_2()
                .child(format!("Couldn’t rebuild the index: {message}"))
                .child(
                    div()
                        .text_color(muted)
                        .child("Check the sources path in Preferences (⌘⇧,), then press ⌘R."),
                ),
        };
        div().id("sync").size_full().p_4().overflow_y_scroll().child(body)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn groups_thousands() {
        assert_eq!(
            [thousands(7), thousands(4233), thousands(42_330), thousands(1_000_000)],
            ["7", "4,233", "42,330", "1,000,000"]
        );
    }

    #[test]
    fn summarizes_a_sync() {
        let summary = SyncSummary {
            total_indexed: 4233,
            files_scanned: 68,
            files_failed: 1,
            duration_ms: 812,
            errors: Vec::new(),
            files: Vec::new(),
        };
        assert_eq!(summary_line(&summary), "4,233 entries from 68 files in 0.8 s, 1 failed");
    }
}
