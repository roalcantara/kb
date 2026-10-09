//! The panel's root view: the search list, the split pane, the detail and rebuild screens, and
//! every command's handler.

use std::fs;
use std::rc::Rc;

use gpui_kit::assets::IconName;
use gpui_kit::component::button::{Button, ButtonVariants as _};
use gpui_kit::component::command::{Command, CommandGroup, CommandItem, CommandState};
use gpui_kit::component::input::{Input, InputEvent, InputState, MoveDown, MoveUp};
use gpui_kit::component::kbd::Kbd;
use gpui_kit::component::list::{List, ListEvent, ListState};
use gpui_kit::component::resizable::{h_resizable, resizable_panel};
use gpui_kit::component::{ActiveTheme as _, Icon, IndexPath, Sizable as _, WindowExt as _, h_flex, v_flex};
use gpui_kit::prelude::FluentBuilder as _;
use gpui_kit::{
    AppContext as _, ClipboardItem, Context, Entity, FocusHandle, InteractiveElement as _, IntoElement, Keystroke,
    ParentElement, Render, Styled as _, Subscription, Window, div, px,
};
use kb_domain::search::{FilterState, entry_types, tags};
use kb_domain::sync::open_readonly;

use crate::config::Config;
use crate::entry_list::EntryList;
use crate::filter::{filter_groups, filter_summary};
use crate::notes::notes_pane;
use crate::palette::{
    Back, CONTEXT, CopyUrl, DETAIL_CONTEXT, OpenActions, OpenFilter, OpenPreferences, OpenSourceFile, PaletteCommand,
    Rebuild, RunPrimary, ToggleDetails, entry_palette,
};
use crate::presentation::{PrimaryKind, TypeKey, primary_action, type_key, type_label};
use crate::sync_view::{SyncFinished, SyncView};

/// What fills the panel.
#[derive(Debug)]
enum Screen {
    /// The list, with the split pane when shown.
    Search,
    /// One entry's notes, full width.
    Detail,
    /// A rebuild and its report.
    Rebuild(Entity<SyncView>),
}

/// The panel's root view.
pub struct SearchView {
    config: Config,
    list: Entity<ListState<EntryList>>,
    query_input: Entity<InputState>,
    palette: Entity<CommandState>,
    /// Focus for the screens without the list, so their keys reach this view.
    focus: FocusHandle,
    screen: Screen,
    show_details: bool,
    show_metadata: bool,
    subscriptions: Vec<Subscription>,
}

impl std::fmt::Debug for SearchView {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SearchView")
            .field("screen", &self.screen)
            .field("show_details", &self.show_details)
            .finish_non_exhaustive()
    }
}

impl SearchView {
    /// Opens the index if there is one and builds the list over it.
    pub fn new(config: Config, window: &mut Window, cx: &mut Context<Self>) -> Self {
        let connection = open_readonly(config.database()).ok();
        let list = cx.new(|cx| ListState::new(EntryList::new(connection), window, cx).searchable(false));
        let query_input = cx.new(|cx| InputState::new(window, cx).placeholder("Search knowledge base…"));
        // The first row starts selected, as in Raycast, so Enter and ⌘K act on it at once.
        list.update(cx, |list, cx| {
            if !list.delegate().entries().is_empty() {
                list.set_selected_index(Some(IndexPath::default()), window, cx);
            }
        });
        query_input.update(cx, |input, cx| {
            input.focus(window, cx);
        });
        let palette = cx.new(|cx| CommandState::new(window, cx));
        let list_sub = cx.subscribe_in(&list, window, Self::on_list_event);
        let input_sub = cx.subscribe_in(&query_input, window, Self::on_query_input_event);
        Self {
            config,
            list,
            query_input,
            palette,
            focus: cx.focus_handle(),
            screen: Screen::Search,
            show_details: true,
            show_metadata: false,
            subscriptions: vec![list_sub, input_sub],
        }
    }

    /// The list state, for tests.
    #[must_use]
    pub fn list(&self) -> &Entity<ListState<EntryList>> {
        &self.list
    }

