/**
 * OpenAtlas Vocabulary Viewer
 * ---------------------------
 * A native, framework-free Web Component (Custom Element v1 + Shadow DOM) that
 * renders the OpenAtlas type vocabulary as a searchable master-detail browser:
 * an expandable hierarchy tree on the left and a detail panel on the right.
 *
 * Styling is provided by Bootstrap 5.3 injected into the shadow root and is
 * themable from the host page via `--oa-*` CSS custom properties (they pierce
 * the shadow boundary). The UI is bilingual (English / German) via the `lang`
 * attribute. No client-side caching is performed: point `tree-endpoint` /
 * `detail-endpoint` at a caching proxy if needed.
 *
 * @module openatlas-vocabulary-viewer
 * @license MIT
 *
 * @fires oa-tree-loaded        {detail:{data:VocabularyTreeResponse}}
 * @fires oa-vocabulary-selected {detail:{id:number,data:VocabularyFlatItem}}
 * @fires oa-vocabulary-error   {detail:{error:Error,context:string}}
 */

/** Default OpenAtlas endpoints (overridable via attributes). */
const DEFAULT_TREE_ENDPOINT = 'https://thanados.openatlas.eu/api/1/vocabulary/tree';
const DEFAULT_DETAIL_ENDPOINT = 'https://thanados.openatlas.eu/api/1/vocabulary/{id}';
const DEFAULT_BOOTSTRAP_URL = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css';

/** The vocabulary categories returned by the tree endpoint, in display order. */
const CATEGORY_ORDER = ['standard', 'place', 'custom', 'value', 'tools', 'system'];

/**
 * All user-facing strings, keyed by language code.
 * @type {{en:Object<string,string>, de:Object<string,string>}}
 */
const LABELS = {
  en: {
    title: 'OpenAtlas Vocabulary',
    searchPlaceholder: 'Search types…',
    loading: 'Loading…',
    noResults: 'No matching types found.',
    emptyDetail: 'No type selected',
    emptyDetailHint: 'Select a type from the tree to see its details.',
    category: 'Category',
    uuid: 'UUID',
    name: 'Name',
    url: 'URL',
    copy: 'Copy',
    copyUuid: 'Copy UUID',
    copyUrl: 'Copy URL',
    copyName: 'Copy Name',
    copied: 'Copied!',
    copyFailed: 'Copy failed',
    downloadConcept: 'Download this concept',
    formatJsonLd: 'JSON-LD',
    formatTurtle: 'Turtle',
    formatRdfXml: 'RDF/XML',
    formatNTriples: 'N-Triples',
    description: 'Description',
    externalReferences: 'External references',
    bibliography: 'Bibliography',
    image: 'Image',
    treeError: 'Failed to load the vocabulary tree.',
    detailError: 'Failed to load the type details.',
    retry: 'Retry',
    subtypes: 'Subtypes',
    entities: 'Entities',
    categories: {
      standard: 'Standard', place: 'Place', custom: 'Custom', value: 'Value', tools: 'Tools', system: 'System'
    }
  },
  de: {
    title: 'OpenAtlas Vokabular',
    searchPlaceholder: 'Typen suchen…',
    loading: 'Wird geladen…',
    noResults: 'Keine passenden Typen gefunden.',
    emptyDetail: 'Kein Typ ausgewählt',
    emptyDetailHint: 'Wählen Sie einen Typ im Baum aus, um Details zu sehen.',
    category: 'Kategorie',
    uuid: 'UUID',
    name: 'Name',
    url: 'URL',
    copy: 'Kopieren',
    copyUuid: 'UUID kopieren',
    copyUrl: 'URL kopieren',
    copyName: 'Name kopieren',
    copied: 'Kopiert!',
    copyFailed: 'Kopieren fehlgeschlagen',
    downloadConcept: 'Konzept herunterladen',
    formatJsonLd: 'JSON-LD',
    formatTurtle: 'Turtle',
    formatRdfXml: 'RDF/XML',
    formatNTriples: 'N-Triples',
    description: 'Beschreibung',
    externalReferences: 'Externe Verweise',
    bibliography: 'Bibliografie',
    image: 'Bild',
    treeError: 'Der Vokabularbaum konnte nicht geladen werden.',
    detailError: 'Die Typdetails konnten nicht geladen werden.',
    retry: 'Erneut versuchen',
    subtypes: 'Untertypen',
    entities: 'Entitäten',
    categories: {
      standard: 'Standard', place: 'Ort', custom: 'Benutzerdefiniert', value: 'Wert', tools: 'Werkzeuge', system: 'System'
    }
  }
};

/**
 * Shared, lazily-created Bootstrap stylesheet keyed by URL so that multiple
 * component instances on the same page do not each re-fetch/parse Bootstrap.
 * Uses a Constructable Stylesheet when supported; otherwise falls back to a
 * per-shadow-root `<link>`.
 * @type {Map<string, CSSStyleSheet>}
 */
const SHARED_BOOTSTRAP_SHEETS = new Map();

/** Escape a string for safe insertion into HTML. @param {*} value @returns {string} */
function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * `<openatlas-vocabulary-viewer>` custom element.
 * @element openatlas-vocabulary-viewer
 */
