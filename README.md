# OpenAtlas Vocabulary Viewer

A native, framework-free **Web Component** (`<openatlas-vocabulary-viewer>`) that renders the
[OpenAtlas](https://openatlas.eu) type vocabulary as a searchable **master-detail browser**:
an expandable hierarchy tree on the left and a rich detail panel on the right.

- **Vanilla JS** (ES6 class, Custom Elements v1) — no React / Vue / jQuery.
- **Shadow DOM** for full CSS isolation.
- **Bootstrap 5.3** styling injected *inside* the shadow root, with colors, typography,
  and font sizing overridable from the host page via `--oa-*` CSS custom properties,
  HTML attributes, or JavaScript API for seamless Corporate Identity (CI) integration.
- **Bilingual UI** (English / German) via a `lang` attribute.
- **Configurable endpoints** so a host can point at its own caching proxy.
- Emits **custom events** so the host page can react to selections and errors.

---

## Setup & Usage

The component is a single self-contained file, `openatlas-vocabulary-viewer.js`. Include it as an
ES module and drop the custom element onto your page:

```html
<!-- Load the component -->
<script type="module" src="./openatlas-vocabulary-viewer.js"></script>

<!-- Use it -->
<openatlas-vocabulary-viewer
  lang="en"
  tree-endpoint="http://127.0.0.1:5000/api/1/vocabulary/tree"
  detail-endpoint="http://127.0.0.1:5000/api/1/vocabulary/{id}">
</openatlas-vocabulary-viewer>
```

On connection the component automatically fetches the tree and renders it. See `index.html` for a
full working demo (language switch, theming, custom endpoint, event log).

### Using a caching proxy

The tree endpoint returns a large payload. **This component does not cache** — caching is delegated
to the host application. A typical setup is a Flask app with a Redis-backed URL proxy; simply point
the component at your proxy URLs:

```html
<openatlas-vocabulary-viewer
  tree-endpoint="/api/proxy/vocabulary/tree"
  detail-endpoint="/api/proxy/vocabulary/{id}">
</openatlas-vocabulary-viewer>
```

The `{id}` placeholder in `detail-endpoint` is replaced with the selected type id.

---

## Styling & CSS Custom Properties

Because Shadow DOM blocks outer page CSS, Bootstrap is injected **into the shadow root**. Colors and
a few layout values are exposed via `--oa-*` custom properties, which pierce the shadow boundary and
can be set from the host page (inline, a class, or `:root`):

```css
openatlas-vocabulary-viewer {
  --oa-primary: #0d6efd;
  --oa-active-bg: #0d6efd;
  --oa-active-text: #ffffff;
  --oa-hover-bg: #e7f0ff;
}
```

| Custom property     | Default                                   | Purpose                                    |
|---------------------|-------------------------------------------|--------------------------------------------|
| `--oa-bg`           | `#ffffff`                                  | Component background                       |
| `--oa-text`         | `#212529`                                  | Primary text color                         |
| `--oa-muted`        | `#6c757d`                                  | Muted / secondary text (labels, hints)     |
| `--oa-primary`      | `#559f55`                                  | Primary accent (mapped to `--bs-primary`)  |
| `--oa-border`       | `#dee2e6`                                  | Borders and dividers                       |
| `--oa-hover-bg`     | `#f1f5f1`                                  | Tree row hover background                   |
| `--oa-active-bg`    | `#559f55`                                  | Selected node background                    |
| `--oa-active-text`  | `#ffffff`                                  | Selected node text                          |
| `--oa-link`         | `#2c6e2c`                                  | Link color                                  |
| `--oa-badge-bg`     | `#e7f1e7`                                  | Badge background (category / external refs) |
| `--oa-badge-text`   | `#2c6e2c`                                  | Badge text                                  |
| `--oa-class-badge-bg` | `var(--oa-hover-bg)`                     | Entity class badge background               |
| `--oa-class-badge-text` | `var(--oa-text)`                       | Entity class badge text                     |
| `--oa-font-family`  | `'Inter', system-ui, …`                    | Component font family (inherited by all child elements) |
| `--oa-font-size`    | `1rem`                                     | Base font size (headings, labels and controls scale proportionally) |
| `--oa-height`       | `600px`                                    | Overall component height                    |

You can also fully swap Bootstrap by pointing `bootstrap-url` at a different (Bootstrap-compatible)
stylesheet.

### Corporate Identity (CI) Customization

To apply your organization's Corporate Identity (typography, font sizing, brand colors), three interfaces are available:

#### 1. Via CSS Custom Properties (preferred in stylesheets)

```css
openatlas-vocabulary-viewer.my-brand {
  --oa-font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  --oa-font-size: 14px; /* All nested text & headings scale proportionally */
  --oa-primary: #7b1fa2;
  --oa-active-bg: #7b1fa2;
  --oa-active-text: #ffffff;
  --oa-link: #6a1b9a;
}
```

#### 2. Via HTML Attributes

```html
<openatlas-vocabulary-viewer
  font-family="'Segoe UI', Roboto, sans-serif"
  font-size="15px"
  lang="de">
</openatlas-vocabulary-viewer>
```

#### 3. Via JavaScript Properties & Methods

```javascript
const viewer = document.querySelector('openatlas-vocabulary-viewer');

// Using property setters:
viewer.fontFamily = 'Georgia, serif';
viewer.fontSize = '14px';

// Using individual methods:
viewer.setFontFamily('Georgia, serif');
viewer.setFontSize('14px'); // accepts strings ('14px', '1rem') or numbers (14 -> 14px)

// Using the combined helper method:
viewer.setFont({
  fontFamily: "'Segoe UI', Roboto, sans-serif",
  fontSize: '15px'
});
```

---

## API Reference

### Attributes

| Attribute         | Default                                                          | Description                                                             |
|-------------------|------------------------------------------------------------------|-------------------------------------------------------------------------|
| `tree-endpoint`   | `http://127.0.0.1:5000/api/1/vocabulary/tree`            | URL of the vocabulary tree endpoint. Overrides `DEFAULT_TREE_ENDPOINT`. Changing it reloads the tree. |
| `detail-endpoint` | `http://127.0.0.1:5000/api/1/vocabulary/{id}`            | URL template for type details; `{id}` is replaced with the type id. Overrides `DEFAULT_DETAIL_ENDPOINT`. |
| `bootstrap-url`   | `https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/.../bootstrap.min.css` | Bootstrap 5.3 stylesheet injected into the shadow root. Overrides `DEFAULT_BOOTSTRAP_URL`. |
| `lang`            | `en`                                                             | UI language: `en` or `de`. Can be changed at runtime.                   |
| `exclude-ids`     | `""`                                                             | Comma-separated or JSON array of IDs to ignore/exclude (e.g. `"209204, 213222"`). Mutually exclusive with `include-ids`. |
| `ignored-ids`     | `""`                                                             | Alias for `exclude-ids`.                                                |
| `include-ids`     | `""`                                                             | Comma-separated or JSON array of IDs to include (e.g. `"[209204, 213222]"`). Mutually exclusive with `exclude-ids`. |
| `included-ids`    | `""`                                                             | Alias for `include-ids`.                                                |
| `font-family`     | (CSS default)                                                    | Custom font family (e.g. `'Segoe UI', sans-serif`). Updates `--oa-font-family`. |
| `font-size`       | (CSS default: `1rem`)                                            | Base font size (e.g. `'14px'`, `'1rem'`, or number `14`). Updates `--oa-font-size`. |

### Public Methods & Properties

| Method / Property                           | Description                                                                                  |
|---------------------------------------------|----------------------------------------------------------------------------------------------|
| `loadTree()`                                | Fetches the tree from `tree-endpoint` and renders it. Returns a `Promise<void>`.             |
| `renderTree(data)`                          | Renders (or re-renders) the tree from externally supplied data — no network needed.          |
| `loadDetail(id)`                            | Fetches a type's detail, renders the detail panel, and dispatches `oa-vocabulary-selected`.  |
| `setIncludedIds(ids)`                       | Sets the list of IDs to include (`Array`, `Set`, comma-separated `string`, or `number`).     |
| `getIncludedIds()`                          | Returns the current array of included IDs (`number[]`).                                      |
| `addIncludedId(...ids)` / `addIncludedIds(...)` | Adds one or more IDs to the include list.                                                  |
| `removeIncludedId(...ids)` / `removeIncludedIds(...)` | Removes one or more IDs from the include list.                                         |
| `clearIncludedIds()`                        | Clears all included IDs.                                                                     |
| `isIncluded(id)`                            | Checks if a specific ID is configured as included.                                           |
| `includedIds` / `includeIds`                | Property accessors for getting / setting included IDs.                                       |
| `setIgnoredIds(ids)` / `setExcludeIds(ids)` | Sets the list of IDs to ignore/exclude.                                                      |
| `getIgnoredIds()` / `getExcludeIds()`       | Returns the current array of ignored/excluded IDs (`number[]`).                              |
| `addIgnoredId(...ids)` / `addIgnoredIds(...)` | Adds one or more IDs to the ignore/exclude list.                                            |
| `removeIgnoredId(...ids)` / `removeIgnoredIds(...)` | Removes one or more IDs from the ignore/exclude list.                                   |
| `clearIgnoredIds()` / `clearExcludeIds()`   | Clears all ignored/excluded IDs and restores visibility.                                    |
| `isIgnored(id)` / `isExcluded(id)`          | Checks if a specific ID is currently ignored/excluded.                                      |
| `ignoredIds` / `excludeIds`                 | Property accessors for getting / setting ignored/excluded IDs.                               |
| `isVisible(id)`                             | Checks if an ID is visible according to active filter rules.                                 |
| `clearFilters()`                            | Clears both inclusion and exclusion filters.                                                 |
| `setLanguage(lang)`                         | Switches the UI language (`'en'` \| `'de'`) at runtime.                                       |
| `setFontFamily(fontFamily)`                 | Sets the font family at runtime (e.g. `'Roboto, sans-serif'`).                              |
| `setFontSize(fontSize)`                     | Sets the base font size at runtime (e.g. `'14px'`, `'1rem'`, or `14`).                       |
| `setFont({ fontFamily, fontSize })`         | Convenience helper to set font family and font size simultaneously.                          |

```js
const viewer = document.querySelector('openatlas-vocabulary-viewer');

// Exclude top-level hierarchies or specific types and all their descendant subtrees:
viewer.setIgnoredIds([209204, 213222, 218845, 22777, 196063]);

// Add / remove dynamically:
viewer.addIgnoredIds(12345);
viewer.removeIgnoredIds(209204);

// Re-render the tree from your own data (e.g. server-rendered / cached):
viewer.renderTree({ standard: [...], place: [...], custom: [], value: [], system: [] });

// Programmatically open a type:
viewer.loadDetail(12);

// Switch language:
viewer.setLanguage('de');
```

### Events

All events bubble and are `composed` (they cross the shadow boundary).

| Event                    | `detail` payload                              | Fired when                                   |
|--------------------------|-----------------------------------------------|----------------------------------------------|
| `oa-tree-loaded`         | `{ data: VocabularyTreeResponse }`            | The tree has been fetched and rendered.      |
| `oa-vocabulary-selected` | `{ id: number, data: VocabularyFlatItem }`    | A type is selected and its detail loaded.    |
| `oa-vocabulary-error`    | `{ error: Error, context: 'tree'\|'detail' }` | A tree or detail fetch fails.                |

```js
viewer.addEventListener('oa-vocabulary-selected', (e) => {
  console.log('Selected type', e.detail.id, e.detail.data);
});

viewer.addEventListener('oa-vocabulary-error', (e) => {
  console.warn('Vocabulary error in', e.detail.context, e.detail.error);
});
```

---

## Filtering & Adapter API

The component provides two powerful, mutually exclusive filtering strategies to tailor the taxonomy displayed in the viewer:
- **Exclude (`exclude-ids` / `ignored-ids`)**: Hides targeted type IDs along with all their descendant subtrees from the hierarchy tree, breadcrumbs, and subtypes listings.
- **Include (`include-ids` / `included-ids`)**: Displays *only* the targeted type IDs (and their subtrees), keeping necessary ancestor branches navigable while pruning all unrelated categories and sibling nodes.

> **Mutual Exclusivity Rule:** `include-ids` and `exclude-ids` (`ignored-ids`) are **mutually exclusive**. Only one filtering mode can be active at a time. If both are specified on the component, passed to the adapter, or set simultaneously, an explicit `Error` is thrown.

### Example ID Lists

```javascript
// Example list to exclude or include:
const typeIds = [209204, 213222, 218845, 22777, 196063];
```

### 1. Web Component Declarative Attributes

Configure inclusion or exclusion directly in HTML:

```html
<!-- Exclude specific types and their descendants -->
<openatlas-vocabulary-viewer
  exclude-ids="[209204, 213222, 218845, 22777, 196063]"
  tree-endpoint="http://127.0.0.1:5000/api/1/vocabulary/tree"
  detail-endpoint="http://127.0.0.1:5000/api/1/vocabulary/{id}">
</openatlas-vocabulary-viewer>

<!-- OR Include only specific types and their subtrees -->
<openatlas-vocabulary-viewer
  include-ids="[209204, 213222]"
  tree-endpoint="http://127.0.0.1:5000/api/1/vocabulary/tree"
  detail-endpoint="http://127.0.0.1:5000/api/1/vocabulary/{id}">
</openatlas-vocabulary-viewer>
```

Accepts JSON arrays (`"[209204, 213222]"`), comma-separated strings (`"209204, 213222, 218845"`), or whitespace-delimited lists.

### 2. Web Component JavaScript API

Manage include and exclude filters dynamically on the custom element:

```javascript
import { OpenAtlasVocabularyViewer } from './openatlas-vocabulary-viewer.js';

const viewer = document.querySelector('openatlas-vocabulary-viewer');

// --- Inclusion Filtering ---
viewer.setIncludedIds([209204, 213222]);
viewer.addIncludedId(218845);
viewer.removeIncludedId(218845);
console.log(viewer.isIncluded(209204)); // true
viewer.clearIncludedIds();

// --- Exclusion Filtering ---
viewer.setIgnoredIds([209204, 213222, 218845, 22777, 196063]);
viewer.addIgnoredIds(22777);
viewer.removeIgnoredIds(22777);
console.log(viewer.isIgnored(209204)); // true
viewer.clearIgnoredIds();

// --- Mutual Exclusivity Error Example ---
try {
  viewer.setIncludedIds([100]);
  viewer.setIgnoredIds([200]); // Throws Error: mutually exclusive!
} catch (err) {
  console.error(err.message);
}
```

### 3. Standalone Adapter (`createVocabularyFilterAdapter`)

The module exports `createVocabularyFilterAdapter` for client-side use or backend proxies / middleware:

```javascript
import { createVocabularyFilterAdapter } from './openatlas-vocabulary-viewer.js';

// 1. Create an inclusion adapter:
const includeAdapter = createVocabularyFilterAdapter({ includeIds: [209204, 213222] });

// OR create an exclusion adapter:
const excludeAdapter = createVocabularyFilterAdapter({ excludeIds: [209204, 213222, 218845] });

// 2. Wrap standard fetch as a transparent interceptor/adapter:
const filteredFetch = includeAdapter.wrapFetch(window.fetch);

// 3. Direct data filtering:
const filteredTree = includeAdapter.filterTree(rawTreeData);
const filteredDetail = includeAdapter.filterDetail(rawDetailData);
```

### 4. Pure Functional Utilities

For lightweight data pipeline transformations:

```javascript
import {
  filterVocabularyTree,
  filterVocabularyItem,
  filterVocabularyDetail,
  parseIds
} from './openatlas-vocabulary-viewer.js';

// Include filter on tree payload:
const includedTree = filterVocabularyTree(treeResponse, { includeIds: [209204, 213222] });

// Exclude filter on tree payload:
const excludedTree = filterVocabularyTree(treeResponse, { excludeIds: [209204, 213222] });

// Filter detail payload:
const filteredDetail = filterVocabularyDetail(detailResponse, { includeIds: [209204] });
```

---

## Features

- **Hierarchy tree** grouped by the six vocabulary categories (Standard, Place, Custom, Value,
  Tools, System), with expandable / collapsible nodes. Branches are **rendered lazily** — a node's
  children are only built when it is expanded — so even very large trees (the live vocabulary has
  ~20,000 nodes) load and stay responsive.
- **Entity counts in the tree** — `entityCount` (direct entities) and `entityCountSubs` (descendant entities)
  are rendered as clear badges next to each tree item, allowing immediate identification of whether and how many
  entities are linked across the taxonomy.
- **Selectable vs. structural grouping nodes** — Types with `selectable: false` serve as category folders /
  grouping nodes and are visually highlighted with a folder icon and status badges, clearly indicating that entities
  cannot be directly assigned to them.
- **Interactive two-way hierarchy navigation** — Breadcrumbs are built from `parents` (`LinkedTypeItem`)
  and direct `subTypes` are displayed as interactive buttons; selecting any parent or child automatically navigates
  to that type and smoothly scrolls and expands to it in the tree.
- **Real-time search** — case-insensitive matching on type names and entity classes (evaluated against the loaded
  data), rendering only the matches and their ancestors fully expanded, and showing a localized
  "no results" state when nothing matches.
- **Rich detail panel** — fully compliant with the latest OpenAtlas OpenAPI schema:
  - Name, category, **copy-to-clipboard buttons** (Name, URL, UUID)
  - **Concept download dropdown** for Linked Open Data export (JSON-LD, Turtle, RDF/XML, N-Triples)
  - Selectable status badge (`Assignable` / `Structural node (not assignable)`) and entity counts
  - Entity classes (`classes`) showing which classes the type can be assigned to (e.g. `artifact`, `place`)
  - Direct sub-types list (`subTypes`) with click-to-open
  - Temporal validity / usage period (`timespan` with start, end dates and derivation notes)
  - Description with line break preservation
  - External authority references with direct entity links (`url`), match type (`match_type`), and descriptions
  - Bibliographic citations with automatic clickable URL linkification
  - Primary image with link to full-resolution file, creator/copyright, and license attribution
- **Robust error handling** — failed fetches show an in-component error state (with retry for the
  tree) and fire `oa-vocabulary-error`; the UI stays usable.

### Notes

- **Endpoints & Defaults:** `DEFAULT_TREE_ENDPOINT`, `DEFAULT_DETAIL_ENDPOINT`, and `DEFAULT_BOOTSTRAP_URL` are fallback defaults that can be overridden per instance via HTML attributes (`tree-endpoint`, `detail-endpoint`, `bootstrap-url`) or properties. `CATEGORY_ORDER` defines the standard OpenAtlas category sequence (`['standard', 'place', 'custom', 'value', 'tools', 'system']`).
- **No client-side caching:** By design, caching is the host's responsibility (e.g. a Redis-backed proxy). Just point `tree-endpoint` / `detail-endpoint` at your proxy or feed data directly via `renderTree(data)`.
- **Clipboard:** Uses `navigator.clipboard` in secure contexts (HTTPS / `localhost`) and gracefully falls back to `document.execCommand` otherwise.

---

## Integration in Multiple Websites

If you want to use this component across multiple websites/projects, choose the integration approach that best fits your workflow:

### Option 1: Direct Git Dependency via `npm` / `package.json` (Recommended for modern web apps)
You do not even need to publish to public npm; npm/yarn/pnpm can install directly from GitHub:
```bash
npm install git+https://github.com/<owner>/vocabulary-viewer.git
# or pin to a specific branch/tag/commit:
npm install git+https://github.com/<owner>/vocabulary-viewer.git#v1.0.0
```
Then import it in your build setup (Vite, Webpack, Rollup, etc.):
```javascript
import 'openatlas-vocabulary-viewer';
```

### Option 2: Publish as an npm Package (`@openatlas/vocabulary-viewer`)
Best for versioned releases and CI/CD pipelines:
1. Initialize/maintain `package.json` in this repository with `"main": "openatlas-vocabulary-viewer.js"`.
2. Publish to npm (`npm publish`) or GitHub Packages.
3. In both client websites: `npm install @openatlas/vocabulary-viewer`.

### Option 3: Git Submodule or Subtree (Best for monorepos or multi-repo vendoring)
Add this repository as a submodule in each website's repository:
```bash
git submodule add https://github.com/<owner>/vocabulary-viewer.git vendor/vocabulary-viewer
```
Include the script in HTML:
```html
<script type="module" src="/vendor/vocabulary-viewer/openatlas-vocabulary-viewer.js"></script>
```
Updates can be pulled in each website with `git submodule update --remote`.

### Option 4: CDN / Static Hosting (Simplest for static / CMS sites)
Host `openatlas-vocabulary-viewer.js` on a shared server, CDN (such as jsDelivr/unpkg via GitHub release/npm tag), or reverse-proxy:
```html
<script type="module" src="https://cdn.example.org/js/openatlas-vocabulary-viewer.js"></script>
```

---

## License

Released under the **MIT License**. See [`LICENSE`](./LICENSE).
