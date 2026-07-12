// Composite Integrity Score
//
// Aggregation rules (mirrored in the Methodology section of index.html):
// - Each indicator normalizes its own raw metric to 0–100 via anchors
//   defined alongside its thresholds (Watch boundary → 60, Healthy → 80).
// - The three indicator pairs are weighted equally (1/3 per pair, so 1/6
//   per indicator).
// - Weakest-link cap: the composite cannot exceed the lowest indicator
//   score + 25, so strong indicators cannot mask a failing one.
// - If fewer than MIN_LIVE indicators have live scores, no composite is
//   shown ("insufficient data") rather than a misleading number.

const TOTAL_INDICATORS = 6;
const MIN_LIVE = 4;
const WEAKEST_LINK_CAP = 25;

const WEIGHTS = {
  feeMarket:               1 / 6,
  securityBudget:          1 / 6,
  miningDecentralization:  1 / 6,
  transactionInclusion:    1 / 6,
  custodialConcentration:  1 / 6,
  nodeDiversity:           1 / 6,
};

const BANDS = [
  { min: 80, word: 'robust',   textClass: 'text-emerald-400' },
  { min: 60, word: 'moderate', textClass: 'text-amber-400' },
  { min: 40, word: 'weak',     textClass: 'text-rose-400' },
  { min: 0,  word: 'critical', textClass: 'text-rose-500' },
];

function bandFor(score) {
  return BANDS.find(b => score >= b.min) || BANDS[BANDS.length - 1];
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function updateComposite(liveResults) {
  const scoreEl     = document.getElementById('composite-score');
  const narrativeEl = document.getElementById('composite-narrative');
  const barEl       = document.getElementById('composite-bar');
  const coverageEl  = document.getElementById('composite-coverage');

  const live = (liveResults || []).filter(r => r && Number.isFinite(r.score));

  // --- Insufficient coverage: suppress the score ---
  if (live.length < MIN_LIVE) {
    if (scoreEl) {
      scoreEl.textContent = '—';
      scoreEl.className = 'text-6xl font-bold text-slate-500';
    }
    if (narrativeEl) {
      narrativeEl.textContent =
        `Live data is available for only ${live.length} of ${TOTAL_INDICATORS} indicators. ` +
        `The composite score is suppressed to avoid showing a misleading number.`;
    }
    if (barEl) barEl.style.width = '0%';
    if (coverageEl) {
      coverageEl.textContent = `Insufficient data (${live.length}/${TOTAL_INDICATORS} indicators live)`;
    }
    console.warn(`⚠️ Composite suppressed: only ${live.length}/${TOTAL_INDICATORS} indicators live`);
    return null;
  }

  // --- Weighted mean over live indicators, weights renormalized ---
  let weightedSum = 0;
  let weightTotal = 0;
  for (const r of live) {
    const w = WEIGHTS[r.key] ?? (1 / TOTAL_INDICATORS);
    weightedSum += r.score * w;
    weightTotal += w;
  }
  const weightedMean = weightedSum / weightTotal;

  // --- Weakest-link cap ---
  const sorted = [...live].sort((a, b) => a.score - b.score);
  const weakest = sorted[0];
  const capLimit = weakest.score + WEAKEST_LINK_CAP;
  const capApplied = weightedMean > capLimit;
  const finalScore = Math.round(Math.min(weightedMean, capLimit));

  const band = bandFor(finalScore);

  // --- Narrative: name the (up to) two lowest-scoring indicators ---
  const pressures = sorted.filter(r => r.score < 80).slice(0, 2);
  let pressureText;
  if (pressures.length === 0) {
    pressureText = 'No indicator is currently exerting significant downward pressure.';
  } else if (pressures.length === 1) {
    pressureText = `${capitalize(pressures[0].label)} is the main downward pressure.`;
  } else {
    pressureText =
      `${capitalize(pressures[0].label)} and ${pressures[1].label} are the main downward pressures.`;
  }

  // --- DOM updates ---
  if (scoreEl) {
    scoreEl.textContent = String(finalScore);
    scoreEl.className = `text-6xl font-bold ${band.textClass}`;
  }
  if (narrativeEl) {
    narrativeEl.innerHTML =
      `Network integrity is currently ` +
      `<span class="${band.textClass} font-semibold">${band.word}</span>. ` +
      pressureText;
  }
  if (barEl) barEl.style.width = `${finalScore}%`;
  if (coverageEl) {
    let text = `Based on ${live.length}/${TOTAL_INDICATORS} live indicators`;
    if (capApplied) {
      text += ` · capped by weakest link (${weakest.label}: ${Math.round(weakest.score)})`;
    }
    coverageEl.textContent = text;
  }

  console.log(
    `✅ Composite: ${finalScore} (${band.word}) — mean ${weightedMean.toFixed(1)}, ` +
    `${live.length}/${TOTAL_INDICATORS} live` +
    (capApplied ? `, capped by ${weakest.key} (${Math.round(weakest.score)})` : '')
  );

  return finalScore;
}
