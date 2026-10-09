//! An entry's notes and metadata, as the split pane and the detail screen show them.

use gpui_kit::component::description_list::DescriptionList;
use gpui_kit::component::text::TextView;
use gpui_kit::component::{ActiveTheme as _, v_flex};
use gpui_kit::prelude::FluentBuilder as _;
use gpui_kit::{App, IntoElement, ParentElement as _, SharedString, Styled as _, div};
use kb_domain::entry::Entry;

use crate::presentation::{metadata, notes_markdown};

/// The notes, rendered from the index's Markdown with highlighted code blocks, above the
/// metadata when `show_metadata`.
#[allow(clippy::unreadable_literal)]
pub fn notes_pane(entry: &Entry, show_metadata: bool, cx: &App) -> impl IntoElement {
    // Keyed by the entry: a TextView keeps its parse while its id is unchanged.
    let id = SharedString::from(format!("notes-{}", entry.id));
    v_flex()
        .size_full()
        .min_h_0()
        .when_some(entry.description.clone(), |pane, desc| {
            pane.child(
                div()
                    .m_3()
                    .mb_0()
                    .border_l_3()
                    .border_color(gpui_kit::rgb(0xef4444))
                    .pl_3()
                    .py_1()
                    .text_sm()
                    .text_color(cx.theme().foreground)
                    .child(desc),
            )
        })
        .child(
            TextView::markdown(id, notes_markdown(entry).to_owned())
                .scrollable(true)
                .flex_1()
                .min_h_0()
                .p_3(),
        )
        .when(show_metadata, |pane| {
            let list = metadata(entry).into_iter().fold(
                DescriptionList::horizontal().columns(1).bordered(false),
                |list, (label, value)| list.item(label, value, 1),
            );
            pane.child(
                v_flex()
                    .flex_none()
                    .p_3()
                    .border_t_1()
                    .border_color(cx.theme().border)
                    .child(list),
            )
        })
}
