# Raycast UI parity enhancement — design

- **Date:** 2026-10-09
- **Status:** Approved design, awaiting implementation plan
- **Scope:** Complete visual and UX overhaul of `kb-app` to achieve parity with the 5 canonical Raycast extension screens.
- **Reference:** Raycast extension screens (List, Filter with selections ⌘P, Actions ⌘K, Split View ⌘D, Detail View ↵) and prototype at `.superpowers/brainstorm/*/content/prototype.html`.

## Goal

Bring `kb-app`'s resident launcher interface from the bare-bones default GPUI Kit appearance to full visual and UX parity with the original Raycast extension:

1. Transform the app from default light mode to a polished, dark launcher aesthetic with deep slate/charcoal tones (`#161822`), high-contrast typography, and 16–18px rounded window corners.
2. Establish a 3-tier launcher shell: a top header with back chevron, borderless search input, and filter trigger (`= All Entries ⌵`); a flexible content area (List, Split, and Detail screens); and a docked bottom action bar with contextual status badges and physical keycap affordances (`Show Details ↵`, `Actions ⌘K`).
3. Enhance list row presentation with vibrant rounded square type badges (neon green `>` for commands, blue file badge for cheats/documents, red play badge for video/media), deterministic pastel tag tints (`#nu`, `#schedule`, `#speckit`), and accessory mascot icons (Linux, Gradle, Grails).
4. Refine notes and detail rendering with a signature red callout quote bar on descriptions, monospace stats styling, and key-value metadata tables.
5. Preserve 100% of the underlying performance (150ms debounced FTS search, sub-5ms rendering) and domain purity (`kb-domain` remains completely untouched).

## Decisions

| #  | Question                 | Decision                                                                                                                                                         |
| -- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 | Theme and window chrome  | Default to `ThemeMode::Dark` on startup; apply deep slate background (`#161822`) and 16–18px corner radius on the floating pop-up window.                        |
| D2 | Launcher shell structure | Structure the root view as a 3-tier vertical flex container: 52px top header, flexible middle content view, and 44px docked bottom action bar.                   |
| D3 | Search header decoupling | Decouple search input from `List` by setting `list.set_searchable(false)` and managing a custom header `Input` that forwards queries to `ListState::set_query`.  |
| D4 | Entry type badges        | Replace plain outline icons with vibrant rounded square badges (`TypeBadge`) colored by entry type (green command badge, blue document badge, red media badge).  |
| D5 | Tag tinting              | Deterministically hash tag names into a curated 6-color dark-mode pastel palette (coral, amber, emerald, sky, rose, violet).                                     |
| D6 | Docked action bar        | Maintain a persistent bottom footer across all screens with contextual left view/title badge and right keyboard shortcut pills (`Show Details ↵`, `Actions ⌘K`). |
| D7 | Description callout      | Render entry descriptions in Split and Detail views with a 3px red vertical accent quote bar (`border_l_3` in `#ef4444`).                                        |
| D8 | Parity matrix update     | Reclassify `parity.md` rows S05 (type icons), S07 (tags), and F01 (filter trigger) from Adapted to Same/Better.                                                  |

## Scope

**In:**

- Full visual and UX parity with the 5 Raycast screens (List, Filter, Actions, Split, Detail).
- Default dark mode theme initialization and custom token configuration.
- 3-tier shell layout in `search_view.rs`: header bar, content router, and docked action bar.
- Custom header bar with `<` back chevron, borderless query input, and `= All Entries ⌵` filter button.
- List row styling with vibrant type badges, deterministic pastel tags, and rounded selection highlight.
- Split and Detail screen styling with red description callout bar, preformatted blocks, and metadata table.
- Dynamic bottom action bar updates between List, Split, and Detail screens.
- Comprehensive UI integration tests in `crates/kb-app/tests/ui.rs`.

**Out:**

- Any modifications to `crates/kb-domain` or the SQLite schema.
- Writing to the Raycast repository (`$KB_TS_REPO`).
- External window managers or Web tech dependencies.

## Architecture & Component Structure

### Theming Bootstrap (`crates/kb-app/src/lib.rs` & `panel.rs`)

- Initialize GPUI Kit in Dark mode during application startup:
  ```rust
  Theme::change(ThemeMode::Dark, None, cx);
  ```
- Customize semantic tokens for the floating launcher:
  - Surface: `#161822` (window background) and `#1b1e2b` (elevated panels/popovers).
  - Borders: `rgba(255, 255, 255, 0.08)`.
  - Foreground: `#f1f5f9` (primary headings/titles) and `#8b92a2` (subtitles/muted text).
  - Selected row: `rgba(255, 255, 255, 0.07)` with smooth rounded corners (`rounded_lg`).

### Root Launcher Shell (`crates/kb-app/src/search_view.rs`)

Replace direct `List` rendering with a structured 3-tier container:

