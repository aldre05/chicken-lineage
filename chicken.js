// Vercel serverless function - proxies Chicken Saga API to avoid CORS
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  try {
    const response = await fetch(`https://app.chickensaga.com/api/proxy?tokenId=${id}`);
    if (!response.ok) return res.status(404).json({ error: 'Chicken not found' });
    const data = await response.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
