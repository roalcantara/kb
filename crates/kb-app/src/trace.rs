//! `kb --trace`: logs the tier 3 latencies to stderr as the app measures them (methodology,
//! "Tier 3").
//!
//! GPUI runs next-frame callbacks at the start of a frame, before it draws. So the first
//! callback after a change marks the frame that draws it, and a second one, scheduled from the
//! first, runs once that frame has been presented. Every line reports both, as a range:
//!
//! ```text
//! kb trace: show 38.2..46.4 ms
//! kb trace: keystroke 161.0..169.3 ms (settle 3.1..11.4 ms)
//! ```

use std::time::Instant;

use gpui_kit::{App, Global, Window};

/// Present while tracing is on: when the query last changed.
#[derive(Debug, Default)]
struct Tracing {
    typed: Option<Instant>,
}

impl Global for Tracing {}

/// Turns tracing on for the app's lifetime.
pub fn enable(cx: &mut App) {
    cx.set_global(Tracing::default());
}

/// Records that the query text changed.
pub fn typed(cx: &mut App) {
    if cx.has_global::<Tracing>() {
        cx.global_mut::<Tracing>().typed = Some(Instant::now());
    }
}

/// Logs how long the panel took to reach the screen since the hotkey was pressed.
pub fn shown(pressed: Instant, window: &Window, cx: &App) {
    if cx.has_global::<Tracing>() {
        after_paint(window, move |drawn, presented| {
            log(&format!("show {}", range(pressed, drawn, presented)));
        });
    }
}

/// Logs how long new results took to reach the screen since the query changed, and since the
/// debounce settled (`settled`, now).
pub fn searched(window: &Window, cx: &mut App) {
    if !cx.has_global::<Tracing>() {
        return;
    }
    let Some(typed) = cx.global_mut::<Tracing>().typed.take() else {
        return;
    };
    let settled = Instant::now();
    after_paint(window, move |drawn, presented| {
        log(&format!(
            "keystroke {} (settle {})",
            range(typed, drawn, presented),
            range(settled, drawn, presented)
        ));
    });
}

/// Calls `done` with the start of the frame that draws the current changes and the start of the
/// one after it, by which time the first has been presented.
fn after_paint(window: &Window, done: impl FnOnce(Instant, Instant) + 'static) {
    window.on_next_frame(move |window, _| {
        let drawn = Instant::now();
        window.on_next_frame(move |_, _| done(drawn, Instant::now()));
    });
}

fn range(since: Instant, drawn: Instant, presented: Instant) -> String {
    let ms = |at: Instant| at.duration_since(since).as_secs_f64() * 1000.;
    format!("{:.1}..{:.1} ms", ms(drawn), ms(presented))
}

#[expect(clippy::print_stderr, reason = "--trace writes to stderr by design")]
fn log(line: &str) {
    eprintln!("kb trace: {line}");
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::*;

    #[test]
    fn formats_a_range_in_milliseconds() {
        let since = Instant::now();
        let drawn = since + Duration::from_micros(38_240);
        let presented = since + Duration::from_micros(46_410);
        assert_eq!(range(since, drawn, presented), "38.2..46.4 ms");
    }
}