```text
┌─────────────────────────────────────────────────────────────────┐
│  <  [ Search knowledge base...             ]     = 2 Filters ⌵ │  <- Header Bar (52px)
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [ List View ]               │   [ Notes & Metadata Pane ]      │  <- Content Area (Flex 1)
│                              │                                  │
├─────────────────────────────────────────────────────────────────┤
│ (•) Search Knowledge Base         [ Show Details ↵ ] [ Actions ⌘K ] │  <- Docked Action Bar (44px)
└─────────────────────────────────────────────────────────────────┘
```

- **Decoupled Search:**
  - Call `self.list.update(cx, |list, cx| list.set_searchable(false, cx))` to suppress the default list search bar.
  - Render a dedicated `Input` component in the header.
  - Changes in the header call `ListState::set_query`, preserving the 150ms debounce and fast FTS response.
- **Header Affordances:**
  - `<` back button: active on Detail and Rebuild screens (invokes `Self::back`), or clears query on Search screen.
  - `= All Entries ⌵` / `= N Filters ⌵` button: displays current filter state and invokes `Self::open_filter` (⌘P).

### List Row Presentation (`crates/kb-app/src/entry_list.rs` & `presentation.rs`)

- **Vibrant Type Badges:**
  - Define `TypeBadge` in `presentation.rs` returning badge background, border, text color, and icon for each `TypeKey`.
  - Render as a fixed-size `div().size_5p5().rounded_md()` badge.
- **Deterministic Tag Tints:**
  - Hash tag names into a curated palette of 6 soft dark-theme colors:
    - Coral (`rgba(239, 68, 68, 0.18)`, fg `#f87171`)
    - Amber (`rgba(180, 83, 9, 0.22)`, fg `#fbbf24`)
    - Emerald (`rgba(34, 197, 94, 0.18)`, fg `#4ade80`)
    - Sky (`rgba(59, 130, 246, 0.18)`, fg `#60a5fa`)
    - Rose/Magenta (`rgba(236, 72, 153, 0.18)`, fg `#f472b6`)
    - Violet (`rgba(168, 85, 247, 0.18)`, fg `#c084fc`)
- **Row Selection:**
  - Full-width rounded highlight (`rounded_lg`) with subtle border and text contrast enhancement.

### Docked Bottom Action Bar (`crates/kb-app/src/search_view.rs`)

- Pinned footer bar across the bottom of all screens.
- **Left Status Pill:**
  - Displays knowledge base icon with coral background.
  - Label is `"Search Knowledge Base"` on list and split view, `"Rebuilding Index…"` on sync view, and the **Entry Title** (e.g. `"Xe'Sha"`) on the detail view.
- **Right Action Pills:**
  - `Show Details` with keycap badge `↵`.
  - `Actions` with keycap badges `⌘` and `K`.
  - On Detail screen: dynamically switches primary action to entry's action (e.g., `Copy Cheat Sheet ↵` or `Open in Browser ↵`).
  - Clicking pills dispatches the corresponding GPUI Actions (`RunPrimary`, `OpenActions`, `ToggleDetails`).

### Notes & Detail Screen Styling (`crates/kb-app/src/notes.rs`)

- **Description Callout:**
  - Renders with a red accent bar on the left:
    ```rust
    div().border_l_3().border_color(rgb(0xef4444)).pl_3().text_color(cx.theme().foreground)
    ```
- **Stats & Preformatted Blocks:**
  - Styled with a dark inset background (`rgba(0, 0, 0, 0.25)`), monospace font, and red/coral highlighted values.
- **Metadata Table:**
  - 2-column key-value grid for Type (pill badge), Description, Tags (tinted pills), and Source file link.

## Acceptance Criteria

The implementation must fulfill the following acceptance criteria, directly matching the interactive prototype at `.superpowers/brainstorm/*/content/prototype.html`:

### AC1: Launcher Theming & Window Geometry

- **Default Dark Mode:** The application initializes in `ThemeMode::Dark` on bootstrap without needing manual configuration.
- **Surface Colors:** Main window background is deep slate/midnight (`#161822` / `#1c1e29`), elevated panels/popovers `#1b1e2b`, borders `rgba(255, 255, 255, 0.08)`.
- **Window Chrome:** The window has 16–18px rounded corners with a subtle outer hairline border, rendered as an accessory pop-up (`WindowKind::PopUp`).
- **Typography Contrast:** Primary titles render in high-contrast crisp white (`#f1f5f9`), subtitles and secondary metadata in muted slate (`#8b92a2`).

### AC2: 3-Tier Launcher Shell & Custom Header Bar

- **Layout Structure:** Root view is structured as a vertical flex container: top header (52px), middle content area (flex-1), and bottom docked action bar (44px).
- **Decoupled Search:** The inner `List` is set to `searchable(false)`. A custom header input (`Input`) manages search queries and forwards them to `ListState::set_query` with the existing 150ms debounce.
- **Back Affordance (`<`):**
  - Displays a back chevron icon (`IconName::ChevronLeft`) on the left of the header.
  - On the **Detail Screen** or **Rebuild Screen**: Clicking `<` (or pressing `Esc`) navigates back to the Search list.
  - On the **Search Screen**: Clicking `<` clears the active search query.
