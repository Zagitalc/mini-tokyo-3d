```md
# Mini London 3D development instructions

## Scope separation

Mini London 3D has separate concerns that must not be conflated:

1. London route-display geometry
2. Live-train identity and movement
3. Vehicle visual geometry and rendering
4. Picking, selection and outlines
5. Generated London data assets
6. London UI layout, lifecycle, accessibility and theming
7. Attribution, licensing and deployment documentation

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
vehicle-mesh-only, UI-only, attribution-only or documentation-only change.

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
- Preserve the existing rendering architecture, fleet count, material count,
  shader count and draw-call count unless the task plan explicitly permits a change.
- When visible and GPU-picking meshes share geometry, preserve that relationship
  unless the agreed plan explicitly requires separation.
- Preserve lifecycle fade-in and fade-out behaviour, including the ability to
  reach zero opacity.
- Compose new opacity factors with existing lifecycle, visibility and search
  factors rather than replacing them.
- Do not introduce invisible, zero-area or degenerate geometry solely to satisfy tests.
- Record geometry metrics before and after geometry changes using consistent
  vertex and triangle-counting rules.

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

## Attribution and licensing invariants

When investigating or modifying map attribution, project credits,
licensing notices or deployment documentation:

- Distinguish required third-party attribution from optional project branding.
- Preserve all required Mapbox attribution, including:
  - the Mapbox logo
  - linked `© Mapbox` text
  - `Improve this map` where required by the active Mapbox configuration
- Preserve visible and linked OpenStreetMap attribution and its applicable
  licence destination.
- Do not remove, obscure, clip, recolour into illegibility or replace required
  provider attribution with Mini London 3D branding.
- Treat literal `undefined`, `null`, `[object Object]`, blank links and repeated
  separators as software or configuration defects, not valid attribution text.
- Trace invalid attribution values to their source configuration, metadata,
  template, join or flattening logic.
- Correct missing metadata at its source rather than hiding generated DOM nodes.
- Filter invalid optional attribution values before passing them to Mapbox.
- Do not rely on undocumented Mapbox private properties in production code.
  They may be inspected during read-only diagnosis only.
- Test compact and expanded attribution states.
- Test desktop, responsive, light-theme and dark-theme attribution rendering.
- Verify every required attribution link remains visible, legible and clickable.
- Verify the attribution control is not duplicated.
- Do not add `© Mini London 3D` unless the copyright owner and intended scope
  of that claim are clearly identified.
- Prefer neutral project credit such as:
  - `Mini London 3D`
  - `Mini London 3D · Project source`
- Preserve applicable upstream Mini Tokyo 3D copyright and licence notices.
- Do not imply ownership of Mapbox, OpenStreetMap, upstream Mini Tokyo 3D code,
  data providers or third-party services.
- Keep project branding separate from required provider attribution.
- Prefer fuller project, author and upstream-credit information in an About
  panel, README, licence file or project page when the map control would become
  overcrowded.
- Read-only attribution audits must not modify repository files, metadata,
  styles or runtime configuration.
- For read-only audits, record HEAD and worktree status before and after the
  investigation and confirm the repository remains unchanged.

## Deployment documentation invariants

When working on deployment documentation:

- Documentation-only tasks must not deploy the application.
- Do not create provider projects, DNS records, workflows, hooks, Functions,
  Workers or deployment-triggering configuration unless explicitly in scope.
- Do not commit `public/config.local.js`.
- Do not commit browser-exposed secrets.
- Treat a public Mapbox token as browser-visible and require suitable URL or
  origin restrictions.
- Never embed a TfL application key in:
  - frontend source
  - generated static JavaScript
  - `config.local.js`
  - HTML
  - browser-facing environment substitutions
- Clearly distinguish browser-public configuration from server-side secrets.
- Document the first-deployment behaviour when a TfL proxy does not yet exist.
- Unauthenticated TfL access must be described as best-effort and must degrade
  gracefully when rejected, rate-limited or unavailable.
- Do not promise reliable live TfL service until a server-side proxy exists.
- A future proxy must keep the TfL credential server-side and expose only the
  proxy base URL through the existing `tflProxyBase` option.
- Explain that build environment variables become public when substituted into
  static browser assets.
- Verify the configured build command, output directory and runtime Node version.
- Verify that the generated deployment output includes required runtime files.
- Verify provider limits such as:
  - maximum file count
  - maximum individual asset size
  - build allowance
  - bandwidth or usage constraints
- Review public metadata before production deployment, including:
  - page title
  - description
  - canonical URL
  - Open Graph URL
  - Open Graph image
  - Twitter or social account metadata
  - analytics identifiers
  - project author and repository links
- Do not leave inherited Mini Tokyo production URLs, analytics IDs or social
  accounts in a Mini London production build unless explicitly intended.

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
- Do not fetch-and-merge, rebase, reset, recreate a branch or change the branch
  base when the task plan requires preserving work from another local or remote branch.
- If the task plan does not specify a branch base:
  - `git fetch origin`
  - identify the repository’s current default branch
  - create or update the task branch from that default branch
  - verify that the worktree is clean
- Do not assume `origin/v2` is the current default branch.
- Before creating or continuing a task branch:
  - record the current branch and HEAD
  - verify any required ancestor commit
  - confirm the worktree state
  - preserve known untracked files unless the plan explicitly includes them
- When a task continues on an existing branch:
  - confirm the branch name exactly
  - do not recreate it
  - do not switch back to the default branch
  - do not fetch-and-merge unless the task plan requires it
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
- Create only the commits permitted by the agreed task plan.
- Read-only investigation phases must not create commits.
- Do not push, deploy, squash or rebase until the task plan’s validation
  requirements have passed.

## Validation

For every implementation task:

- Run `npm test`.
- Run `npm run lint`.
- Run `npm run build:london`.
- Run any focused tests added for the changed subsystem.
- Run `git diff --check`.
- Inspect the running London build when the task affects visual rendering or UI.
- Check the browser console for JavaScript, WebGL, shader and runtime errors.
- Hash protected generated assets before and after the work.
- Record the baseline lint result before implementation when existing lint
  errors or warnings are present.
- The task must introduce no additional lint errors or warnings.
- Any lint problem in a changed file must be resolved.
- Report:
  - branch and HEAD
  - files changed
  - commits created
  - tests and builds run
  - command exit statuses
  - results
  - relevant invariant status
  - asset-hash status
  - geometry metrics where applicable
  - visual checks performed
  - accessibility checks performed
  - attribution findings where applicable
  - known limitations

For vehicle-rendering work, additionally verify:

- one train still maps to one `instanceID`
- visible and GPU-picking meshes retain the intended shared-geometry relationship
- visible, picking and outline bounds remain aligned
- train selection and tracking still resolve the correct object
- lifecycle fade-in and fade-out still reach zero
- search dimming and view-mode opacity compose correctly
- Tokyo rendering remains unchanged
- buses and aircraft remain unchanged
- no geometry or material is allocated per frame or per train
- no unexpected mesh, material, shader, uniform, texture, fleet, instance or
  draw call is introduced
- geometry contains no non-finite values
- geometry contains no degenerate triangles
- geometry metrics remain within the agreed budget
- moving-train visual checks cover representative bearings, pitches, themes
  and travel directions

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

For attribution work, additionally verify:

- every visible attribution entry has a known source
- invalid values are not presented as legal attribution
- compact and expanded attribution states are correct
- required Mapbox and OpenStreetMap attribution remains intact
- provider links are visible, legible and clickable
- project branding does not replace required attribution
- London and Tokyo modes are both checked
- the attribution control is not duplicated
- read-only audits leave HEAD and worktree status unchanged

For deployment-documentation work, additionally verify:

- no deployment-triggering configuration was added unless explicitly required
- no secret or local runtime configuration file was committed
- the documented build produces `build/index.html`
- required browser runtime configuration is documented accurately
- the output remains within the selected provider’s file-count and
  individual-asset limits
- the expected behaviour of live TfL features before a proxy exists is stated
- inherited production metadata has been identified for review
- no deployment or DNS change occurred

## Subagents

- Use subagents for independent read-only exploration, test review,
  fixture analysis, performance review, accessibility review, attribution
  inspection, deployment-document review and visual verification.
- Subagents must not commit.
- Subagents must not modify repository files during read-only investigations.
- Avoid parallel edits to overlapping files.
- The main agent owns implementation, integration, validation and commits.
```
