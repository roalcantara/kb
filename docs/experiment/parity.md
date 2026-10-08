# UI/UX parity

One row per user-visible behaviour of kb's Raycast search command. Sources are paths in the Raycast repo
(`apps/kb/src/`). **Status** is Same, Adapted, Better or Missing; anything but Same carries a justification.
Plan 3 fills in Status and Evidence (a `TestAppContext` test, a screenshot pair, or both).

## Surfaces

| #   | Behaviour in Raycast                                                                                                                                                           | Source                               | Status | Evidence | Justification |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ | ------ | -------- | ------------- |
| S01 | Search field with placeholder "Search knowledge base..."; typing searches after 150 ms                                                                                         | `search.screen.tsx`, `use-search.ts` |        |          |               |
| S02 | Results ordered by FTS rank; by title when the query is empty                                                                                                                  | `search.ts` (domain)                 |        |          |               |
| S03 | Pages of 50; the next page loads at the end of the list                                                                                                                        | `pagination.ts`                      |        |          |               |
| S04 | Previous results stay on screen while the next query runs; a loading indicator shows                                                                                           | `use-search.ts`                      |        |          |               |
| S05 | Row icon: type icon tinted by type colour; bookmarks show the site favicon, globe fallback; tooltip names the type                                                             | `icons.ts`, `accessories.ts`         |        |          |               |
| S06 | Row title, and the description as subtitle                                                                                                                                     | `search.screen.tsx`                  |        |          |               |
| S07 | Row accessories: up to 3 tags (`#tag`, colour hashed from the tag, or the tag's icon from assets), `+N` for the rest, link count with a link icon                              | `accessories.ts`, `assets.ts`        |        |          |               |
| S08 | Empty states: Loading…; No entries indexed yet (with Rebuild); No matching entries                                                                                             | `empty.tsx`                          |        |          |               |
| S09 | Split pane toggled with → and ←: the notes Markdown, or "_No additional notes available for this entry._", above the metadata                                                  | `detail.tsx`, `actions.tsx`          |        |          |               |
| S10 | Metadata, in order: URL link (bookmarks) or Command (commands); Type tag; Status; Priority; Description; Tags; Links; Source                                                   | `metadata.tsx`                       |        |          |               |
| S11 | Detail screen pushed with Return: the entry title as navigation title, the notes, metadata toggled with → and ←                                                                | `detail.tsx`                         |        |          |               |
| S12 | Notes rendering: headings, lists, tables, blockquote description, highlighted code blocks, YouTube thumbnail, SVG and image blocks, mermaid diagram, LINKS list, source footer | `markdown.ts` (domain)               |        |          |               |

## Filter

| #   | Behaviour in Raycast                                                                                          | Source                    | Status | Evidence | Justification |
| --- | ------------------------------------------------------------------------------------------------------------- | ------------------------- | ------ | -------- | ------------- |
| F01 | A dropdown beside the search field: a summary item and Clear All Filters; a Types section; a Tags section     | `filter.tsx`              |        |          |               |
| F02 | Choosing a type or tag toggles it; several can be active; any selected type and every selected tag must match | `filter.tsx`, `search.ts` |        |          |               |
| F03 | Filters reset on every launch                                                                                 | `filter.tsx`              |        |          |               |

## Actions

| #   | Behaviour in Raycast                                                                                                                                            | Source        | Status | Evidence | Justification |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------ | -------- | ------------- |
| A01 | ⌘K opens the action panel; actions are grouped in sections with their shortcuts shown                                                                           | `actions.tsx` |        |          |               |
| A02 | List: Return shows details (push)                                                                                                                               | `actions.tsx` |        |          |               |
| A03 | List: ⌘Return runs the type's primary action — Open in Browser (bookmarks); Copy Command Snippet; Copy Cheat Sheet; Copy Notes; Copy Task; Copy Primary Content | `actions.tsx` |        |          |               |
| A04 | Detail: Return runs the type's primary action                                                                                                                   | `actions.tsx` |        |          |               |
| A05 | ⌘C copies a bookmark's URL                                                                                                                                      | `actions.tsx` |        |          |               |
| A06 | → / ← show and hide Details (list) or Metadata (detail)                                                                                                         | `actions.tsx` |        |          |               |
| A07 | ⌘O opens the source file                                                                                                                                        | `actions.tsx` |        |          |               |
| A08 | Links submenu: per link, Open and Copy URL                                                                                                                      | `actions.tsx` |        |          |               |
| A09 | Copy… submenu: Title, Description, Notes, Raw YAML (Description and Notes only when present)                                                                    | `actions.tsx` |        |          |               |
| A10 | ⌘R Rebuild Index…; ⌘⇧, Open Extension Preferences                                                                                                               | `actions.tsx` |        |          |               |

## Sync

| #   | Behaviour in Raycast                                                                                             | Source                                | Status | Evidence | Justification |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------ | -------- | ------------- |
| Y01 | Rebuild screen with progress: files scanned of total, entries, current file; can be stopped                      | `sync/screen.tsx`, `sync/progress.ts` |        |          |               |
| Y02 | A toast on completion; on failure, a toast with Open Extension Preferences                                       | `sync/use-sync.ts`                    |        |          |               |
| Y03 | Report: files in sections by status; a file's detail shows an excerpt and File, Status, Location, Entries, Types | `sync/report.ts`, `sync/file.tsx`     |        |          |               |
| Y04 | Stopped and Failed states, with Retry and Open Extension Preferences                                             | `sync/screen.tsx`                     |        |          |               |

## Launch and preferences

| #   | Behaviour in Raycast                                                               | Source     | Status | Evidence | Justification |
| --- | ---------------------------------------------------------------------------------- | ---------- | ------ | -------- | ------------- |
| L01 | Opened from Raycast's root search or a user-assigned hotkey; Esc pops, then closes | Raycast    |        |          |               |
| P01 | The Sources Directory preference, defaulting to `~/.config/kodexb/sources`         | `paths.ts` |        |          |               |

## Tasks

The five tasks measured for task cost (keystrokes and tier 3 time) in Plan 4, on both apps.

| #  | Task                                               |
| -- | -------------------------------------------------- |
| T1 | Find a bookmark by a word in its title and open it |
| T2 | Find a command and copy it                         |
| T3 | Filter by one type and one tag                     |
| T4 | Read a code-heavy note in the detail screen        |
| T5 | Rebuild the index                                  |
