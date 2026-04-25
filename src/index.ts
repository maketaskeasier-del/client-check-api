import { Hono } from "hono";

const app = new Hono();

// =====================================================
// 🌐 CORS
// =====================================================
app.use('*', async (c, next) => {
  await next();
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Headers', '*');
  c.header('Access-Control-Allow-Methods', '*');
});

app.options('*', (c) => c.text('', 200));

// =====================================================
// 🧠 INTELLIGENT RISK ENGINE v2
// =====================================================

// 🔥 Strong negative legal events
const STRONG_SIGNALS = [
  "money laundering case",
  "fraud investigation",
  "scam case",
  "fugitive businessman",
  "extradition case",
  "charged with",
  "arrested by"
];

// ⚖️ Context modifiers
const NEGATIONS = [
  "denies",
  "not guilty",
  "no evidence",
  "cleared",
  "acquitted",
  "dismissed",
  "quashed",
  "withdrawn"
];

// 📊 Risk keywords
const KEYWORDS = {
  high: ["fraud", "scam", "money laundering", "arrest", "raid", "fugitive", "convicted"],
  medium: ["investigation", "probe", "case", "court", "hearing", "fir", "chargesheet"],
  low: ["notice", "penalty", "audit", "violation", "default"]
};

const WEIGHTS = { high: 5, medium: 3, low: 1 };

// =====================================================
// 🧠 CORE SCORING FUNCTION (NEW LOGIC)
// =====================================================
function scoreHeadline(headline) {
  const text = headline.toLowerCase();

  let score = 0;

  // 1. Strong signals
  for (const s of STRONG_SIGNALS) {
    if (text.includes(s)) score += 8;
  }

  // 2. Keyword scoring
  for (const k of KEYWORDS.high) if (text.includes(k)) score += WEIGHTS.high;
  for (const k of KEYWORDS.medium) if (text.includes(k)) score += WEIGHTS.medium;
  for (const k of KEYWORDS.low) if (text.includes(k)) score += WEIGHTS.low;

  // 3. NEGATION override (IMPORTANT UPGRADE)
  for (const n of NEGATIONS) {
    if (text.includes(n)) score -= 6;
  }

  // 4. Outcome correction layer (NEW)
  if (text.includes("cleared of") || text.includes("not involved")) {
    score = Math.min(score, 1);
  }

  if (text.includes("convicted") || text.includes("guilty")) {
    score += 4;
  }

  return Math.max(score, 0);
}

// =====================================================
// 🧠 RISK LEVEL ENGINE
// =====================================================
function getRiskLevel(headlines) {
  const scores = headlines.map(h => h.score);

  const high = scores.filter(s => s >= 7).length;
  const medium = scores.filter(s => s >= 3 && s < 7).length;

  let level = "Low";
  let confidence = "Weak";
  let insight = "No major red flags detected.";

  if (high >= 2) {
    level = "High";
    confidence = "Strong";
    insight = "Multiple serious legal signals detected across sources.";
  } 
  else if (high === 1) {
    level = "High";
    confidence = "Moderate";
    insight = "One strong legal risk signal found. Needs verification.";
  } 
  else if (medium >= 2) {
    level = "Medium";
    confidence = "Moderate";
    insight = "Repeated regulatory/legal mentions found.";
  } 
  else if (medium === 1) {
    level = "Medium";
    confidence = "Weak";
    insight = "Single compliance-related mention detected.";
  }

  return { level, confidence, insight };
}

// =====================================================
// 🚀 MAIN API
// =====================================================
app.post("/api/analyze-directors", async (c) => {
  try {
    const { companyName, directors } = await c.req.json();

    if (!directors?.length) {
      return c.json({ error: "Directors required" }, 400);
    }

    const result = [];

    for (const name of directors) {

      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(name)}&hl=en-IN&gl=IN&ceid=IN:en`;

      const res = await fetch(url);
      const text = await res.text();

     const items = [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1]);

let headlines = items.map(item => {
  const titleMatch = item.match(/<title>(.*?)<\/title>/);
  const linkMatch = item.match(/<link>(.*?)<\/link>/);
  return {
    title: titleMatch ? titleMatch[1] : null,
    link: linkMatch ? linkMatch[1] : null,
  };
}).filter(h => h.title && h.title !== "Google News");

      // 🧠 Remove duplicates (IMPORTANT FIX)
      headlines = [...new Set(headlines)];

      // 🧠 Score
      const scored = headlines.map(h => ({
  headline: h.title,
  link: h.link,
  score: scoreHeadline(h.title)
})).sort((a, b) => b.score - a.score);

      // 🧠 Risk engine
      const risk = getRiskLevel(scored);

      // 🎯 Smart slicing
      const final = scored.filter(h => h.score > 0).slice(0, 5);

      result.push({
        name,
       news: final.map(f => ({ headline: f.headline, link: f.link })),
        risk
      });
    }

    return c.json({
      companyName: companyName || "Unknown Company",
      directors: result
    });

  } catch (err) {
    console.error(err);
    return c.json({ error: "Failed to analyze directors" }, 500);
  }
});

// =====================================================
// 🟢 HEALTH
// =====================================================
app.get("/", (c) => c.text("Backend v2 running 🚀"));

export default app;