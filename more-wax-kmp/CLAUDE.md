# More'Wax KMP — Claude Code Handoff

## What this project is

More'Wax is a vinyl record collection manager. There is an existing **Python HTTP server** (in `../`) that serves a REST JSON API and a vanilla JS web app. This `more-wax-kmp/` directory is a **new Kotlin Multiplatform client** that talks to that same Python server. The web app stays as-is.

## Tech stack

- **Compose Multiplatform 1.10** for UI rendering
- **Circuit 0.33.1** (by Slack, `com.slack.circuit`) for Presenter + Ui architecture and navigation
- **Metro 0.10.2** (by Zac Sweers, `dev.zacsweers.metro`) for compile-time dependency injection
- **Ktor 3.4.0** for HTTP networking
- **Coil3** for image loading
- **Kotlinx Serialization** for JSON
- **Java 21** (SDKMAN: `sdk env install` reads `.sdkmanrc`)
- **Gradle 9.4** (wrapper already present)
- **Android SDK** at `/Users/homeserver/Library/Android/sdk`

## Project structure — single module

Everything is in one `composeApp` module with platform source sets:

```
composeApp/
└── src/
    ├── commonMain/kotlin/com/morewax/
    │   ├── App.kt                         ← Root composable, Circuit wiring
    │   ├── api/
    │   │   ├── ApiModels.kt               ← @Serializable DTOs matching server JSON
    │   │   └── MoreWaxClient.kt           ← Ktor HTTP client, all endpoints
    │   ├── di/
    │   │   └── AppGraph.kt                ← Metro @DependencyGraph + manual fallback
    │   ├── domain/
    │   │   ├── model/Record.kt            ← Domain model, SortOption enum
    │   │   └── repository/
    │   │       ├── RecordsRepository.kt   ← Collection CRUD
    │   │       └── DiscogsRepository.kt   ← Discogs search/release
    │   └── screens/
    │       ├── collection/                ← CollectionScreen + Presenter + Ui (grid)
    │       ├── detail/                    ← RecordDetailScreen + Presenter + Ui
    │       └── theme/MoreWaxTheme.kt      ← Dark blue color scheme
    ├── androidMain/
    │   ├── kotlin/com/morewax/android/MainActivity.kt
    │   ├── AndroidManifest.xml
    │   └── res/values/themes.xml
    ├── desktopMain/
    │   └── kotlin/com/morewax/desktop/Main.kt
    └── iosMain/
        └── kotlin/com/morewax/ios/MainViewController.kt
```

## Server API (Python backend at http://localhost:8765)

The KMP app is a client for this API. All responses are JSON.

### Collection CRUD
- `GET /api/collection` → `List<RecordDto>` (sorted by artist)
- `GET /api/collection/{id}` → `RecordDto`
- `POST /api/collection` → body: RecordDto → `{id, success}` or `{duplicate: true, existing: RecordDto}` (409)
- `PUT /api/collection/{id}` → body: partial fields → `{success}`
- `DELETE /api/collection/{id}` → `{success}`

### Discogs integration
- `GET /api/discogs/search?q=...` → `{results: [{id, title, year, label, format, cover_image, thumb}]}`
- `GET /api/discogs/search?barcode=...` → same shape
- `GET /api/discogs/release/{id}` → `ReleaseDto` (full release with prices, collection status)
- `GET /api/discogs/prices/{id}` → `{price_low, price_median, price_high, price_currency, num_for_sale}`
- `POST /api/discogs/add-to-collection/{id}` → `{success}`
- `POST /api/collection/refresh-prices` → `{updated, total_stale}`

### Image processing
- `POST /api/upload-cover` → body: `{image: base64, record_id}` → `{path, success}`
- `POST /api/convert-image` → body: `{image: base64}` → `{image: base64_jpeg, success}`
- `POST /api/identify-cover` → body: `{image: base64}` → `{success, artist, title, label, catalog_number, country, year, barcode, format_details}`

### Static
- `GET /covers/covers/{filename}` — cover image files

## Architecture patterns

### Circuit pattern (Screen → Presenter → Ui)

