// Orchestrator: loads and runs all indicator updates
import { updateFeeMarket }              from './indicators/fee-market.js';
import { updateSecurityBudget }         from './indicators/security-budget.js';
import { updateMiningDecentralization } from './indicators/mining-decentralization.js';
import { updateTransactionInclusion }   from './indicators/transaction-inclusion.js';
import { updateTimestamp }              from './utils/timestamp.js';

async function init() {
  // Run all indicator updates in parallel
  const results = await Promise.allSettled([
    updateFeeMarket(),
    updateSecurityBudget(),
    updateMiningDecentralization(),
    updateTransactionInclusion(),
    // Future indicators will be added here:
    // updateCustodialConcentration(),
    // updateNodeDiversity(),
  ]);

  // Log any failures without breaking the page
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`Indicator ${i + 1} failed:`, result.reason);
    }
  });

  // Update the global timestamp once all data is fetched
  updateTimestamp();
}

init();
