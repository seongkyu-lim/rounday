# Rounday Phase Plan

Private GitHub repository workflow:

- Each phase is tracked by a GitHub issue.
- Work is committed in small units.
- Each phase ends with a pull request.
- The pull request is merged after verification.
- Issue comments summarize completed work and follow-up notes.

## Phase 1 - Product Foundation

- Define MVP scope and core user flow.
- Build the first usable static app.
- Add circular 24-hour schedule view.
- Add event create, edit, delete, local storage, and overlap detection.

## Phase 2 - Interaction Polish

- Add direct manipulation on the circular clock.
- Improve editing affordances and selected-state behavior.
- Add keyboard-friendly controls.
- Add mobile interaction refinements.

## Phase 3 - Data Model

- Add multiple day profiles.
- Add recurring routines.
- Add import from exported JSON.
- Harden validation for edge cases.

## Phase 4 - Persistence Layer

- Choose lightweight backend shape.
- Add account-ready data schema.
- Add sync abstraction while preserving local-first behavior.
- Add migration path from local storage.

## Phase 5 - User Accounts

- Add authentication flow.
- Add private user schedule storage.
- Add account settings.
- Add basic session handling.

## Phase 6 - Calendar Intelligence

- Add schedule insights.
- Add category summaries.
- Add free-time suggestions.
- Add warnings for overloaded days.

## Phase 7 - Sharing and Export

- Add shareable read-only schedule views.
- Add image export.
- Add printable layout.
- Add richer JSON import/export.

## Phase 8 - Templates Marketplace

- Add template library.
- Add custom template save/apply.
- Add routine presets by persona.
- Add template preview.

## Phase 9 - Quality and Testing

- Add automated UI tests.
- Add accessibility pass.
- Add responsive visual checks.
- Add regression coverage for time calculations.

## Phase 10 - Launch Readiness

- Add deployment configuration.
- Add production metadata.
- Add onboarding polish.
- Add release notes and final docs.
