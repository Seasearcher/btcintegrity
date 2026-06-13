// Reusable sparkline renderer for SVG path elements
// Renders a line + filled area into existing <path> elements

export function renderSparkline({ lineId, areaId, points, color }) {
  if (!points || points.length < 2) return;

  const W = 200;
  const H = 50;
  const PAD = 4;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = (max - min) || 1; // avoid divide-by-zero

  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * W;
    // SVG y=0 is top, so high values map to small y
    const y = PAD + (1 - (v - min) / range) * (H - 2 * PAD);
    return [x.toFixed(2), y.toFixed(2)];
  });

  const linePath = 'M' + coords.map(p => p.join(',')).join(' L');
  const areaPath = linePath + ` L${W},${H} L0,${H} Z`;

  const lineEl = document.getElementById(lineId);
  const areaEl = document.getElementById(areaId);

  if (lineEl) {
    lineEl.setAttribute('d', linePath);
    if (color) lineEl.setAttribute('stroke', color);
  }

if (areaEl) {
  areaEl.setAttribute('d', areaPath);
  if (color) {
    areaEl.setAttribute('fill', color);
    areaEl.setAttribute('fill-opacity', '0.15');
  }
}
}

