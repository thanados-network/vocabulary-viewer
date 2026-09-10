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
| `tree-endpoint`   | `http://127.0.0.1:5000/api/1/vocabulary/tree`            | URL of the vocabulary tree endpoint. Changing it reloads the tree.      |
| `detail-endpoint` | `http://127.0.0.1:5000/api/1/vocabulary/{id}`            | URL template for type details; `{id}` is replaced with the type id.     |
| `lang`            | `en`                                                             | UI language: `en` or `de`. Can be changed at runtime.                   |
| `bootstrap-url`   | `https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/.../bootstrap.min.css` | Bootstrap 5.3 stylesheet injected into the shadow root.             |
| `font-family`     | (CSS default)                                                    | Custom font family (e.g. `'Segoe UI', sans-serif`). Updates `--oa-font-family`. |
| `font-size`       | (CSS default: `1rem`)                                            | Base font size (e.g. `'14px'`, `'1rem'`, or number `14`). Updates `--oa-font-size`. |

### Public Methods

| Method                                      | Description                                                                                  |
|---------------------------------------------|----------------------------------------------------------------------------------------------|
| `loadTree()`                                | Fetches the tree from `tree-endpoint` and renders it. Returns a `Promise<void>`.             |
| `renderTree(data)`                          | Renders (or re-renders) the tree from externally supplied data — no network needed.          |
| `loadDetail(id)`                            | Fetches a type's detail, renders the detail panel, and dispatches `oa-vocabulary-selected`.  |
| `setLanguage(lang)`                         | Switches the UI language (`'en'` \| `'de'`) at runtime.                                       |
| `setFontFamily(fontFamily)`                 | Sets the font family at runtime (e.g. `'Roboto, sans-serif'`).                              |
| `setFontSize(fontSize)`                     | Sets the base font size at runtime (e.g. `'14px'`, `'1rem'`, or `14`).                       |
| `setFont({ fontFamily, fontSize })`         | Convenience helper to set font family and font size simultaneously.                          |

```js
const viewer = document.querySelector('openatlas-vocabulary-viewer');

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
  - Name, category, UUID with a **copy-to-clipboard** button
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

- **No client-side caching.** By design, caching is the host's responsibility (e.g. a Redis-backed
  proxy). Just point `tree-endpoint` / `detail-endpoint` at your proxy.
- **Clipboard** uses `navigator.clipboard` in secure contexts (HTTPS / `localhost`) and gracefully
  falls back otherwise.

---

## License

Released under the **MIT License**. See [`LICENSE`](./LICENSE).
