// Plain-language glossary. The AI looks terms up here instead of inventing definitions.
export const GLOSSARY = {
  sip: {
    term: 'SIP (Systematic Investment Plan)',
    plain: 'Investing a fixed amount in a mutual fund every month, automatically.',
    example: '₹2,000 on the 5th of every month goes into your chosen fund, whether markets are up or down.'
  },
  nav: {
    term: 'NAV (Net Asset Value)',
    plain: "The price of one unit of a mutual fund. It's updated once every working day.",
    example: 'If the NAV is ₹50 and you invest ₹5,000, you get 100 units.'
  },
  expense_ratio: {
    term: 'Expense ratio',
    plain: "The yearly fee a fund charges to manage your money, taken as a small % of what you've invested.",
    example: 'A 1% expense ratio on ₹1,00,000 is about ₹1,000 a year. Lower is usually better.'
  },
  direct_vs_regular: {
    term: 'Direct plan vs regular plan',
    plain: 'The same fund in two versions. Regular plans pay a commission to a distributor, so they have a higher expense ratio. Direct plans skip the middleman and cost less.',
    example: 'Over 10+ years, the lower fee of a direct plan can add up to a noticeably bigger amount.'
  },
  exit_load: {
    term: 'Exit load',
    plain: 'A small fee some funds charge if you withdraw before a set period, often 1 year.',
    example: 'A 1% exit load on a ₹10,000 withdrawal costs ₹100.'
  },
  equity: {
    term: 'Equity (growth) funds',
    plain: 'Funds that own shares in companies. They can grow more over long periods but go up and down along the way.',
    example: 'Large-cap, flexi-cap and mid-cap funds are all equity funds.'
  },
  debt: {
    term: 'Debt (stability) funds',
    plain: 'Funds that lend money to the government and companies and earn interest. Steadier than equity, but grow slower.',
    example: 'Short-duration and liquid funds are debt funds.'
  },
  index_fund: {
    term: 'Index fund',
    plain: 'A fund that simply copies a market index, like the Nifty 50, instead of a manager picking stocks. Usually low cost.',
    example: 'A Nifty 50 index fund holds the same 50 companies as the Nifty 50.'
  },
  large_cap: {
    term: 'Large-cap',
    plain: "India's biggest companies by market value. Usually steadier than smaller companies.",
    example: 'Funds that mainly hold these are called large-cap funds.'
  },
  mid_cap: {
    term: 'Mid-cap',
    plain: 'Medium-sized companies. They can grow faster than large companies but swing more.',
    example: 'A mid-cap fund can fall more in a bad year and rise more in a good one.'
  },
  flexi_cap: {
    term: 'Flexi-cap fund',
    plain: 'A fund where the manager can invest in companies of any size.',
    example: 'It might hold mostly large companies one year and more mid-sized ones the next.'
  },
  liquid_fund: {
    term: 'Liquid fund',
    plain: 'A very low-risk debt fund for money you may need soon. Withdrawals usually reach your bank in a day.',
    example: 'A common place to keep an emergency fund.'
  },
  emergency_fund: {
    term: 'Emergency fund',
    plain: 'Savings set aside for surprises like a job loss or medical bill, usually 3–6 months of expenses.',
    example: 'If you spend ₹30,000 a month, aim for ₹90,000 to ₹1,80,000.'
  },
  elss: {
    term: 'ELSS (tax-saving fund)',
    plain: 'An equity (growth) fund that can lower your income tax under the old tax regime, up to the yearly limit for tax-saving investments. Each investment is locked in for 3 years.',
    example: 'Money you put in today can only be withdrawn after 3 years. Tax rules change, so check the current limit before investing for tax.'
  },
  lump_sum: {
    term: 'Lump sum',
    plain: 'Investing a large amount at once instead of monthly.',
    example: 'Investing a ₹50,000 bonus in one go.'
  },
  xirr: {
    term: 'XIRR / annual return',
    plain: 'A way to measure the yearly growth rate of investments made at different times, like a SIP.',
    example: 'A SIP with an XIRR of 12% grew at roughly 12% a year on average.'
  },
  risk: {
    term: 'Risk (in investing)',
    plain: 'How much an investment can go up and down, and the chance of being worth less than you put in, especially over short periods.',
    example: 'Equity funds can fall 20–30% in a bad year; debt funds rarely move that much.'
  },
  compounding: {
    term: 'Compounding',
    plain: 'Earning returns on your past returns, not just on what you put in. It is why starting early helps so much.',
    example: 'Growth in year 10 is calculated on everything built up over years 1 to 9.'
  },
  costly_debt: {
    term: 'High-interest debt (credit cards, personal loans)',
    plain: 'Loans that charge more interest than investments usually earn. Paying them off first is usually the best "return" you can get.',
    example: 'Clearing credit card dues before starting a SIP stops the debt from growing faster than your savings.'
  },
  rebalancing: {
    term: 'Rebalancing',
    plain: 'Bringing your growth/stability split back to your plan, usually once a year, after markets move it.',
    example: 'If 70/30 drifts to 80/20 after a good year, you move some money back to stability.'
  }
};

const ALIASES = {
  'systematic investment plan': 'sip', 'net asset value': 'nav', 'ter': 'expense_ratio',
  'expense': 'expense_ratio', 'direct plan': 'direct_vs_regular', 'regular plan': 'direct_vs_regular',
  'direct': 'direct_vs_regular', 'regular': 'direct_vs_regular', 'equity': 'equity', 'shares': 'equity',
  'stocks': 'equity', 'debt fund': 'debt', 'bond': 'debt', 'index': 'index_fund', 'nifty': 'index_fund',
  'largecap': 'large_cap', 'large cap': 'large_cap', 'midcap': 'mid_cap', 'mid cap': 'mid_cap',
  'flexicap': 'flexi_cap', 'flexi cap': 'flexi_cap', 'liquid': 'liquid_fund', 'emergency': 'emergency_fund',
  'tax saving': 'elss', 'tax saver': 'elss', 'lumpsum': 'lump_sum', 'one time': 'lump_sum',
  'cagr': 'xirr', 'credit card': 'costly_debt', 'loan': 'costly_debt', 'debt first': 'costly_debt', 'return': 'xirr', 'compound': 'compounding', 'rebalance': 'rebalancing'
};

export function lookupTerm(query) {
  const q = String(query || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!q) return { found: false };
  const key = q.replace(/ /g, '_');
  if (GLOSSARY[key]) return { found: true, ...GLOSSARY[key] };
  for (const [alias, id] of Object.entries(ALIASES)) {
    if (q.includes(alias)) return { found: true, ...GLOSSARY[id] };
  }
  for (const [id, entry] of Object.entries(GLOSSARY)) {
    if (q.includes(id.replace(/_/g, ' ')) || entry.term.toLowerCase().includes(q)) return { found: true, ...entry };
  }
  return { found: false, available: Object.values(GLOSSARY).map((g) => g.term) };
}
