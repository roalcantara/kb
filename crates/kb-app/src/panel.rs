//! The resident panel: an accessory app without a Dock icon, one floating window shown by a
//! global hotkey and hidden when it loses focus (ADR 0004).

use std::time::{Duration, Instant};

use futures::StreamExt as _;
use futures::channel::mpsc;
use global_hotkey::hotkey::{Code, HotKey, Modifiers};
use global_hotkey::{GlobalHotKeyEvent, GlobalHotKeyManager, HotKeyState};
use gpui_kit::component::WindowExt as _;
use gpui_kit::{
    ActivationPolicy, App, AppContext as _, AsyncApp, Bounds, Entity, Subscription, WindowBounds, WindowKind,
    WindowOptions, px, size,
};

use crate::config::Config;
use crate::palette::key_bindings;
use crate::search_view::SearchView;
use crate::trace;

/// How long a deactivation must last before the panel hides.
const BLUR_SETTLE: Duration = Duration::from_millis(100);

/// The hotkey that shows the panel: ⌥K.
#[must_use]
pub fn hotkey() -> HotKey {
    HotKey::new(Some(Modifiers::ALT), Code::KeyK)
}

/// The panel window: above other windows, centred, without a title bar.
#[must_use]
pub fn window_options(cx: &App) -> WindowOptions {
    WindowOptions {
        kind: WindowKind::PopUp,
        titlebar: None,
        window_bounds: Some(WindowBounds::Windowed(Bounds::centered(
            None,
            // The frame is in the platform's points and is fixed before the window has a rem
            // size; everything inside it is laid out in rems and follows the base font. Raycast's
            // is 750 × 475; this one is larger so the split pane leaves the notes room.
            size(px(860.), px(520.)),
            cx,
        ))),
        is_movable: false,
        is_resizable: false,
        is_minimizable: false,
        focus: true,
        show: true,
        ..WindowOptions::default()
    }
}

/// Why the panel could not open.
#[derive(Debug, thiserror::Error)]
#[error("cannot open the panel window: {0}")]
pub struct PanelError(String);

/// Opens the panel, registers the hotkey, and keeps both alive for the app's lifetime. A hotkey
/// that cannot be registered — usually because another app holds ⌥K — joins `notices`, which
/// the panel shows as notifications: the panel still works when shown from the Dock or Finder.
///
/// # Errors
///
/// The window cannot be opened.
pub fn open(config: Config, mut notices: Vec<String>, cx: &mut App) -> Result<(), PanelError> {
    cx.bind_keys(key_bindings());
    cx.set_activation_policy(ActivationPolicy::Accessory);

    let (window, view) = gpui_kit::open_window(window_options(cx), cx, |window, cx| {
        cx.new(|cx| SearchView::new(config, window, cx))
    })
    .map_err(|error| PanelError(error.to_string()))?;
    let hide_on_blur = hide_on_blur(&view, window, cx);

    // The manager must live on the main thread for the app's lifetime; the task below owns it.
    let manager = match register_hotkey() {
        Ok(manager) => Some(manager),
        Err(error) => {
            notices.push(format!("Couldn’t register ⌥K: {error}. Another app may be using it."));
            None
        }
    };
    let (sender, mut presses) = mpsc::unbounded();
    GlobalHotKeyEvent::set_event_handler(Some(move |event: GlobalHotKeyEvent| {
        if event.state() == HotKeyState::Pressed {
            // The receiver lives as long as the app; a failed send means it is quitting.
            let _ = sender.unbounded_send(Instant::now());
        }
    }));
    cx.spawn(async move |cx: &mut AsyncApp| {
        let _keep = (manager, hide_on_blur);
        while let Some(pressed) = presses.next().await {
            cx.update(|cx| {
                cx.activate(true);
                // The window lives as long as the app.
                let _ = window.update(cx, |_, window, cx| {
                    window.activate_window();
                    trace::shown(pressed, window, cx);
                });
            });
        }
    })
    .detach();
    let _ = window.update(cx, |_, window, cx| {
        for notice in notices {
            window.push_notification(notice, cx);
        }
    });
    cx.activate(true);
    Ok(())
}

fn register_hotkey() -> global_hotkey::Result<GlobalHotKeyManager> {
    let manager = GlobalHotKeyManager::new()?;
    manager.register(hotkey())?;
    Ok(manager)
}

/// Hides the app whenever the panel window stops being the active one.
fn hide_on_blur(view: &Entity<SearchView>, window: gpui_kit::AnyWindowHandle, cx: &mut App) -> Option<Subscription> {
    window
        .update(cx, |_, window, cx| {
            view.update(cx, |_, cx| {
                cx.observe_window_activation(window, |_, window, cx| {
                    if window.is_window_active() {
                        return;
                    }
                    // Showing the app again after a hide delivers one stale deactivation before
                    // the activation it asked for. Hide only if the window is still inactive
                    // once that settles.
                    cx.spawn_in(window, async move |_, cx| {
                        cx.background_executor().timer(BLUR_SETTLE).await;
                        let _ = cx.update(|window, cx| {
                            if !window.is_window_active() {
                                cx.hide();
                            }
                        });
                    })
                    .detach();
                })
            })
        })
        .ok()
}
