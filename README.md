# BTC Integrity Monitor

A live dashboard tracking the structural health of the Bitcoin network through six
indicators and a single Composite Integrity Score.

**Live site:** [btcintegrity.com](https://btcintegrity.com) ·
**Methodology:** [btcintegrity.com/methodology.html](https://btcintegrity.com/methodology.html)

## About this project

A personal note upfront: I'm not a Bitcoin expert. I built this dashboard because I
wanted a better feel for the structural health of the network myself, beyond price
charts and headlines — and I figured others might find it useful too. The methodology
was developed with substantial help from AI, drawing on published research on
Bitcoin's security economics.

That's exactly why everything here is open source and documented in detail: I *want*
the calibration, the data handling, and the assumptions to be checked by people who
know more than I do. Ideas for improvement are welcome, limited time to implement though.

## What it measures

Bitcoin's integrity isn't just price or hashrate — it's a set of structural properties
that can erode quietly while the chain appears healthy. This dashboard tracks six of
them, grouped into three thematic pairs:

| Pair | Indicator | Question it answers |
|------|-----------|---------------------|
| **Economic sustainability** | Fee Market Maturity | Can fees replace the shrinking block subsidy? |
| | Security Budget | Is security spend proportional to the value secured? |
| **Decentralization & neutrality** | Mining Decentralization | How concentrated is block production? (HHI + Nakamoto coefficient) |
| | Transaction Inclusion | Are pools including transactions neutrally, or filtering? |
| **Capture & monoculture** | Custodial Concentration | How much supply sits with tracked institutional custodians? |
| | Node Software Diversity | Is the network dependent on a single client implementation? |

Each indicator is normalized to a 0–100 sub-score via fixed anchor points and combined
into a weighted composite with **weakest-link semantics**: the composite is capped at
25 points above the lowest sub-score, so strong indicators cannot mask a failing one.

Full details — data sources, anchor values, status thresholds, and calibration
rationale — are documented on the
[methodology page](https://btcintegrity.com/methodology.html).

## How it works

- **100% client-side.** No backend, no database, no tracking. All data is fetched
  directly from public APIs in your browser on page load.
- **No smoothing or adjustment** beyond what's described in the methodology.
- **Graceful degradation.** If an API is unreachable, that indicator is excluded and
  the coverage is shown. Fewer than four live indicators → no composite is displayed.

### Data sources

| Source | Used for |
|--------|----------|
| [mempool.space](https://mempool.space) | Block fees & rewards, pool shares, block-template match rates |
| [CoinGecko](https://www.coingecko.com) | Market cap, circulating supply, treasury holdings |
| [blockchain.info](https://blockchain.info) | Miner revenue (USD) |
| bitaccelerate.net | Node client software distribution |