class OpenAtlasVocabularyViewer extends HTMLElement {
  /** Attributes that trigger {@link attributeChangedCallback}. */
  static get observedAttributes() {
    return ['tree-endpoint', 'detail-endpoint', 'lang', 'bootstrap-url'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    /** @type {VocabularyTreeResponse|null} Last rendered tree data. */
    this._treeData = null;
    /** @type {number|null} Currently selected type id. */
    this._activeId = null;
    /** @type {boolean} Whether Bootstrap has been injected already. */
    this._bootstrapInjected = false;

    this.shadowRoot.innerHTML = this.#skeleton();
  }

  /* ---------------------------------------------------------------------- */
  /* Attribute accessors                                                    */
  /* ---------------------------------------------------------------------- */

  /** @returns {string} Configured tree endpoint URL. */
  get treeEndpoint() {
    return this.getAttribute('tree-endpoint') || DEFAULT_TREE_ENDPOINT;
  }

  /** @returns {string} Configured detail endpoint URL template (with `{id}`). */
  get detailEndpoint() {
    return this.getAttribute('detail-endpoint') || DEFAULT_DETAIL_ENDPOINT;
  }

  /** @returns {string} Configured Bootstrap stylesheet URL. */
  get bootstrapUrl() {
    return this.getAttribute('bootstrap-url') || DEFAULT_BOOTSTRAP_URL;
  }

  /** @returns {'en'|'de'} Active UI language (defaults to `en`). */
  get lang() {
    const l = (this.getAttribute('lang') || 'en').toLowerCase();
    return l === 'de' ? 'de' : 'en';
  }

  /** @returns {Object<string,string>} Active label set. */
  get #labels() {
    return LABELS[this.lang];
  }

