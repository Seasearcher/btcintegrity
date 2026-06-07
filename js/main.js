// Orchestrator: loads and runs all indicator updates
import { updateFeeMarket } from './indicators/fee-market.js';
import { updateTimestamp } from './utils/timestamp.js';

async function init() {
  // Run all indicator updates in parallel
  const results = await Promise.allSettled([
    updateFeeMarket(),
    // Future indicators will be added here:
    // updateSecurityBudget(),
    // updateMiningDecentralization(),
    // updateCensorshipResistance(),
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
