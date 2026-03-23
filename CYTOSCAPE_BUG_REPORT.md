# Cytoscape.js Bug Report: Edges invisible after cy.add() + cy.style().fromJson().update()

**Cytoscape.js version:** 3.33.1  
**Renderer:** WebGL (ElementDrawingWebGL) — the bug does not reproduce in the canvas 2D renderer  
**Environment:** Electron (Chromium), also potentially affects Chrome/Firefox desktop browsers  

---

## Summary

When a graph is loaded programmatically by calling `cy.add([...nodes, ...edges])` followed by
`cy.style().fromJson([...]).update()`, edges are **not visible on the first rendered frame**. They
only appear after the user interacts with them (e.g. clicking / selecting an edge).  Node shapes,
node labels, and edge labels all render correctly.  Only the edge line/arrow geometry is missing.

This behaviour was observed in an Electron application that saves and reloads graphs (the
[Boxes LPG editor](https://github.com/boxes-org/boxes)). It does **not** reproduce with the canvas
2D renderer used in headless/test environments.

---

## Steps to Reproduce

Open `cytoscape-edge-bug-repro.html` (included in this repository at the project root) in a
WebGL-capable browser.

```
file:///path/to/boxes/cytoscape-edge-bug-repro.html
```

1. Click **"2 · Remove + re-add (bug scenario)"**.
2. Observe the **right pane** — edges should be invisible (no line connecting nodes).
3. Click one of the edges (it is selectable even though invisible) — it becomes visible.
4. Click **"4 · Inspect rs.allpts"** immediately after step 2 (before clicking an edge) to see
   `rs.allpts == NULL ⚠` in the log.

For comparison, click **"1 · Fresh init (baseline)"** — both panes show edges correctly because
the elements are provided at Cytoscape construction time.

---

## Minimal Reproduction (JavaScript)

```javascript
// Assuming a <div id="cy"> with non-zero dimensions already in the DOM

// Step 1 — create a Cytoscape instance (elements added at construction time work fine)
const cy = cytoscape({
  container: document.getElementById('cy'),
  elements: [],
  style: [
    { selector: 'node', style: { 'width': 60, 'height': 60, 'background-color': '#666' } },
    { selector: 'edge', style: { 'width': 2, 'line-color': '#999', 'curve-style': 'bezier',
                                 'target-arrow-shape': 'triangle' } }
  ]
});

// Step 2 — simulate a "file load": remove everything, then re-add nodes + edges
cy.elements().remove();
cy.add([
  { data: { id: 'n1', label: 'Alice' }, position: { x: 150, y: 150 } },
  { data: { id: 'n2', label: 'Bob'   }, position: { x: 350, y: 150 } },
  { data: { id: 'e1', source: 'n1', target: 'n2', label: 'knows' } }
]);

// Step 3 — re-apply the stylesheet (required to apply user-customised styles)
cy.style().fromJson([
  { selector: 'node', style: { 'width': 60, 'height': 60, 'background-color': '#666' } },
  { selector: 'edge', style: { 'width': 2, 'line-color': '#999', 'curve-style': 'bezier',
                               'target-arrow-shape': 'triangle' } }
]).update();

// After one animation frame, inspect rscratch:
requestAnimationFrame(() => {
  const rs = cy.edges()[0]._private.rscratch;
  console.log('allpts:', rs.allpts); // EXPECTED: numeric array; ACTUAL: null (WebGL renderer)
});
```

---

## Expected Behaviour

`rs.allpts` is populated on the first draw frame after `cy.add()` + `cy.style().fromJson().update()`,
and edges are rendered visibly, matching the result of adding elements at construction time.

## Actual Behaviour

`rs.allpts === null` on the first draw frame when the WebGL renderer is active.  Because
`ElementDrawingWebGL._isValidEdge(edge)` returns `false` when `rs.allpts == null`, the call to
`drawEdgeLine` exits immediately and the edge geometry is never submitted to the GPU.

Edges do become visible after the next interaction that causes a style recalculation
(e.g., selecting an edge), which triggers `dirtyStyleCache()` on the element and causes
`recalculateRenderedStyle` → `findEdgeControlPoints` to run successfully on the next frame.

---

## Investigation Notes

### Rendering pipeline

`rs.allpts` is set by `storeAllpts(edge)` inside `findEdgeControlPoints()`, which is called by
`recalculateRenderedStyle()` inside `updateEleCalcs(willDraw=true)` — a `beforeRender` callback
registered at priority 300.

`findEdgeControlPoints` skips an edge if:
1. `edge.removed()` — not the case here
2. `!edge.takesUpSpace()` — should be `true` (width=2, display=element)

`takesUpSpace()` is wrapped in `cachePrototypeStyleFunction`, which caches the result in
`ele._private.styleCache`. This cache is only cleared by `dirtyStyleCache()` (called from
`checkTriggers` in `applyParsedProperty`). `cleanElements()` in `styfn.clear()` **does not** call
`dirtyStyleCache()`; it only clears `_private.style` and calls `clearStyleHints()`.

Hypothesis: the `styleCache` for `takesUpSpace`/`visible` may contain a stale value that prevents
`findEdgeControlPoints` from processing newly added edges after `cy.style().fromJson().update()`
resets the stylesheet. This would explain why the canvas renderer (where the cache might not exist
or is cleared differently) does not exhibit the bug, while the WebGL renderer does.

### Why selection fixes it

Selecting an edge fires a 'style' event with class changes, which calls `applyParsedProperty` →
`checkTriggers` → `dirtyStyleCache()` → clears `styleCache`.  On the subsequent frame,
`takesUpSpace()` and `visible()` recompute their values, `findEdgeControlPoints` is no longer
skipped, `rs.allpts` is set, and the edge renders.

### Canvas renderer

The canvas renderer (2D context) passes the reproduction test — after one animation frame,
`rs.allpts` is populated correctly.  The regression test in
`packages/core/tests/boxes-editor.test.js` ("edges should have rs.allpts set after importGraph")
confirms this.  The bug is therefore specific to the WebGL renderer path introduced in 3.x.

---

## Workaround

Calling `cy.elements().forEach(ele => ele.emit('style'))` after the stylesheet update does
**not** fully fix the issue (it fires 'style' but does not clear `styleCache`).

A reliable workaround is to trigger a full style recalculation by forcing each element through
`dirtyStyleCache`:

```javascript
// After cy.add(...) and cy.style().fromJson(...).update():
cy.elements().forEach(ele => { ele._private.styleCache = null; });
```

This is a private API hack and should not be required.  A better workaround (if a public API
equivalent exists) would be `cy.elements().updateStyle()` — but that calls the same
`updateStyle()` path that already fires 'style' without clearing `styleCache`.

---

## API Usage Verification

The sequence used was verified against the [Cytoscape.js documentation](https://js.cytoscape.org):

| Call | Documentation reference | Status |
|------|------------------------|--------|
| `cy.add([...nodes, ...edges])` | [cy.add()](https://js.cytoscape.org/#cy.add) — array form | ✅ Correct |
| `cy.style().fromJson([...]).update()` | [cy.style().fromJson()](https://js.cytoscape.org/#style.fromJson) | ✅ Correct |
| Element data shape: `{ data: { id, source?, target? } }` | [Element JSON](https://js.cytoscape.org/#notation/elements-json) | ✅ Correct |
| No inline `style` field on elements | Documentation warns against this | ✅ Correct |

---

## Files

- **Standalone test:** `cytoscape-edge-bug-repro.html` (project root)  
  Open in a WebGL-capable browser and click "2 · Remove + re-add (bug scenario)".
- **Regression test:** `packages/core/tests/boxes-editor.test.js`  
  Test: *"edges should have rs.allpts set after importGraph (rendering regression)"*
