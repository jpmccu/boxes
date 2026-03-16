// Cytoscape.js uses the Canvas 2D API internally. happy-dom stubs the
// HTMLCanvasElement but doesn't implement getContext, so we provide a
// minimal mock that satisfies Cytoscape's renderer without a real GPU.
HTMLCanvasElement.prototype.getContext = function (type) {
  if (type !== '2d') return null;
  return {
    canvas: this,
    // state
    strokeStyle: '#000', fillStyle: '#000', globalAlpha: 1,
    lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', miterLimit: 10,
    shadowBlur: 0, shadowColor: 'transparent', shadowOffsetX: 0, shadowOffsetY: 0,
    font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic',
    globalCompositeOperation: 'source-over',
    // transforms
    save: () => {}, restore: () => {},
    scale: () => {}, rotate: () => {}, translate: () => {},
    transform: () => {}, setTransform: () => {}, resetTransform: () => {},
    // rects & fills
    clearRect: () => {}, fillRect: () => {}, strokeRect: () => {},
    // text
    fillText: () => {}, strokeText: () => {},
    measureText: () => ({ width: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 }),
    // paths
    beginPath: () => {}, closePath: () => {},
    moveTo: () => {}, lineTo: () => {},
    bezierCurveTo: () => {}, quadraticCurveTo: () => {},
    arc: () => {}, arcTo: () => {}, ellipse: () => {}, rect: () => {},
    fill: () => {}, stroke: () => {}, clip: () => {},
    isPointInPath: () => false, isPointInStroke: () => false,
    // gradients / patterns
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createPattern: () => null,
    // image data
    getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
    putImageData: () => {},
    createImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
    drawImage: () => {},
    // line dash
    setLineDash: () => {}, getLineDash: () => [],
  };
};

// Cytoscape's layout algorithms call getBoundingClientRect on nodes and the
// container to compute positions. Return a stable non-zero rect so layouts
// run without throwing "Cannot read properties of undefined (reading 'x1')".
Element.prototype.getBoundingClientRect = function () {
  return { x: 0, y: 0, width: 100, height: 100, top: 0, left: 0, right: 100, bottom: 100 };
};
