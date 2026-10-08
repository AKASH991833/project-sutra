// Server-side Gemini proxy for Documents & Projects Creator.
// The Gemini key lives only in the GEMINI_API_KEY environment variable on the host. It is never sent to the browser.
const MODELS = (process.env.GEMINI_MODELS || 'gemini-2.5-flash,gemini-2.0-flash,gemini-flash-latest').split(',');
const ALLOWED = (process.env.ALLOWED_ORIGINS || 'https://akash991833.github.io').split(',').map(s => s.trim());
const LANGS = { en: 'English', hi: 'Hindi (Devanagari script)', mr: 'Marathi (Devanagari script)' };
const hits = new Map();

function originOk(o, host) {
  if (!o) return false;
  try { if (host && new URL(o).host === host) return true; } catch {}
  if (ALLOWED.includes(o)) return true;
  try { const u = new URL(o); return u.hostname === 'localhost' || (/^project-sutra[a-z0-9-]*\.vercel\.app$/.test(u.hostname)) || u.hostname === (process.env.VERCEL_PROJECT_PRODUCTION_URL || '-'); } catch { return false; }
}
function limited(ip) {
  const now = Date.now(), win = 10 * 60 * 1000, arr = (hits.get(ip) || []).filter(t => now - t < win);
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > 60;
}
const clip = (v, n) => String(v == null ? '' : v).slice(0, n);

async function gemini(system, user, schema) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw Object.assign(new Error('AI is not configured yet.'), { status: 503 });
  let last;
  for (const model of MODELS) {
    const generationConfig = { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.7, maxOutputTokens: 4096 };
    if (model.includes('2.5')) generationConfig.thinkingConfig = { thinkingBudget: 0 };
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig })
    }).catch(e => ({ ok: false, status: 0, _e: e }));
    if (r.ok) {
      const j = await r.json();
      const t = j?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
      try { return JSON.parse(t); } catch { last = new Error('AI returned an unreadable answer. Try again.'); continue; }
    }
    last = Object.assign(new Error(r.status === 429 ? 'AI is busy right now (free limit). Wait a few seconds and try again.' : 'AI service error.'), { status: r.status === 429 ? 429 : 502 });
    if (r.status === 429) break;
  }
  throw last || new Error('AI service error.');
}

const STYLE = 'You help students format their own college and school documents. Write clear, simple, correct academic prose. Never invent citations, references, URLs, statistics, survey results, test results, names of people or institutions. If a fact is uncertain, stay general. Do not use markdown, headings or bullet symbols unless asked.';

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  if (originOk(origin, req.headers.host)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method === 'GET') return res.status(200).json({ ok: true, ai: !!process.env.GEMINI_API_KEY });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!originOk(origin, req.headers.host)) return res.status(403).json({ error: 'This site is not allowed to use the AI service.' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  if (limited(ip)) return res.status(429).json({ error: 'Too many requests. Wait a few minutes.' });
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const lang = LANGS[b.lang] ? b.lang : 'en', L = LANGS[lang];
    const type = ['assignment', 'project', 'blackbook'].includes(b.type) ? b.type : 'project';
    if (b.task === 'outline') {
      const topic = clip(b.topic, 300);
      if (topic.length < 3) return res.status(400).json({ error: 'Topic too short.' });
      const out = await gemini(STYLE, `Plan the section titles for a ${type === 'blackbook' ? 'final-year project report (black book)' : type === 'assignment' ? 'short college assignment' : 'project report'} on this topic: "${topic}". Return 5 to 9 section titles in ${L}, in a sensible order. Do not include Acknowledgement or References. Titles only, short.`,
        { type: 'OBJECT', properties: { sections: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['sections'] });
      return res.status(200).json({ sections: (out.sections || []).map(s => clip(s, 80)).slice(0, 12) });
    }
    if (b.task === 'section') {
      const topic = clip(b.topic, 300), title = clip(b.title, 120);
      const outline = Array.isArray(b.outline) ? b.outline.slice(0, 20).map(s => clip(s, 80)).join(', ') : '';
      const words = { short: '80 to 130', medium: '150 to 230', long: '260 to 380' }[b.length] || '150 to 230';
      if (topic.length < 3 || !title) return res.status(400).json({ error: 'Missing topic or title.' });
      const out = await gemini(STYLE, `Document topic: "${topic}". Document sections: ${outline}.\nWrite the section titled "${title}" in ${L}. About ${words} words in total, split into 1 to 3 paragraphs. Write only the body text of this section, no title.`,
        { type: 'OBJECT', properties: { paragraphs: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['paragraphs'] });
      return res.status(200).json({ paragraphs: (out.paragraphs || []).map(p => clip(p, 3000)).slice(0, 5) });
    }
    if (b.task === 'diagram') {
      const text = clip(b.text, 3500), title = clip(b.title, 120);
      if (text.length < 40) return res.status(400).json({ error: 'Not enough text.' });
      const out = await gemini('You turn a section of a student document into a simple diagram outline. Use only ideas that appear in the text.', `Section "${title}":\n${text}\n\nReturn a diagram: kind "flow" for steps in order, "layers" for stacked components, or "hub" when one central thing connects to several parts (first node is the centre). 3 to 7 nodes, each 1 to 5 words, in ${L}. Also a short diagram title in ${L}.`,
        { type: 'OBJECT', properties: { kind: { type: 'STRING' }, title: { type: 'STRING' }, nodes: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['kind', 'nodes'] });
      return res.status(200).json({ kind: clip(out.kind, 10), title: clip(out.title, 80), nodes: (out.nodes || []).map(n => clip(n, 40)).slice(0, 8) });
    }
    return res.status(400).json({ error: 'Unknown task.' });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message || 'Server error' });
  }
};
