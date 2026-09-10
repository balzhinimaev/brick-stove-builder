# Teplushka-15 reconstruction — work in progress

## Scope and publication boundary

Isolated branch `rebuild/teplushka15-source`, based on main `5cf7eb6`.
Stable bundled example ID: `russian-stove-hob`. Preserve public guest access and editable copies.
No deployment, merge, service/configuration changes, or changes to other worktrees.
Parent must independently review the final model, source correspondence and evidence before publication.

Design basis: I. S. Podgorodnikov, *Бытовые печи двухколпаковые*, 1992,
[complete original scan](https://kirpichiki.pro/assets/files/books/podgorodnikov_1992.pdf).
Local source: `/tmp/stove-source-research/podgorodnikov-1992.pdf`.
Selected after parent research: **Teplushka-15, 129 × 129 cm, wood-firing, front-left chimney**,
33 source courses. Do not combine this with the mirrored Figure 32 or larger 154 × 141 cm design.
Design dossier received: `/tmp/stove-source-research/design-dossier.md`.
Source page images 39–43 were independently inspected and model transcription is implemented; review and dynamic hardware integration remain open.

## Historical baseline audit (superseded model at main@5cf7eb6)

- `src/domain/russianStove.ts`: courses 3–11 deliberately fill the body under the hearth. This is not a lower heating chamber.
- The current hob uses a separate riser feeding a high hood; it cannot be retained as evidence of the original Teplushka circuit.
- Courses 21–24 use horizontal corbels, not radial arch masonry. A new source-grounded vault must not inherit that substitution.
- `brickSolids` represents rectangular plan boxes with vertical intervals; h/v orientation only rotates in plan.
- `overlaps3D` intentionally exempts overlay/non-overlay pairs. That editor compatibility rule is not an independent physical collision audit.
- Existing smoke tests whitelist cells and remove an entire open damper obstacle. They prove limited connectivity of the old model, not valve clearances, source sections, or flow direction.
- `ThreeBrick` renders door hardware thinner than its collision envelope, and damper frames/blades differently from the solid envelope. Gas-obstacle and placement-envelope semantics must be explicit.
- `cloneRows` clones custom/notch but has no nested vertical profile contract. Any profile extension must deep-clone its vertices.
- `server/models/Project.js` explicitly whitelists custom geometry. A TypeScript-only addition would be stripped by persisted projects/drafts.
- Showcase includes a static `public/russian-stove-demo.png`; replace it with a fresh final-model image, not an old-release screenshot.

## Representation design

1. Source manifest: exact pages/figures, source numbering, dimensions, row-to-drawing mapping, chamber names, opening identifiers and uncertainty register.
2. Physical model: individually editable masonry and hardware; lower collection openings, partitions, hearth connections and valve seats remain actual voids.
3. Vault: minimal shared vertical-profile geometry if required by drawings. Rendering, exact collision checks, profile bounds, cloning, save/import and materials must consume the same shape. Bounding boxes alone cannot certify wedge separation.
4. Circuit semantics: mode-specific design routes tied to physical opening IDs and blade states. Explicitly label them as design paths, not CFD or a draft calculation.
5. Inspection: source-aligned section views, chamber/opening labels, selected mode and row-source reference in concise Russian, English and Lithuanian.

## Verification gates

- Exact selected-source dimensions and cross sections; complete source row mapping.
- Pairwise physical collisions independent of legacy overlay exemptions.
- Geometric support/contact paths including inclined voussoirs; report contact footprints and continuity, not a boolean satisfied by any tiny overlap. No claim of structural analysis or certification.
- Full-volume gas-space checks, including the surrounding exterior and all internal voids, not a whitelist of intended-route cells. Distinguish intended air intakes/exhaust from unintended exterior leaks; include thin hardware and reject mortar-seam shortcuts.
- Main/hob routes for each source-defined mode; closed bypass must cut only its intended route. Compute actual blade apertures at closed, partially open and fully open states; never treat every `damperOpen > 0` as fully open. Check forbidden shortcuts and source-derived cross sections, not only path existence.
- Negative mutation tests: plugged low chimney entrance, blocked chamber connection, removed thin blade and blocked cleanout.
- Cleanout access to named lower spaces, not just a door count.
- Profile JSON, server schema, deep clone and editor-history round trips; ordinary editor regressions.
- `VITE_API_BASE=/api npm run check`, production preview without deployment, fresh desktop/mobile browser runs and screenshots through the existing Playwright runner.
- Commit and draft PR with source evidence, test results and unresolved limitations; no premature ready-for-publication claim.

## Baseline verification — 2026-09-10

`VITE_API_BASE=/api npm run check` passed on the unmodified main implementation:
22 test files, 253 tests; formatting passed; production build passed.
Lint reported 73 pre-existing warnings. This establishes regression baseline only,
not acceptance of the rejected stove model. Final-model browser evidence is still pending.


## Accepted source contract — 2026-09-10

- PDF pp. 37–38: two bells in the order **upper cooking chamber first, lower heating chamber second**.
- Figure 30, PDF pp. 39–40: front-left chimney starts near the floor, with two low admissions from the lower chamber.
- Figure 31, PDF p. 40, wood section: preserve the communicating combustion assembly; no independent hob chimney.
- Figure 33, PDF pp. 41–43: complete courses 1–33. Source front is bottom of each plan; proposed model coordinates +X right, +Y rear, front-left origin.
- Winter design route: communicating firebox/hob → front-right hearth riser → upper cooking bell → six parallel rear/side hearth descents → lower heating bell → bottom chimney admissions → common chimney.
- Summer bypass: upper chamber → source summer gate → chimney, without requiring traversal of the lower bell.
- Six descents are **four rear, one left, one right**, visible in courses 10–11. They are not six serial smoke turns.
- Source dimensions: body 1290 × 1290 mm; hob 710 × 410 mm; row-12 rising throat approximately 260 × 260 mm; summer gate 130 × 130 mm; upper chimney throat 140 × 260 mm.
- Summer gate belongs at course 12; ventilation gate at course 24. Main closure around courses 22–23 requires exact seat transcription from the sections.
- Hood is not a third heating bell. Warm roof is not an adult-length projecting sleeping bench.

### Source-to-construction-course index

| Source courses | PDF page / figure | Geometry to transcribe and verify |
| --- | --- | --- |
| 1 | 41 / 33 | Full base, 129 × 129 cm |
| 2–5 | 41 / 33 | Lower chamber, source supports, ash boxes, low chimney connections and service access |
| 6–9 | 41 / 33; wood section 40 / 31 | Communicating combustion assembly and grate seats; fuel-dependent details from wood section |
| 10–11 | 41 / 33 | Hearth support/closure, six separate descents, plate and rising throat |
| 12 | 41 / 33 | Upper chamber inlet, summer-gate connection, chimney separation |
| 13–14 | 42 / 33 | Upper chamber, oven mouth and chimney wall |
| 15–18 | 42 / 33; sections 39–40 / 30 | Actual curved vault, mouth/hood and source ties; plan hatching must not be interpreted as a flat solid chamber fill |
| 19–21 | 42 / 33 | Vault covering, roof and separated front exhaust structures |
| 22–24 | 42 / 33 | Main closure, ventilation connection and its independent gate |
| 25–26 | 42 / 33 | Gathering section |
| 27–33 | 43 / 33 | Gathering transition and upper chimney throat |

### Remaining interpretation obligations

Dimensions above are source facts or explicitly marked approximations, not measurements of a finished model. Before model acceptance, transcribe the exact low admissions, cleanout locations and clearances, all valve seats, support footprints and curved vault into the implementation. The existing 125 × 70 mm throat, common damper and connectivity tests are rejected as acceptance evidence. No implementation or publication is certified by this source index.


### Drawing-specific research clarification — reviewed dossier complete

Parent researcher reports these additional Figure 30/33 details; they constrain the
coordinate transcription but are not yet independently verified implementation evidence:

- Chimney is front-left beside the shestok, with its shaft and bottom admissions at courses 2–4; never substitute a roof-centred outlet.
- Main upward throat is approximately 260 × 260 mm, front-right of the upper hearth, fed by the shared hob/main combustion node beneath the plate.
- Figure 30 B–B upper chimney is 140 × 260 mm. Lower shaft dimensions vary (220 / 165 mm reported); transcribe their respective section axes and levels from the drawing rather than using a uniform 250 × 250 mm shaft.
- Summer bypass gate/seat spans courses 12–13 and connects directly into the front-left shaft.
- Independent oven-mouth/fume-hood ventilation gate at course 24 joins the shaft above the main view closure at courses 22–23. Do not combine this ventilation branch with the winter combustion route.
- Lower-firebox operating mode requires the oven mouth damper closed; test this physical boundary independently of chimney closures.

These clarify the course-12 summer-gate reference above: exact seat geometry extends
into the adjacent course and remains to be transcribed. Updated researcher dossier
is complete and parent-reviewed; no new masonry or test completion is implied by these notes.

## Active model implementation handoff (2026-09-10)

Model entry `russianStove.ts` now calls `makeTeplushka15()`; stable public ID is unchanged. Model writes are confined to domain model/helper/tests and these docs; engine/UI integration belongs to parent authors.

UI contract is exported from `teplushkaSource.ts` and re-exported by `russianStove.ts`:
`TEPLUSHKA_SOURCE`, `TEPLUSHKA_DAMPER_IDS`, `TEPLUSHKA_MODE_SETTINGS`, `TEPLUSHKA_OPENINGS`, `TEPLUSHKA_ROUTES`.
Coordinates are physical mm from stove front-left; add 125 mm X/Y to convert to editor foundation coordinates. Course base is `(row-1)*70` mm. `TEPLUSHKA_OPENINGS` names actual six hearth holes, two low pipe admissions, two removable left-wall service covers and mouth closure.

### Integration issues requiring engine/UI owner attention

- Mouth is a **vertical `cleanout`-kind metal closure**, ID `teplushka-mouth-damper`, 350×345 mm, not a horizontal `damper`. Do not turn it into a horizontal plate to satisfy a UI type filter. Guide preset inspection currently accepts only damper-kind elements; this needs coordinated treatment for the vertical mouth.
- The three horizontal controls are `teplushka-summer-damper` (r12), `teplushka-main-damper` (r22), `teplushka-hood-damper` (r24). In the currently inspected engine, `brickSolids(damper)` still returns the whole frame bounding box regardless of `damperOpen`; renderer moves its blade separately. **Model tests do not call a nonzero opening a fully open hole.** Dynamic exact aperture and collision/render congruence must be integrated before release.
- Canonical `profileXZ` is used exclusively by the model. Tests use the engine author's `profilePolyhedron` and full convex SAT directly while `brickSolids` integration is in progress. No model writes to geometry/types/render/server.

### Implemented evidence

14 targeted tests pass: stable ID and 33-course body/hob dimensions, source metadata, profile validation and six 17-voussoir positive-face chains to both skewbacks, independent reconstructed profile arrays, exhaustive pairwise SAT (including metal; no overlay exemptions), full-volume 10 mm topology, all six physical hearth holes, negative plugged-riser / plugged-descents / plugged-low-admissions tests, and each low cleanout opening to the lower bell.

The finite-volume audit examines the entire enclosing volume, including exterior space. It seals ordinary 5 mm horizontal mortar beds, preserves thin metal by conservative cell intersection, and uses actual convex profile face inequalities; it is not CFD. Its passing closed-metal tests are not dynamic valve verification or structural certification.

### Explicit interpolation / review points

- R880, 990 mm clear arch span are read from Fig.30 G–G. Spring elevation 1050 mm and 17 radial joints per 95 mm barrel bay are reconstruction choices; individual cuts are not dimensioned by the source.
- Summer seat has a dogleg across courses12–13 to force passage across its horizontal blade: the 130×130 mm blade is at x120,y500, with a 120 mm masonry separation from the unchanged 165×260 mm shaft below, joining the shaft above the blade in r13. The local left-front wall extends to y750 to enclose this seat. This local interpolation must be independently checked against Fig.30 B–B; do not advertise an exact brick-for-brick facsimile based only on topology passing.
- Regular wall fragment tiling is editor cut allocation, not proof of the published bond. Lower chamber support/hearth bearing still needs source-by-source independent audit. No invented support posts were added merely to pass overlap tests.

Fresh physical-section artifact generated from model solids: `/tmp/stove-source-research/teplushka15-model-sections.svg` and `.png`. Includes r10–13 plan cuts, transverse barrel section y=1000 mm and longitudinal pipe section x=200 mm. This is fresh model evidence, not an old release screenshot or final UI QA.

Control IDs now match the UI author’s `teplushkaControls.ts` (`TEPLUSHKA_DAMPERS`); the source manifest re-exports that same object as `TEPLUSHKA_DAMPER_IDS`.

### Verification run at model handoff

- 14/14 model tests pass (source identity/dimensions, profiles, pairwise physical SAT, whole-volume topology and service access).
- Full `npm test`: **278 passed, 2 failed** (28 files). Failures: `geometry-collisions.test.ts` ready-project overlap and legacy `profile.test.ts` empty-wedge-box case. Both call the still-unintegrated generic collision path. Direct canonical face SAT in the owned model audit passes. Log: `/tmp/stove-source-research/model-full-test.log`.
- `VITE_API_BASE=/api npm run check` executed and stopped at formatting in engine-owned files, including `server/__tests__/profile-persistence.test.js`. No out-of-scope formatter edits were made. Log: `/tmp/stove-source-research/model-check.log`.
- `npx tsc -b --pretty false`: only currently reported errors are unused imports (`prisms` and `profilePolyhedron`) in engine-owned `geometry/collisions.ts`. No model type errors.
- Scoped model lint: no errors, 18 non-null assertion/style warnings. These are recorded, not hidden by configuration changes.
- Fresh local Vite preview `http://127.0.0.1:4186/` (not deployment): Playwright desktop1440×1000 and mobile390×844 both open the stable showcase ID into a persisted guest copy with **33 courses / 1734 elements / 438 profile elements**, no page errors and no horizontal overflow. Screenshots `/tmp/stove-source-research/teplushka15-desktop-editor.png` and `teplushka15-mobile-editor.png`; report `/tmp/stove-source-research/model-preview-report.json`.
- Browser mode controls were deliberately not called passed: vertical-mouth type integration and true moving-blade apertures remain unverified. Static source thumbnail was not replaced by a screenshot of this unfinished integration.

Additional UI overlay export: `TEPLUSHKA_ROUTE_POINTS_MM` contains main/hob feed polylines, SIX independent descent branches, bottom collection path, summer branch, and upper hood branch. Coordinates use the same millimetre origin as `TEPLUSHKA_OPENINGS`; labels/directions are source explanations, not CFD.
