// Orchestrator: loads and runs all indicator updates
import { updateFeeMarket }              from './indicators/fee-market.js';
import { updateSecurityBudget }         from './indicators/security-budget.js';
import { updateMiningDecentralization } from './indicators/mining-decentralization.js';
import { updateTransactionInclusion }   from './indicators/transaction-inclusion.js';
import { updateCustodialConcentration } from './indicators/custodial-concentration.js';
import { updateNodeDiversity }          from './indicators/node-diversity.js';
import { updateComposite }              from './composite.js';
import { updateTimestamp }              from './utils/timestamp.js';

const INDICATORS = [
  ['Fee Market Maturity',      updateFeeMarket],
  ['Security Budget',          updateSecurityBudget],
  ['Mining Decentralization',  updateMiningDecentralization],
  ['Transaction Inclusion',    updateTransactionInclusion],
  ['Custodial Concentration',  updateCustodialConcentration],
  ['Node Software Diversity',  updateNodeDiversity],
];

async function init() {
  // Run all indicator updates in parallel. Shared endpoints are deduplicated
  // by utils/fetch-cache.js, so overlapping fetches only hit the network once.
  const settled = await Promise.allSettled(INDICATORS.map(([, fn]) => fn()));

  const live = [];
  settled.forEach((result, i) => {
    if (result.status === 'fulfilled' && result.value) {
      live.push(result.value);
    } else if (result.status === 'rejected') {
      console.error(`Indicator "${INDICATORS[i][0]}" failed:`, result.reason);
    }
  });

  // Composite handles partial coverage itself (renormalizes weights,
  // suppresses the score below its minimum-coverage floor).
  updateComposite(live);

  // Only refresh the timestamp if at least one indicator actually got data,
  // so a total outage doesn't falsely signal freshness.
  if (live.length > 0) {
    updateTimestamp();
  }
}

init();
