# AI Agent Guidelines

These guidelines serve as a mandatory system prompt and ruleset for all AI agents and contributors working on this repository to maximize development efficiency, system reliability, and overall project maintainability.

---

### 1. Branching & Workflow
- **No Direct Commits to `main`:** Direct pushes and commits to the `main` branch are strictly prohibited.
- **Feature Branches:** All changes must be developed in dedicated branches (e.g., `feat/feature-name`, `fix/issue-description`) and integrated into `main` exclusively via Pull Requests or branch merges.

---

### 2. Conventional Commits (Mandatory)
- **Format:** All commit messages must strictly adhere to the [Conventional Commits](https://www.conventionalcommits.org/) specification:
  - `feat: ...` -> New feature or functionality (**Minor bump**)
  - `fix: ...` -> Bug fix or defect correction (**Patch bump**)
  - `chore: ...` / `docs: ...` / `refactor: ...` / `perf: ...` -> Maintenance, documentation, code optimization (**Patch bump** / maintenance)
  - `feat!: ...` or commit body containing `BREAKING CHANGE:` -> Breaking changes (**Major bump**)
- **Impact:** Strict conformity is essential to ensure the automated release pipeline accurately computes semantic versions in `package.json` and creates reliable Git release tags.

---

### 3. Focus & Architecture
- **Vanilla JavaScript & Native Web Components:** Write clean, modern, and standard-compliant JavaScript (ES6+, Custom Elements v1, Shadow DOM).
- **Zero Unnecessary Dependencies:** Do not introduce external runtime dependencies or frameworks (such as React, Vue, jQuery, or utility libraries). The project must remain a lightweight, self-contained native web component (`openatlas-vocabulary-viewer.js`) to minimize overhead and maximize downstream compatibility.

---

### 4. JavaScript Coding Standards (Vanilla JS)
- **KISS & DRY:** Keep It Simple, Stupid & Don't Repeat Yourself. Write modular, highly legible code without over-engineering.
- **Variable Declarations:** Always use `const` by default. Only use `let` if reassignment is strictly necessary. Never use `var`.
- **Functions:** Use Arrow Functions (`() => {}`) for callbacks and standard functions to maintain predictable `this` scoping. Use `function` declarations only when explicitly required (e.g., for Web Component lifecycle methods).
- **Modern ES6+ Features:** Exploit modern syntax such as Optional Chaining (`?.`), Nullish Coalescing (`??`), Template Literals, and Destructuring to keep the code concise.
- **DOM Manipulation:** Prefer `querySelector` and `querySelectorAll` for querying the DOM within your Shadow DOM or document, keeping selectors CSS-aligned.
