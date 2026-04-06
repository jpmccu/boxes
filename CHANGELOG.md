# Changelog

All notable changes to this project will be documented in this file.

## [0.5.0] - 2026-04-06

### Added
- **Find / search toolbar** — a new toolbar with a search/find bar lets users locate nodes and edges by label or property value. Matching elements are highlighted and the viewport pans to the first result. ([#8](https://github.com/jpmccu/boxes/pull/8))

### Fixed
- **PDF export in web build** — fixed a `ReferenceError: exports is not defined` crash when exporting to PDF from the web app. The web build's minifier was removing `var exports = exports$1;` aliases that `cytoscape-pdf-export` relies on inside its eval'd webpack bundle. The aliases are now re-injected by a post-minification Vite plugin, and a defensive null guard was added to the replace callbacks in both vite configs. ([#7](https://github.com/jpmccu/boxes/pull/7))
- **Nudge re-render** — the nudge operation now causes an actual Cytoscape re-render without modifying stored element positions, so visual feedback is immediate. ([#8](https://github.com/jpmccu/boxes/pull/8))

## [0.4.0] - Initial release

- Initial public release of `boxes-core`, `boxes-vue`, and `boxes-react` packages.
