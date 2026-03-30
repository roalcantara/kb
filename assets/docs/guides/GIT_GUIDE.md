---
title: Git guidelines (extended)
description: Git usage and commit message background; Conventional Commits detail
---

# GIT GUIDELINES

For day-to-day commit format, prefer **`assets/docs/guides/GIT_COMMITS_GUIDE.md`** and `.cursor/rules/git-commits.mdc` (single source of truth for this repo).

## COMMIT MESSAGES

> Git commit messages are a vital part of the software development process.
> Well-crafted commit messages not only document the history of your project but also facilitate collaboration and maintainability.
> This document outlines the guidelines for writing git commit messages that are clear, concise, and informative.

1. PURPOSE OF COMMIT MESSAGES

   - **Project History:** Creates a chronological log of changes and reasoning
   - **Code Review:** Helps reviewers understand intent quickly
   - **Collaboration:** Keeps team informed about others' changes
   - **Documentation:** Provides context and helps onboard new members

2. CHARACTERISTICS OF EFFECTIVE COMMIT MESSAGES

   - **Conciseness:** Be brief but descriptive.
   - **Relevance:** Focus on why the change is necessary, not how it was implemented.
   - **Clarity:** Avoid vague descriptions; be specific about what and why.
   - **Consistency:** Follow a standard format for ease of reading.

3. ATOMIC, SELF-CONTAINED, AND TESTABLE COMMITS

    - **Atomic:** Focus on one logical change
    - **Self-Contained:** Be small, focused, self-contained and testable
    - **Testable:** Leave the codebase in a working state
    - **Revert:** Allow complete reverts and cherry-picks

4. THE 7 RULES FOR EFFECTIVE COMMIT MESSAGES

   1. Separate the subject from the body with a blank line;
   2. Limit the subject line to a maximum of 50 characters;
   3. Use the present tense; capitalize the subject line’s first letter (matches `GIT_COMMITS_GUIDE.md` and gitlint in this repo);
   4. Avoid ending the subject line with a period;
   5. Use the imperative mood in the subject line;
   6. Wrap the body at a maximum of 72 characters per line;
   7. Utilize the body to explain the "what" and "why" of the changes rather than the "how".

