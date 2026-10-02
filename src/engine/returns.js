// Returns engine: SIP outcomes from real monthly NAV history.
// Shows a range (weak / typical / strong), never a single promised number.

// A series is [['YYYY-MM', nav], ...], oldest first, one value per month.

function percentile(sorted, p) {
  if (!sorted.length) return NaN;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

// Value of `months` instalments, each invested at the start of a month and
// valued one month after the last instalment, at a monthly rate.
export function sipFutureValue(monthlyAmount, months, monthlyRate) {
  if (monthlyRate === 0) return monthlyAmount * months;
  const g = 1 + monthlyRate;
  return monthlyAmount * ((Math.pow(g, months) - 1) / monthlyRate) * g;
}

// Monthly rate that turns `months` instalments of 1 into `finalValue`.
export function sipMonthlyRate(months, finalValue) {
  let lo = -0.2, hi = 0.2;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (sipFutureValue(1, months, mid) < finalValue) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// Lines up several monthly series on the months they all share.
export function alignSeries(seriesById) {
  const ids = Object.keys(seriesById);
  const maps = ids.map((id) => new Map(seriesById[id]));
  const months = seriesById[ids[0]]
    .map(([m]) => m)
    .filter((m) => maps.every((mp) => mp.has(m)));
  return { months, values: ids.map((_, i) => months.map((m) => maps[i].get(m))), ids };
}

function usedSeries(seriesById, weights) {
  const used = Object.keys(weights).filter((id) => weights[id] > 0);
  for (const id of used) {
    if (!seriesById[id] || !seriesById[id].length) throw new Error(`No data for fund type: ${id}`);
  }
  return Object.fromEntries(used.map((id) => [id, seriesById[id]]));
}

// Runs a SIP of 1 per month into a weighted mix, for every possible start month,
// and returns the annualised SIP return of each window.
export function historicalSipRates(seriesById, weights, windowMonths) {
  const { months, values, ids } = alignSeries(usedSeries(seriesById, weights));
  const w = ids.map((id) => weights[id]);
  const total = w.reduce((a, b) => a + b, 0);
  const norm = w.map((x) => x / total);

  const rates = [];
  for (let s = 0; s + windowMonths < months.length; s++) {
    let finalValue = 0;
    for (let f = 0; f < ids.length; f++) {
      let units = 0;
      for (let k = s; k < s + windowMonths; k++) units += norm[f] / values[f][k];
      finalValue += units * values[f][s + windowMonths];
    }
    const r = sipMonthlyRate(windowMonths, finalValue);
    rates.push(Math.pow(1 + r, 12) - 1);
  }
  return { rates, firstMonth: months[0], lastMonth: months[months.length - 1], monthsAvailable: months.length };
}

// Projects a SIP using the weak (10th percentile), typical (median) and strong
// (90th percentile) rates seen in history. If history is shorter than the goal,
// it uses the longest window with enough samples and flags it in `basis`.
export function projectSip({ seriesById, weights, monthly, years, minWindows = 24 }) {
  const months = Math.round(years * 12);
  const { months: shared } = alignSeries(usedSeries(seriesById, weights));

  const windowYears = Math.min(Math.floor(years), Math.floor((shared.length - minWindows) / 12));
  if (windowYears < 1) {
    return { ok: false, reason: 'Not enough past data for this mix yet.' };
  }
  const hist = historicalSipRates(seriesById, weights, windowYears * 12);
  const sorted = [...hist.rates].sort((a, b) => a - b);
  const pick = { weak: percentile(sorted, 0.1), typical: percentile(sorted, 0.5), strong: percentile(sorted, 0.9) };

  const toMonthly = (annual) => Math.pow(1 + annual, 1 / 12) - 1;
  const value = (annual) => Math.round(sipFutureValue(monthly, months, toMonthly(annual)));

  return {
    ok: true,
    invested: monthly * months,
    outcomes: {
      weak: { annualRate: pick.weak, value: value(pick.weak) },
      typical: { annualRate: pick.typical, value: value(pick.typical) },
      strong: { annualRate: pick.strong, value: value(pick.strong) }
    },
    basis: {
      windowYears,
      windowsCounted: hist.rates.length,
      from: hist.firstMonth,
      to: hist.lastMonth,
      extrapolated: windowYears < years
    },
    disclaimer: "Based on past data. Past returns don't guarantee future results."
  };
}