- **Filter Button (`= All Entries ⌵`):**
  - Displays an interactive pill on the right of the header with an icon and label reflecting active filters (e.g., `= All Entries ⌵` or `= 2 Filters ⌵`).
  - Clicking the button opens the filter palette (dispatches the `OpenFilter` action, equivalent to ⌘P).

### AC3: List Row Presentation & Vibrant Badges

- **Command Badges:** Entries of type `Command` display a vibrant green rounded square badge (`bg: #14532d`, `border: #22c55e`, `fg: #4ade80`) with a bold terminal prompt `>` glyph.
- **Cheat / Document Badges:** Entries of type `Cheat` or document display a vibrant blue rounded square badge (`bg: #1e3a8a`, `border: #3b82f6`, `fg: #93c5fd`) with a document glyph.
- **Video / Media Badges:** YouTube and video links display a vibrant red badge (`bg: #7f1d1d`, `border: #ef4444`, `fg: #fca5a5`) with a play glyph.
- **Accessories:** Far-right platform and tool accessories (such as Linux mascot, Gradle elephant, Grails mascot) render when present on the entry.
- **Selection State:** The currently selected row displays a full-width soft rounded highlight (`rgba(255, 255, 255, 0.07)` or `#252839`) with rounded corners (`rounded_lg`).

### AC4: Deterministic Tinted Tags

- **Tinted Pills:** Tags render as compact pills with rounded corners (`rounded_md`), low-opacity tinted backgrounds, and colored text.
- **Deterministic Hash:** Tag colors are deterministically chosen from a curated dark-theme palette:
  - Coral (`#f87171` text on `rgba(239, 68, 68, 0.18)` background, e.g. `#nu`)
  - Amber (`#fbbf24` text on `rgba(180, 83, 9, 0.22)` background, e.g. `#schedule`)
  - Emerald (`#4ade80` text on `rgba(34, 197, 94, 0.18)` background, e.g. `#speckit`)
  - Sky (`#60a5fa` text on `rgba(59, 130, 246, 0.18)` background, e.g. `#plan`)
  - Rose (`#f472b6` text on `rgba(236, 72, 153, 0.18)` background, e.g. `#prod`)
  - Violet (`#c084fc` text on `rgba(168, 85, 247, 0.18)` background, e.g. `#heroes`)

### AC5: Docked Bottom Action Bar

- **Persistent Placement:** Docked at the bottom of the window across all screens, separated by a subtle top hairline border.
- **Left Context Badge:**
  - On Search list and Split view: Displays knowledge base icon with coral accent and label `"Search Knowledge Base"`.
  - On Detail screen: Displays knowledge base icon and the active **Entry Title** (e.g. `"Xe'Sha"`).
  - On Sync view: Displays sync icon and label `"Rebuilding Index…"`.
- **Right Action Shortcuts:**
  - Displays interactive pills with physical keyboard keycap chips:
    - `Show Details` with `↵` keycap.
    - `Actions` with `⌘` and `K` keycaps.
  - On Detail screen: The primary action dynamically updates to the entry's primary action (e.g. `Copy Cheat Sheet ↵` or `Open in Browser ↵`).
  - Clicking the pills dispatches the corresponding actions (`RunPrimary`, `OpenActions`, `ToggleDetails`).

### AC6: Split View Styling (⌘D / Left-Right Toggle)

- **Layout:** Resizable split container with narrowed list on the left and notes pane on the right.
- **Description Callout:** When a description is present, it renders with a 3px red vertical accent quote bar on the left (`border_l_3` in `#ef4444`, `pl_3`).
- **Preformatted / Stats Blocks:** Monospace code/stats blocks render with a dark inset background (`rgba(0, 0, 0, 0.25)`), subtle border, and accented red highlight values.
- **Metadata Table:** Renders a clean 2-column grid showing Type (colored pill), Description, Tags (tinted pills), and Source file link (`games.yml`).

### AC7: Full-Width Detail Screen (↵ Push Screen)

- **Navigation:** Pressing Enter on a selected row pushes the full-width Detail screen.
- **Header:** Displays `<` back chevron to return to search results.
- **Body:** Displays full notes with the red description callout bar, formatted stats/code, and source footer.
- **Footer Synchronization:** Context badge shows entry title; right primary shortcut reflects entry primary action.
- **Return Path:** Pressing `Esc` or clicking `<` smoothly pops back to the Search list.

### AC8: Verification, Regressions & Performance

- **No Regression in Core Loop:** Typing in the search field debounces at 150ms; FTS query results update in under 5ms.
- **Domain Purity:** `crates/kb-domain` remains completely untouched (zero changes to domain crate).
- **Test Coverage:** All existing unit and UI integration tests pass (`cargo nextest run`).
- **New UI Tests:** Dedicated tests in `crates/kb-app/tests/ui.rs` verify header query forwarding, action bar dispatches, filter button dispatch, and detail back navigation.
- **Quality Gates:** `cargo clippy --workspace --all-targets -- -D warnings` and `mise run gate` pass cleanly.
