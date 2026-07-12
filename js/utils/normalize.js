// Piecewise-linear scoring against fixed anchor points.
//
// anchors: array of [value, score] pairs. Score must be in 0–100.
// Works for both "higher is better" and "lower is better" metrics —
// just supply anchors whose scores decrease as the value worsens.
// Values outside the anchor range are clamped to the end scores.

export function scoreFromAnchors(value, anchors) {
  if (!Number.isFinite(value) || !Array.isArray(anchors) || anchors.length < 2) {
    return null;
  }

  // Sort ascending by metric value, keeping paired scores.
  const pts = [...anchors].sort((a, b) => a[0] - b[0]);

  if (value <= pts[0][0]) return clamp(pts[0][1]);
  if (value >= pts[pts.length - 1][0]) return clamp(pts[pts.length - 1][1]);

  for (let i = 0; i < pts.length - 1; i++) {
    const [v0, s0] = pts[i];
    const [v1, s1] = pts[i + 1];
    if (value >= v0 && value <= v1) {
      const t = (value - v0) / ((v1 - v0) || 1);
      return clamp(s0 + t * (s1 - s0));
    }
  }
  return null;
}

function clamp(s) {
  return Math.max(0, Math.min(100, s));
}