    /// Whether the detail screen is showing.
    #[must_use]
    pub fn is_showing_detail(&self) -> bool {
        matches!(self.screen, Screen::Detail)
    }

    /// Moves the list selection by `delta` rows, clamped to the results, and scrolls to it.
    fn move_selection(&mut self, delta: isize, window: &mut Window, cx: &mut Context<Self>) {
        self.list.update(cx, |list, cx| {
            let count = list.delegate().entries().len();
            if count == 0 {
                return;
            }
            let current = list.selected_index().map_or(0, |ix| ix.row);
            let row = current.saturating_add_signed(delta).min(count - 1);
            list.set_selected_index(Some(IndexPath::new(row)), window, cx);
            list.scroll_to_selected_item(window, cx);
        });
        cx.notify();
    }

    /// Searches for `text`: the list debounces it and selects the first result.
    fn search(&mut self, text: &str, window: &mut Window, cx: &mut Context<Self>) {
        self.list.update(cx, |list, cx| list.set_query(text, window, cx));
    }

    fn show_detail_screen(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        if self.list.read(cx).delegate().selected_entry().is_none() {
            return;
        }
        self.screen = Screen::Detail;
        self.show_metadata = false;
        self.focus.focus(window, cx);
        cx.notify();
    }

    fn on_query_input_event(
        &mut self,
        state: &Entity<InputState>,
        event: &InputEvent,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        match event {
            InputEvent::Change => {
                let text = state.read(cx).value().to_string();
                self.search(&text, window, cx);
            }
            InputEvent::PressEnter { secondary, .. } => {
                if *secondary {
                    self.run_primary(&RunPrimary, window, cx);
                } else {
                    self.show_detail_screen(window, cx);
                }
            }
            _ => {}
        }
    }

    fn on_list_event(
        &mut self,
        _: &Entity<ListState<EntryList>>,
        event: &ListEvent,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        match event {
            ListEvent::Select(_) => cx.notify(),
            ListEvent::Confirm(_) => {
                if self.list.read(cx).delegate().is_secondary_confirm() {
                    self.run_primary(&RunPrimary, window, cx);
                } else {
                    self.show_detail_screen(window, cx);
                }
            }
            // Esc in the list leaves the panel, as it closes the Raycast command.
            ListEvent::Cancel => cx.hide(),
        }
    }

    fn run_primary(&mut self, _: &RunPrimary, _: &mut Window, cx: &mut Context<Self>) {
        let Some(action) = self.list.read(cx).delegate().selected_entry().map(primary_action) else {
            return;
        };
        match action.kind {
            PrimaryKind::OpenInBrowser => cx.open_url(&action.content),
            PrimaryKind::Copy => cx.write_to_clipboard(ClipboardItem::new_string(action.content)),
        }
    }

    fn copy_url(&mut self, _: &CopyUrl, _: &mut Window, cx: &mut Context<Self>) {
        let url = self
            .list
            .read(cx)
            .delegate()
            .selected_entry()
            .filter(|e| type_key(&e.entry_type) == TypeKey::Bookmark)
            .map(|e| e.primary_content.clone());
        if let Some(url) = url {
            cx.write_to_clipboard(ClipboardItem::new_string(url));
        }
    }

    fn toggle_details(&mut self, _: &ToggleDetails, _: &mut Window, cx: &mut Context<Self>) {
        match self.screen {
            Screen::Detail => self.show_metadata = !self.show_metadata,
            _ => self.show_details = !self.show_details,
        }
        cx.notify();
    }

    fn open_source_file(&mut self, _: &OpenSourceFile, _: &mut Window, cx: &mut Context<Self>) {
        let path = self
            .list
            .read(cx)
            .delegate()
            .selected_entry()
            .map(|e| e.source_file.clone());
        if let Some(path) = path {
            cx.open_with_system(std::path::Path::new(&path));
        }
    }

