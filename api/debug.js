module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { parent = '2735', start = '15200', end = '15400' } = req.query;
  
  const CONTRACT = '0x322b3d98ddbd589dc2e8dd83659bb069828231e0';
  const API_KEY  = 'l62lam6Dt5AyU7zO6H7fK0Czz58bcPYq';
  
  // Just check a few specific IDs
  const testIds = [15288, 15486, 15762];
  const results = [];
  
  for (const id of testIds) {
    try {
      const url = `https://api-gateway.skymavis.com/skynet/ronin/web3/v2/collections/${CONTRACT}/tokens/${id}`;
      const r = await fetch(url, { headers: { 'X-API-Key': API_KEY } });
      const json = await r.json();
      const item = json?.result?.token ?? json?.result ?? json;
      const meta = item?.metadata ?? item;
      const attrs = meta?.attributes || [];
      const p1 = String((attrs.find(a => a.trait_type === 'Parent 1') || {}).value || '0');
      const p2 = String((attrs.find(a => a.trait_type === 'Parent 2') || {}).value || '0');
      results.push({ id, status: r.status, parent1: p1, parent2: p2, isChild: p1 === parent || p2 === parent });
    } catch(e) {
      results.push({ id, error: e.message });
    }
  }
  
  return res.status(200).json({ parent, results });
}
