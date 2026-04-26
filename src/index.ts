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

const STRONG_SIGNALS = [
  "money laundering case",
  "fraud investigation",
  "scam case",
  "fugitive businessman",
  "extradition case",
  "charged with",
  "arrested by"
];

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

const KEYWORDS = {
  high: ["fraud", "scam", "money laundering", "arrest", "raid", "fugitive", "convicted"],
  medium: ["investigation", "probe", "case", "court", "hearing", "fir", "chargesheet"],
  low: ["notice", "penalty", "audit", "violation", "default"]
};

const WEIGHTS = { high: 5, medium: 3, low: 1 };

// =====================================================
// 🧠 CORE SCORING FUNCTION
// =====================================================
function scoreHeadline(headline) {
  const text = headline.toLowerCase();
  let score = 0;

  for (const s of STRONG_SIGNALS) {
    if (text.includes(s)) score += 8;
  }

  for (const k of KEYWORDS.high)   if (text.includes(k)) score += WEIGHTS.high;
  for (const k of KEYWORDS.medium) if (text.includes(k)) score += WEIGHTS.medium;
  for (const k of KEYWORDS.low)    if (text.includes(k)) score += WEIGHTS.low;

  for (const n of NEGATIONS) {
    if (text.includes(n)) score -= 6;
  }

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
  const high   = scores.filter(s => s >= 7).length;
  const medium = scores.filter(s => s >= 3 && s < 7).length;

  let level = "Low", confidence = "Weak", insight = "No major red flags detected.";

  if (high >= 2) {
    level = "High"; confidence = "Strong";
    insight = "Multiple serious legal signals detected across sources.";
  } else if (high === 1) {
    level = "High"; confidence = "Moderate";
    insight = "One strong legal risk signal found. Needs verification.";
  } else if (medium >= 2) {
    level = "Medium"; confidence = "Moderate";
    insight = "Repeated regulatory/legal mentions found.";
  } else if (medium === 1) {
    level = "Medium"; confidence = "Weak";
    insight = "Single compliance-related mention detected.";
  }

  return { level, confidence, insight };
}

// =====================================================
// 🕐 DATE FILTER HELPER
// parseSince("7d")  → timestamp 7 days ago
// parseSince("1d")  → timestamp 24 hours ago
// parseSince("30d") → timestamp 30 days ago
// parseSince(null)  → null (no filter = return all)
// =====================================================
function parseSince(param) {
  if (!param) return null;
  const n = parseInt(param);
  if (isNaN(n) || n <= 0) return null;
  return Date.now() - n * 24 * 60 * 60 * 1000;
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

    // ✅ NEW: read optional ?since=7d param from query string
    // If present → only return news from the last N days
    // If absent  → return all news (your other app keeps working as-is)
    const sinceParam = c.req.query('since');
    const sinceMs    = parseSince(sinceParam);

    const result = [];

    for (const name of directors) {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(name)}&hl=en-IN&gl=IN&ceid=IN:en`;

      const res  = await fetch(url);
      const text = await res.text();

      const items = [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1]);

      // ✅ CHANGED: also parse <pubDate> from each RSS item
      let headlines = items.map(item => {
        const titleMatch   = item.match(/<title>(.*?)<\/title>/);
        const linkMatch    = item.match(/<link>(.*?)<\/link>/);
        const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);

        const pubDate = pubDateMatch
          ? new Date(pubDateMatch[1]).getTime()
          : null;

        return {
          title:   titleMatch ? titleMatch[1] : null,
          link:    linkMatch  ? linkMatch[1]  : null,
          pubDate,
        };
      }).filter(h => h.title && h.title !== "Google News");

      // ✅ NEW: apply date filter only when ?since= was passed
      if (sinceMs !== null) {
        headlines = headlines.filter(h => h.pubDate && h.pubDate >= sinceMs);
      }

      // Remove duplicates
      const seen = new Set();
      headlines = headlines.filter(h => {
        if (seen.has(h.title)) return false;
        seen.add(h.title);
        return true;
      });

      // Score each headline
      const scored = headlines.map(h => ({
        headline: h.title,
        link:     h.link,
        pubDate:  h.pubDate,
        score:    scoreHeadline(h.title),
      })).sort((a, b) => b.score - a.score);

      // Risk engine
      const risk = getRiskLevel(scored);

      // Return top relevant headlines
      const final = scored.filter(h => h.score >= 3).slice(0, 5);

      result.push({
        name,
        news: final.map(f => ({ headline: f.headline, link: f.link, pubDate: f.pubDate })),
        risk,
      });
    }

    return c.json({
      companyName: companyName || "Unknown Company",
      directors:   result,
    });

  } catch (err) {
    console.error(err);
    return c.json({ error: "Failed to analyze directors" }, 500);
  }
});

// =====================================================
// 🟢 HEALTH
// =====================================================
app.get("/", (c) => c.text("Backend v3 running 🚀 (date filter support added)"));

export default app;