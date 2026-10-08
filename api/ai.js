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
    const generationConfig = { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.7, maxOutputTokens: 8192 };
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
    let detail = '';
    try { const ej = await r.json(); detail = String(ej?.error?.message || '').replace(/key[^ ]*/gi, '').slice(0, 160); } catch {}
    console.log('gemini', model, r.status, detail);
    last = Object.assign(new Error(r.status === 429 ? 'AI is busy right now (free limit). Wait a few seconds and try again.' : 'AI service error (' + model + ' ' + (r.status || 'network') + '): ' + detail), { status: r.status === 429 ? 429 : 502 });
    if (r.status === 429) break;
  }
  throw last || new Error('AI service error.');
}

const STYLE = [
  'You are an experienced academic writer helping a student in India prepare their OWN college or school document.',
  'Write the way a good final-year student or lecturer would: formal, clear, simple English (or the requested language), third person, no first-person "I" unless the section is Acknowledgement.',
  'Be specific and substantive. Explain what, why and how. Give definitions, reasoning, comparisons and concrete examples. No filler, no generic openers such as "In today\'s fast-paced world" or "Technology has become an integral part of our lives".',
  'Never invent: citations, book or paper titles, authors, URLs, statistics, percentages, survey or test results, dates, company names, people or institution names, version numbers. Never claim the student built, measured or tested something specific unless the details say so.',
  'If the student gave no technology details, describe the design in technology-neutral terms and name typical options only as examples ("such as a relational database"). Keep every section consistent with the topic and with the other sections.',
  'Output plain text only. No markdown bold or asterisks. Allowed structure: normal paragraphs; a subheading as its own paragraph starting with "## "; a bullet list as one paragraph whose lines each start with "- ".'
].join(' ');

const GUIDE = {
  introduction: 'Cover: background of the subject area, the problem being addressed, why it matters, and a short overview of the document. Use subheadings 1.1 Background, 1.2 Problem Statement, 1.3 Motivation where suitable.',
  objectives: 'List clear, measurable objectives as bullet lines, then a short scope paragraph covering what is included and what is excluded.',
  abstract: 'One tight paragraph of 150 to 220 words: problem, approach, main features, expected outcome. No headings, no references.',
  literature: 'Discuss the kinds of existing approaches and their limitations in general terms. Do not cite specific papers or authors.',
  analysis: 'Cover the existing system and its drawbacks, the proposed system and its advantages, and a feasibility study (technical, economic, operational) as subheadings.',
  requirement: 'Cover functional requirements (bullet list), non-functional requirements (bullet list), and hardware and software requirements stated as typical minimums, not as measured facts.',
  design: 'Describe the architecture, main modules and what each does, data flow, database entities with their key attributes, and user interface principles. Describe diagrams in words (they will be drawn separately).',
  implementation: 'Describe each module in order: purpose, inputs, processing steps and outputs. Mention validation and security measures. Use subheadings per module.',
  testing: 'Describe the testing strategy: unit, integration, system and user-acceptance testing, with example test scenarios and expected behaviour. Do NOT report fake pass rates or numbers.',
  results: 'Describe the expected outcomes and how the system meets each objective, in qualitative terms. Do not invent measurements.',
  conclusion: 'Summarise what the work achieves, how it meets the objectives, its limitations and key learnings.',
  future: 'Give realistic enhancements as bullet lines, each with one sentence of explanation.',
  methodology: 'Explain the approach step by step: planning, data or requirements gathering, design, development and evaluation. Mention the process model in general terms.',
  background: 'Explain the key concepts and terms a reader needs, with clear definitions and examples.',
  advantages: 'Give balanced advantages and limitations as two subheadings with bullet lines and one sentence of explanation each.',
  applications: 'Give realistic application areas with a short explanation for each.',
  main: 'Develop the main argument in well-ordered paragraphs, each with one clear point and an example.',
  examples: 'Give 2 to 4 concrete, realistic examples with short explanations.'
};
function guideFor(title) {
  const t = String(title).toLowerCase();
  const map = [['abstract', 'abstract'], ['introduc', 'introduction'], ['objective', 'objectives'], ['literature', 'literature'], ['analysis', 'analysis'], ['requirement', 'requirement'], ['design', 'design'], ['implement', 'implementation'], ['test', 'testing'], ['result', 'results'], ['conclusion', 'conclusion'], ['future', 'future'], ['method', 'methodology'], ['background', 'background'], ['advantage', 'advantages'], ['limitation', 'advantages'], ['application', 'applications'], ['main', 'main'], ['discussion', 'main'], ['example', 'examples'], ['current', 'main']];
  for (const [k, g] of map) if (t.includes(k)) return GUIDE[g];
  return 'Explain this section in depth with definitions, reasoning and examples relevant to the topic.';
}

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
      const out = await gemini(STYLE, `Plan the section titles for a ${type === 'blackbook' ? 'final-year project report (black book)' : type === 'assignment' ? 'short college assignment' : 'project report'} on this topic: "${topic}". Return the section titles in ${L} in the order a professional report on this topic would use (${type === 'blackbook' ? '9 to 12 chapters, starting with Abstract, then Introduction, covering analysis, requirements, design, implementation, testing, conclusion and future scope' : type === 'assignment' ? '4 to 6 sections' : '6 to 9 sections'}). Do not include Acknowledgement or References. Short titles only.`,
        { type: 'OBJECT', properties: { sections: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['sections'] });
      return res.status(200).json({ sections: (out.sections || []).map(s => clip(s, 80)).slice(0, 12) });
    }
    if (b.task === 'section') {
      const topic = clip(b.topic, 300), title = clip(b.title, 120), details = clip(b.details, 600);
      const outline = Array.isArray(b.outline) ? b.outline.slice(0, 20).map(s => clip(s, 80)).join(' | ') : '';
      const chapterNo = Math.max(0, Math.min(40, parseInt(b.chapterNo, 10) || 0));
      const words = type === 'assignment'
        ? { short: '90 to 140', medium: '160 to 260', long: '300 to 450' }[b.length] || '160 to 260'
        : { short: '120 to 180', medium: '280 to 420', long: '520 to 760' }[b.length] || '280 to 420';
      if (topic.length < 3 || !title) return res.status(400).json({ error: 'Missing topic or title.' });
      const abs = /abstract/i.test(title);
      const numbering = type === 'blackbook' && chapterNo && !abs ? ` If you use subheadings, number them ${chapterNo}.1, ${chapterNo}.2 and so on, for example "## ${chapterNo}.1 Background".` : ' If you use subheadings, do not number them.';
      const out = await gemini(STYLE, `Document type: ${type === 'blackbook' ? 'final-year project report (black book)' : type === 'assignment' ? 'assignment' : 'project report'}.\nTopic: "${topic}".\n${details ? 'Student-provided details (use only these for specific technologies, names or facts): ' + details + '\n' : ''}All sections in order: ${outline}.\nNow write ONLY the section titled "${title}" in ${L}. Length: about ${words} words in total.\nSection guidance: ${guideFor(title)}${numbering}\nDo not repeat the section title as a heading. Do not repeat content that clearly belongs to other sections.`,
        { type: 'OBJECT', properties: { paragraphs: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['paragraphs'] });
      return res.status(200).json({ paragraphs: (out.paragraphs || []).map(p => clip(p, 4000)).slice(0, 14) });
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
