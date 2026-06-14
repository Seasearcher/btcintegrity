// Indicator 5: Custodial Concentration
// Measures: BTC held by tracked institutional custodians (public company
// treasuries + tracked funds) as a percentage of circulating supply.
//
// Source: CoinGecko /companies/public_treasury/bitcoin
//
// Scope note: This captures publicly-disclosed corporate treasuries and
// tracked funds. It does NOT include exchange custody balances or every
// spot ETF. Treat the figure as a LOWER BOUND on true custodial
// concentration. Exchange custody alone is estimated to add another
// 15-20% based on external research.

const ENDPOINTS = {
  treasuries: 'https://api.coingecko.com/api/v3/companies/public_treasury/bitcoin',
  bitcoin:    'https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&tickers=false&community_data=false&developer_data=false',
};

// Thresholds for "% of circulating supply held by tracked treasuries & funds".
// Calibrated for this subset only; true custodial concentration is higher.
const THRESHOLDS = {
  healthy: 5,    // < 5%   = limited tracked institutional concentration
  watch:   10,   // 5-10%  = moderate, growing concentration
  // >= 10%       = high concentration via tracked institutions alone
};

const STATUS_STYLES = {
  Healthy: {
    badge: 'text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    valueClass: 'text-emerald-400',
  },
  Watch: {
    badge: 'text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20',
    valueClass: 'text-amber-400',
  },
  Concern: {
    badge: 'text-xs px-2 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20',
    valueClass: 'text-rose-400',
  },
};

function classifyStatus(pct) {
  if (pct < THRESHOLDS.healthy) return 'Healthy';
  if (pct < THRESHOLDS.watch)   return 'Watch';
  return 'Concern';
}

export async function updateCustodialConcentration() {
  const valueEl    = document.getElementById('custodial-concentration-value');
  const badgeEl    = document.getElementById('custodial-concentration-badge');
  const subtitleEl = document.getElementById('custodial-concentration-subtitle');

  if (!valueEl) {
    throw new Error('custodial-concentration-value element not found');
  }

  try {
    const [treasuriesRes, bitcoinRes] = await Promise.all([
      fetch(ENDPOINTS.treasuries),
      fetch(ENDPOINTS.bitcoin),
    ]);

    if (!treasuriesRes.ok || !bitcoinRes.ok) {
      throw new Error('CoinGecko API returned non-OK status');
    }

    const treasuriesData = await treasuriesRes.json();
    const bitcoinData    = await bitcoinRes.json();

    const totalHoldings     = treasuriesData.total_holdings;
    const circulatingSupply = bitcoinData.market_data.circulating_supply;
    const companies         = treasuriesData.companies || [];

    if (!totalHoldings || !circulatingSupply) {
      throw new Error('Missing holdings or supply data');
    }

    const pctOfSupply = (totalHoldings / circulatingSupply) * 100;

    // Top-10 concentration within the tracked set
    const top10         = companies.slice(0, 10);
    const top10Holdings = top10.reduce((sum, c) => sum + (c.total_holdings || 0), 0);
    const top10Pct      = (top10Holdings / circulatingSupply) * 100;

    const status = classifyStatus(pctOfSupply);
    const styles = STATUS_STYLES[status];

    // --- Update DOM ---
    valueEl.textContent = pctOfSupply.toFixed(2) + '%';
    valueEl.className   = `text-3xl font-bold ${styles.valueClass} mono`;

    if (badgeEl) {
      badgeEl.textContent   = status;
      badgeEl.className     = styles.badge;
      badgeEl.style.opacity = '1';

      const topName = companies[0]?.name || 'unknown';
      const topPct  = (((companies[0]?.total_holdings || 0) / circulatingSupply) * 100).toFixed(2);
      badgeEl.title =
        `${totalHoldings.toLocaleString()} BTC across ${companies.length} tracked entities. ` +
        `Largest holder: ${topName} (${topPct}% of supply). ` +
        `Top-10: ${top10Pct.toFixed(2)}%. ` +
        `Excludes exchange custody — true custodial concentration is higher.`;
    }

    if (subtitleEl) {
      subtitleEl.textContent =
        `Supply held by tracked treasuries & funds (${companies.length} entities)`;
    }

    console.log(
      `✅ Custodial Concentration: ${pctOfSupply.toFixed(2)}% (${status}) — ` +
      `${totalHoldings.toLocaleString()} BTC across ${companies.length} entities, ` +
      `top-10: ${top10Pct.toFixed(2)}%`
    );

  } catch (err) {
    console.error('⚠️ Custodial Concentration update failed:', err);
    if (badgeEl) {
      badgeEl.title         = 'Live data unavailable';
      badgeEl.style.opacity = '0.6';
    }
    throw err;
  }
}
