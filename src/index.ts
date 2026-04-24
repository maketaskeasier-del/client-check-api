import { Hono } from "hono";

const app = new Hono();

// ✅ CORS
app.use('*', async (c, next) => {
  await next();
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Headers', '*');
  c.header('Access-Control-Allow-Methods', '*');
});

app.options('*', (c) => c.text('', 200));

// =====================================================
// 🔥 INTELLIGENT SIGNAL SYSTEM
// =====================================================

// 🔴 Strong phrases (highest priority)
const STRONG_SIGNALS = [
  "money laundering case",
  "fraud investigation",
  "scam case",
  "under investigation",
  "arrested by",
  "charged with",
  "fugitive businessman",
  "extradition case",
];

// 🔻 Negation / positive context
const NEGATION_WORDS = [
  "denies",
  "no evidence",
  "cleared",
  "acquitted",
  "not involved",
  "dismissed",
  "quashed"
];

// 🔑 Keywords
const KEYWORDS = {
  high: [
    "fraud", "scam", "money laundering", "arrest", "raid",
    "illegal", "fugitive", "charged", "convicted", "extradition"
  ],
  medium: [
    "investigation", "probe", "case", "court", "hearing",
    "cbi", "ed", "sfio", "fir", "chargesheet"
  ],
  low: [
    "notice", "penalty", "default", "non-compliance",
    "violation", "tax evasion", "audit"
  ]
};

const WEIGHTS = {
  high: 5,
  medium: 3,
  low: 1
};

// =====================================================
// 🔥 MAIN API
// =====================================================

app.post("/api/analyze-directors", async (c) => {
  try {
    const body = await c.req.json();
    const { companyName, directors } = body;

    if (!directors || directors.length === 0) {
      return c.json({ error: "Directors required" }, 400);
    }

    const result = [];

    for (let name of directors) {

      // 🔍 Neutral search (important)
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(name)}&hl=en-IN&gl=IN&ceid=IN:en`;

      const res = await fetch(url);
      const text = await res.text();

      let headlines = [...text.matchAll(/<title>(.*?)<\/title>/g)]
        .map((match) => match[1])
        .filter((title): title is string => Boolean(title))
        .filter((title) => title !== "Google News");

      // =====================================================
      // 🧠 SMART SCORING
      // =====================================================

      let scoredHeadlines = headlines.map((headline) => {
        const lower = headline.toLowerCase();
        let score = 0;

        // 🔴 STRONG SIGNALS (very high confidence)
        STRONG_SIGNALS.forEach((phrase) => {
          if (lower.includes(phrase)) score += 8;
        });

        // 🔴 HIGH
        KEYWORDS.high.forEach((kw) => {
          if (lower.includes(kw)) score += WEIGHTS.high;
        });

        // 🟠 MEDIUM
        KEYWORDS.medium.forEach((kw) => {
          if (lower.includes(kw)) score += WEIGHTS.medium;
        });

        // 🟡 LOW
        KEYWORDS.low.forEach((kw) => {
          if (lower.includes(kw)) score += WEIGHTS.low;
        });

        // ⚠️ NEGATION → reduce score
        NEGATION_WORDS.forEach((word) => {
          if (lower.includes(word)) score -= 4;
        });

        return {
          headline,
          score: Math.max(score, 0)
        };
      });

      // 🔥 Sort by risk
      scoredHeadlines.sort((a, b) => b.score - a.score);

      // =====================================================
      // 🧠 FREQUENCY BOOST (big upgrade)
      // =====================================================

      const riskCount = scoredHeadlines.filter(h => h.score > 0).length;

      if (riskCount >= 3) {
        scoredHeadlines = scoredHeadlines.map(h => ({
          ...h,
          score: h.score + 2
        }));
      }

      // =====================================================
      // 🎯 FINAL SELECTION LOGIC
      // =====================================================

      const hasRisk = scoredHeadlines.length > 0 && (scoredHeadlines[0]?.score ?? 0) > 0;

      const finalHeadlines = hasRisk
        ? scoredHeadlines.slice(0, 5)
        : scoredHeadlines.slice(0, 2);

      result.push({
        name,
        news: finalHeadlines.map(h => h.headline)
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
// 🟢 HEALTH CHECK
// =====================================================

app.get("/", (c) => {
  return c.text("Backend is running 🚀");
});

export default app;