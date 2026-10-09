/**
 * OpenAtlas Vocabulary Viewer
 * ---------------------------
 * A native, framework-free Web Component (Custom Element v1 + Shadow DOM) that
 * renders the OpenAtlas type vocabulary as a searchable master-detail browser:
 * an expandable hierarchy tree on the left and a detail panel on the right.
 *
 * Styling is provided by Bootstrap 5.3 injected into the shadow root and is
 * themable from the host page via `--oa-*` CSS custom properties (they pierce
 * the shadow boundary), as well as HTML attributes (`font-family`, `font-size`)
 * and a public JavaScript API for Corporate Identity (CI) integration.
 * The UI is bilingual (English / German) via the `lang` attribute. No client-side
 * caching is performed: point `tree-endpoint` / `detail-endpoint` at a caching proxy if needed.
 *
 * @module openatlas-vocabulary-viewer
 * @license MIT
 *
 * @fires oa-tree-loaded        {detail:{data:VocabularyTreeResponse}}
 * @fires oa-vocabulary-selected {detail:{id:number,data:VocabularyFlatItem}}
 * @fires oa-vocabulary-error   {detail:{error:Error,context:string}}
 */

/** Default OpenAtlas endpoints (overridable via attributes). */
const DEFAULT_TREE_ENDPOINT = 'http://127.0.0.1:5000/api/1/vocabulary/tree';
const DEFAULT_DETAIL_ENDPOINT = 'http://127.0.0.1:5000/api/1/vocabulary/{id}';
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
    entitiesSubs: 'Subtype entities',
    directEntities: 'Directly linked entities',
    subtypesEntities: 'Entities in subtypes',
    classes: 'Entity classes',
    selectable: 'Selectable',
    assignable: 'Assignable',
    notAssignable: 'Structural node (not assignable)',
    structuralNode: 'Structural node',
    structuralNodeHint: 'Structural grouping node — entities cannot be assigned to this type.',
    assignableHint: 'Entities can be assigned to this type.',
    timespan: 'Time span',
    from: 'From',
    to: 'To',
    parents: 'Parents',
    categories: {
      standard: 'Standard', place: 'Place', custom: 'Custom', value: 'Value', tools: 'Tools', tool: 'Tools', system: 'System'
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
    entitiesSubs: 'Untertyp-Entitäten',
    directEntities: 'Direkt verknüpfte Entitäten',
    subtypesEntities: 'Entitäten in Untertypen',
    classes: 'Entitätsklassen',
    selectable: 'Auswählbar',
    assignable: 'Zuweisbar',
    notAssignable: 'Strukturknoten (nicht zuweisbar)',
    structuralNode: 'Strukturknoten',
    structuralNodeHint: 'Dient als Strukturknoten — es können keine Entitäten zugewiesen werden.',
    assignableHint: 'Diesem Typ können Entitäten zugewiesen werden.',
    timespan: 'Zeitspanne',
    from: 'Von',
    to: 'Bis',
    parents: 'Übergeordnete Typen',
    categories: {
      standard: 'Standard', place: 'Ort', custom: 'Benutzerdefiniert', value: 'Wert', tools: 'Werkzeuge', tool: 'Werkzeuge', system: 'System'
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

/** Capitalize the first letter of a string. @param {*} value @returns {string} */
function capitalize(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Parse an input of IDs (array, Set, comma-separated string, JSON array string, or single ID)
 * into a Set of numeric IDs.
 *
 * @param {Array<number|string>|Set<number|string>|string|number|null|undefined} input
 * @returns {Set<number>}
 */
function parseIds(input) {
  const result = new Set();
  if (input === null || input === undefined || input === '') return result;

  if (input instanceof Set) {
    for (const item of input) {
      const num = Number(item);
      if (!isNaN(num)) result.add(num);
      else if (item !== '' && item !== null && item !== undefined) result.add(item);
    }
    return result;
  }

  if (Array.isArray(input)) {
    for (const item of input.flat(Infinity)) {
      if (typeof item === 'string') {
        const parsed = parseIds(item);
        for (const p of parsed) result.add(p);
      } else {
        const num = Number(item);
        if (!isNaN(num)) result.add(num);
        else if (item !== '' && item !== null && item !== undefined) result.add(item);
      }
    }
    return result;
  }

  if (typeof input === 'number') {
    if (!isNaN(input)) result.add(input);
    return result;
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return result;
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsedJson = JSON.parse(trimmed);
        if (Array.isArray(parsedJson)) {
          return parseIds(parsedJson);
        }
      } catch (_e) {
        // Fall back to delimiter splitting
      }
    }
    const tokens = trimmed.split(/[\s,;]+/);
    for (const tok of tokens) {
      if (!tok) continue;
      const num = Number(tok);
      if (!isNaN(num)) result.add(num);
      else result.add(tok);
    }
    return result;
  }

  return result;
}

const parseIgnoredIds = parseIds;
const parseIncludedIds = parseIds;

/**
 * Normalize and validate filter options containing include / exclude IDs.
 * Throws an Error if both include and exclude filters are non-empty (mutually exclusive).
 *
 * @param {*} optionsOrExclude
 * @param {*} [includeIdsArg]
 * @returns {{ mode: 'none'|'exclude'|'include', excludeSet: Set<number>, includeSet: Set<number> }}
 */
function normalizeFilterOptions(optionsOrExclude, includeIdsArg) {
  let excludeInput = null;
  let includeInput = null;

  if (optionsOrExclude && typeof optionsOrExclude === 'object' && !(optionsOrExclude instanceof Set) && !Array.isArray(optionsOrExclude)) {
    excludeInput = optionsOrExclude.excludeIds ?? optionsOrExclude.ignoredIds ?? optionsOrExclude.exclude ?? optionsOrExclude.ignored;
    includeInput = optionsOrExclude.includeIds ?? optionsOrExclude.includedIds ?? optionsOrExclude.include ?? optionsOrExclude.included;
  } else {
    excludeInput = optionsOrExclude;
    includeInput = includeIdsArg;
  }

  const excludeSet = parseIds(excludeInput);
  const includeSet = parseIds(includeInput);

  if (excludeSet.size > 0 && includeSet.size > 0) {
    throw new Error('openatlas-vocabulary-viewer: "include-ids" and "exclude-ids" ("ignored-ids") are mutually exclusive. Only one can be specified.');
  }

  if (includeSet.size > 0) {
    return { mode: 'include', excludeSet, includeSet };
  }
  if (excludeSet.size > 0) {
    return { mode: 'exclude', excludeSet, includeSet };
  }
  return { mode: 'none', excludeSet, includeSet };
}

/**
 * Filter a single VocabularyTreeItem and its recursive children according to exclusion or inclusion rules.
 * When in exclude mode: returns null if the item itself matches any excluded ID.
 * When in include mode: returns the item if it matches included IDs (with all descendants),
 * or returns the item with filtered children if any descendant matches, or null otherwise.
 *
 * @param {VocabularyTreeItem} item
 * @param {*} optionsOrExclude
 * @param {*} [includeIdsArg]
 * @returns {VocabularyTreeItem|null} Filtered copy of item, or null if filtered out.
 */
function filterVocabularyItem(item, optionsOrExclude, includeIdsArg) {
  if (!item || typeof item !== 'object') return null;
  const { mode, excludeSet, includeSet } = normalizeFilterOptions(optionsOrExclude, includeIdsArg);

  if (mode === 'none') {
    return item;
  }

  if (mode === 'exclude') {
    const itemId = item.id;
    if (excludeSet.has(itemId) || excludeSet.has(Number(itemId)) || excludeSet.has(String(itemId))) {
      return null;
    }

    let children = [];
    if (Array.isArray(item.children) && item.children.length > 0) {
      children = item.children
        .map((child) => filterVocabularyItem(child, { excludeIds: excludeSet }))
        .filter((child) => child !== null);
    }

    return {
      ...item,
      children
    };
  }

  if (mode === 'include') {
    const itemId = item.id;
    const isDirectlyIncluded = includeSet.has(itemId) || includeSet.has(Number(itemId)) || includeSet.has(String(itemId));
    if (isDirectlyIncluded) {
      // The item is explicitly included: its entire subtree is included.
      return { ...item };
    }

    // Otherwise, check if any descendant is included.
    let keptChildren = [];
    if (Array.isArray(item.children) && item.children.length > 0) {
      keptChildren = item.children
        .map((child) => filterVocabularyItem(child, { includeIds: includeSet }))
        .filter((child) => child !== null);
    }

    if (keptChildren.length > 0) {
      return {
        ...item,
        children: keptChildren
      };
    }

    return null;
  }

  return item;
}

/**
 * Deep-filter a VocabularyTreeResponse object so that:
 * - In exclude mode: any node matching excludeIds (along with its entire descendant subtree) is omitted.
 * - In include mode: only nodes matching includeIds (with their subtrees) and their ancestor path nodes are retained.
 * Throws an error if both include and exclude IDs are supplied (mutually exclusive).
 *
 * @param {VocabularyTreeResponse} treeData
 * @param {*} optionsOrExclude
 * @param {*} [includeIdsArg]
 * @returns {VocabularyTreeResponse} Filtered copy of the vocabulary tree.
 */
function filterVocabularyTree(treeData, optionsOrExclude, includeIdsArg) {
  if (!treeData || typeof treeData !== 'object') return treeData;
  const { mode, excludeSet, includeSet } = normalizeFilterOptions(optionsOrExclude, includeIdsArg);
  if (mode === 'none') return treeData;

  const activeSet = mode === 'include' ? includeSet : excludeSet;
  const activeKey = mode === 'include' ? 'includeIds' : 'excludeIds';

  const filtered = {};
  for (const [cat, items] of Object.entries(treeData)) {
    if (Array.isArray(items)) {
      filtered[cat] = items
        .map((item) => filterVocabularyItem(item, { [activeKey]: activeSet }))
        .filter((item) => item !== null);
    } else {
      filtered[cat] = items;
    }
  }
  return filtered;
}

/**
 * Filter a VocabularyFlatItem detail payload to reflect active exclusion or inclusion rules.
 *
 * @param {VocabularyFlatItem} detailData
 * @param {*} optionsOrExclude
 * @param {*} [includeIdsArg]
 * @returns {VocabularyFlatItem} Filtered copy of the detail data.
 */
function filterVocabularyDetail(detailData, optionsOrExclude, includeIdsArg) {
  if (!detailData || typeof detailData !== 'object') return detailData;
  const { mode, excludeSet, includeSet } = normalizeFilterOptions(optionsOrExclude, includeIdsArg);
  if (mode === 'none') return detailData;

  const result = { ...detailData };

  if (mode === 'exclude') {
    if (Array.isArray(result.subTypes)) {
      result.subTypes = result.subTypes.filter((sub) => {
        const id = typeof sub === 'object' && sub !== null ? sub.id : sub;
        return !excludeSet.has(id) && !excludeSet.has(Number(id)) && !excludeSet.has(String(id));
      });
    }
    if (Array.isArray(result.children)) {
      result.children = result.children
        .map((child) => filterVocabularyItem(child, { excludeIds: excludeSet }))
        .filter((child) => child !== null);
    }
    return result;
  }

  if (mode === 'include') {
    const detailId = result.id;
    const isDirectlyIncluded = includeSet.has(detailId) || includeSet.has(Number(detailId)) || includeSet.has(String(detailId));

    if (Array.isArray(result.subTypes)) {
      result.subTypes = result.subTypes.filter((sub) => {
        const id = typeof sub === 'object' && sub !== null ? sub.id : sub;
        if (isDirectlyIncluded) return true;
        return includeSet.has(id) || includeSet.has(Number(id)) || includeSet.has(String(id));
      });
    }
    if (Array.isArray(result.children)) {
      result.children = result.children
        .map((child) => {
          if (isDirectlyIncluded) return child;
          return filterVocabularyItem(child, { includeIds: includeSet });
        })
        .filter((child) => child !== null);
    }
    return result;
  }

  return result;
}

/**
 * Create a reusable Vocabulary Filter Adapter.
 * Supports both exclusion and inclusion filtering modes (mutually exclusive).
 * Throws an Error if both include and exclude filters are non-empty.
 *
 * @param {*} [initialOptions=[]] Array/Set of ignored IDs or options object `{ includeIds, excludeIds, ignoredIds, includedIds }`
 * @param {*} [initialIncludeIds] Optional inclusion IDs when first param is exclusion IDs
 * @returns {Object} Adapter instance.
 */
function createVocabularyFilterAdapter(initialOptions = [], initialIncludeIds) {
  let { excludeSet, includeSet } = normalizeFilterOptions(initialOptions, initialIncludeIds);

  return {
    get mode() {
      if (includeSet.size > 0) return 'include';
      if (excludeSet.size > 0) return 'exclude';
      return 'none';
    },
    get ignoredIds() {
      return Array.from(excludeSet);
    },
    set ignoredIds(ids) {
      this.setIgnoredIds(ids);
    },
    get excludeIds() {
      return Array.from(excludeSet);
    },
    set excludeIds(ids) {
      this.setIgnoredIds(ids);
    },
    get includedIds() {
      return Array.from(includeSet);
    },
    set includedIds(ids) {
      this.setIncludedIds(ids);
    },
    get includeIds() {
      return Array.from(includeSet);
    },
    set includeIds(ids) {
      this.setIncludedIds(ids);
    },
    getIgnoredIds() {
      return Array.from(excludeSet);
    },
    getExcludeIds() {
      return Array.from(excludeSet);
    },
    getIncludedIds() {
      return Array.from(includeSet);
    },
    getIncludeIds() {
      return Array.from(includeSet);
    },
    setIgnoredIds(ids) {
      const parsed = parseIds(ids);
      if (parsed.size > 0 && includeSet.size > 0) {
        throw new Error('VocabularyFilterAdapter: "includeIds" and "excludeIds"/"ignoredIds" are mutually exclusive. Only one can be specified.');
      }
      excludeSet = parsed;
      return this;
    },
    setExcludeIds(ids) {
      return this.setIgnoredIds(ids);
    },
    setIncludedIds(ids) {
      const parsed = parseIds(ids);
      if (parsed.size > 0 && excludeSet.size > 0) {
        throw new Error('VocabularyFilterAdapter: "includeIds" and "excludeIds"/"ignoredIds" are mutually exclusive. Only one can be specified.');
      }
      includeSet = parsed;
      return this;
    },
    setIncludeIds(ids) {
      return this.setIncludedIds(ids);
    },
    addIgnoredIds(...ids) {
      if (includeSet.size > 0) {
        throw new Error('VocabularyFilterAdapter: "includeIds" and "excludeIds"/"ignoredIds" are mutually exclusive. Only one can be specified.');
      }
      for (const id of ids.flat(Infinity)) {
        const parsed = parseIds(id);
        for (const item of parsed) excludeSet.add(item);
      }
      return this;
    },
    addExcludeIds(...ids) {
      return this.addIgnoredIds(...ids);
    },
    addIncludedIds(...ids) {
      if (excludeSet.size > 0) {
        throw new Error('VocabularyFilterAdapter: "includeIds" and "excludeIds"/"ignoredIds" are mutually exclusive. Only one can be specified.');
      }
      for (const id of ids.flat(Infinity)) {
        const parsed = parseIds(id);
        for (const item of parsed) includeSet.add(item);
      }
      return this;
    },
    addIncludeIds(...ids) {
      return this.addIncludedIds(...ids);
    },
    removeIgnoredIds(...ids) {
      for (const id of ids.flat(Infinity)) {
        const parsed = parseIds(id);
        for (const item of parsed) excludeSet.delete(item);
      }
      return this;
    },
    removeExcludeIds(...ids) {
      return this.removeIgnoredIds(...ids);
    },
    removeIncludedIds(...ids) {
      for (const id of ids.flat(Infinity)) {
        const parsed = parseIds(id);
        for (const item of parsed) includeSet.delete(item);
      }
      return this;
    },
    removeIncludeIds(...ids) {
      return this.removeIncludedIds(...ids);
    },
    clearIgnoredIds() {
      excludeSet.clear();
      return this;
    },
    clearExcludeIds() {
      return this.clearIgnoredIds();
    },
    clearIncludedIds() {
      includeSet.clear();
      return this;
    },
    clearIncludeIds() {
      return this.clearIncludedIds();
    },
    clear() {
      excludeSet.clear();
      includeSet.clear();
      return this;
    },
    isIgnored(id) {
      return excludeSet.has(Number(id)) || excludeSet.has(id) || excludeSet.has(String(id));
    },
    isExcluded(id) {
      return this.isIgnored(id);
    },
    isIncluded(id) {
      return includeSet.has(Number(id)) || includeSet.has(id) || includeSet.has(String(id));
    },
    isVisible(id) {
      if (includeSet.size > 0 && excludeSet.size > 0) {
        throw new Error('VocabularyFilterAdapter: "includeIds" and "excludeIds"/"ignoredIds" are mutually exclusive.');
      }
      if (excludeSet.size > 0) return !this.isIgnored(id);
      if (includeSet.size > 0) return this.isIncluded(id);
      return true;
    },
    filterTree(treeData) {
      if (includeSet.size > 0 && excludeSet.size > 0) {
        throw new Error('VocabularyFilterAdapter: "includeIds" and "excludeIds"/"ignoredIds" are mutually exclusive. Only one can be specified.');
      }
      if (includeSet.size > 0) {
        return filterVocabularyTree(treeData, { includeIds: includeSet });
      }
      if (excludeSet.size > 0) {
        return filterVocabularyTree(treeData, { excludeIds: excludeSet });
      }
      return treeData;
    },
    filterItem(item) {
      if (includeSet.size > 0 && excludeSet.size > 0) {
        throw new Error('VocabularyFilterAdapter: "includeIds" and "excludeIds"/"ignoredIds" are mutually exclusive. Only one can be specified.');
      }
      if (includeSet.size > 0) {
        return filterVocabularyItem(item, { includeIds: includeSet });
      }
      if (excludeSet.size > 0) {
        return filterVocabularyItem(item, { excludeIds: excludeSet });
      }
      return item;
    },
    filterDetail(detailData) {
      if (includeSet.size > 0 && excludeSet.size > 0) {
        throw new Error('VocabularyFilterAdapter: "includeIds" and "excludeIds"/"ignoredIds" are mutually exclusive. Only one can be specified.');
      }
      if (includeSet.size > 0) {
        return filterVocabularyDetail(detailData, { includeIds: includeSet });
      }
      if (excludeSet.size > 0) {
        return filterVocabularyDetail(detailData, { excludeIds: excludeSet });
      }
      return detailData;
    },
    wrapFetch(fetchFn = (typeof window !== 'undefined' ? window.fetch : fetch)) {
      return async (input, init) => {
        const res = await fetchFn(input, init);
        if (!res.ok) return res;
        try {
          const clone = res.clone();
          const json = await clone.json();
          const isTree = json && CATEGORY_ORDER.some((cat) => Array.isArray(json[cat]));
          const filtered = isTree ? this.filterTree(json) : this.filterDetail(json);
          return new Response(JSON.stringify(filtered), {
            status: res.status,
            statusText: res.statusText,
            headers: res.headers
          });
        } catch (_e) {
          return res;
        }
      };
    }
  };
}

const HTMLElementBase = typeof HTMLElement !== 'undefined' ? HTMLElement : class {};

/**
 * `<openatlas-vocabulary-viewer>` custom element.
 * @element openatlas-vocabulary-viewer
 */
class OpenAtlasVocabularyViewer extends HTMLElementBase {
  /** Attributes that trigger {@link attributeChangedCallback}. */
  static get observedAttributes() {
    return [
      'tree-endpoint',
      'detail-endpoint',
      'title-endpoint',
      'header-title',
      'custom-title',
      'title',
      'sidebar-width',
      'master-width',
      'resizable',
      'lang',
      'bootstrap-url',
      'font-family',
      'font-size',
      'ignored-ids',
      'exclude-ids',
      'include-ids',
      'included-ids'
    ];
  }

  constructor() {
    super();
    if (typeof this.attachShadow === 'function') {
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = this.#skeleton();
    }

    /** @type {VocabularyTreeResponse|null} Last rendered (filtered) tree data. */
    this._treeData = null;
    /** @type {VocabularyTreeResponse|null} Raw (unfiltered) tree data from endpoint or caller. */
    this._rawTreeData = null;
    /** @type {Set<number|string>} Set of IDs to ignore/exclude. */
    this._ignoredIds = new Set();
    /** @type {Set<number|string>} Set of IDs to include. */
    this._includedIds = new Set();
    /** @type {Set<number|string>} Set of IDs present in current rendered tree. */
    this._visibleNodeIds = new Set();
    /** @type {number|null} Currently selected type id. */
    this._activeId = null;
    /** @type {boolean} Whether Bootstrap has been injected already. */
    this._bootstrapInjected = false;
    /** @type {string|null} Custom title override or programmatic title. */
    this._customTitle = null;
    /** @type {string|null} Title fetched from title-endpoint. */
    this._fetchedTitle = null;
    /** @type {boolean} Resizer drag wire flag. */
    this._resizerWired = false;
  }

  /* ---------------------------------------------------------------------- */
  /* Attribute accessors                                                    */
  /* ---------------------------------------------------------------------- */

  /** @returns {string} Configured tree endpoint URL. */
  get treeEndpoint() {
    return this.getAttribute?.('tree-endpoint') || DEFAULT_TREE_ENDPOINT;
  }

  /** @returns {string} Configured detail endpoint URL template (with `{id}`). */
  get detailEndpoint() {
    return this.getAttribute?.('detail-endpoint') || DEFAULT_DETAIL_ENDPOINT;
  }

  /** @returns {string} Configured title endpoint URL. */
  get titleEndpoint() {
    return this.getAttribute?.('title-endpoint') || '';
  }

  /** @param {string|null} val */
  set titleEndpoint(val) {
    if (val) {
      this.setAttribute?.('title-endpoint', val);
    } else {
      this.removeAttribute?.('title-endpoint');
    }
  }

  /** @returns {string} Configured header title (or empty string if default localized title is used). */
  get headerTitle() {
    return this.getAttribute?.('header-title') ||
           this.getAttribute?.('custom-title') ||
           this._customTitle ||
           '';
  }

  /** @param {string|null} val */
  set headerTitle(val) {
    if (val !== null && val !== undefined && val !== '') {
      this._customTitle = String(val);
      this.setAttribute?.('header-title', String(val));
    } else {
      this._customTitle = null;
      this.removeAttribute?.('header-title');
      this.removeAttribute?.('custom-title');
    }
    this.#applyStaticLabels();
  }

  /** @returns {string} Effective component title. */
  get title() {
    return this.headerTitle || this.getAttribute?.('title') || '';
  }

  /** @param {string|null} val */
  set title(val) {
    this.headerTitle = val;
  }

  /** @returns {string} Configured sidebar (master column) width. */
  get sidebarWidth() {
    return this.getAttribute?.('sidebar-width') ||
           this.getAttribute?.('master-width') ||
           this._sidebarWidth ||
           this.style?.getPropertyValue?.('--oa-master-width') ||
           '350px';
  }

  /** @param {string|number|null} val */
  set sidebarWidth(val) {
    if (val !== null && val !== undefined && val !== '') {
      const w = typeof val === 'number' ? `${val}px` : String(val).trim();
      const parsed = /^\d+(\.\d+)?$/.test(w) ? `${w}px` : w;
      this._sidebarWidth = parsed;
      this.setAttribute?.('sidebar-width', parsed);
      this.style?.setProperty?.('--oa-master-width', parsed);
    } else {
      this._sidebarWidth = null;
      this.removeAttribute?.('sidebar-width');
      this.removeAttribute?.('master-width');
      this.style?.removeProperty?.('--oa-master-width');
    }
  }

  /** @returns {string} Alias for sidebarWidth. */
  get masterWidth() {
    return this.sidebarWidth;
  }

  /** @param {string|number|null} val */
  set masterWidth(val) {
    this.sidebarWidth = val;
  }

  /** @returns {boolean} Whether the sidebar divider is resizable by the user. */
  get resizable() {
    if (this._resizable !== undefined && this._resizable !== null) {
      return this._resizable;
    }
    return this.getAttribute?.('resizable') !== 'false';
  }

  /** @param {boolean|string} val */
  set resizable(val) {
    const bool = val !== false && val !== 'false';
    this._resizable = bool;
    this.setAttribute?.('resizable', String(bool));
  }

  /** @returns {string} Configured Bootstrap stylesheet URL. */
  get bootstrapUrl() {
    return this.getAttribute?.('bootstrap-url') || DEFAULT_BOOTSTRAP_URL;
  }

  /** @returns {string} Configured font family. */
  get fontFamily() {
    return this.getAttribute?.('font-family') || this.style?.getPropertyValue?.('--oa-font-family') || '';
  }

  /** @param {string|null} val */
  set fontFamily(val) {
    if (val) {
      this.setAttribute?.('font-family', val);
    } else {
      this.removeAttribute?.('font-family');
    }
  }

  /** @returns {string} Configured font size. */
  get fontSize() {
    return this.getAttribute?.('font-size') || this.style?.getPropertyValue?.('--oa-font-size') || '';
  }

  /** @param {string|number|null} val */
  set fontSize(val) {
    if (val != null && val !== '') {
      this.setAttribute?.('font-size', String(val));
    } else {
      this.removeAttribute?.('font-size');
    }
  }

  /** @returns {'en'|'de'} Active UI language (defaults to `en`). */
  get lang() {
    const l = (this.getAttribute?.('lang') || 'en').toLowerCase();
    return l === 'de' ? 'de' : 'en';
  }

  /** @returns {number[]} Configured array of ignored IDs. */
  get ignoredIds() {
    return Array.from(this._ignoredIds);
  }

  /** @param {Array<number|string>|Set<number|string>|string|number|null|undefined} val */
  set ignoredIds(val) {
    const parsed = parseIds(val);
    if (parsed.size > 0 && (this._includedIds.size > 0 || this.hasAttribute('include-ids') || this.hasAttribute('included-ids'))) {
      throw new Error('openatlas-vocabulary-viewer: "include-ids" and "exclude-ids" ("ignored-ids") are mutually exclusive. Only one can be specified.');
    }
    this._ignoredIds = parsed;
    if (this._rawTreeData) {
      this.renderTree(this._rawTreeData);
    }
  }

  /** @returns {number[]} Configured array of excluded IDs (alias for ignoredIds). */
  get excludeIds() {
    return this.ignoredIds;
  }

  /** @param {Array<number|string>|Set<number|string>|string|number|null|undefined} val */
  set excludeIds(val) {
    this.ignoredIds = val;
  }

  /** @returns {number[]} Configured array of included IDs. */
  get includedIds() {
    return Array.from(this._includedIds);
  }

  /** @param {Array<number|string>|Set<number|string>|string|number|null|undefined} val */
  set includedIds(val) {
    const parsed = parseIds(val);
    if (parsed.size > 0 && (this._ignoredIds.size > 0 || this.hasAttribute('exclude-ids') || this.hasAttribute('ignored-ids'))) {
      throw new Error('openatlas-vocabulary-viewer: "include-ids" and "exclude-ids" ("ignored-ids") are mutually exclusive. Only one can be specified.');
    }
    this._includedIds = parsed;
    if (this._rawTreeData) {
      this.renderTree(this._rawTreeData);
    }
  }

  /** @returns {number[]} Configured array of included IDs (alias for includedIds). */
  get includeIds() {
    return this.includedIds;
  }

  /** @param {Array<number|string>|Set<number|string>|string|number|null|undefined} val */
  set includeIds(val) {
    this.includedIds = val;
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
    const hasInclude = (this.hasAttribute('include-ids') && this.getAttribute('include-ids') !== '') ||
                       (this.hasAttribute('included-ids') && this.getAttribute('included-ids') !== '');
    const hasExclude = (this.hasAttribute('exclude-ids') && this.getAttribute('exclude-ids') !== '') ||
                       (this.hasAttribute('ignored-ids') && this.getAttribute('ignored-ids') !== '');

    if (hasInclude && hasExclude) {
      throw new Error('openatlas-vocabulary-viewer: "include-ids" and "exclude-ids" ("ignored-ids") are mutually exclusive. Only one can be specified.');
    }

    if (hasInclude) {
      this._includedIds = parseIds(this.getAttribute('include-ids') || this.getAttribute('included-ids'));
    } else if (hasExclude) {
      this._ignoredIds = parseIds(this.getAttribute('exclude-ids') || this.getAttribute('ignored-ids'));
    }

    if (this.hasAttribute('sidebar-width') || this.hasAttribute('master-width')) {
      const w = this.getAttribute('sidebar-width') || this.getAttribute('master-width');
      if (w) {
        const parsed = /^\d+(\.\d+)?$/.test(w.trim()) ? `${w.trim()}px` : w.trim();
        this.style.setProperty('--oa-master-width', parsed);
      }
    }

    this.#applyFont();
    this.#injectBootstrap();
    this.#applyStaticLabels();
    this.#wireResizer();

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

    if (this.titleEndpoint && !this._customTitle && !this._fetchedTitle) {
      this.loadTitle();
    }

    // Load the tree only once when first connected.
    if (!this._rawTreeData && !this._treeData) {
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
      case 'header-title':
      case 'custom-title':
      case 'title':
        this._customTitle = newValue;
        this.#applyStaticLabels();
        break;
      case 'title-endpoint':
        if (newValue) {
          this.loadTitle(newValue);
        } else {
          this._fetchedTitle = null;
          this.#applyStaticLabels();
        }
        break;
      case 'sidebar-width':
      case 'master-width':
        if (newValue) {
          const parsed = /^\d+(\.\d+)?$/.test(newValue.trim()) ? `${newValue.trim()}px` : newValue.trim();
          this.style.setProperty('--oa-master-width', parsed);
        } else {
          this.style.removeProperty('--oa-master-width');
        }
        break;
      case 'resizable':
        // Evaluated via resizable getter and CSS selector
        break;
      case 'font-family':
      case 'font-size':
        this.#applyFont();
        break;
      case 'lang':
        this.#applyStaticLabels();
        // Re-render detail (labels inside it) and tree category headers.
        if (this._rawTreeData) {
          this.renderTree(this._rawTreeData);
        } else if (this._treeData) {
          this.renderTree(this._treeData);
        }
        break;
      case 'bootstrap-url':
        this._bootstrapInjected = false;
        this.#injectBootstrap();
        break;
      case 'tree-endpoint':
        this.loadTree();
        break;
      case 'include-ids':
      case 'included-ids': {
        const hasExclude = (this.hasAttribute('exclude-ids') && this.getAttribute('exclude-ids') !== '') ||
                           (this.hasAttribute('ignored-ids') && this.getAttribute('ignored-ids') !== '') ||
                           this._ignoredIds.size > 0;
        const parsed = parseIds(newValue);
        if (parsed.size > 0 && hasExclude) {
          throw new Error('openatlas-vocabulary-viewer: "include-ids" and "exclude-ids" ("ignored-ids") are mutually exclusive. Only one can be specified.');
        }
        this._includedIds = parsed;
        if (this._rawTreeData) {
          this.renderTree(this._rawTreeData);
        }
        break;
      }
      case 'ignored-ids':
      case 'exclude-ids': {
        const hasInclude = (this.hasAttribute('include-ids') && this.getAttribute('include-ids') !== '') ||
                           (this.hasAttribute('included-ids') && this.getAttribute('included-ids') !== '') ||
                           this._includedIds.size > 0;
        const parsed = parseIds(newValue);
        if (parsed.size > 0 && hasInclude) {
          throw new Error('openatlas-vocabulary-viewer: "include-ids" and "exclude-ids" ("ignored-ids") are mutually exclusive. Only one can be specified.');
        }
        this._ignoredIds = parsed;
        if (this._rawTreeData) {
          this.renderTree(this._rawTreeData);
        }
        break;
      }
      default:
        break;
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Public API                                                             */
  /* ---------------------------------------------------------------------- */

  /**
   * Set the list of IDs to ignore/exclude from the vocabulary tree and detail views.
   * Excluded items and all their descendants will not be displayed.
   * @param {Array<number|string>|Set<number|string>|string|number|null|undefined} ids
   * @returns {this}
   */
  setIgnoredIds(ids) {
    this.ignoredIds = ids;
    return this;
  }

  /**
   * Set the list of IDs to exclude (alias for setIgnoredIds).
   * @param {Array<number|string>|Set<number|string>|string|number|null|undefined} ids
   * @returns {this}
   */
  setExcludeIds(ids) {
    return this.setIgnoredIds(ids);
  }

  /**
   * Get the current array of ignored IDs.
   * @returns {number[]}
   */
  getIgnoredIds() {
    return this.ignoredIds;
  }

  /**
   * Get the current array of excluded IDs (alias for getIgnoredIds).
   * @returns {number[]}
   */
  getExcludeIds() {
    return this.ignoredIds;
  }

  /**
   * Add one or more IDs to the ignore list.
   * @param {...(number|string|Array<number|string>)} ids
   * @returns {this}
   */
  addIgnoredId(...ids) {
    return this.addIgnoredIds(...ids);
  }

  /**
   * Add one or more IDs to the ignore list.
   * @param {...(number|string|Array<number|string>)} ids
   * @returns {this}
   */
  addIgnoredIds(...ids) {
    if (this._includedIds.size > 0 || (this.hasAttribute('include-ids') && this.getAttribute('include-ids') !== '') || (this.hasAttribute('included-ids') && this.getAttribute('included-ids') !== '')) {
      throw new Error('openatlas-vocabulary-viewer: "include-ids" and "exclude-ids" ("ignored-ids") are mutually exclusive. Only one can be specified.');
    }
    for (const id of ids.flat(Infinity)) {
      const parsed = parseIds(id);
      for (const item of parsed) this._ignoredIds.add(item);
    }
    if (this._rawTreeData) {
      this.renderTree(this._rawTreeData);
    }
    return this;
  }

  /**
   * Remove one or more IDs from the ignore list.
   * @param {...(number|string|Array<number|string>)} ids
   * @returns {this}
   */
  removeIgnoredId(...ids) {
    return this.removeIgnoredIds(...ids);
  }

  /**
   * Remove one or more IDs from the ignore list.
   * @param {...(number|string|Array<number|string>)} ids
   * @returns {this}
   */
  removeIgnoredIds(...ids) {
    for (const id of ids.flat(Infinity)) {
      const parsed = parseIds(id);
      for (const item of parsed) this._ignoredIds.delete(item);
    }
    if (this._rawTreeData) {
      this.renderTree(this._rawTreeData);
    }
    return this;
  }

  /**
   * Clear all ignored IDs, restoring full visibility of the vocabulary tree.
   * @returns {this}
   */
  clearIgnoredIds() {
    this._ignoredIds.clear();
    if (this._rawTreeData) {
      this.renderTree(this._rawTreeData);
    }
    return this;
  }

  /**
   * Clear all excluded IDs (alias for clearIgnoredIds).
   * @returns {this}
   */
  clearExcludeIds() {
    return this.clearIgnoredIds();
  }

  /**
   * Check whether a specific ID is currently configured to be ignored.
   * @param {number|string} id
   * @returns {boolean}
   */
  isIgnored(id) {
    return this._ignoredIds.has(Number(id)) || this._ignoredIds.has(id) || this._ignoredIds.has(String(id));
  }

  /**
   * Check whether a specific ID is excluded (alias for isIgnored).
   * @param {number|string} id
   * @returns {boolean}
   */
  isExcluded(id) {
    return this.isIgnored(id);
  }

  /**
   * Set the list of IDs to include in the vocabulary tree and detail views.
   * When include-ids is active, only matching hierarchies/types and their subtrees are shown.
   * @param {Array<number|string>|Set<number|string>|string|number|null|undefined} ids
   * @returns {this}
   */
  setIncludedIds(ids) {
    this.includedIds = ids;
    return this;
  }

  /**
   * Set the list of IDs to include (alias for setIncludedIds).
   * @param {Array<number|string>|Set<number|string>|string|number|null|undefined} ids
   * @returns {this}
   */
  setIncludeIds(ids) {
    return this.setIncludedIds(ids);
  }

  /**
   * Get the current array of included IDs.
   * @returns {number[]}
   */
  getIncludedIds() {
    return this.includedIds;
  }

  /**
   * Get the current array of included IDs (alias for getIncludedIds).
   * @returns {number[]}
   */
  getIncludeIds() {
    return this.includedIds;
  }

  /**
   * Add one or more IDs to the include list.
   * @param {...(number|string|Array<number|string>)} ids
   * @returns {this}
   */
  addIncludedId(...ids) {
    return this.addIncludedIds(...ids);
  }

  /**
   * Add one or more IDs to the include list.
   * @param {...(number|string|Array<number|string>)} ids
   * @returns {this}
   */
  addIncludedIds(...ids) {
    if (this._ignoredIds.size > 0 || (this.hasAttribute('exclude-ids') && this.getAttribute('exclude-ids') !== '') || (this.hasAttribute('ignored-ids') && this.getAttribute('ignored-ids') !== '')) {
      throw new Error('openatlas-vocabulary-viewer: "include-ids" and "exclude-ids" ("ignored-ids") are mutually exclusive. Only one can be specified.');
    }
    for (const id of ids.flat(Infinity)) {
      const parsed = parseIds(id);
      for (const item of parsed) this._includedIds.add(item);
    }
    if (this._rawTreeData) {
      this.renderTree(this._rawTreeData);
    }
    return this;
  }

  /**
   * Remove one or more IDs from the include list.
   * @param {...(number|string|Array<number|string>)} ids
   * @returns {this}
   */
  removeIncludedId(...ids) {
    return this.removeIncludedIds(...ids);
  }

  /**
   * Remove one or more IDs from the include list.
   * @param {...(number|string|Array<number|string>)} ids
   * @returns {this}
   */
  removeIncludedIds(...ids) {
    for (const id of ids.flat(Infinity)) {
      const parsed = parseIds(id);
      for (const item of parsed) this._includedIds.delete(item);
    }
    if (this._rawTreeData) {
      this.renderTree(this._rawTreeData);
    }
    return this;
  }

  /**
   * Clear all included IDs, restoring full visibility of the vocabulary tree.
   * @returns {this}
   */
  clearIncludedIds() {
    this._includedIds.clear();
    if (this._rawTreeData) {
      this.renderTree(this._rawTreeData);
    }
    return this;
  }

  /**
   * Clear all included IDs (alias for clearIncludedIds).
   * @returns {this}
   */
  clearIncludeIds() {
    return this.clearIncludedIds();
  }

  /**
   * Check whether a specific ID is configured in included IDs.
   * @param {number|string} id
   * @returns {boolean}
   */
  isIncluded(id) {
    return this._includedIds.has(Number(id)) || this._includedIds.has(id) || this._includedIds.has(String(id));
  }

  /**
   * Check whether a specific ID is visible under current filter rules (include or exclude).
   * @param {number|string} id
   * @returns {boolean}
   */
  isVisible(id) {
    if (this._includedIds.size > 0 && this._ignoredIds.size > 0) {
      throw new Error('openatlas-vocabulary-viewer: "include-ids" and "exclude-ids" ("ignored-ids") are mutually exclusive. Only one can be specified.');
    }
    if (this._ignoredIds.size > 0) {
      return !this.isIgnored(id);
    }
    if (this._includedIds.size > 0) {
      if (this._visibleNodeIds.size > 0) {
        return this._visibleNodeIds.has(Number(id)) || this._visibleNodeIds.has(id) || this._visibleNodeIds.has(String(id));
      }
      return this.isIncluded(id);
    }
    return true;
  }

  /**
   * Clear all filter rules (both include and exclude).
   * @returns {this}
   */
  clearFilters() {
    this._ignoredIds.clear();
    this._includedIds.clear();
    if (this._rawTreeData) {
      this.renderTree(this._rawTreeData);
    }
    return this;
  }

  /**
   * Switch the UI language at runtime.
   * @param {'en'|'de'} lang
   * @returns {void}
   */
  setLanguage(lang) {
    this.setAttribute('lang', lang === 'de' ? 'de' : 'en');
  }

  /**
   * Set the header title at runtime. Overrides the default localized title.
   * Pass null or an empty string to restore the default title.
   * @param {string|null} title Custom title text, or null/empty to reset to localized default.
   * @returns {this}
   */
  setTitle(title) {
    this.headerTitle = title;
    return this;
  }

  /**
   * Get the current effective title (custom title if set, otherwise localized default).
   * @returns {string}
   */
  getTitle() {
    return this.headerTitle || this._fetchedTitle || this.#labels.title;
  }

  /**
   * Reset title to the default localized title.
   * @returns {this}
   */
  resetTitle() {
    this.headerTitle = null;
    this._fetchedTitle = null;
    this.#applyStaticLabels();
    return this;
  }

  /**
   * Set a custom title endpoint to dynamically fetch the title from a backend API.
   * @param {string|null} url Endpoint URL.
   * @returns {this}
   */
  setTitleEndpoint(url) {
    this.titleEndpoint = url;
    if (url) {
      this.loadTitle();
    }
    return this;
  }

  /**
   * Fetch the title from the configured `title-endpoint`.
   * Accepts JSON ({ title: "..." }, { name: "..." }, { label: "..." }, { text: "..." }) or plain text.
   * @param {string} [url] Optional URL override.
   * @returns {Promise<string>}
   * @fires oa-title-loaded
   * @fires oa-vocabulary-error
   */
  async loadTitle(url = this.titleEndpoint) {
    if (!url) return this.getTitle();
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json, text/plain, */*' } });
      if (!res.ok) throw new Error(`HTTP ${res.status} while loading title`);
      const contentType = res.headers.get('content-type') || '';
      let titleText = '';
      if (contentType.includes('application/json')) {
        const json = await res.json();
        titleText = typeof json === 'string'
          ? json
          : (json?.title || json?.name || json?.label || json?.text || json?.value || json?.headerTitle || JSON.stringify(json));
      } else {
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          titleText = typeof json === 'string'
            ? json
            : (json?.title || json?.name || json?.label || json?.text || json?.value || json?.headerTitle || text);
        } catch (_e) {
          titleText = text.trim();
        }
      }
      if (titleText) {
        this._fetchedTitle = titleText;
        this.#applyStaticLabels();
        this.dispatchEvent(new CustomEvent('oa-title-loaded', {
          bubbles: true, composed: true, detail: { title: titleText, url }
        }));
      }
      return titleText;
    } catch (error) {
      this.#emitError(error, 'title');
      return this.getTitle();
    }
  }

  /**
   * Set the sidebar / master column width at runtime.
   * Accepts pixel numbers (e.g. 350) or CSS units (e.g. '350px', '22rem', '30%').
   * @param {string|number} width
   * @returns {this}
   */
  setSidebarWidth(width) {
    this.sidebarWidth = width;
    return this;
  }

  /**
   * Alias for setSidebarWidth.
   * @param {string|number} width
   * @returns {this}
   */
  setMasterWidth(width) {
    return this.setSidebarWidth(width);
  }

  /**
   * Get the configured sidebar width.
   * @returns {string}
   */
  getSidebarWidth() {
    return this.sidebarWidth;
  }

  /**
   * Alias for getSidebarWidth.
   * @returns {string}
   */
  getMasterWidth() {
    return this.sidebarWidth;
  }

  /**
   * Enable or disable user-interactive sidebar resizing.
   * @param {boolean} resizable
   * @returns {this}
   */
  setResizable(resizable) {
    this.resizable = resizable;
    return this;
  }

  /**
   * Check whether sidebar resizing is enabled.
   * @returns {boolean}
   */
  isResizable() {
    return this.resizable;
  }

  /**
   * Set the font family at runtime.
   * @param {string|null} fontFamily CSS font-family string (e.g. 'Roboto, sans-serif').
   * @returns {void}
   */
  setFontFamily(fontFamily) {
    this.fontFamily = fontFamily;
  }

  /**
   * Set the font size at runtime.
   * @param {string|number|null} fontSize CSS font-size (e.g. '14px', '1rem', or 14 for 14px).
   * @returns {void}
   */
  setFontSize(fontSize) {
    this.fontSize = fontSize != null ? String(fontSize) : null;
  }

  /**
   * Configure both font family and font size simultaneously.
   * @param {{ fontFamily?: string|null, fontSize?: string|number|null }} options
   * @returns {void}
   */
  setFont({ fontFamily, fontSize } = {}) {
    if (fontFamily !== undefined) this.setFontFamily(fontFamily);
    if (fontSize !== undefined) this.setFontSize(fontSize);
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
        bubbles: true, composed: true, detail: { data: this._treeData, rawData: data }
      }));
    } catch (error) {
      this.#showTreeError(error);
      this.#emitError(error, 'tree');
    }
  }

  /**
   * Render (or re-render) the tree from externally supplied data. This is
   * network-independent and can be driven by a host that supplies its own data.
   * Applies any configured include/ignored IDs.
   * @param {VocabularyTreeResponse} data
   * @returns {void}
   */
  renderTree(data) {
    this._rawTreeData = data;
    if (this._includedIds.size > 0 && this._ignoredIds.size > 0) {
      throw new Error('openatlas-vocabulary-viewer: "include-ids" and "exclude-ids" ("ignored-ids") are mutually exclusive. Only one can be specified.');
    }
    const filtered = filterVocabularyTree(data, {
      excludeIds: this._ignoredIds,
      includeIds: this._includedIds
    });
    this._treeData = filtered;

    this._visibleNodeIds = new Set();
    const collectIds = (node) => {
      if (!node) return;
      this._visibleNodeIds.add(node.id);
      const num = Number(node.id);
      if (!isNaN(num)) this._visibleNodeIds.add(num);
      if (Array.isArray(node.children)) {
        node.children.forEach(collectIds);
      }
    };
    for (const category of CATEGORY_ORDER) {
      if (Array.isArray(filtered?.[category])) {
        filtered[category].forEach(collectIds);
      }
    }

    const container = this.shadowRoot.getElementById('tree-container');
    if (!container) return;

    if (this._activeId != null && !this.isVisible(this._activeId)) {
      this._activeId = null;
      const panel = this.shadowRoot.getElementById('detail-panel');
      if (panel) {
        panel.innerHTML = `
          <div id="oa-empty-detail" class="oa-empty-detail text-center text-body-secondary p-5">
            <div class="oa-empty-title h6">${esc(this.#labels.emptyDetail)}</div>
            <div class="oa-empty-hint small">${esc(this.#labels.emptyDetailHint)}</div>
          </div>
        `;
      }
    }

    container.innerHTML = '';
    const frag = document.createDocumentFragment();

    let total = 0;
    for (const category of CATEGORY_ORDER) {
      const items = Array.isArray(filtered?.[category]) ? filtered[category] : [];
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
    if (!this.isVisible(id)) {
      this._activeId = null;
      const panel = this.shadowRoot.getElementById('detail-panel');
      if (panel) {
        panel.innerHTML = `
          <div id="oa-empty-detail" class="oa-empty-detail text-center text-body-secondary p-5">
            <div class="oa-empty-title h6">${esc(this.#labels.emptyDetail)}</div>
            <div class="oa-empty-hint small">${esc(this.#labels.emptyDetailHint)}</div>
          </div>
        `;
      }
      return;
    }

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
    const isSelectable = item.selectable !== false;
    li.dataset.selectable = String(isSelectable);

    const row = document.createElement('div');
    row.className = 'oa-node-row';
    if (!isSelectable) row.classList.add('oa-non-selectable');
    row.style.setProperty('--oa-depth', String(depth));

    const hasChildren = Array.isArray(item.children) && item.children.length > 0;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'oa-toggle';
    toggle.setAttribute('aria-label', 'toggle');
    if (hasChildren) {
      toggle.textContent = expand ? '\u25BE' : '\u25B8';
      toggle.dataset.expanded = String(expand);
    } else {
      toggle.classList.add('oa-toggle-empty');
      toggle.textContent = '';
      toggle.disabled = true;
    }
    row.appendChild(toggle);

    if (!isSelectable) {
      const structIcon = document.createElement('span');
      structIcon.className = 'oa-tree-icon';
      structIcon.setAttribute('aria-hidden', 'true');
      structIcon.textContent = '\uD83D\uDCC1'; // 📁 folder icon for grouping nodes
      structIcon.title = this.#labels.structuralNodeHint;
      row.appendChild(structIcon);
    }

    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'oa-label';
    label.textContent = item.name || `#${item.id}`;
    if (!isSelectable) {
      label.title = `${item.name || `#${item.id}`} (${this.#labels.notAssignable})`;
    } else if (Array.isArray(item.classes) && item.classes.length) {
      label.title = `${item.name || `#${item.id}`} [${item.classes.map(capitalize).join(', ')}]`;
    }
    row.appendChild(label);

    // Entity counts (direct and subtypes)
    const entityCount = item.entityCount ?? item.count ?? 0;
    const entityCountSubs = item.entityCountSubs ?? item.countSubs ?? 0;

    if (entityCount > 0 || entityCountSubs > 0) {
      const countsWrap = document.createElement('span');
      countsWrap.className = 'oa-tree-counts';

      if (entityCount > 0) {
        const directBadge = document.createElement('span');
        directBadge.className = 'badge rounded-pill oa-badge-count-direct';
        directBadge.textContent = String(entityCount);
        directBadge.title = `${this.#labels.directEntities}: ${entityCount}`;
        countsWrap.appendChild(directBadge);
      }

      if (entityCountSubs > 0) {
        const subsBadge = document.createElement('span');
        subsBadge.className = 'badge rounded-pill oa-badge-count-subs';
        subsBadge.textContent = `+${entityCountSubs}`;
        subsBadge.title = `${this.#labels.subtypesEntities}: ${entityCountSubs}`;
        countsWrap.appendChild(subsBadge);
      }

      row.appendChild(countsWrap);
    }

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
        toggle.textContent = nowExpanded ? '\u25BE' : '\u25B8';
        if (nowExpanded) this.#buildChildren(li);
        childUl.hidden = !nowExpanded;
      });
    }

    row.addEventListener('click', (e) => {
      if (e.target.closest('.oa-toggle')) return;
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

  /**
   * Find the path of node IDs from root to the given target node id.
   * @param {number} targetId
   * @returns {number[]|null} Array of node IDs including targetId, or null if not found.
   */
  #findPathToNode(targetId) {
    if (!this._treeData) return null;

    const findInNodes = (nodes, path) => {
      for (const node of nodes) {
        const currentPath = [...path, node.id];
        if (node.id === targetId) return currentPath;
        if (Array.isArray(node.children) && node.children.length > 0) {
          const res = findInNodes(node.children, currentPath);
          if (res) return res;
        }
      }
      return null;
    };

    for (const cat of CATEGORY_ORDER) {
      const items = Array.isArray(this._treeData[cat]) ? this._treeData[cat] : [];
      const res = findInNodes(items, []);
      if (res) return res;
    }
    return null;
  }

  /** Mark the node with the given id active, expand ancestors, and clear previous highlight. @param {number} id */
  #highlightActive(id) {
    this.#revealInTree(id);
    this.shadowRoot.querySelectorAll('.oa-node-row.active')
      .forEach((el) => el.classList.remove('active'));

    const escTarget = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(String(id)) : String(id);
    const li = this.shadowRoot.querySelector(`.oa-node[data-id="${escTarget}"]`);
    if (li) {
      const row = li.querySelector(':scope > .oa-node-row');
      if (row) {
        row.classList.add('active');
        if (typeof row.scrollIntoView === 'function') {
          row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
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
   * query by name or classes or that have a descendant which matches. Used to build the
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
      const nameMatch = (item.name || '').toLowerCase().includes(q);
      const classMatch = Array.isArray(item.classes) && item.classes.some((c) => String(c).toLowerCase().includes(q));
      if (nameMatch || classMatch || children.length) {
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

    // Image (with link to high-res fileUrl and creator/license info)
    const image = this.#renderImage(item.image);

    // Header: title + category badge + selectable badge + counts + class, side-by-side with image thumbnail
    const catName = item.category ? (L.categories[item.category] || item.category) : '';
    const isSelectable = item.selectable !== false;
    const directCount = item.entityCount ?? item.count;
    const subsCount = item.entityCountSubs ?? item.countSubs;

    parts.push(`
      <div class="oa-detail-header-wrap d-flex justify-content-between align-items-start gap-3 mb-2 flex-wrap">
        <div class="oa-detail-header flex-grow-1">
          <h2 class="oa-detail-title h4 mb-2">${esc(item.name)}</h2>
          <div class="oa-badges mb-2">
            ${catName ? `<span class="badge oa-badge">${esc(catName)}</span>` : ''}
            ${isSelectable
              ? `<span class="badge text-bg-success" title="${esc(L.assignableHint)}">${esc(L.assignable)}</span>`
              : `<span class="badge text-bg-warning text-dark" title="${esc(L.structuralNodeHint)}">${esc(L.notAssignable)}</span>`
            }
            ${directCount != null ? `<span class="badge oa-count-badge" title="${esc(L.directEntities)}">${L.entities}: ${esc(directCount)}</span>` : ''}
            ${subsCount != null ? `<span class="badge oa-count-badge" title="${esc(L.subtypesEntities)}">${L.entitiesSubs}: ${esc(subsCount)}</span>` : ''}
            ${item.class && item.class !== 'type' ? `<span class="badge oa-class-badge">${esc(capitalize(item.class))}</span>` : ''}
          </div>
        </div>
        ${image ? `<div class="oa-detail-header-image flex-shrink-0 ms-auto">${image}</div>` : ''}
      </div>
    `);

    // Notice for structural grouping nodes (not assignable to entities)
    if (!isSelectable) {
      parts.push(`
        <div class="alert alert-warning py-2 px-3 small my-2" role="status">
          <strong>${esc(L.notAssignable)}:</strong> ${esc(L.structuralNodeHint)}
        </div>
      `);
    }

    // Description
    if (item.description) {
      parts.push(`
        <div class="oa-section mt-3">
          <label class="oa-field-label">${esc(L.description)}</label>
          <p class="oa-description mb-0">${esc(item.description)}</p>
        </div>
      `);
    }

    // Valid entity classes
    const classes = this.#renderClasses(item.classes);
    if (classes) parts.push(classes);

    // Direct sub-types
    const subtypes = this.#renderSubtypes(item.subTypes);
    if (subtypes) parts.push(subtypes);

    // Timespan
    const timespan = this.#renderTimespan(item.timespan);
    if (timespan) parts.push(timespan);

    // External references
    const extRefs = this.#renderExternalReferences(item.externalReferences);
    if (extRefs) parts.push(extRefs);

    // Bibliography
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

    // Wire up navigation clicks for breadcrumb parents and direct subtypes
    panel.querySelectorAll('[data-nav-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const navId = parseInt(btn.dataset.navId, 10);
        if (!isNaN(navId)) this.loadDetail(navId);
      });
    });
  }

  /**
   * Build a breadcrumb path with clickable links for ancestors, looking up
   * names in the currently loaded tree or the item's parents/root data.
   * Excludes any ancestor that is not visible under current filter rules.
   * @param {VocabularyFlatItem} item
   * @returns {string} HTML or empty string.
   */
  #renderBreadcrumb(item) {
    let ancestors = this.#findAncestorPath(item.id);
    if (!ancestors.length) {
      if (Array.isArray(item.parents) && item.parents.length) {
        ancestors = item.parents
          .filter((p) => this.isVisible(typeof p === 'object' && p !== null ? p.id : p))
          .map((p) => {
            if (typeof p === 'object' && p !== null) {
              return { id: p.id, name: p.name || this.#findNodeName(p.id) || `#${p.id}` };
            }
            return { id: p, name: this.#findNodeName(p) || `#${p}` };
          });
      } else if (Array.isArray(item.root) && item.root.length) {
        ancestors = item.root
          .filter((id) => this.isVisible(typeof id === 'object' && id !== null ? id.id : id))
          .map((id) => {
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
   * Render valid entity classes badges.
   * @param {string[]|null|undefined} classes
   * @returns {string} HTML or empty string.
   */
  #renderClasses(classes) {
    if (!Array.isArray(classes) || !classes.length) return '';
    const L = this.#labels;
    const badges = classes.map((c) => `<span class="badge oa-class-badge">${esc(capitalize(c))}</span>`).join(' ');
    return `
      <div class="oa-section mt-3">
        <label class="oa-field-label">${esc(L.classes)}</label>
        <div class="oa-badges">${badges}</div>
      </div>
    `;
  }

  /**
   * Render direct sub-types as interactive navigation buttons.
   * Excludes any subtype that is not visible under current filter rules.
   * @param {LinkedTypeItem[]|null|undefined} subTypes
   * @returns {string} HTML or empty string.
   */
  #renderSubtypes(subTypes) {
    if (!Array.isArray(subTypes) || !subTypes.length) return '';
    const visibleSubtypes = subTypes.filter((sub) => {
      const id = typeof sub === 'object' && sub !== null ? sub.id : sub;
      return this.isVisible(id);
    });
    if (!visibleSubtypes.length) return '';
    const L = this.#labels;
    const items = visibleSubtypes.map((sub) => `
      <button type="button" class="btn btn-sm btn-outline-secondary oa-nav-link-btn" data-nav-id="${sub.id}" title="${esc(sub.name)}">
        ${esc(sub.name)}
      </button>
    `).join(' ');
    return `
      <div class="oa-section mt-3">
        <label class="oa-field-label">${esc(L.subtypes)} (${visibleSubtypes.length})</label>
        <div class="oa-badges">${items}</div>
      </div>
    `;
  }

  /**
   * Render timespan information (start, end dates and comments).
   * @param {TimeSpan|null|undefined} timespan
   * @returns {string} HTML or empty string.
   */
  #renderTimespan(timespan) {
    if (!timespan || (!timespan.start && !timespan.end)) return '';
    const L = this.#labels;
    const formatDate = (d) => {
      if (!d) return '';
      if (d.earliest && d.latest && d.earliest !== d.latest) {
        return `${d.earliest} \u2013 ${d.latest}`;
      }
      return d.earliest || d.latest || '';
    };

    const parts = [];
    const startStr = formatDate(timespan.start);
    const endStr = formatDate(timespan.end);

    if (startStr && endStr) {
      parts.push(`${L.from}: ${startStr} \u2014 ${L.to}: ${endStr}`);
    } else if (startStr) {
      parts.push(`${L.from}: ${startStr}`);
    } else if (endStr) {
      parts.push(`${L.to}: ${endStr}`);
    }

    const comments = [timespan.start?.comment, timespan.end?.comment].filter(Boolean);
    const commentStr = comments.length ? `<small class="text-body-secondary d-block mt-1">${esc(comments.join('; '))}</small>` : '';

    if (!parts.length && !commentStr) return '';

    return `
      <div class="oa-section mt-3">
        <label class="oa-field-label">${esc(L.timespan)}</label>
        <div class="oa-timespan">${esc(parts.join(', '))}${commentStr}</div>
      </div>
    `;
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
      const match = ref.match_type || ref.match || '';
      const desc = ref.description || '';
      const titleParts = [];
      if (match) titleParts.push(`[${match}]`);
      if (desc) titleParts.push(desc);
      if (ref.identifier) titleParts.push(`ID: ${ref.identifier}`);
      const title = titleParts.join(' ');

      if (href) {
        return `<a class="badge oa-ext-badge text-decoration-none" href="${esc(href)}" target="_blank" rel="noopener noreferrer" title="${esc(title)}">${esc(text)} \u2197</a>`;
      }
      return `<span class="badge oa-ext-badge" title="${esc(title)}">${esc(text)}</span>`;
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
    if (!ref) return '';
    const id = (ref.identifier || '').trim();
    const url = (ref.url || '').trim();
    const resolver = (ref.resolverUrl || '').trim();
    const refUrl = (ref.referenceUrl || '').trim();

    // 1. If identifier itself is an absolute URL (e.g. Wikidata URI, Getty AAT URI, ChronOntology URI),
    // it points directly to the external entity record.
    if (/^https?:\/\//i.test(id)) return id;

    // 2. If id is present and url is a base resolver prefix (e.g. url: "https://vocab.getty.edu/aat/", id: "300027621")
    if (id && /^https?:\/\//i.test(url)) {
      if (url.includes(id)) return url;
      return url.endsWith('/') || url.endsWith('=') ? `${url}${id}` : `${url}/${id}`;
    }

    // 3. Legacy resolverUrl / referenceUrl with id
    if (id && /^https?:\/\//i.test(resolver)) {
      return resolver.endsWith('/') || resolver.endsWith('=') ? `${resolver}${id}` : `${resolver}/${id}`;
    }
    if (id && /^https?:\/\//i.test(refUrl)) {
      return refUrl.endsWith('/') || refUrl.endsWith('=') ? `${refUrl}${id}` : `${refUrl}/${id}`;
    }

    // 4. If url is an exact entity link (absolute URL not ending in a directory slash)
    if (/^https?:\/\//i.test(url) && !url.endsWith('/')) {
      return url;
    }

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
      const typeBadge = r.type ? ` <span class="badge oa-count-badge">${esc(r.type)}</span>` : '';
      return `<li class="oa-biblio-item">${this.#linkify(cite)}${pages}${typeBadge}</li>`;
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
    // Prefer fileUrl (the direct binary display endpoint /files/{id}/display) because
    // thumbnailUrl may 404 when imageProcessing is disabled on the OpenAtlas server.
    const primarySrc = image.fileUrl || image.thumbnailUrl;
    const fallbackSrc = image.thumbnailUrl || image.fileUrl;
    if (!primarySrc) return '';

    const L = this.#labels;
    const creators = Array.isArray(image.creators) ? image.creators.map((c) => c.name).filter(Boolean).join(', ') : '';
    const licenseName = image.license?.name || '';
    const metaParts = [];
    if (creators) metaParts.push(creators);
    if (licenseName) metaParts.push(licenseName);

    const fullUrl = image.fileUrl || primarySrc;

    return `
      <div class="oa-image">
        <a href="${esc(fullUrl)}" target="_blank" rel="noopener noreferrer" title="${esc(image.name || L.image)}">
          <img src="${esc(primarySrc)}"
               data-fallback="${esc(fallbackSrc)}"
               alt="${esc(image.name || L.image)}"
               class="img-fluid rounded"
               loading="lazy"
               onerror="if (this.dataset.fallback && this.src !== this.dataset.fallback) { this.src = this.dataset.fallback; } else { this.style.display='none'; }">
        </a>
        ${metaParts.length ? `<div class="oa-image-meta small mt-1 text-end">${esc(metaParts.join(' \u2022 '))}</div>` : ''}
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
    const title = this.shadowRoot?.getElementById('oa-title');
    if (title) {
      const custom = this.headerTitle || this._fetchedTitle;
      title.textContent = custom || L.title;
    }
    const search = this.shadowRoot?.getElementById('search');
    if (search) search.setAttribute('placeholder', L.searchPlaceholder);
    const empty = this.shadowRoot?.getElementById('oa-empty-detail');
    if (empty) {
      empty.querySelector('.oa-empty-title').textContent = L.emptyDetail;
      empty.querySelector('.oa-empty-hint').textContent = L.emptyDetailHint;
    }
  }

  /**
   * Wire mouse, touch, and keyboard interactions for the resizable splitter between
   * the master tree sidebar and the detail column.
   */
  #wireResizer() {
    if (this._resizerWired) return;
    const resizer = this.shadowRoot?.getElementById('oa-resizer');
    const root = this.shadowRoot?.querySelector('.oa-root');
    const master = this.shadowRoot?.getElementById('oa-master');
    const body = this.shadowRoot?.getElementById('oa-body');
    if (!resizer || !root || !master || !body) return;

    let startX = 0;
    let startWidth = 0;

    const onPointerMove = (e) => {
      const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
      if (clientX === undefined) return;
      const dx = clientX - startX;
      const totalWidth = body.getBoundingClientRect().width;
      const minW = 180;
      const maxW = Math.max(minW, totalWidth - 180);
      const newWidth = Math.min(Math.max(startWidth + dx, minW), maxW);

      const pxVal = `${Math.round(newWidth)}px`;
      this.style.setProperty('--oa-master-width', pxVal);
      resizer.setAttribute('aria-valuenow', String(Math.round(newWidth)));
      this.dispatchEvent(new CustomEvent('oa-sidebar-resized', {
        bubbles: true, composed: true, detail: { width: Math.round(newWidth), widthCss: pxVal }
      }));
    };

    const onPointerUp = () => {
      root.classList.remove('oa-is-resizing');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
    };

    const onPointerDown = (e) => {
      if (!this.resizable) return;
      if (e.button !== undefined && e.button !== 0) return;
      startX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
      if (startX === undefined) return;
      startWidth = master.getBoundingClientRect().width;
      root.classList.add('oa-is-resizing');

      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
      window.addEventListener('touchmove', onPointerMove, { passive: false });
      window.addEventListener('touchend', onPointerUp);
      window.addEventListener('mousemove', onPointerMove);
      window.addEventListener('mouseup', onPointerUp);
      e.preventDefault();
    };

    resizer.addEventListener('pointerdown', onPointerDown);
    resizer.addEventListener('touchstart', onPointerDown, { passive: false });
    resizer.addEventListener('mousedown', onPointerDown);

    resizer.addEventListener('keydown', (e) => {
      if (!this.resizable) return;
      const currentWidth = master.getBoundingClientRect().width;
      const totalWidth = body.getBoundingClientRect().width;
      const minW = 180;
      const maxW = Math.max(minW, totalWidth - 180);
      const step = e.shiftKey ? 30 : 10;
      let newWidth = currentWidth;

      if (e.key === 'ArrowLeft') {
        newWidth = Math.max(currentWidth - step, minW);
      } else if (e.key === 'ArrowRight') {
        newWidth = Math.min(currentWidth + step, maxW);
      } else if (e.key === 'Home') {
        newWidth = minW;
      } else if (e.key === 'End') {
        newWidth = Math.min(500, maxW);
      } else {
        return;
      }

      e.preventDefault();
      const pxVal = `${Math.round(newWidth)}px`;
      this.style.setProperty('--oa-master-width', pxVal);
      resizer.setAttribute('aria-valuenow', String(Math.round(newWidth)));
      this.dispatchEvent(new CustomEvent('oa-sidebar-resized', {
        bubbles: true, composed: true, detail: { width: Math.round(newWidth), widthCss: pxVal }
      }));
    });

    this._resizerWired = true;
  }

  /**
   * Synchronize the `font-family` and `font-size` attributes to CSS custom
   * properties on the host element so they pierce into the Shadow DOM.
   */
  #applyFont() {
    if (this.hasAttribute('font-family')) {
      const ff = this.getAttribute('font-family');
      if (ff && ff.trim()) {
        this.style.setProperty('--oa-font-family', ff.trim());
      } else {
        this.style.removeProperty('--oa-font-family');
      }
    } else {
      this.style.removeProperty('--oa-font-family');
    }

    if (this.hasAttribute('font-size')) {
      let fs = this.getAttribute('font-size');
      if (fs && fs.trim()) {
        fs = fs.trim();
        if (/^\d+(\.\d+)?$/.test(fs)) {
          fs = `${fs}px`;
        }
        this.style.setProperty('--oa-font-size', fs);
      } else {
        this.style.removeProperty('--oa-font-size');
      }
    } else {
      this.style.removeProperty('--oa-font-size');
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
        <div class="oa-body" id="oa-body">
          <div class="oa-master" id="oa-master">
            <div id="tree-container" class="oa-tree-container"></div>
          </div>
          <div class="oa-resizer" id="oa-resizer" role="separator" aria-orientation="vertical" aria-label="Resize tree sidebar" tabindex="0">
            <div class="oa-resizer-handle"></div>
          </div>
          <div class="oa-detail-col" id="oa-detail-col">
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
        --oa-class-badge-bg: var(--oa-hover-bg);
        --oa-class-badge-text: var(--oa-text);
        --oa-font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        --oa-font-size: 1rem;
        --oa-height: 600px;
        --oa-master-width: 350px;
        --oa-sidebar-width: var(--oa-master-width);

        /* Map onto Bootstrap where useful. */
        --bs-primary: var(--oa-primary);
        --bs-link-color: var(--oa-link);
        --bs-body-color: var(--oa-text);
        --bs-body-bg: var(--oa-bg);
        --bs-border-color: var(--oa-border);
        --bs-body-font-family: var(--oa-font-family);
        --bs-body-font-size: var(--oa-font-size);
        --bs-secondary-rgb: 108, 117, 125;
        --bs-secondary-color: var(--oa-muted);
        --bs-secondary-bg: var(--oa-hover-bg);
        --bs-light-rgb: 248, 249, 250;
        --bs-dark-rgb: 33, 37, 41;
        --bs-success-rgb: 25, 135, 84;
        --bs-warning-rgb: 255, 193, 7;
        --bs-danger-rgb: 220, 53, 69;

        display: block;
        color: var(--oa-text);
        background: var(--oa-bg);
        font-family: var(--oa-font-family);
        font-size: var(--oa-font-size);
        line-height: 1.5;
        border: 1px solid var(--oa-border);
        border-radius: .5rem;
        overflow: hidden;
      }

      .oa-root {
        display: flex;
        flex-direction: column;
        height: var(--oa-height);
        font-family: var(--oa-font-family);
        font-size: var(--oa-font-size);
      }

      .oa-root input,
      .oa-root button,
      .oa-root select,
      .oa-root textarea {
        font-family: inherit;
      }

      .oa-header { padding: .75rem 1rem; border-bottom: 1px solid var(--oa-border); background: var(--oa-bg); }
      .oa-header-title { color: var(--oa-text); margin: 0; font-size: 1.15em; font-weight: 600; line-height: 1.3; }
      .oa-search { font-size: .875em; color: var(--oa-text); background-color: var(--oa-bg); border-color: var(--oa-border); }

      .oa-body { display: flex; flex: 1 1 auto; min-height: 0; position: relative; }

      .oa-master {
        width: var(--oa-master-width, 350px);
        min-width: 180px;
        max-width: calc(100% - 180px);
        flex: 0 0 auto;
        overflow: auto;
      }
      .oa-tree-container { padding: .5rem; }

      .oa-resizer {
        width: 7px;
        margin: 0 -3px;
        background: transparent;
        cursor: col-resize;
        position: relative;
        z-index: 5;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s ease, border-color 0.15s ease;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
        flex: 0 0 7px;
        border-left: 1px solid var(--oa-border);
      }
      .oa-resizer:hover, .oa-resizer:focus-visible, .oa-root.oa-is-resizing .oa-resizer {
        background: var(--oa-primary);
        border-left-color: var(--oa-primary);
        outline: none;
      }
      .oa-resizer-handle {
        width: 2px;
        height: 28px;
        border-radius: 1px;
        background: var(--oa-border);
        pointer-events: none;
        transition: background 0.15s ease;
      }
      .oa-resizer:hover .oa-resizer-handle,
      .oa-resizer:focus-visible .oa-resizer-handle,
      .oa-root.oa-is-resizing .oa-resizer-handle {
        background: var(--oa-active-text);
      }
      .oa-root.oa-is-resizing {
        cursor: col-resize !important;
        user-select: none !important;
        -webkit-user-select: none !important;
      }
      .oa-root.oa-is-resizing * {
        user-select: none !important;
        -webkit-user-select: none !important;
        cursor: col-resize !important;
      }
      :host([resizable="false"]) .oa-resizer {
        display: none;
      }
      :host([resizable="false"]) .oa-master {
        border-right: 1px solid var(--oa-border);
      }

      .oa-detail-col { flex: 1 1 auto; overflow: auto; min-width: 200px; }

      .oa-category + .oa-category { margin-top: .75rem; }
      .oa-category-title {
        font-size: .72em; text-transform: uppercase; letter-spacing: .06em;
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
      .oa-node-row.oa-non-selectable .oa-label {
        font-style: italic;
        opacity: .85;
      }

      .oa-tree-icon {
        font-size: .85em;
        line-height: 1;
        flex: 0 0 auto;
        opacity: .75;
      }

      .oa-tree-counts {
        display: inline-flex;
        gap: .25rem;
        align-items: center;
        flex: 0 0 auto;
        margin-left: auto;
        padding-right: .25rem;
      }

      .oa-badge-count-direct {
        background: var(--oa-badge-bg);
        color: var(--oa-badge-text);
        font-size: .7em;
        font-weight: 600;
        padding: .15em .45em;
        border: 1px solid var(--oa-border);
      }

      .oa-badge-count-subs {
        background: var(--oa-hover-bg);
        color: var(--oa-muted);
        font-size: .7em;
        font-weight: 500;
        padding: .15em .45em;
        border: 1px dashed var(--oa-border);
      }

      .oa-node-row.active .oa-badge-count-direct,
      .oa-node-row.active .oa-badge-count-subs {
        background: rgba(255, 255, 255, 0.25);
        color: var(--oa-active-text);
        border-color: rgba(255, 255, 255, 0.4);
      }

      .oa-toggle {
        border: 0; background: transparent; color: var(--oa-muted);
        width: 1.25em; height: 1.25em; line-height: 1; padding: 0;
        cursor: pointer; flex: 0 0 auto; font-size: .8em;
      }
      .oa-toggle-empty { visibility: hidden; }

      .oa-label {
        border: 0; background: transparent; color: var(--oa-text);
        text-align: left; padding: .1rem .25rem; cursor: pointer;
        flex: 1 1 auto; font-size: .9em;
      }
      .oa-label:hover { color: var(--oa-link); }

      .oa-field-label {
        display: block; font-size: .72em; text-transform: uppercase;
        letter-spacing: .05em; color: var(--oa-muted); font-weight: 700;
        margin-bottom: .25rem;
      }

      .oa-detail-title { color: var(--oa-text); font-size: 1.35em; font-weight: 600; line-height: 1.3; }
      .badge {
        display: inline-block;
        padding: .35em .65em;
        font-size: .75em;
        font-weight: 600;
        line-height: 1;
        text-align: center;
        white-space: nowrap;
        vertical-align: baseline;
        border-radius: .375rem;
      }
      .text-bg-success {
        color: #ffffff !important;
        background-color: #198754 !important;
      }
      .text-bg-warning {
        color: #000000 !important;
        background-color: #ffc107 !important;
      }
      .text-bg-secondary {
        color: var(--oa-text) !important;
        background-color: var(--oa-hover-bg) !important;
        border: 1px solid var(--oa-border);
      }
      .text-bg-light {
        color: var(--oa-text) !important;
        background-color: var(--oa-hover-bg) !important;
        border: 1px solid var(--oa-border);
      }
      .oa-badge { background: var(--oa-badge-bg); color: var(--oa-badge-text); font-size: .75em; }
      .oa-ext-badge { background: var(--oa-badge-bg); color: var(--oa-badge-text); font-size: .75em; }
      a.oa-ext-badge:hover { filter: brightness(.95); }

      .oa-uuid-row { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
      .oa-uuid-value {
        background: var(--oa-hover-bg); padding: .2rem .4rem; border-radius: .25rem;
        font-size: .85em; word-break: break-all;
      }
      .oa-copy-btn { border: 1px solid var(--oa-border); color: var(--oa-text); background: var(--oa-bg); font-size: .85em; }
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
      .oa-description { color: var(--oa-text); white-space: pre-wrap; font-size: .95em; }
      .oa-breadcrumb { font-size: .85em; }
      .oa-breadcrumb .breadcrumb-item, .oa-breadcrumb .breadcrumb-item + .breadcrumb-item::before { color: var(--oa-muted); }
      .oa-breadcrumb .breadcrumb-item.active { color: var(--oa-muted); }

      .oa-biblio-item { margin-bottom: .6rem; line-height: 1.4; font-size: .9em; }
      .oa-biblio-item:last-child { margin-bottom: 0; }
      .oa-biblio-item a { color: var(--oa-link); word-break: break-word; }

      .oa-nav-link-btn {
        font-size: .8em;
        padding: .15rem .5rem;
        border-radius: .25rem;
        border: 1px solid var(--oa-border);
        background: var(--oa-bg);
        color: var(--oa-text);
        cursor: pointer;
        transition: background-color .15s, border-color .15s, color .15s;
      }
      .oa-nav-link-btn:hover {
        background: var(--oa-hover-bg);
        color: var(--oa-link);
        border-color: var(--oa-link);
      }
      .oa-crumb-btn {
        color: var(--oa-link);
        font-size: inherit;
        text-decoration: none;
        vertical-align: baseline;
        border: 0;
        background: transparent;
        cursor: pointer;
      }
      .oa-crumb-btn:hover {
        text-decoration: underline;
      }
      .oa-class-badge {
        display: inline-block;
        font-size: .75em;
        font-weight: 500;
        padding: .25em .6em;
        border-radius: .25rem;
        background: var(--oa-class-badge-bg, var(--oa-hover-bg));
        color: var(--oa-class-badge-text, var(--oa-text));
        border: 1px solid var(--oa-border);
        line-height: 1.2;
      }
      .oa-count-badge {
        display: inline-block;
        font-size: .75em;
        font-weight: 500;
        padding: .25em .6em;
        border-radius: .25rem;
        background: var(--oa-hover-bg);
        color: var(--oa-muted);
        border: 1px solid var(--oa-border);
        line-height: 1.2;
      }
      .oa-timespan {
        font-size: .9em;
        color: var(--oa-text);
      }

      .oa-image {
        display: inline-block;
        max-width: 100%;
      }
      .oa-image img {
        max-width: 200px;
        max-height: 160px;
        width: auto;
        height: auto;
        display: block;
        border-radius: .375rem;
        object-fit: contain;
        border: 1px solid var(--oa-border);
        background: var(--oa-hover-bg);
      }
      .oa-image-meta {
        color: var(--oa-muted);
        font-size: .8em;
        max-width: 200px;
        word-break: break-word;
      }

      .oa-empty-detail .oa-empty-title { font-size: 1.1em; font-weight: 600; }
      .oa-empty-detail .oa-empty-hint { font-size: .875em; }
      .oa-loading { font-size: .9em; }
    `;
  }
}

if (typeof customElements !== 'undefined') {
  customElements.define('openatlas-vocabulary-viewer', OpenAtlasVocabularyViewer);
}

export {
  OpenAtlasVocabularyViewer,
  parseIds,
  parseIgnoredIds,
  parseIncludedIds,
  normalizeFilterOptions,
  filterVocabularyItem,
  filterVocabularyTree,
  filterVocabularyDetail,
  createVocabularyFilterAdapter
};

export default OpenAtlasVocabularyViewer;
