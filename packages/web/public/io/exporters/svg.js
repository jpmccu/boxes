/**
 * SVG exporter for Boxes graph editor.
 *
 * Walks the live Cytoscape instance to produce a standalone SVG file
 * that mirrors the graph's visual appearance, including:
 *   - Node shapes (rectangle, roundrectangle, ellipse, diamond, triangle,
 *     hexagon, octagon, star, vee, rhomboid)
 *   - Fill colour + opacity, border colour / width / style
 *   - Node labels with alignment
 *   - Edge paths (straight, bezier, segmented)
 *   - Edge line style (solid, dashed, dotted), width, colour
 *   - Arrow markers (triangle, tee, circle, square, diamond)
 *   - Edge labels
 */

// ── Helpers ────────────────────────────────────────────────────────────────

function escXML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Strip alpha channel from rgba() so SVG fill/stroke attributes stay valid.
 * Opacity is returned separately via alphaOf().
 */
function solidColor(str) {
  if (!str || str === 'none') return 'none';
  return str.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/, 'rgb($1,$2,$3)');
}

function alphaOf(str) {
  if (!str) return 1;
  const m = str.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/);
  return m ? parseFloat(m[1]) : 1;
}

function strokeDashAttr(lineStyle) {
  if (lineStyle === 'dashed') return 'stroke-dasharray="8 4"';
  if (lineStyle === 'dotted') return 'stroke-dasharray="2 3"';
  return '';
}

// ── Polygon helpers ────────────────────────────────────────────────────────