  /**
   * Base API origin/path extracted from detail/tree endpoints for LOD & export links.
   * @returns {string}
   */
  get #apiBase() {
    const ep = this.detailEndpoint || this.treeEndpoint || DEFAULT_DETAIL_ENDPOINT;
    const replaced = ep.replace(/\/vocabulary(\/.*)?$/, '');
    if (replaced !== ep) return replaced;
    return ep.replace(/\/+$/, '');
  }

  /* ---------------------------------------------------------------------- */
  /* Lifecycle                                                              */
  /* ---------------------------------------------------------------------- */

  connectedCallback() {
    this.#injectBootstrap();
    this.#applyStaticLabels();

    const search = this.shadowRoot.getElementById('search');
    if (search && !this._searchWired) {
      search.addEventListener('input', (e) => this.#filterTree(e.target.value));
      this._searchWired = true;
    }

    if (!this._dismissWired) {
      this.shadowRoot.addEventListener('click', (e) => {
        if (!e.target.closest('.oa-download-dropdown')) {
          this.shadowRoot.querySelectorAll('.oa-download-dropdown.show').forEach((el) => {
            el.classList.remove('show');
            el.querySelector('.oa-btn-download')?.setAttribute('aria-expanded', 'false');
          });
        }
      });
      this.shadowRoot.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.shadowRoot.querySelectorAll('.oa-download-dropdown.show').forEach((el) => {
            el.classList.remove('show');
            el.querySelector('.oa-btn-download')?.setAttribute('aria-expanded', 'false');
          });
        }
      });
      this._dismissWired = true;
    }

    // Load the tree only once when first connected.
    if (!this._treeData) {
      this.loadTree();
    }
  }

  /**
   * React to observed attribute changes.
   * @param {string} name
   * @param {string|null} oldValue
   * @param {string|null} newValue
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (!this.isConnected) return;

    switch (name) {
      case 'lang':
        this.#applyStaticLabels();
        // Re-render detail (labels inside it) and tree category headers.
        if (this._treeData) this.renderTree(this._treeData);
        break;
      case 'bootstrap-url':
        this._bootstrapInjected = false;
        this.#injectBootstrap();
        break;
      case 'tree-endpoint':
        this.loadTree();
        break;
      default:
        break;
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Public API                                                             */
  /* ---------------------------------------------------------------------- */

  /**
   * Switch the UI language at runtime.
   * @param {'en'|'de'} lang
   * @returns {void}
   */
  setLanguage(lang) {
    this.setAttribute('lang', lang === 'de' ? 'de' : 'en');
  }

  /**
   * Fetch the vocabulary tree from the configured endpoint and render it.
   * @returns {Promise<void>}
   * @fires oa-tree-loaded
   * @fires oa-vocabulary-error
   */
  async loadTree() {
    const container = this.shadowRoot.getElementById('tree-container');
    if (container) container.innerHTML = this.#spinner();

    try {
      const res = await fetch(this.treeEndpoint, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status} while loading tree`);
      const data = await res.json();
      this.renderTree(data);
      this.dispatchEvent(new CustomEvent('oa-tree-loaded', {
        bubbles: true, composed: true, detail: { data }
      }));
    } catch (error) {
      this.#showTreeError(error);
      this.#emitError(error, 'tree');
    }
  }

  /**
   * Render (or re-render) the tree from externally supplied data. This is
   * network-independent and can be driven by a host that supplies its own data.
   * @param {VocabularyTreeResponse} data
   * @returns {void}
   */
  renderTree(data) {
    this._treeData = data;
    const container = this.shadowRoot.getElementById('tree-container');
    if (!container) return;

    container.innerHTML = '';
    const frag = document.createDocumentFragment();

    let total = 0;
    for (const category of CATEGORY_ORDER) {
      const items = Array.isArray(data?.[category]) ? data[category] : [];
      if (!items.length) continue;
      total += items.length;
      frag.appendChild(this.#renderCategory(category, items));
    }

    if (total === 0) {
      container.innerHTML = `<div class="oa-empty text-body-secondary p-3">${esc(this.#labels.noResults)}</div>`;
      return;
    }

    container.appendChild(frag);

    // Re-apply active highlight if a node is still selected.
    if (this._activeId != null) this.#highlightActive(this._activeId);
    // Re-apply any active filter.
    const search = this.shadowRoot.getElementById('search');
    if (search && search.value) this.#filterTree(search.value);
  }

  /**
   * Fetch a type's detail, render the detail panel and dispatch the selection
   * event.
   * @param {number} id
   * @returns {Promise<void>}
   * @fires oa-vocabulary-selected
   * @fires oa-vocabulary-error
   */
  async loadDetail(id) {
    const panel = this.shadowRoot.getElementById('detail-panel');
    if (panel) panel.innerHTML = this.#spinner();

    this._activeId = id;
    this.#highlightActive(id);

    try {
      const url = this.detailEndpoint.replace('{id}', encodeURIComponent(id));
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status} while loading detail ${id}`);
      const data = await res.json();
      this.#renderDetail(data);
      this.dispatchEvent(new CustomEvent('oa-vocabulary-selected', {
        bubbles: true, composed: true, detail: { id, data }
      }));
    } catch (error) {
      this.#showDetailError(error);
      this.#emitError(error, 'detail');
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Tree rendering                                                         */
  /* ---------------------------------------------------------------------- */

  /**
   * Render one category block with its top-level nodes.
   * @param {string} category
   * @param {VocabularyTreeItem[]} items
   * @returns {HTMLElement}
   */
  #renderCategory(category, items) {
    const section = document.createElement('div');
    section.className = 'oa-category';
    section.dataset.category = category;

    const heading = document.createElement('div');
    heading.className = 'oa-category-title';
    heading.textContent = this.#labels.categories[category] || category;
    section.appendChild(heading);

    const ul = document.createElement('ul');
    ul.className = 'oa-tree list-unstyled mb-0';
    for (const item of items) {
      ul.appendChild(this.#renderNode(item, 0));
    }
    section.appendChild(ul);
    return section;
  }

  /**
   * Render a single tree node. Child nodes are built lazily on first expand to
   * keep the initial render fast even for very large trees (tens of thousands
   * of nodes). Pass `expand = true` to build and expand the whole subtree
   * eagerly (used by the search/filter view, where the match set is small).
   * @param {VocabularyTreeItem} item
   * @param {number} depth
   * @param {boolean} [expand=false]
   * @returns {HTMLElement}
   */
  #renderNode(item, depth, expand = false) {
    const li = document.createElement('li');
    li.className = 'oa-node';
    li.dataset.id = item.id;
    li.dataset.name = (item.name || '').toLowerCase();

    const row = document.createElement('div');
    row.className = 'oa-node-row';
    row.style.setProperty('--oa-depth', String(depth));

    const hasChildren = Array.isArray(item.children) && item.children.length > 0;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'oa-toggle';
    toggle.setAttribute('aria-label', 'toggle');
    if (hasChildren) {
      toggle.textContent = expand ? '▾' : '▸';
      toggle.dataset.expanded = String(expand);
    } else {
      toggle.classList.add('oa-toggle-empty');
      toggle.textContent = '';
      toggle.disabled = true;
    }
    row.appendChild(toggle);

    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'oa-label';
    label.textContent = item.name || `#${item.id}`;
    row.appendChild(label);

    li.appendChild(row);

    if (hasChildren) {
      const childUl = document.createElement('ul');
      childUl.className = 'oa-tree list-unstyled';
      childUl.hidden = !expand;
      li.appendChild(childUl);

      // Stash the child data so it can be built lazily on first expand.
      li._childItems = item.children;
      li._childDepth = depth + 1;
      li._built = false;

      if (expand) {
        const frag = document.createDocumentFragment();
        for (const child of item.children) {
          frag.appendChild(this.#renderNode(child, depth + 1, true));
        }
        childUl.appendChild(frag);
        li._built = true;
      }

      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const nowExpanded = toggle.dataset.expanded !== 'true';
        toggle.dataset.expanded = String(nowExpanded);
        toggle.textContent = nowExpanded ? '▾' : '▸';
        if (nowExpanded) this.#buildChildren(li);
        childUl.hidden = !nowExpanded;
      });
    }

    label.addEventListener('click', (e) => {
      e.stopPropagation();
      this.loadDetail(item.id);
    });

    return li;
  }

  /**
   * Build the (previously deferred) direct children of a node on first expand.
   * @param {HTMLElement} li
   * @returns {void}
   */
  #buildChildren(li) {
    if (!li || li._built) return;
    const childUl = li.querySelector(':scope > ul.oa-tree');
    if (!childUl || !Array.isArray(li._childItems)) return;
    const frag = document.createDocumentFragment();
    for (const child of li._childItems) {
      frag.appendChild(this.#renderNode(child, li._childDepth));
    }
    childUl.appendChild(frag);
    li._built = true;
  }

  /** Mark the node with the given id active, expand ancestors, and clear previous highlight. @param {number} id */
  #highlightActive(id) {
    this.#revealInTree(id);
    this.shadowRoot.querySelectorAll('.oa-node-row.active')
      .forEach((el) => el.classList.remove('active'));
    const li = this.shadowRoot.querySelector(`.oa-node[data-id="${CSS.escape(String(id))}"]`);
    if (li) {
      const row = li.querySelector(':scope > .oa-node-row');
      if (row) {
        row.classList.add('active');
        row.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }

  /**
   * Ensure all ancestor tree nodes of the given id are expanded in the DOM.
   * @param {number} id
   */
  #revealInTree(id) {
    const ancestors = this.#findAncestorPath(id);
    for (const anc of ancestors) {
      const li = this.shadowRoot.querySelector(`.oa-node[data-id="${CSS.escape(String(anc.id))}"]`);
      if (li) {
        const toggle = li.querySelector(':scope > .oa-node-row > .oa-toggle');
        const childUl = li.querySelector(':scope > ul.oa-tree');
        if (toggle && toggle.dataset.expanded !== 'true') {
          toggle.dataset.expanded = 'true';
          toggle.textContent = '▾';
          this.#buildChildren(li);
          if (childUl) childUl.hidden = false;
        }
      }
    }
  }

  /**
   * Find the path of ancestor nodes leading to the given id in the loaded tree.
   * @param {number} id
   * @returns {Array<{id: number, name: string}>}
   */
  #findAncestorPath(id) {
    if (!this._treeData) return [];
    for (const cat of CATEGORY_ORDER) {
      const roots = Array.isArray(this._treeData[cat]) ? this._treeData[cat] : [];
      for (const root of roots) {
        const path = [];
        if (this.#searchTreePath(root, id, path)) {
          path.pop(); // remove target node itself
          return path;
        }
      }
    }
    return [];
  }

  /**
   * Recursive tree path search helper.
   * @param {VocabularyTreeItem} node
   * @param {number} targetId
   * @param {Array<{id: number, name: string}>} currentPath
   * @returns {boolean}
   */
  #searchTreePath(node, targetId, currentPath) {
    currentPath.push({ id: node.id, name: node.name || `#${node.id}` });
    if (node.id === targetId) {
      return true;
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        if (this.#searchTreePath(child, targetId, currentPath)) {
          return true;
        }
      }
    }
    currentPath.pop();
    return false;
  }

  /* ---------------------------------------------------------------------- */
  /* Search / filter                                                        */
  /* ---------------------------------------------------------------------- */

  /**
   * Filter the tree by a case-insensitive name match. The filter runs against
   * the loaded data model (not the DOM), so it works even though the tree is
   * rendered lazily. Matching nodes and their ancestors are rendered fully
   * expanded; an empty query restores the normal lazy tree. A localized
   * "no results" state is shown when nothing matches.
   * @param {string} query
   * @returns {void}
   */
  #filterTree(query) {
    const container = this.shadowRoot.getElementById('tree-container');
    if (!container) return;

    const q = (query || '').trim().toLowerCase();

    if (!q) {
      // Restore the normal (collapsed, lazily-rendered) tree.
      if (this._treeData) this.renderTree(this._treeData);
      return;
    }
    if (!this._treeData) return;

    container.innerHTML = '';
    const frag = document.createDocumentFragment();
    let anyMatch = false;

    for (const category of CATEGORY_ORDER) {
      const items = Array.isArray(this._treeData?.[category]) ? this._treeData[category] : [];
      const pruned = this.#pruneItems(items, q);
      if (!pruned.length) continue;
      anyMatch = true;

      const section = document.createElement('div');
      section.className = 'oa-category';
      section.dataset.category = category;
      const heading = document.createElement('div');
      heading.className = 'oa-category-title';
      heading.textContent = this.#labels.categories[category] || category;
      section.appendChild(heading);
      const ul = document.createElement('ul');
      ul.className = 'oa-tree list-unstyled mb-0';
      for (const item of pruned) {
        ul.appendChild(this.#renderNode(item, 0, true));
      }
      section.appendChild(ul);
      frag.appendChild(section);
    }

    if (!anyMatch) {
      container.innerHTML =
        `<div class="oa-no-results text-body-secondary p-3">${esc(this.#labels.noResults)}</div>`;
      return;
    }

    container.appendChild(frag);
    if (this._activeId != null) this.#highlightActive(this._activeId);
  }

  /**
   * Return a pruned copy of the given items, keeping only nodes that match the
   * query by name or that have a descendant which matches. Used to build the
   * (small) filtered subtree that the search view renders.
   * @param {VocabularyTreeItem[]} items
   * @param {string} q Lower-cased query.
   * @returns {VocabularyTreeItem[]}
   */
  #pruneItems(items, q) {
    if (!Array.isArray(items)) return [];
    const out = [];
    for (const item of items) {
      const children = this.#pruneItems(item.children, q);
      const selfMatch = (item.name || '').toLowerCase().includes(q);
      if (selfMatch || children.length) {
        out.push({ ...item, children });
      }
    }
    return out;
  }

  /* ---------------------------------------------------------------------- */
  /* Detail rendering                                                       */
  /* ---------------------------------------------------------------------- */

  /**
   * Render the detail panel for a flat vocabulary item.
   * @param {VocabularyFlatItem} item
   * @returns {void}
   */
  #renderDetail(item) {
    const panel = this.shadowRoot.getElementById('detail-panel');
    if (!panel) return;
    const L = this.#labels;

    const parts = [];

    const crumb = this.#renderBreadcrumb(item);
    const conceptUrl = item.uuid
      ? `${this.#apiBase}/entity/${item.uuid}`
      : `${this.#apiBase}/vocabulary/${item.id}`;
    const downloadBase = item.uuid
      ? `${this.#apiBase}/entity/${item.uuid}`
      : `${this.#apiBase}/vocabulary/${item.id}`;

    // Top action bar: breadcrumb on left, copy & download action buttons on right.
    parts.push(`
      <div class="oa-detail-top d-flex justify-content-between align-items-start gap-2 mb-2 flex-wrap">
        <div class="oa-breadcrumb-wrap flex-grow-1">
          ${crumb}
        </div>
        <div class="oa-detail-actions d-flex flex-wrap gap-1 align-items-center">
          <button type="button" class="btn btn-sm oa-copy-btn" data-copy="${esc(item.name)}" title="${esc(L.copyName)}: ${esc(item.name)}">
            <span class="oa-copy-icon" aria-hidden="true">\u29c9</span> ${esc(L.copyName)}
          </button>
          <button type="button" class="btn btn-sm oa-copy-btn" data-copy="${esc(conceptUrl)}" title="${esc(L.copyUrl)}: ${esc(conceptUrl)}">
            <span class="oa-copy-icon" aria-hidden="true">\u29c9</span> ${esc(L.copyUrl)}
          </button>
          ${item.uuid ? `
          <button type="button" class="btn btn-sm oa-copy-btn" data-copy="${esc(item.uuid)}" title="${esc(L.uuid)}: ${esc(item.uuid)}">
            <span class="oa-copy-icon" aria-hidden="true">\u29c9</span> ${esc(L.copyUuid)}
          </button>
          ` : ''}
          ${item.uuid ? `
          <div class="dropdown oa-download-dropdown d-inline-block">
            <button class="btn btn-sm oa-btn-download dropdown-toggle" type="button" aria-expanded="false" title="${esc(L.downloadConcept)}">
              <span class="oa-download-icon" aria-hidden="true">\u2913</span> ${esc(L.downloadConcept)}
            </button>
            <ul class="dropdown-menu dropdown-menu-end oa-download-menu">
              <li><a class="dropdown-item small" href="${esc(downloadBase + '.json')}" target="_blank" download="${esc(item.name || item.uuid)}.json" rel="noopener noreferrer">${esc(L.formatJsonLd)} (.json)</a></li>
              <li><a class="dropdown-item small" href="${esc(downloadBase + '.ttl')}" target="_blank" download="${esc(item.name || item.uuid)}.ttl" rel="noopener noreferrer">${esc(L.formatTurtle)} (.ttl)</a></li>
              <li><a class="dropdown-item small" href="${esc(downloadBase + '.xml')}" target="_blank" download="${esc(item.name || item.uuid)}.xml" rel="noopener noreferrer">${esc(L.formatRdfXml)} (.xml)</a></li>
              <li><a class="dropdown-item small" href="${esc(downloadBase + '.nt')}" target="_blank" download="${esc(item.name || item.uuid)}.nt" rel="noopener noreferrer">${esc(L.formatNTriples)} (.nt)</a></li>
            </ul>
          </div>
          ` : ''}
        </div>
      </div>
    `);

    // Header: title + category badge.
    const catName = item.category ? (L.categories[item.category] || item.category) : '';
    parts.push(`
      <div class="oa-detail-header">
        <h2 class="oa-detail-title h4 mb-1">${esc(item.name)}</h2>
        ${catName ? `<span class="badge oa-badge">${esc(catName)}</span>` : ''}
        ${item.count != null ? `<span class="badge text-bg-light ms-1">${L.entities}: ${esc(item.count)}</span>` : ''}
        ${item.countSubs != null ? `<span class="badge text-bg-light ms-1">${L.subtypes}: ${esc(item.countSubs)}</span>` : ''}
      </div>
    `);

    // Image (shown here, where the UUID field used to be).
    const image = this.#renderImage(item.image);
    if (image) parts.push(image);

    // Description.
    if (item.description) {
      parts.push(`
        <div class="oa-section mt-3">
          <label class="oa-field-label">${esc(L.description)}</label>
          <p class="oa-description mb-0">${esc(item.description)}</p>
        </div>
      `);
    }

    // External references.
    const extRefs = this.#renderExternalReferences(item.externalReferences);
    if (extRefs) parts.push(extRefs);

    // Bibliography.
    const biblio = this.#renderBibliography(item.references);
    if (biblio) parts.push(biblio);

    panel.innerHTML = `<div class="oa-detail p-3 position-relative">${parts.join('')}</div>`;

    // Breadcrumb navigation click handlers.
    panel.querySelectorAll('.oa-breadcrumb-link').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const id = Number(link.dataset.id);
        if (id) {
          this.loadDetail(id);
        }
      });
    });

    // Copy buttons click handlers.
    panel.querySelectorAll('.oa-copy-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.copy;
        if (val) this.#copyValue(val, btn);
      });
    });

    // Download dropdown toggle handler.
    const downloadDropdown = panel.querySelector('.oa-download-dropdown');
    if (downloadDropdown) {
      const toggle = downloadDropdown.querySelector('.oa-btn-download');
      if (toggle) {
        toggle.addEventListener('click', (e) => {
          e.stopPropagation();
          const isOpen = downloadDropdown.classList.contains('show');
          this.shadowRoot.querySelectorAll('.oa-download-dropdown.show').forEach((el) => {
            el.classList.remove('show');
            el.querySelector('.oa-btn-download')?.setAttribute('aria-expanded', 'false');
          });
          if (!isOpen) {
            downloadDropdown.classList.add('show');
            toggle.setAttribute('aria-expanded', 'true');
          }
        });
      }
    }
  }

  /**
   * Build a breadcrumb path with clickable links for ancestors, looking up
   * names in the currently loaded tree or the item's parents/root data.
   * @param {VocabularyFlatItem} item
   * @returns {string} HTML or empty string.
   */
  #renderBreadcrumb(item) {
    let ancestors = this.#findAncestorPath(item.id);
    if (!ancestors.length) {
      if (Array.isArray(item.parents) && item.parents.length) {
        ancestors = item.parents.map((p) => {
          if (typeof p === 'object' && p !== null) {
            return { id: p.id, name: p.name || this.#findNodeName(p.id) || `#${p.id}` };
          }
          return { id: p, name: this.#findNodeName(p) || `#${p}` };
        });
      } else if (Array.isArray(item.root) && item.root.length) {
        ancestors = item.root.map((id) => {
          if (typeof id === 'object' && id !== null) {
            return { id: id.id, name: id.name || this.#findNodeName(id.id) || `#${id.id}` };
          }
          return { id, name: this.#findNodeName(id) || `#${id}` };
        });
      }
    }

    if (!ancestors.length) return '';

    const crumbs = ancestors.map((anc) => `
      <li class="breadcrumb-item">
        <a href="#" class="oa-breadcrumb-link" data-id="${esc(anc.id)}" title="${esc(anc.name)}">${esc(anc.name)}</a>
      </li>
    `);
    crumbs.push(`<li class="breadcrumb-item active" aria-current="page">${esc(item.name)}</li>`);
    return `<nav aria-label="breadcrumb"><ol class="breadcrumb oa-breadcrumb small mb-0">${crumbs.join('')}</ol></nav>`;
  }

  /** Find a node's name by id in the loaded tree. @param {number} id @returns {string|null} */
  #findNodeName(id) {
    if (!this._treeData) return null;
    const stack = [];
    for (const cat of CATEGORY_ORDER) {
      if (Array.isArray(this._treeData[cat])) stack.push(...this._treeData[cat]);
    }
    while (stack.length) {
      const node = stack.pop();
      if (node.id === id) return node.name;
      if (Array.isArray(node.children)) stack.push(...node.children);
    }
    return null;
  }

  /**
   * Render external references as linked badges.
   * @param {ExternalReferenceSystemModel[]|null|undefined} refs
   * @returns {string} HTML or empty string.
   */
  #renderExternalReferences(refs) {
    if (!Array.isArray(refs) || !refs.length) return '';
    const badges = refs.map((ref) => {
      const isUrl = /^https?:\/\//i.test(ref.identifier || '');
      const text = (ref.identifier && !isUrl) ? `${ref.name}: ${ref.identifier}` : ref.name;
      const href = this.#externalHref(ref);
      if (href) {
        return `<a class="badge oa-ext-badge text-decoration-none" href="${esc(href)}" target="_blank" rel="noopener noreferrer" title="${esc(ref.match || '')}">${esc(text)}</a>`;
      }
      return `<span class="badge oa-ext-badge" title="${esc(ref.match || '')}">${esc(text)}</span>`;
    }).join(' ');
    return `
      <div class="oa-section mt-3">
        <label class="oa-field-label">${esc(this.#labels.externalReferences)}</label>
        <div class="oa-badges">${badges}</div>
      </div>
    `;
  }

  /** Resolve a clickable URL for an external reference. @param {ExternalReferenceSystemModel} ref @returns {string} */
  #externalHref(ref) {
    const id = ref.identifier || '';
    // Some systems (Wikidata, Getty AAT) already provide the full record URL as
    // the identifier — link straight to it rather than to the base site.
    if (/^https?:\/\//i.test(id)) return id;
    // Otherwise build the exact record URL from the resolver base + identifier.
    if (id && ref.resolverUrl) return `${ref.resolverUrl}${id}`;
    if (id && ref.referenceUrl) return `${ref.referenceUrl}${id}`;
    return '';
  }

  /**
   * Render bibliography references as a list.
   * @param {ReferenceModel[]|null|undefined} refs
   * @returns {string} HTML or empty string.
   */
  #renderBibliography(refs) {
    if (!Array.isArray(refs) || !refs.length) return '';
    const items = refs.map((r) => {
      const cite = r.citation || r.name;
      const pages = r.pages ? `, ${esc(r.pages)}` : '';
      // Citations may contain URLs — render those as clickable links.
      return `<li class="oa-biblio-item">${this.#linkify(cite)}${pages}</li>`;
    }).join('');
    return `
      <div class="oa-section mt-3">
        <label class="oa-field-label">${esc(this.#labels.bibliography)}</label>
        <ul class="oa-biblio list-unstyled mb-0">${items}</ul>
      </div>
    `;
  }

  /**
   * Escape a string and turn any bare http(s) URLs it contains into links.
   * @param {*} text
   * @returns {string} HTML-safe string with anchors for embedded URLs.
   */
  #linkify(text) {
    const raw = (text === null || text === undefined) ? '' : String(text);
    const urlRe = /(https?:\/\/[^\s<>"')\]]+)/g;
    let out = '';
    let last = 0;
    let m;
    while ((m = urlRe.exec(raw)) !== null) {
      out += esc(raw.slice(last, m.index));
      const url = m[1];
      out += `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>`;
      last = m.index + url.length;
    }
    out += esc(raw.slice(last));
    return out;
  }

  /**
   * Render an image thumbnail when present.
   * @param {FileItem|null|undefined} image
   * @returns {string} HTML or empty string.
   */
  #renderImage(image) {
    if (!image) return '';
    const src = image.thumbnailUrl || image.fileUrl;
    if (!src) return '';
    return `
      <div class="oa-section mt-3">
        <label class="oa-field-label">${esc(this.#labels.image)}</label>
        <div class="oa-image">
          <img src="${esc(src)}" alt="${esc(this.#labels.image)}" class="img-fluid rounded" loading="lazy">
        </div>
      </div>
    `;
  }

  /**
   * Copy a value to the clipboard with a graceful fallback for insecure
   * contexts, showing a short visual confirmation on the button.
   * @param {string} value
   * @param {HTMLButtonElement} button
   * @returns {Promise<void>}
   */
  async #copyValue(value, button) {
    const L = this.#labels;
    const originalHtml = button.innerHTML;
    const done = (ok) => {
      button.innerHTML = `<span class="oa-copy-icon" aria-hidden="true">${ok ? '\u2713' : '\u2717'}</span> ${esc(ok ? L.copied : L.copyFailed)}`;
      button.classList.toggle('oa-copied', ok);
      setTimeout(() => {
        button.innerHTML = originalHtml;
        button.classList.remove('oa-copied');
      }, 1500);
    };
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        done(true);
        return;
      }
      // Fallback: hidden textarea + execCommand.
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      this.shadowRoot.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      done(ok);
    } catch (_e) {
      done(false);
    }
  }

  /** Alias for backward compatibility. @param {string} value @param {HTMLButtonElement} button */
  async #copyUri(value, button) {
    return this.#copyValue(value, button);
  }

  /* ---------------------------------------------------------------------- */
  /* States & helpers                                                       */
  /* ---------------------------------------------------------------------- */

  /** @returns {string} A Bootstrap spinner markup. */
  #spinner() {
    return `
      <div class="oa-loading d-flex align-items-center gap-2 p-3 text-body-secondary">
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        <span>${esc(this.#labels.loading)}</span>
      </div>
    `;
  }

  /** Show a tree-load error state with a retry button. @param {Error} error */
  #showTreeError(error) {
    const container = this.shadowRoot.getElementById('tree-container');
    if (!container) return;
    container.innerHTML = `
      <div class="alert alert-danger m-2" role="alert">
        <div>${esc(this.#labels.treeError)}</div>
        <small class="d-block text-body-secondary">${esc(error.message)}</small>
        <button type="button" class="btn btn-sm btn-outline-danger mt-2" id="oa-retry-tree">${esc(this.#labels.retry)}</button>
      </div>
    `;
    const retry = container.querySelector('#oa-retry-tree');
    if (retry) retry.addEventListener('click', () => this.loadTree());
  }

  /** Show a detail-load error state. @param {Error} error */
  #showDetailError(error) {
    const panel = this.shadowRoot.getElementById('detail-panel');
    if (!panel) return;
    panel.innerHTML = `
      <div class="alert alert-danger m-3" role="alert">
        <div>${esc(this.#labels.detailError)}</div>
        <small class="d-block text-body-secondary">${esc(error.message)}</small>
      </div>
    `;
  }

  /** Dispatch the error event. @param {Error} error @param {string} context */
  #emitError(error, context) {
    this.dispatchEvent(new CustomEvent('oa-vocabulary-error', {
      bubbles: true, composed: true, detail: { error, context }
    }));
  }

  /** Apply static (non-data) labels such as header title and search placeholder. */
  #applyStaticLabels() {
    const L = this.#labels;
    const title = this.shadowRoot.getElementById('oa-title');
    if (title) title.textContent = L.title;
    const search = this.shadowRoot.getElementById('search');
    if (search) search.setAttribute('placeholder', L.searchPlaceholder);
    const empty = this.shadowRoot.getElementById('oa-empty-detail');
    if (empty) {
      empty.querySelector('.oa-empty-title').textContent = L.emptyDetail;
      empty.querySelector('.oa-empty-hint').textContent = L.emptyDetailHint;
    }
  }

  /**
   * Inject the Bootstrap stylesheet plus component theme styles into the shadow
   * root, reusing a shared constructable stylesheet across instances.
   */
  #injectBootstrap() {
    if (this._bootstrapInjected) return;
    const url = this.bootstrapUrl;

    const supportsAdopted = 'adoptedStyleSheets' in Document.prototype &&
      'replace' in CSSStyleSheet.prototype;

    if (supportsAdopted) {
      let sheet = SHARED_BOOTSTRAP_SHEETS.get(url);
      if (!sheet) {
        sheet = new CSSStyleSheet();
        SHARED_BOOTSTRAP_SHEETS.set(url, sheet);
        fetch(url)
          .then((r) => r.text())
          .then((css) => sheet.replace(css))
          .catch(() => { /* Bootstrap is optional; component still works. */ });
      }
      const theme = new CSSStyleSheet();
      theme.replaceSync(this.#themeCss());
      this.shadowRoot.adoptedStyleSheets = [sheet, theme];
    } else {
      // Fallback: <link> + <style> inside the shadow root.
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      const style = document.createElement('style');
      style.textContent = this.#themeCss();
      this.shadowRoot.prepend(style);
      this.shadowRoot.prepend(link);
    }

    this._bootstrapInjected = true;
  }

  /** @returns {string} Static skeleton markup for the shadow root. */
  #skeleton() {
    return `
      <div class="oa-root">
        <div class="oa-header">
          <h1 id="oa-title" class="oa-header-title h5 mb-2"></h1>
          <input id="search" type="search" class="form-control form-control-sm oa-search" autocomplete="off">
        </div>
        <div class="oa-body">
          <div class="oa-master">
            <div id="tree-container" class="oa-tree-container"></div>
          </div>
          <div class="oa-detail-col">
            <div id="detail-panel" class="oa-detail-panel">
              <div id="oa-empty-detail" class="oa-empty-detail text-center text-body-secondary p-5">
                <div class="oa-empty-title h6"></div>
                <div class="oa-empty-hint small"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Component theme CSS. Maps `--oa-*` custom properties (with sensible
   * defaults) onto Bootstrap variables and component rules so the host can
   * override colors from outside the shadow boundary.
   * @returns {string}
   */
  #themeCss() {
    return `
      :host {
        /* ---- Public theming API (override these from the host) ---- */
        --oa-bg: #ffffff;
        --oa-text: #212529;
        --oa-muted: #6c757d;
        --oa-primary: #559f55;
        --oa-border: #dee2e6;
        --oa-hover-bg: #f1f5f1;
        --oa-active-bg: #559f55;
        --oa-active-text: #ffffff;
        --oa-link: #2c6e2c;
        --oa-badge-bg: #e7f1e7;
        --oa-badge-text: #2c6e2c;
        --oa-font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        --oa-height: 600px;

        /* Map onto Bootstrap where useful. */
        --bs-primary: var(--oa-primary);
        --bs-link-color: var(--oa-link);
        --bs-body-color: var(--oa-text);
        --bs-body-bg: var(--oa-bg);
        --bs-border-color: var(--oa-border);

        display: block;
        color: var(--oa-text);
        background: var(--oa-bg);
        font-family: var(--oa-font-family);
        border: 1px solid var(--oa-border);
        border-radius: .5rem;
        overflow: hidden;
      }

      .oa-root { display: flex; flex-direction: column; height: var(--oa-height); }

      .oa-header { padding: .75rem 1rem; border-bottom: 1px solid var(--oa-border); background: var(--oa-bg); }
      .oa-header-title { color: var(--oa-text); margin: 0; }

      .oa-body { display: flex; flex: 1 1 auto; min-height: 0; }

      .oa-master {
        width: 40%; min-width: 240px; max-width: 480px;
        border-right: 1px solid var(--oa-border);
        overflow: auto;
      }
      .oa-tree-container { padding: .5rem; }

      .oa-detail-col { flex: 1 1 auto; overflow: auto; }

      .oa-category + .oa-category { margin-top: .75rem; }
      .oa-category-title {
        font-size: .7rem; text-transform: uppercase; letter-spacing: .06em;
        color: var(--oa-muted); font-weight: 700; padding: .25rem .5rem;
      }

      .oa-tree { margin: 0; padding: 0; }
      .oa-node { list-style: none; }
      .oa-node-row {
        display: flex; align-items: center; gap: .25rem;
        padding: .15rem .25rem;
        padding-left: calc(.25rem + var(--oa-depth, 0) * 1rem);
        border-radius: .375rem; cursor: pointer;
      }
      .oa-node-row:hover { background: var(--oa-hover-bg); }
      .oa-node-row.active { background: var(--oa-active-bg); }
      .oa-node-row.active .oa-label { color: var(--oa-active-text); font-weight: 600; }

      .oa-toggle {
        border: 0; background: transparent; color: var(--oa-muted);
        width: 1.25rem; height: 1.25rem; line-height: 1; padding: 0;
        cursor: pointer; flex: 0 0 auto; font-size: .75rem;
      }
      .oa-toggle-empty { visibility: hidden; }

      .oa-label {
        border: 0; background: transparent; color: var(--oa-text);
        text-align: left; padding: .1rem .25rem; cursor: pointer;
        flex: 1 1 auto; font-size: .9rem;
      }
      .oa-label:hover { color: var(--oa-link); }

      .oa-field-label {
        display: block; font-size: .7rem; text-transform: uppercase;
        letter-spacing: .05em; color: var(--oa-muted); font-weight: 700;
        margin-bottom: .25rem;
      }

      .oa-detail-title { color: var(--oa-text); }
      .oa-badge { background: var(--oa-badge-bg); color: var(--oa-badge-text); }
      .oa-ext-badge { background: var(--oa-badge-bg); color: var(--oa-badge-text); }
      a.oa-ext-badge:hover { filter: brightness(.95); }

      .oa-uuid-row { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
      .oa-uuid-value {
        background: var(--oa-hover-bg); padding: .2rem .4rem; border-radius: .25rem;
        font-size: .85rem; word-break: break-all;
      }
      .oa-copy-btn { border: 1px solid var(--oa-border); color: var(--oa-text); background: var(--oa-bg); }
      .oa-copy-btn:hover { background: var(--oa-hover-bg); color: var(--oa-text); }
      .oa-copy-btn.oa-copied { background: var(--oa-active-bg); color: var(--oa-active-text); border-color: var(--oa-active-bg); }
      .oa-copy-corner { position: absolute; top: .75rem; right: .75rem; z-index: 2; white-space: nowrap; }
      .oa-copy-icon { font-size: .9em; }

      .oa-btn-download { border: 1px solid var(--oa-border); color: var(--oa-text); background: var(--oa-bg); }
      .oa-btn-download:hover, .oa-btn-download:focus { background: var(--oa-hover-bg); color: var(--oa-text); }
      .oa-download-dropdown { position: relative; }
      .oa-download-menu {
        position: absolute; right: 0; top: 100%; z-index: 1050;
        min-width: 10.5rem; padding: .5rem 0; margin: .125rem 0 0;
        font-size: .85rem; color: var(--oa-text); text-align: left;
        list-style: none; background-color: var(--oa-bg);
        border: 1px solid var(--oa-border); border-radius: .375rem;
        box-shadow: 0 .5rem 1rem rgba(0, 0, 0, .15);
        display: none;
      }
      .oa-download-dropdown.show .oa-download-menu { display: block; }
      .oa-download-menu .dropdown-item {
        display: block; width: 100%; padding: .35rem 1rem; clear: both;
        font-weight: 400; color: var(--oa-text); text-align: inherit;
        text-decoration: none; white-space: nowrap; background-color: transparent;
        border: 0; cursor: pointer;
      }
      .oa-download-menu .dropdown-item:hover, .oa-download-menu .dropdown-item:focus {
        color: var(--oa-link); background-color: var(--oa-hover-bg);
      }
      .oa-download-icon { font-size: .9em; }

      .oa-detail-top { margin-bottom: .5rem; }
      .oa-breadcrumb-link { color: var(--oa-link); text-decoration: none; cursor: pointer; }
      .oa-breadcrumb-link:hover { text-decoration: underline; color: var(--oa-link); }

      .oa-badges { display: flex; flex-wrap: wrap; gap: .35rem; }
      .oa-description { color: var(--oa-text); white-space: pre-wrap; }
      .oa-breadcrumb .breadcrumb-item, .oa-breadcrumb .breadcrumb-item + .breadcrumb-item::before { color: var(--oa-muted); }
      .oa-breadcrumb .breadcrumb-item.active { color: var(--oa-muted); }

      .oa-biblio-item { margin-bottom: .6rem; line-height: 1.4; }
      .oa-biblio-item:last-child { margin-bottom: 0; }
      .oa-biblio-item a { color: var(--oa-link); word-break: break-word; }

      .oa-image img { max-height: 320px; }
    `;
  }
}

customElements.define('openatlas-vocabulary-viewer', OpenAtlasVocabularyViewer);

export default OpenAtlasVocabularyViewer;