5. CONVENTIONAL COMMITS

    The Conventional Commits specification is a lightweight convention on top of commit messages.
    It provides an easy set of rules for creating an explicit commit history; which makes it easier to write automated tools on top of.
    This convention entails that the commit message should be structured as follows:

        ```gitcommit
        <type>[optional scope]: <description>

        [optional body]

        [optional footer(s)]
        ```

    This pattern communicates its intention in a clear, concise, and informative way due to the following structural elements:

      1. **TYPE** _(required)_

          > Defines the category of the commit, simplifying track bugs, code reviews, and maintenance.

          It MUST be a one of the following nouns which clarify the nature of the commit:
          - build: Related to build process;
          - ci: Related to continuous integration;
          - chore: Related to dependencies or auxiliary tool changes;
          - docs: Related to documentation maintenance;
          - feat: Introduces new features or libraries;
          - fix: Addresses bug fixes;
          - perf: Improves performance;
          - ref: Refactors code without adding new features;
          - revert: Reverts previous changes;
          - style: Markup, formatting, or code style fixes and changes;
          - test: Test suite maintenance;
      2. **SCOPE** _(optional)_

          > Defines the section/module/area affected by the commit

          - MUST be a noun describing which section/module/area has been impacted by the commit, which:
          - It MAY be omitted if not related to a specific section/module/area
          - It MUST be surrounded by parenthesis if used
          - It MAY indicate that affects all sections/modules/areas by using a `*`
          - It MAY separate by slashes each section/module/area involved
          - And it MUST end with a colon and a space if used
          - **EXAMPLES:**
              - ()
              - (*)
              - (core)
              - (core/domain)
              - (core/domain/services)
      3. **SUBJECT** _(required)_

          > A capitalized short summary of the commit

          - MUST immediately follow the colon and space after the type/scope prefix and:
          - It MUST be written in the imperative mood and present tense
          - It MUST use a capitalized first letter (project standard; aligns with `GIT_COMMITS_GUIDE.md`)
          - It MUST be limited to 50 characters
          - It MUST NOT end with a period
      4. **BODY** _(optional)_

          > Additional contextual information about the code changes

          - It MUST begin one blank line after the TITLE.
          - It provides additional contextual information about the code changes.
          - It is free-form and MAY consist of any number of newline separated paragraphs and bullet points.
          - It MUST be wrapped at a maximum of 72 characters per line.
      5. **FOOTER** _(optional)_

          > Structured metadata about the commit, such as issue references, breaking changes, or related tickets, enabling automation

          - MUST begin one blank line after the BODY.
          - It MAY be provided more than once
          - It MUST consist of a word token followed by either a `:<space>` or `<space>#` separator followed by a [string](mdc:https:/git-scm.com/docs/git-interpret-trailers) value.
          - It MAY contain spaces and newlines, and parsing MUST terminate when the next valid footer token/separator pair is observed.
          - It MUST use `-` in place of whitespace characters to differentiate the footer section from a multi-paragraph BODY, e.g.:

              > - Acked-by: John Doe <john.doe@example.com>

          - It MAY use _BREAKING CHANGE_ as token as an exception.
      6. **BREAKING CHANGES** _(optional)_

          > MUST be indicated in the _TYPE/SCOPE_ prefix, in the _FOOTER_, or both!

          1. Using the `!` in the _TYPE/SCOPE_ prefix:

          > This approach was added later as a more visible, concise way to flag breaking changes

          - The `!` immediately before the `:` indicates this is a breaking change
          - The _FOOTER_ does not need to include `BREAKING CHANGE:` since the `!` already indicates it
          - The commit description explains what the breaking change is. **I.E.:**

                  ```gitcommit
                  feat!: Allow provided config object to extend other configs

                  This introduces a breaking change to the API by requiring users to update
                  their configuration structure.
                  ```

          > **ADVANTAGES:**
          > - More immediately visible in commit logs
          > - Concise for simple breaking changes
          > - Easier to spot in automated tooling and commit history
          >
          > **WHEN TO USE IT?**
          > - The breaking change requires extensive explanation
          > - You want to maintain a cleaner first line
          > - You're following older team conventions that prefer this style

          1. Using the `BREAKING CHANGE:` keyword in the _FOOTER_:

          > This approach was the original method in earlier versions of the specification

          - The uppercased text `BREAKING CHANGE:` followed by its description is placed in the _FOOTER_
          - It's separated from the _BODY_ by a blank line. **I.E.:**

                  ```gitcommit
                  feat: Add new payment processor integration

                  The new integration supports modern payment methods.

                  BREAKING CHANGE: older payment gateways using the legacy API will need to be
                  updated to use the new unified payment interface.
                  ```

          > **ADVANTAGES:**
          > - Allows for detailed explanation of complex breaking changes
          > - Keeps the first line cleaner (no `!`)
          > - Better for lengthy breaking change descriptions that need multiple paragraphs
          >
          > **WHEN TO USE IT?**
          > - The breaking change is straightforward
          > - Immediate visibility in commit logs is important
          > - The commit description already explains the breaking change sufficiently

          1. Using in both _TYPE/SCOPE_ and _FOOTER_:

          > This approach allows for maximum clarity in complex changes

          - Although valid, this is somewhat redundant. **I.E.:**

                  ```gitcommit
                  feat(api)!: Redesign authentication system

                  Complete overhaul of auth flows.

                  BREAKING CHANGE: All clients will need to update their authentication flow
                  to work with the new token-based system.
                  ```

          > **ADVANTAGES:**
          > - Maximizes visibility (the `!` flags it immediately)
          > - Provides dedicated space for detailed explanation in the footer
          > - Most comprehensive for significant API changes
          >
          > **WHEN TO USE IT?**
          > - The change is major and needs both immediate visibility and detailed explanation
          > - Working in a team that uses automated tooling that looks for both indicators
          > - You want to be extra clear about the significance of the change

## REFERENCES

- [Conventional Commits][1]
- [7 Best Practices of Git Commit Messages][2]

[1]: https://conventionalcommits.org/en/v1.0.0 'Conventional Commits'
[2]: https://codefinity.com/blog/7-Best-Practices-of-Git-Commit-Messages '7 Best Practices of Git Commit Messages'