    fn open_preferences(&mut self, _: &OpenPreferences, window: &mut Window, cx: &mut Context<Self>) {
        let file = self.config.preferences().to_path_buf();
        if !file.exists() {
            let template = format!(
                "# kb preferences\n# sources_path = \"{}\"\n",
                self.config.sources_dir().display()
            );
            let written = file
                .parent()
                .map_or(Ok(()), fs::create_dir_all)
                .and_then(|()| fs::write(&file, template));
            if let Err(error) = written {
                window.push_notification(format!("Couldn’t create {}: {error}", file.display()), cx);
                return;
            }
        }
        cx.open_with_system(&file);
    }

    fn rebuild(&mut self, _: &Rebuild, window: &mut Window, cx: &mut Context<Self>) {
        if matches!(&self.screen, Screen::Rebuild(sync) if sync.read(cx).is_running()) {
            return;
        }
        let (sources, database) = (
            self.config.sources_dir().to_path_buf(),
            self.config.database().to_path_buf(),
        );
        let sync = cx.new(|cx| SyncView::start(sources, database, cx));
        let subscription = cx.subscribe_in(&sync, window, |this, _, finished: &SyncFinished, window, cx| {
            window.push_notification(finished.message.clone(), cx);
            if finished.rebuilt {
                let connection = open_readonly(this.config.database()).ok();
                this.list.update(cx, |list, cx| {
                    list.delegate_mut().set_connection(connection);
                    cx.notify();
                });
            }
        });
        self.subscriptions.push(subscription);
        self.screen = Screen::Rebuild(sync);
        self.focus.focus(window, cx);
        cx.notify();
    }

    fn back(&mut self, _: &Back, window: &mut Window, cx: &mut Context<Self>) {
        match &self.screen {
            Screen::Rebuild(sync) if sync.read(cx).is_running() => sync.read(cx).cancel(),
            Screen::Search => {
                if self.query_input.read(cx).value().is_empty() {
                    cx.hide();
                } else {
                    self.query_input.update(cx, |input, cx| {
                        input.set_value("", window, cx);
                    });
                    self.search("", window, cx);
                }
            }
            Screen::Detail | Screen::Rebuild(_) => {
                self.screen = Screen::Search;
                self.query_input.update(cx, |input, cx| input.focus(window, cx));
            }
        }
        cx.notify();
    }

