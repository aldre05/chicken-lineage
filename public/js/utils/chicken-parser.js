export function getAttributeValue(attributes, name) {
  const attribute = (attributes || []).find((entry) => entry.trait_type === name);
  return attribute ? attribute.value : null;
}

export function parseChickenData(data, fallbackId) {
  if (!data || data.error) {
    return {
      id: String(fallbackId),
      unknown: true,
      ip: 0,
      parent1: '0',
      parent2: '0',
    };
  }

  const source = data.metadata || data;
  const attributes = source.attributes || data.attributes || [];
  const innateAttack   = Number(getAttributeValue(attributes, 'Innate Attack'))   || 0;
  const innateDefense  = Number(getAttributeValue(attributes, 'Innate Defense'))  || 0;
  const innateSpeed    = Number(getAttributeValue(attributes, 'Innate Speed'))    || 0;
  const innateHealth   = Number(getAttributeValue(attributes, 'Innate Health'))   || 0;
  // Secondary innate stats — real value if present, otherwise mirror base stat
  const iCrRaw  = getAttributeValue(attributes, 'Innate Cockrage');
  const iFerRaw = getAttributeValue(attributes, 'Innate Ferocity');
  const iEvaRaw = getAttributeValue(attributes, 'Innate Evasion');
  const innateCockrage  = iCrRaw  != null ? Number(iCrRaw)  : innateAttack;
  const innateFerocity  = iFerRaw != null ? Number(iFerRaw) : innateDefense;
  const innateEvasion   = iEvaRaw != null ? Number(iEvaRaw) : innateSpeed;

  return {
    id: String(source.token_id || source.id || data.token_id || data.id || fallbackId),
    image: source.image || data.image || '',
    gen: getAttributeValue(attributes, 'Generation') || '',
    type: getAttributeValue(attributes, 'Type') || '',
    instinct: getAttributeValue(attributes, 'Instinct') || '',
    level: getAttributeValue(attributes, 'Level') || 1,
    breedCount: Number(getAttributeValue(attributes, 'Breed Count')) || 0,
    body: getAttributeValue(attributes, 'Body') || '',
    gender: getAttributeValue(attributes, 'Gender') || '',
    parent1: String(getAttributeValue(attributes, 'Parent 1') || '0'),
    parent2: String(getAttributeValue(attributes, 'Parent 2') || '0'),
    iAtk: innateAttack,
    iDef: innateDefense,
    iSpd: innateSpeed,
    iHp: innateHealth,
    iCr:  innateCockrage,
    iFer: innateFerocity,
    iEva: innateEvasion,
    hasTrueSecondary: iCrRaw != null || iFerRaw != null || iEvaRaw != null,
    ip: innateAttack + innateCockrage + innateDefense + innateFerocity + innateSpeed + innateEvasion + innateHealth,
    dead: String(getAttributeValue(attributes, 'State') || '') === 'Dead',
    unknown: false,
  };
}
