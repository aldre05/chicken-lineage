module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { id = '13243' } = req.query;
  
  try {
    const url = `https://app.chickensaga.com/api/proxy?tokenId=${id}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://app.chickensaga.com/',
        'Origin': 'https://app.chickensaga.com'
      }
    });
    const text = await response.text();
    return res.status(200).json({
      status: response.status,
      ok: response.ok,
      preview: text.slice(0, 500),
      url
    });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