    /// Opens a palette in a dialog. The dialog sits in Root's overlay layer, beside this view,
    /// so a row's Action is dispatched only after the dialog closes and focus is back here.
    fn open_palette(
        &self,
        placeholder: &'static str,
        groups: Vec<(&'static str, Vec<(CommandItem, PaletteCommand)>)>,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let palette = self.palette.clone();
        palette.update(cx, |state, cx| state.set_query("", window, cx));
        let mut command_groups = Vec::new();
        let mut commands: Vec<Vec<PaletteCommand>> = Vec::new();
        for (label, rows) in groups {
            let (items, row_commands): (Vec<_>, Vec<_>) = rows.into_iter().unzip();
            command_groups.push(CommandGroup::new().label(label).items(items));
            commands.push(row_commands);
        }
        let commands = Rc::new(commands);
        let view = cx.entity().downgrade();
        window.open_dialog(cx, move |dialog, _, _| {
            let (palette, command_groups, commands, view) =
                (palette.clone(), command_groups.clone(), commands.clone(), view.clone());
            dialog.close_button(false).p_0().content(move |content, _, _| {
                let (commands, view) = (commands.clone(), view.clone());
                content.child(
                    command_groups
                        .iter()
                        .cloned()
                        .fold(
                            Command::new(&palette).bordered(false).placeholder(placeholder),
                            Command::group,
                        )
                        .on_confirm(move |ix: IndexPath, window, cx| {
                            window.close_dialog(cx);
                            match commands.get(ix.section).and_then(|rows| rows.get(ix.row)) {
                                Some(PaletteCommand::Run(action)) => window.dispatch_action(action.boxed_clone(), cx),
                                Some(PaletteCommand::OpenUrl(url)) => cx.open_url(url),
                                Some(PaletteCommand::Copy(text)) => {
                                    cx.write_to_clipboard(ClipboardItem::new_string(text.clone()));
                                }
                                Some(PaletteCommand::Filter(filter)) => {
                                    let filter = filter.clone();
                                    let _ = view.update(cx, |this, cx| this.apply_filter(filter, cx));
                                }
                                None => {}
                            }
                        }),
                )
            })
        });
        // Opening the dialog moves focus into it; hand it to the palette's search field after.
        let palette = self.palette.clone();
        window.defer(cx, move |window, cx| {
            palette.update(cx, |state, cx| state.focus(window, cx));
        });
    }

    fn open_actions(&mut self, _: &OpenActions, window: &mut Window, cx: &mut Context<Self>) {
        let entry = match self.screen {
            Screen::Rebuild(_) => None,
            _ => self.list.read(cx).delegate().selected_entry().cloned(),
        };
        let showing = if self.is_showing_detail() {
            self.show_metadata
        } else {
            self.show_details
        };
        let groups = entry_palette(entry.as_ref(), showing)
            .into_iter()
            .map(|group| {
                let rows = group
                    .rows
                    .into_iter()
                    .map(|row| {
                        let mut item = CommandItem::new().label(row.label).icon(Icon::new(row.icon));
                        if let PaletteCommand::Run(action) = &row.command {
                            item = item.action(action.boxed_clone());
                        }
                        (item, row.command)
                    })
                    .collect();
                (group.label, rows)
            })
            .collect();
        self.open_palette("Search actions…", groups, window, cx);
    }

    fn open_filter(&mut self, _: &OpenFilter, window: &mut Window, cx: &mut Context<Self>) {
        let delegate = self.list.read(cx).delegate();
        let Some(connection) = delegate.connection() else {
            return;
        };
        let (types, all_tags) = (
            entry_types(connection).unwrap_or_default(),
            tags(connection).unwrap_or_default(),
        );
        let groups = filter_groups(&types, &all_tags, delegate.filter())
            .into_iter()
            .map(|group| {
                let rows = group
                    .choices
                    .into_iter()
                    .map(|choice| {
                        (
                            CommandItem::new().label(choice.label).checked(choice.checked),
                            PaletteCommand::Filter(choice.next),
                        )
                    })
                    .collect();
                (group.label, rows)
            })
            .collect();
        self.open_palette("Filter by type or tag…", groups, window, cx);
    }

    fn apply_filter(&mut self, filter: FilterState, cx: &mut Context<Self>) {
        self.list.update(cx, |list, cx| {
            list.delegate_mut().set_filter(filter);
            cx.notify();
        });
        cx.notify();
    }
}
impl Render for SearchView {
    #[allow(clippy::too_many_lines)]
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let selected = self.list.read(cx).delegate().selected_entry().cloned();
        let filter_label = filter_summary(self.list.read(cx).delegate().filter());

        let header = h_flex()
            .h_12()
            .w_full()
            .items_center()
            .px_3()
            .gap_2()
            .border_b_1()
            .border_color(cx.theme().border)
            .bg(cx.theme().background)
            .child(
                Button::new("back-button")
                    .ghost()
                    .small()
                    .icon(IconName::ChevronLeft)
                    .on_click(cx.listener(|this, _, window, cx| {
                        this.back(&Back, window, cx);
                    })),
            )
            .child(
                // A single-line input consumes ↑ and ↓ without propagating them, so they are
                // captured here, before it, to move the list selection.
                div()
                    .flex_1()
                    .min_w_0()
                    .capture_action(cx.listener(|this, _: &MoveUp, window, cx| this.move_selection(-1, window, cx)))
                    .capture_action(cx.listener(|this, _: &MoveDown, window, cx| this.move_selection(1, window, cx)))
                    .child(Input::new(&self.query_input).cleanable(true).appearance(false)),
            )
            .child(
                Button::new("filter-button")
                    .ghost()
                    .small()
                    .icon(IconName::ListFilter)
                    .label(filter_label)
                    .dropdown_caret(true)
                    .on_click(cx.listener(|this, _, window, cx| {
                        this.open_filter(&OpenFilter, window, cx);
                    })),
            );