Each screen is a triple:
1. **Screen** — data object/class implementing `com.slack.circuit.runtime.screen.Screen`, contains `State` (implements `CircuitUiState` with `eventSink: (Event) -> Unit`) and `Event` sealed interface
2. **Presenter** — class implementing `Presenter<State>`, has a `@Composable present(): State` function that uses `remember`, `LaunchedEffect`, `rememberCoroutineScope` for state management
3. **Ui** — `@Composable` function receiving `(state: State, modifier: Modifier)`

Wired together in `App.kt` via `MoreWaxPresenterFactory` and `MoreWaxUiFactory`, passed to `Circuit.Builder()`.

Navigation uses `rememberSaveableBackStack(CollectionScreen)` + `rememberCircuitNavigator(backStack)` + `NavigableCircuitContent(navigator, backStack)`.

### Metro DI

`AppGraph` is annotated `@DependencyGraph` with `@Provides` methods. Currently has a `ManualAppGraph` fallback until Metro codegen is wired. Metro is a compiler plugin — no KSP/KAPT needed, just the Gradle plugin `dev.zacsweers.metro`.

### Ktor client

`MoreWaxClient` creates its own `HttpClient` with ContentNegotiation (JSON) and Logging plugins. Platform-specific engines: OkHttp (Android), Java (Desktop), Darwin (iOS).

## Current state — what's done

- Full Gradle setup (single module, all targets, version catalog)
- All API DTOs matching server JSON (`ApiModels.kt`)
- HTTP client with all endpoints (`MoreWaxClient.kt`)
- Domain model + repositories
- DI graph (Metro + manual fallback)
- **CollectionScreen** — grid of records with sort (artist/title/year/recent/price), filter, FAB
- **RecordDetailScreen** — full record view with cover, metadata, prices, genres/styles chips, delete with confirmation dialog
- Theme (dark blue palette matching web app)
- Platform entry points for Android, Desktop, iOS

## What needs to happen now

### Immediate: Get it compiling
1. Run `./gradlew :composeApp:desktopRun` — this is the fastest target to test
2. Fix any dependency resolution issues, API mismatches, or import errors
3. The Circuit and Metro APIs may have changed — check their docs if compilation fails:
   - Circuit: https://slackhq.github.io/circuit/
   - Metro: https://zacsweers.github.io/metro/latest/

### Common issues to watch for
- Circuit API may differ from what was written (check `Presenter.Factory.create` signature, `ui<State>` helper, `rememberSaveableBackStack` vs `rememberSaveableBackStack(root)`)
- Metro `@DependencyGraph` may need `@SingleIn(AppScope::class)` scope annotation
- Ktor 3.x has breaking changes from 2.x — make sure imports are from `io.ktor.client.*` not old paths
- `compose.materialIconsExtended` may need explicit opt-in

### Phase 2: Add record flow (not yet built)
- **SearchScreen** — text search Discogs, show results grid, select release
- **ConfirmScreen** — review release details, notes field, save to collection
- **MethodScreen** — choose: photo / barcode scan / text search
- **DuplicateScreen** — handle 409 duplicate response

### Phase 3: Camera & barcode (not yet built)
- Platform `expect`/`actual` for `BarcodeScanner` and `CameraProvider`
- Android: CameraX + ML Kit barcode
- iOS: AVFoundation + Vision framework
- Desktop: Webcam + ZXing

### Phase 4: Cover photo identification
- Photo capture → base64 → POST `/api/identify-cover` (server calls Claude Vision)
- Progressive Discogs search: barcode → catalog → artist+title → broad

## Build commands

```bash
cd ~/more-wax/more-wax-kmp
sdk env install                          # Java 21 via SDKMAN
./gradlew :composeApp:run                # Desktop (fastest to test)
./gradlew :composeApp:assembleDebug      # Android APK
```

## Key files to read first

1. `composeApp/build.gradle.kts` — all targets, dependencies, configs
2. `gradle/libs.versions.toml` — version catalog
3. `composeApp/src/commonMain/kotlin/com/morewax/App.kt` — Circuit wiring
4. `composeApp/src/commonMain/kotlin/com/morewax/api/MoreWaxClient.kt` — all API calls
5. `composeApp/src/commonMain/kotlin/com/morewax/screens/collection/` — example Circuit screen
