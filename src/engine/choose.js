// How to choose a fund within each fund type. Shown on the plan screen and
// used by the AI, so both always give the same advice. No fund names, on purpose.

export const COMMON_TIPS = [
  'Pick the direct plan: same fund, lower fees.',
  'Compare expense ratios: lower means more of your money stays invested.',
  'Prefer funds at least 5 years old, so you can see how they handled bad years.',
  'Look for steady returns over 5 to 10 years, not just the best last year.'
];

export const TYPE_TIPS = {
  largecap_index: [
    'All Nifty 50 index funds hold the same companies, so the lowest expense ratio usually wins.',
    'Check how closely it follows the index (often shown as "tracking error"; lower is better).'
  ],
  flexicap: [
    'Compare its 5 and 10-year returns with other flexi-cap funds, not with last year alone.',
    "Check how long the current fund manager has run it."
  ],
  midcap: [
    'Expect bigger ups and downs. Keep this money invested for 7 years or more.',
    'Compare how much it fell in bad years, not just how much it rose in good ones.'
  ],
  short_debt: [
    'Prefer funds that lend mostly to the government and top-rated companies (check the "credit quality" or rating breakdown).',
    'Expense ratio matters a lot here, because returns are steadier and smaller.'
  ],
  liquid: [
    'Liquid funds are very similar to each other, so choose a low expense ratio and a large, well-known fund house.',
    'Check how quickly withdrawals reach your bank; usually the next working day.'
  ]
};

export const WHERE_TO_COMPARE = 'Compare funds on the investment app you use, or on AMFI\'s website (amfiindia.com), which lists every mutual fund in India.';

export function tipsFor(typeId) {
  return { specific: TYPE_TIPS[typeId] || [], common: COMMON_TIPS, whereToCompare: WHERE_TO_COMPARE };
}