function regularPolygonPoints(cx, cy, rx, ry, sides, startAngle) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = startAngle + (2 * Math.PI * i) / sides;
    pts.push(`${(cx + rx * Math.cos(a)).toFixed(2)},${(cy + ry * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

function starPoints(cx, cy, outerRx, outerRy, points) {
  const innerRx = outerRx * 0.4;
  const innerRy = outerRy * 0.4;
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const a = (Math.PI * i) / points - Math.PI / 2;
    const rx = i % 2 === 0 ? outerRx : innerRx;
    const ry = i % 2 === 0 ? outerRy : innerRy;
    pts.push(`${(cx + rx * Math.cos(a)).toFixed(2)},${(cy + ry * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

// ── Arrow markers ──────────────────────────────────────────────────────────

function buildMarkerDef(id, shape, color) {
  if (!shape || shape === 'none') return '';

  switch (shape) {
    case 'triangle':
    case 'triangle-backcurve':
      return `<marker id="${id}" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L10,5 L0,10 Z" fill="${color}"/>
    </marker>`;
    case 'triangle-tee':
      return `<marker id="${id}" markerWidth="12" markerHeight="10" refX="10" refY="5" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L10,5 L0,10 Z" fill="${color}"/>
      <line x1="0" y1="0" x2="0" y2="10" stroke="${color}" stroke-width="2"/>
    </marker>`;
    case 'tee':
      return `<marker id="${id}" markerWidth="6" markerHeight="10" refX="3" refY="5" orient="auto" markerUnits="strokeWidth">
      <line x1="3" y1="0" x2="3" y2="10" stroke="${color}" stroke-width="2"/>
    </marker>`;
    case 'circle':
    case 'circle-triangle':
      return `<marker id="${id}" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto" markerUnits="strokeWidth">
      <circle cx="4" cy="4" r="3" fill="${color}"/>
    </marker>`;
    case 'square':
      return `<marker id="${id}" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto" markerUnits="strokeWidth">
      <rect x="1" y="1" width="6" height="6" fill="${color}"/>
    </marker>`;
    case 'diamond':
      return `<marker id="${id}" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto" markerUnits="strokeWidth">
      <polygon points="5,0 10,5 5,10 0,5" fill="${color}"/>
    </marker>`;
    case 'open-triangle':
      return `<marker id="${id}" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L10,5 L0,10" fill="none" stroke="${color}" stroke-width="1.5"/>
    </marker>`;
    default:
      return '';
  }
}

// ── Node rendering ─────────────────────────────────────────────────────────

function renderNode(node, ox, oy) {
  const pos = node.position();
  const w   = node.width();
  const h   = node.height();
  const cx  = pos.x + ox;
  const cy  = pos.y + oy;
  const x   = cx - w / 2;
  const y   = cy - h / 2;

  const shape        = node.style('shape') || 'ellipse';
  const bgColor      = solidColor(node.style('background-color'));
  const bgOpacity    = parseFloat(node.style('background-opacity') ?? '1') *
                       alphaOf(node.style('background-color'));
  const borderColor  = solidColor(node.style('border-color'));
  const borderWidth  = parseFloat(node.style('border-width')  ?? '0');
  const borderStyle  = node.style('border-style') || 'solid';
  const dash         = strokeDashAttr(borderStyle);

  const shapeAttrs = `fill="${bgColor}" fill-opacity="${bgOpacity.toFixed(3)}" ` +
                     `stroke="${borderColor}" stroke-width="${borderWidth}" ${dash}`;

  let shapeEl;
  switch (shape) {
    case 'ellipse':
      shapeEl = `<ellipse cx="${cx}" cy="${cy}" rx="${w / 2}" ry="${h / 2}" ${shapeAttrs}/>`;
      break;
    case 'roundrectangle':
    case 'round-rectangle': {
      const r = Math.min(w * 0.15, h * 0.15, 12);
      shapeEl = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" ${shapeAttrs}/>`;
      break;
    }
    case 'diamond': {
      const pts = `${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}`;
      shapeEl = `<polygon points="${pts}" ${shapeAttrs}/>`;
      break;
    }
    case 'triangle': {
      const pts = `${cx},${y} ${x + w},${y + h} ${x},${y + h}`;
      shapeEl = `<polygon points="${pts}" ${shapeAttrs}/>`;
      break;
    }
    case 'vee': {
      const pts = `${x},${y} ${cx},${cy} ${x + w},${y} ${cx},${y + h}`;
      shapeEl = `<polygon points="${pts}" ${shapeAttrs}/>`;
      break;
    }
    case 'rhomboid': {
      const skew = w * 0.15;
      const pts = `${x + skew},${y} ${x + w},${y} ${x + w - skew},${y + h} ${x},${y + h}`;
      shapeEl = `<polygon points="${pts}" ${shapeAttrs}/>`;
      break;
    }
    case 'pentagon': {
      const pts = regularPolygonPoints(cx, cy, w / 2, h / 2, 5, -Math.PI / 2);
      shapeEl = `<polygon points="${pts}" ${shapeAttrs}/>`;
      break;
    }
    case 'hexagon': {
      const pts = regularPolygonPoints(cx, cy, w / 2, h / 2, 6, 0);
      shapeEl = `<polygon points="${pts}" ${shapeAttrs}/>`;
      break;
    }
    case 'heptagon': {
      const pts = regularPolygonPoints(cx, cy, w / 2, h / 2, 7, -Math.PI / 2);
      shapeEl = `<polygon points="${pts}" ${shapeAttrs}/>`;
      break;
    }
    case 'octagon': {
      const pts = regularPolygonPoints(cx, cy, w / 2, h / 2, 8, -Math.PI / 8);
      shapeEl = `<polygon points="${pts}" ${shapeAttrs}/>`;
      break;
    }
    case 'star': {
      const pts = starPoints(cx, cy, w / 2, h / 2, 5);
      shapeEl = `<polygon points="${pts}" ${shapeAttrs}/>`;
      break;
    }
    case 'barrel': {
      // Approximate barrel with a rounded rect
      const r = w * 0.3;
      shapeEl = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${h * 0.2}" ${shapeAttrs}/>`;
      break;
    }
    default:
      shapeEl = `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${shapeAttrs}/>`;
  }

  // ── Label ────────────────────────────────────────────────────────────────
  const label    = node.style('label') || node.data('label') || '';
  let labelEl    = '';

  if (label) {
    const fontSize        = parseFloat(node.style('font-size') ?? '12');
    const textColor       = solidColor(node.style('color'));
    const fontWeight      = node.style('font-weight') || 'normal';
    const fontStyle       = node.style('font-style')  || 'normal';
    const textHalign      = node.style('text-halign') || 'center';
    const textValign      = node.style('text-valign') || 'center';
    const nodePadding     = parseFloat(node.style('padding') ?? '0');

    let lx = cx, ly = cy;
    let anchor = 'middle', baseline = 'central';

    if (textHalign === 'left')  { lx = x + nodePadding + 2; anchor = 'start'; }
    if (textHalign === 'right') { lx = x + w - nodePadding - 2; anchor = 'end'; }
    if (textValign === 'top')   { ly = y + nodePadding + fontSize; baseline = 'auto'; }
    if (textValign === 'bottom'){ ly = y + h - nodePadding - 4;    baseline = 'auto'; }

    const textAttrs = `font-size="${fontSize}" fill="${textColor}" font-family="Arial,sans-serif" ` +
                      `font-weight="${fontWeight}" font-style="${fontStyle}"`;

    const lines = String(label).split('\n');
    if (lines.length === 1) {
      labelEl = `<text x="${lx}" y="${ly}" text-anchor="${anchor}" dominant-baseline="${baseline}" ${textAttrs}>${escXML(label)}</text>`;
    } else {
      const lineH = fontSize * 1.2;
      const startY = ly - (lines.length - 1) * lineH / 2;
      const tspans = lines.map((l, i) =>
        `<tspan x="${lx}" y="${(startY + i * lineH).toFixed(2)}">${escXML(l)}</tspan>`
      ).join('');
      labelEl = `<text text-anchor="${anchor}" ${textAttrs}>${tspans}</text>`;
    }
  }

  return `<g id="node-${escXML(node.id())}">\n  ${shapeEl}\n  ${labelEl}\n</g>`;
}

// ── Edge rendering ─────────────────────────────────────────────────────────

function renderEdge(edge, ox, oy, markerIds) {
  const src = edge.sourceEndpoint();
  const tgt = edge.targetEndpoint();
  const sx  = src.x + ox, sy = src.y + oy;
  const tx  = tgt.x + ox, ty = tgt.y + oy;

  const lineColor  = solidColor(edge.style('line-color'));
  const lineWidth  = parseFloat(edge.style('width') ?? '1');
  const lineStyle  = edge.style('line-style') || 'solid';
  const curveStyle = edge.style('curve-style') || 'bezier';
  const dash       = strokeDashAttr(lineStyle);

  // Build path
  let pathD;
  try {
    const ctrlPts = edge.controlPoints?.() || [];
    const segPts  = edge.segmentPoints?.() || [];

    if (curveStyle === 'straight' || (ctrlPts.length === 0 && segPts.length === 0)) {
      pathD = `M ${sx} ${sy} L ${tx} ${ty}`;
    } else if (segPts.length > 0) {
      const mid = segPts.map(p => `${p.x + ox} ${p.y + oy}`).join(' L ');
      pathD = `M ${sx} ${sy} L ${mid} L ${tx} ${ty}`;
    } else if (ctrlPts.length === 1) {
      const cp = ctrlPts[0];
      pathD = `M ${sx} ${sy} Q ${cp.x + ox} ${cp.y + oy} ${tx} ${ty}`;
    } else if (ctrlPts.length >= 2) {
      const cp1 = ctrlPts[0];
      const cp2 = ctrlPts[ctrlPts.length - 1];
      pathD = `M ${sx} ${sy} C ${cp1.x + ox} ${cp1.y + oy} ${cp2.x + ox} ${cp2.y + oy} ${tx} ${ty}`;
    } else {
      pathD = `M ${sx} ${sy} L ${tx} ${ty}`;
    }
  } catch (_) {
    pathD = `M ${sx} ${sy} L ${tx} ${ty}`;
  }

  const { srcId, tgtId } = markerIds;
  const markerStart = srcId ? `marker-start="url(#${srcId})"` : '';
  const markerEnd   = tgtId ? `marker-end="url(#${tgtId})"` : '';

  const pathEl = `<path d="${pathD}" fill="none" stroke="${lineColor}" stroke-width="${lineWidth}" ${dash} ${markerStart} ${markerEnd}/>`;

  // Edge label
  let labelEl = '';
  const label = edge.style('label') || edge.data('label') || '';
  if (label) {
    let mid;
    try { mid = edge.midpoint?.(); } catch (_) { /* ignore */ }
    const lx = mid ? mid.x + ox : (sx + tx) / 2;
    const ly = mid ? mid.y + oy : (sy + ty) / 2;
    const fontSize  = parseFloat(edge.style('font-size') ?? '11');
    const textColor = solidColor(edge.style('color') || edge.style('line-color'));
    labelEl = `<text x="${lx}" y="${ly - 4}" text-anchor="middle" dominant-baseline="auto" ` +
              `font-size="${fontSize}" fill="${textColor}" font-family="Arial,sans-serif">${escXML(String(label))}</text>`;
  }

  return `<g id="edge-${escXML(edge.id())}">\n  ${pathEl}\n  ${labelEl}\n</g>`;
}

// ── Exporter ───────────────────────────────────────────────────────────────

export const svgExporter = {
  name: 'SVG Image',
  extension: '.svg',
  mimeType: 'image/svg+xml',

  export(editor, options = {}) {
    const cy = editor.cy;
    if (!cy || cy.nodes().length === 0) throw new Error('Nothing to export — graph is empty');

    const padding = options.padding ?? 50;
    const extent  = cy.extent();

    const svgW = Math.ceil(extent.w) + padding * 2;
    const svgH = Math.ceil(extent.h) + padding * 2;
    const ox   = padding - extent.x1;
    const oy   = padding - extent.y1;

    // ── Build arrow marker defs ────────────────────────────────────────────
    const markerDefs = [];
    const edgeMarkerIds = new Map(); // edgeId → { srcId, tgtId }
    let mi = 0;

    cy.edges().forEach(edge => {
      const eid      = edge.id();
      const srcShape = edge.style('source-arrow-shape') || 'none';
      const tgtShape = edge.style('target-arrow-shape') || 'none';
      const srcColor = solidColor(edge.style('source-arrow-color') || edge.style('line-color'));
      const tgtColor = solidColor(edge.style('target-arrow-color') || edge.style('line-color'));

      let srcId = null, tgtId = null;

      if (srcShape !== 'none') {
        srcId = `am${mi++}`;
        const def = buildMarkerDef(srcId, srcShape, srcColor);
        if (def) markerDefs.push(def);
        else srcId = null;
      }
      if (tgtShape !== 'none') {
        tgtId = `am${mi++}`;
        const def = buildMarkerDef(tgtId, tgtShape, tgtColor);
        if (def) markerDefs.push(def);
        else tgtId = null;
      }

      edgeMarkerIds.set(eid, { srcId, tgtId });
    });

    // ── Render ─────────────────────────────────────────────────────────────
    const edgesSVG = cy.edges()
      .map(e => renderEdge(e, ox, oy, edgeMarkerIds.get(e.id()) || {}))
      .join('\n');

    const nodesSVG = cy.nodes()
      .map(n => renderNode(n, ox, oy))
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${svgW}" height="${svgH}"
     viewBox="0 0 ${svgW} ${svgH}">
  <defs>
    ${markerDefs.join('\n    ')}
  </defs>
  <g id="edges">
    ${edgesSVG}
  </g>
  <g id="nodes">
    ${nodesSVG}
  </g>
</svg>`;
  },
};
