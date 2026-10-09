//! The result list: one page of entries for the query and filter, read from the index.

use std::time::Duration;

use gpui_kit::component::empty::{Empty, EmptyDescription, EmptyHeader, EmptyTitle};
use gpui_kit::component::list::{ListDelegate, ListItem, ListState};
use gpui_kit::component::tag::Tag;
use gpui_kit::component::{ActiveTheme as _, Icon, IndexPath, Sizable as _, h_flex};
use gpui_kit::prelude::FluentBuilder as _;
use gpui_kit::{App, Context, IntoElement as _, ParentElement, SharedString, Styled as _, Task, Window, div};
use kb_domain::Connection;
use kb_domain::entry::Entry;
use kb_domain::row::row_to_entry;
use kb_domain::search::{FilterState, PAGE_SIZE, SearchQuery, search};

use crate::presentation::{row_tags, type_icon};

/// Keystrokes settle this long before a query runs, as in the Raycast command.
pub const DEBOUNCE: Duration = Duration::from_millis(150);

/// Owns the query, filter and page of the list, and the read-only index connection.
#[derive(Debug)]
pub struct EntryList {
    connection: Option<Connection>,
    query: String,
    filter: FilterState,
    limit: usize,
    entries: Vec<Entry>,
    selected: Option<IndexPath>,
    secondary_confirm: bool,
}

impl EntryList {
    /// A list over `connection`; `None` when there is no index yet.
    #[must_use]
    pub fn new(connection: Option<Connection>) -> Self {
        let mut list = Self {
            connection,
            query: String::new(),
            filter: FilterState::default(),
            limit: PAGE_SIZE,
            entries: Vec::new(),
            selected: None,
            secondary_confirm: false,
        };
        list.refresh();
        list
    }

    /// Whether an index is open.
    #[must_use]
    pub fn has_index(&self) -> bool {
        self.connection.is_some()
    }

    /// Replaces the connection after a sync and runs the query again.
    pub fn set_connection(&mut self, connection: Option<Connection>) {
        self.connection = connection;
        self.refresh();
    }

    /// The read-only connection, for the filter's choices.
    #[must_use]
    pub fn connection(&self) -> Option<&Connection> {
        self.connection.as_ref()
    }

    /// The current filter.
    #[must_use]
    pub fn filter(&self) -> &FilterState {
        &self.filter
    }

    /// Replaces the filter and runs the query again from the first page.
    pub fn set_filter(&mut self, filter: FilterState) {
        self.filter = filter;
        self.limit = PAGE_SIZE;
        self.refresh();
    }

    /// The entries shown.
    #[must_use]
    pub fn entries(&self) -> &[Entry] {
        &self.entries
    }

    /// The selected entry.
    #[must_use]
    pub fn selected_entry(&self) -> Option<&Entry> {
        self.selected.and_then(|ix| self.entries.get(ix.row))
    }

    /// Whether the last confirmation was the secondary one (⌘↩), which runs the primary action.
    #[must_use]
    pub fn is_secondary_confirm(&self) -> bool {
        self.secondary_confirm
    }

    /// Runs the query for the current text, filter and page window.
    fn refresh(&mut self) {
        let Some(connection) = &self.connection else {
            self.entries.clear();
            return;
        };
        let query = SearchQuery {
            text: self.query.clone(),
            filter: self.filter.clone(),
            limit: self.limit,
            offset: 0,
        };
        // A failed query keeps the previous results on screen rather than emptying the list.
        if let Ok(rows) = search(connection, &query) {
            self.entries = rows.iter().map(row_to_entry).collect();
        }
    }

    fn render_row(entry: &Entry, selected: bool, cx: &App) -> ListItem {
        let (tags, more) = row_tags(&entry.tags);
        ListItem::new(SharedString::from(entry.id.clone()))
            .selected(selected)
            .child(
                h_flex()
                    .w_full()
                    .gap_2()
                    .child(Icon::new(type_icon(&entry.entry_type)).text_color(cx.theme().muted_foreground))
                    .child(div().flex_none().child(entry.title.clone()))
                    .child(
                        div()
                            .flex_1()
                            .min_w_0()
                            .truncate()
                            .text_color(cx.theme().muted_foreground)
                            .when_some(entry.description.clone(), ParentElement::child),
                    )
                    .children(tags.iter().map(|tag| Tag::secondary().small().child(format!("#{tag}"))))
                    .when(more > 0, |row| {
                        row.child(div().text_color(cx.theme().muted_foreground).child(format!("+{more}")))
                    })
                    .when(!entry.links.is_empty(), |row| {
                        row.child(
                            div()
                                .text_color(cx.theme().muted_foreground)
                                .child(format!("{} links", entry.links.len())),
                        )
                    }),
            )
    }
}

impl ListDelegate for EntryList {
    type Item = ListItem;

    fn perform_search(&mut self, query: &str, _: &mut Window, cx: &mut Context<ListState<Self>>) -> Task<()> {
        let query = query.to_owned();
        // The list drops the previous task when the query changes again, which cancels it, so
        // only a query that has been stable for DEBOUNCE runs.
        cx.spawn(async move |list, cx| {
            cx.background_executor().timer(DEBOUNCE).await;
            let _ = list.update(cx, |list, cx| {
                let delegate = list.delegate_mut();
                delegate.query = query;
                delegate.limit = PAGE_SIZE;
                delegate.refresh();
                cx.notify();
            });
        })
    }

    fn items_count(&self, _: usize, _: &App) -> usize {
        self.entries.len()
    }

    fn render_item(&mut self, ix: IndexPath, _: &mut Window, cx: &mut Context<ListState<Self>>) -> Option<ListItem> {
        let entry = self.entries.get(ix.row)?;
        Some(Self::render_row(entry, Some(ix) == self.selected, cx))
    }

    fn render_empty(&mut self, _: &mut Window, cx: &mut Context<ListState<Self>>) -> impl gpui_kit::IntoElement {
        let (title, description) = if self.has_index() {
            ("No matching entries", "Adjust the query or clear the filters.")
        } else {
            (
                "No entries indexed yet",
                "Press ⌘R to rebuild the index from your sources.",
            )
        };
        Empty::new()
            .header(
                EmptyHeader::new()
                    .title(EmptyTitle::new().child(title))
                    .description(EmptyDescription::new().child(description)),
            )
            .text_color(cx.theme().muted_foreground)
            .into_any_element()
    }

    fn set_selected_index(&mut self, ix: Option<IndexPath>, _: &mut Window, cx: &mut Context<ListState<Self>>) {
        self.selected = ix;
        cx.notify();
    }

    fn confirm(&mut self, secondary: bool, _: &mut Window, _: &mut Context<ListState<Self>>) {
        self.secondary_confirm = secondary;
    }

    fn has_more(&self, _: &App) -> bool {
        self.entries.len() == self.limit
    }

    fn load_more(&mut self, _: &mut Window, cx: &mut Context<ListState<Self>>) {
        self.limit += PAGE_SIZE;
        self.refresh();
        cx.notify();
    }
}
