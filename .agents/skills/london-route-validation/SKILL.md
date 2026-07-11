# Mini London 3D development instructions

## Scope separation

Mini London 3D has separate concerns that must not be conflated:

1. London route-display geometry
2. Live-train identity and movement
3. Vehicle visual geometry and rendering
4. Picking, selection and outlines
5. Generated London data assets
6. London UI layout, lifecycle, accessibility and theming

A task may modify one concern without modifying the others. Follow the explicit task plan and preserve all out-of-scope systems.

## London route rendering invariants

When working on London route-display geometry:

- Replace only the visual London railway geometry.
- Never modify `features.json.gz`, railway feature IDs, station offsets,
  TrafficLayer route groups, train compute-state generation, or live-train movement logic.
- Keep the 3D TrafficLayer enabled.
- Remove only the obsolete visual railway rendering path.
- OSM geometry failures must fall back per corridor, not per line.
- Do not merge corridors solely because they share endpoint stations.
- Lane assignments must be calculated from the complete unfiltered network.
- Runtime filtering may change visibility only; it must not recalculate lane slots.
- Geometry and lane output must be deterministic.

These route-specific restrictions do not prohibit an explicitly planned
vehicle-mesh-only or UI-only change.

## London vehicle rendering invariants

When working on London train appearance:

- Modify only vehicle visual geometry, train-specific shader presentation,
  picking geometry, outline geometry, or London-only scale parameters required
  by the agreed plan.
- Preserve one logical compute-renderer instance and one `instanceID` per train.
- Do not create separate runtime train objects or compute instances per carriage.
- Preserve live-train identity, observation normalisation, route assignment,
  route rebind, movement, interpolation, dwell, stale handling and opacity state.
- Preserve TrafficLayer route groups and route-display geometry.
- Preserve the existing CPU picking fallback unless the plan explicitly changes it.
- Preserve delay-marker behaviour and instance allocation.
- Keep Tokyo and all non-London vehicle rendering unchanged.
- Keep aircraft and bus rendering unchanged unless explicitly in scope.
- Do not add external GLB, GLTF, OBJ, textures or model-loading dependencies
  unless the agreed plan explicitly requires them.
- Build reusable geometry once during initialisation.
- Never create geometry or materials per frame or per train.
- London visual changes must be selected through an explicit London-only option
  or code path, not by changing global defaults.

## London UI invariants

When working on London panels, drawers, dialogs, navigation controls,
accessibility or theme styling:

- Modify only the UI layout, DOM lifecycle, accessibility behaviour and
  London-specific styling required by the agreed plan.
- Do not modify TfL requests, polling cadence, response normalisation,
  status classification, caching, stored live-status state, train behaviour,
  route geometry, vehicle rendering or generated assets.
- Keep persistent UI shells mounted when stable event handlers, focus or
  scroll state are required.
- Bind lifecycle and interaction handlers once unless the task plan
  explicitly requires dynamic binding.
- Prevent repeated opening or live refreshes from accumulating listeners.
- Keep modal shells outside any background subtree that becomes `inert`.
- Preserve and restore each background element’s previous `inert` state.
- Dialogs must use appropriate semantics, including:
  - `role="dialog"`
  - `aria-modal="true"`
  - `aria-labelledby`
  - accurate visible and `aria-hidden` state
- Trap keyboard focus inside an open modal.
- Recompute focusable controls when handling keyboard navigation if dialog
  content may change dynamically.
- Restore focus to the invoking control when that control is still connected.
- Closing actions must be idempotent.
- Backdrop closing must occur only when the backdrop itself is the event target.
- Live content refreshes must not replace persistent modal headers, close
  controls or the modal shell.
- Preserve scroll and focus state across content refreshes where required
  by the agreed plan.
- Use viewport-safe sizing, including `dvh` units and safe-area insets where
  appropriate.
- Apply dark-theme overrides only under explicit London dark-theme selectors.
- Leave London light mode and all non-London UI unchanged unless explicitly
  in scope.
- Do not make Mapbox control overrides global.
- Maintain keyboard, pointer and screen-reader access for all modified controls.
- Do not introduce duplicate modal shells or duplicate control IDs.

## Generated asset invariants

Unless the agreed task explicitly changes generated data:

- Do not modify `features.json.gz`.
- Do not modify `london-route-display.json.gz`.
- Do not modify railway feature IDs or station offsets.
- Hash protected generated assets before and after implementation.
- Compare decompressed content hashes where gzip metadata could differ.
- Treat an unexpected asset-hash change as a regression.

## Git workflow

- Follow the branch base and preflight steps defined in the agreed task plan.
- Do not fetch-and-merge, rebase, reset, or change the branch base when the
  task plan requires preserving work from another local or remote branch.
- If the task plan does not specify a branch base:
  - `git fetch origin`
  - `git merge --ff-only origin/v2`
  - verify that the worktree is clean
- Before creating a task branch:
  - record the current branch and HEAD
  - verify any required ancestor commit
  - confirm the worktree state
  - preserve known untracked files unless the plan explicitly includes them
- Follow the commit sequence defined in the agreed implementation plan.
- Do not squash, reorder or combine commits unless the plan explicitly permits it.
- Do not commit generated or unrelated files unless required by the plan.
- When a task includes one file from an otherwise untracked directory,
  stage that file by its exact path.
- Never stage an untracked parent directory wholesale.
- Before each commit:
  - run `git diff --check`
  - review the unstaged diff
  - review the staged diff
  - run the tests relevant to that phase
  - confirm that out-of-scope invariants remain intact
- Do not push until the task plan’s validation requirements have passed.

## Validation

For every implementation task:

- Run `npm test`.
- Run `npm run lint`.
- Run `npm run build:london`.
- Run any focused tests added for the changed subsystem.
- Inspect the running London build when the task affects visual rendering or UI.
- Check the browser console for JavaScript, WebGL, shader and runtime errors.
- Hash protected generated assets before and after the work.
- Record the baseline lint result before implementation when existing lint
  errors or warnings are present.
- The task must introduce no additional lint errors or warnings.
- Any lint problem in a changed file must be resolved.
- Report:
  - files changed
  - tests and builds run
  - results
  - relevant invariant status
  - asset-hash status
  - visual checks performed
  - accessibility checks performed
  - known limitations

For vehicle-rendering work, additionally verify:

- one train still maps to one `instanceID`
- visible, picking and outline geometry remain aligned
- train selection and tracking still resolve the correct object
- Tokyo rendering remains unchanged
- buses and aircraft remain unchanged
- no geometry or material is allocated per frame or per train

For London UI work, additionally verify:

- desktop, short-desktop and responsive viewport layouts
- no panel or drawer overlaps the navigation header
- scrollable bodies remain usable while fixed headers and footers stay accessible
- dialogs can be opened and closed repeatedly without duplicated behaviour
- X, backdrop and Escape each produce one close transition
- focus remains trapped while the dialog is open
- focus is restored correctly on close
- refreshes preserve required scroll and focus state
- exactly one persistent modal shell exists where required
- no event-listener accumulation occurs across repeated opens or refreshes
- London dark-mode text and controls meet the agreed contrast target
- Mapbox zoom, compass and fullscreen controls retain hover, disabled and
  rotation behaviour
- light mode remains unchanged
- non-London UI remains unchanged
- no new browser console, accessibility or WebGL errors are introduced

## Subagents

- Use subagents for independent read-only exploration, test review,
  fixture analysis, performance review, accessibility review and visual verification.
- Subagents must not commit.
- Avoid parallel edits to overlapping files.
- The main agent owns implementation, integration, validation and commits.