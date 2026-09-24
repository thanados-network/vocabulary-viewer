# OpenAtlas Vocabulary Viewer

A native, framework-free **Web Component** (`<openatlas-vocabulary-viewer>`) that renders the
[OpenAtlas](https://openatlas.eu) type vocabulary as a searchable **master-detail browser**:
an expandable hierarchy tree on the left and a rich detail panel on the right.

- **Vanilla JS** (ES6 class, Custom Elements v1) — no React / Vue / jQuery.
- **Shadow DOM** for full CSS isolation.
- **Bootstrap 5.3** styling injected *inside* the shadow root, with colors overridable from the
  host page via `--oa-*` CSS custom properties.
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
  tree-endpoint="https://thanados.openatlas.eu/api/1/vocabulary/tree"
  detail-endpoint="https://thanados.openatlas.eu/api/1/vocabulary/{id}">
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
| `--oa-font-family`  | `'Inter', system-ui, …`                    | Component font family                       |
| `--oa-height`       | `600px`                                    | Overall component height                    |

You can also fully swap Bootstrap by pointing `bootstrap-url` at a different (Bootstrap-compatible)
stylesheet.

---

## API Reference

### Attributes

| Attribute         | Default                                                          | Description                                                             |
|-------------------|------------------------------------------------------------------|-------------------------------------------------------------------------|
| `tree-endpoint`   | `https://thanados.openatlas.eu/api/1/vocabulary/tree`            | URL of the vocabulary tree endpoint. Changing it reloads the tree.      |
| `detail-endpoint` | `https://thanados.openatlas.eu/api/1/vocabulary/{id}`            | URL template for type details; `{id}` is replaced with the type id.     |
| `lang`            | `en`                                                             | UI language: `en` or `de`. Can be changed at runtime.                   |
| `bootstrap-url`   | `https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/.../bootstrap.min.css` | Bootstrap 5.3 stylesheet injected into the shadow root.             |

### Public Methods

| Method                 | Description                                                                                  |
|------------------------|----------------------------------------------------------------------------------------------|
| `loadTree()`           | Fetches the tree from `tree-endpoint` and renders it. Returns a `Promise<void>`.             |
| `renderTree(data)`     | Renders (or re-renders) the tree from externally supplied data — no network needed.          |
| `loadDetail(id)`       | Fetches a type's detail, renders the detail panel, and dispatches `oa-vocabulary-selected`.  |
| `setLanguage(lang)`    | Switches the UI language (`'en'` \| `'de'`) at runtime.                                       |

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
- **Real-time search** — case-insensitive matching on type names (evaluated against the loaded
  data), rendering only the matches and their ancestors fully expanded, and showing a localized
  "no results" state when nothing matches.
- **Detail panel** — name, category, **copy-to-clipboard buttons** (Name, URL, UUID),
  **concept download dropdown** (JSON-LD, Turtle, RDF/XML, N-Triples), description,
  external references as linked badges (Wikidata, Getty AAT, translations, …), bibliography, and an
  image thumbnail. Empty sections are omitted automatically.
- **Interactive breadcrumb** path derived from the type's ancestors with clickable navigation links.
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
