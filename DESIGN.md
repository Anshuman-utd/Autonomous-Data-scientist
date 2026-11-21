# Autonomous Data Scientist — application design

A light, information-first analytics workspace. Near-white canvas (#F7F8FA),
white surfaces, ink (#111827), secondary slate (#64748B), hairline borders
(#E5E7EB), blue (#2563EB) for primary actions and selected navigation. Green,
amber and red communicate measured states. No decorative gradients or glow.

Inter/system sans, 14–16px body, 28px page headings, 18px section headings.
Tabular numerals in diagnostics. Spacing follows 4/8px steps; 8px controls,
10px panels. Flat surfaces; floating menus/dialogs alone use shadows.

Desktop: 232px persistent sidebar, 64px context bar, flexible content width.
Mobile: accessible disclosure navigation; flowing header actions; scrolling
workspace tabs and tables inside bounded containers. All controls have visible
keyboard focus. Dialogs contain focus and close with Escape. Motion respects
system preferences. Empty and failure states explain a next action.

Page hierarchy: Overview, Datasets, Model runs, Saved insights, Account.
Dataset workflow: Overview, Explore, Cleaning, Training, Predictions, Insights,
Analyst, Exports, Versions. URL search parameters preserve browser navigation.
Numbers come from server calculations; unknown results render as unavailable.
