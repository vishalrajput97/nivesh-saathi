// Risk scoring: plain, explainable rules (no AI).
// Inputs come from the onboarding questions.

export const PROFILES = {
  conservative: {
    id: 'conservative',
    label: 'Careful',
    plain: 'You prefer steady growth and smaller ups and downs.'
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    plain: 'Okay with some ups and downs for better growth over time.'
  },
  growth: {
    id: 'growth',
    label: 'Growth-focused',
    plain: 'Comfortable riding big ups and downs for the best long-term growth.'
  }
};

// reaction: what the user would do if ₹1,00,000 fell to ₹80,000
//   'sell' | 'wait' | 'buy_more'
// years: how long until they need the money
export function scoreRisk({ reaction, years }) {
  if (!['sell', 'wait', 'buy_more'].includes(reaction)) {
    throw new Error(`Unknown reaction: ${reaction}`);
  }
  if (!(years > 0)) throw new Error('years must be a positive number');

  const fromReaction = { sell: 'conservative', wait: 'balanced', buy_more: 'growth' }[reaction];
  const order = ['conservative', 'balanced', 'growth'];

  // Time horizon caps how much risk makes sense, whatever the comfort level.
  let cap = 'growth';
  let capReason = null;
  if (years < 3) {
    cap = 'conservative';
    capReason = 'You need this money in under 3 years, so the plan stays mostly in steadier funds.';
  } else if (years < 5) {
    cap = 'balanced';
    capReason = 'With under 5 years to go, the plan limits how much goes into shares.';
  }

  const profileId = order[Math.min(order.indexOf(fromReaction), order.indexOf(cap))];
  return {
    profile: PROFILES[profileId],
    limitedByTime: profileId !== fromReaction,
    reason: profileId !== fromReaction ? capReason : null
  };
}