        let middle_content = match &self.screen {
            Screen::Rebuild(sync) => sync.clone().into_any_element(),
            Screen::Detail => match &selected {
                Some(entry) => v_flex()
                    .size_full()
                    .child(div().px_3().pt_3().text_lg().child(entry.title.clone()))
                    .child(
                        div()
                            .px_3()
                            .text_color(cx.theme().muted_foreground)
                            .child(type_label(&entry.entry_type)),
                    )
                    .child(notes_pane(entry, self.show_metadata, cx))
                    .into_any_element(),
                None => div().into_any_element(),
            },
            Screen::Search => h_resizable("search-split")
                .child(resizable_panel().size(px(320.)).child(List::new(&self.list)))
                .when_some(selected.clone().filter(|_| self.show_details), |split, entry| {
                    split.child(resizable_panel().child(notes_pane(&entry, true, cx)))
                })
                .into_any_element(),
        };

        let (context_icon, context_text) = match &self.screen {
            Screen::Detail => (
                IconName::BookOpen,
                selected.as_ref().map_or("Detail".to_string(), |e| e.title.clone()),
            ),
            Screen::Rebuild(_) => (IconName::RefreshCw, "Rebuilding Index…".to_string()),
            Screen::Search => (IconName::BookOpen, "Search Knowledge Base".to_string()),
        };

        let primary_label = if self.is_showing_detail() {
            selected.as_ref().map_or("Action", |e| primary_action(e).title)
        } else {
            "Show Details"
        };

        let enter_hint = Keystroke::parse("enter").ok().map(Kbd::new);
        let actions_hint = Kbd::binding_for_action(&OpenActions, Some(CONTEXT), window);
        let footer = h_flex()
            .h_11()
            .w_full()
            .items_center()
            .justify_between()
            .px_3()
            .border_t_1()
            .border_color(cx.theme().border)
            .bg(cx.theme().background)
            // Left context badge
            .child(
                h_flex()
                    .items_center()
                    .gap_2()
                    .px_2()
                    .py_1()
                    .rounded_md()
                    .bg(cx.theme().muted.opacity(0.4))
                    .text_xs()
                    .text_color(cx.theme().foreground)
                    .child(Icon::new(context_icon).small().text_color(cx.theme().red))
                    .child(div().truncate().max_w_80().child(context_text)),
            )
            // Right action pills
            .child(
                h_flex()
                    .items_center()
                    .gap_2()
                    .child(
                        Button::new("footer-primary-action")
                            .ghost()
                            .small()
                            .label(primary_label)
                            .when_some(enter_hint, ParentElement::child)
                            .on_click(cx.listener(|this, _, window, cx| {
                                if this.is_showing_detail() {
                                    this.run_primary(&RunPrimary, window, cx);
                                } else {
                                    this.show_detail_screen(window, cx);
                                }
                            })),
                    )
                    .child(
                        Button::new("footer-open-actions")
                            .ghost()
                            .small()
                            .label("Actions")
                            .when_some(actions_hint, ParentElement::child)
                            .on_click(cx.listener(|this, _, window, cx| {
                                this.open_actions(&OpenActions, window, cx);
                            })),
                    ),
            );

        v_flex()
            .track_focus(&self.focus)
            .key_context(
                if self.is_showing_detail() {
                    format!("{CONTEXT} {DETAIL_CONTEXT}")
                } else {
                    CONTEXT.to_owned()
                }
                .as_str(),
            )
            .on_action(cx.listener(Self::open_actions))
            .on_action(cx.listener(Self::open_filter))
            .on_action(cx.listener(Self::run_primary))
            .on_action(cx.listener(Self::copy_url))
            .on_action(cx.listener(Self::toggle_details))
            .on_action(cx.listener(Self::open_source_file))
            .on_action(cx.listener(Self::rebuild))
            .on_action(cx.listener(Self::open_preferences))
            .on_action(cx.listener(Self::back))
            .size_full()
            .bg(cx.theme().background)
            .text_color(cx.theme().foreground)
            .child(header)
            .child(div().flex_1().min_h_0().w_full().child(middle_content))
            .child(footer)
    }
}
