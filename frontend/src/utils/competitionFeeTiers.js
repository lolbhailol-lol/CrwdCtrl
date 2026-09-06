export function sanitizeCompetitionFeeTiers(list) {
  if (!Array.isArray(list)) return [];
  const used = new Set();
  return list
    .map((tier, index) => {
      const label = String(tier?.label || tier?.name || '').trim();
      const amount = Math.max(0, Math.round(Number(tier?.amount ?? tier?.fee) || 0));
      let id = String(tier?.id || '').trim();
      if (!id) {
        id = label
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, '')
          .slice(0, 32) || `tier_${index + 1}`;
      }
      id = id.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 48);
      if (!id) id = `tier_${index + 1}`;
      if (used.has(id)) id = `${id}_${index + 1}`;
      used.add(id);
      return { id, label, amount };
    })
    .filter((tier) => tier.label || tier.amount > 0)
    .map((tier, index) => ({
      ...tier,
      label: tier.label || `Category ${index + 1}`,
    }));
}

export function getCompetitionFeeTiers(competition) {
  return sanitizeCompetitionFeeTiers(competition?.feeTiers);
}

export function minCompetitionFeeAmount(tiers) {
  if (!Array.isArray(tiers) || !tiers.length) return 0;
  return Math.min(...tiers.map((t) => Math.max(0, Number(t.amount) || 0)));
}

export function formatCompetitionFeeTiersLabel(tiers) {
  const list = sanitizeCompetitionFeeTiers(tiers);
  if (!list.length) return '';
  return list
    .map((t) => `₹${Number(t.amount).toLocaleString('en-IN')}/- for ${t.label}`)
    .join(' · ');
}

export function formatCompetitionFeeFromLabel(tiers) {
  const list = sanitizeCompetitionFeeTiers(tiers);
  if (!list.length) return '';
  const min = minCompetitionFeeAmount(list);
  const max = Math.max(...list.map((t) => t.amount));
  if (max === 0) return 'Free';
  if (min === max) return `₹${min.toLocaleString('en-IN')}`;
  return list
    .map((t) => `₹${Number(t.amount).toLocaleString('en-IN')}`)
    .join(' · ');
}

export function findCompetitionFeeTier(competition, tierId) {
  const id = String(tierId || '').trim();
  if (!id) return null;
  return getCompetitionFeeTiers(competition).find((t) => t.id === id) || null;
}

export function organizerCompetitionFeeLabel(comp = {}) {
  const tiers = getCompetitionFeeTiers(comp);
  if (tiers.length > 1) return formatCompetitionFeeFromLabel(tiers);
  if (tiers.length === 1) {
    const amount = Number(tiers[0].amount) || 0;
    return amount > 0 ? `₹${amount.toLocaleString('en-IN')}` : 'Free';
  }
  const n = Number(comp.feeAmount) || 0;
  if (n > 0) return `₹${n.toLocaleString('en-IN')}`;
  const raw = String(comp.registrationFee || '').trim();
  return raw || 'Free';
}
