const { GoogleGenerativeAI } = require('@google/generative-ai');

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';

const SECTION_KEYS = [
  'companySummary',
  'businessInsights',
  'websiteObservations',
  'growthOpportunities',
  'automationSuggestions',
  'personalizedOutreach',
];

function log(step, message, meta) {
  const time = new Date().toISOString();
  if (meta !== undefined) {
    console.log(`[${time}] [${step}]`, message, meta);
  } else {
    console.log(`[${time}] [${step}]`, message);
  }
}

function isApiKeyConfigured() {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && !key.includes('YOUR_GEMINI_API_KEY'));
}

function buildScrapeContext(scrapedData) {
  if (!scrapedData?.success) {
    return {
      scrapeSucceeded: false,
      note: scrapedData?.error || 'Website could not be scraped.',
      url: scrapedData?.url || '',
    };
  }

  return {
    scrapeSucceeded: true,
    url: scrapedData.url,
    title: scrapedData.title || '',
    metaDescription: scrapedData.metaDescription || '',
    headings: scrapedData.headings || [],
    aboutText: scrapedData.aboutText || '',
    aboutPageUrl: scrapedData.aboutPageUrl || null,
  };
}

function buildPrompt(lead, scrapedData) {
  const scrapeContext = buildScrapeContext(scrapedData);

  return `You are a senior business consultant at SimplifIQ preparing a personalized first-touch audit for a new lead.

LEAD:
- Contact name: ${lead.name}
- Email: ${lead.email}
- Company: ${lead.companyName}
- Website: ${lead.companyWebsite}

WEBSITE RESEARCH (from public scrape):
${JSON.stringify(scrapeContext, null, 2)}

Write a highly personalized, professional audit. Reference specific details from the scrape when available. If scrape data is limited, use the company name and website thoughtfully and note assumptions briefly.

Return ONLY valid JSON with exactly these string fields (each 2-4 sentences, personalizedOutreach 3-5 sentences as a warm email-style note addressing ${lead.name} by first name):
{
  "companySummary": "",
  "businessInsights": "",
  "websiteObservations": "",
  "growthOpportunities": "",
  "automationSuggestions": "",
  "personalizedOutreach": ""
}`;
}

function emptySections() {
  return SECTION_KEYS.reduce((acc, key) => {
    acc[key] = '';
    return acc;
  }, {});
}

function normalizeSections(raw) {
  const sections = emptySections();
  if (!raw || typeof raw !== 'object') return sections;

  for (const key of SECTION_KEYS) {
    sections[key] = String(raw[key] || '').trim();
  }
  return sections;
}

function hasMinimumContent(sections) {
  return SECTION_KEYS.some((key) => sections[key].length >= 40);
}

function parseJsonFromText(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('Empty AI response');

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  return JSON.parse(candidate);
}

function buildFallbackReport(lead, scrapedData, reason) {
  const firstName = lead.name.split(' ')[0] || lead.name;
  const title = scrapedData?.title || lead.companyName;
  const about = scrapedData?.aboutText || scrapedData?.metaDescription || '';
  const headings = (scrapedData?.headings || []).slice(0, 5).join(', ');

  const sections = {
    companySummary: `${lead.companyName} (${lead.companyWebsite}) appears to operate in a competitive digital market. ${
      scrapedData?.success
        ? `Their public site highlights "${title}" as a primary message.`
        : 'Limited public website data was available during automated research.'
    } This summary is based on available public information and form details.`,
    businessInsights: `${lead.companyName} can strengthen client acquisition by clarifying its core value proposition and aligning messaging with target buyer pain points. ${
      about ? `Public content suggests: ${about.slice(0, 200)}${about.length > 200 ? '...' : ''}` : 'Consider validating positioning with customer interviews and pipeline data.'
    }`,
    websiteObservations: scrapedData?.success
      ? `The website title is "${title}". ${
          headings ? `Key headings include: ${headings}.` : 'Heading structure could be expanded for clearer service positioning.'
        } ${scrapedData.metaDescription ? `Meta description: ${scrapedData.metaDescription}` : 'Adding a stronger meta description may improve discovery and click-through.'}`
      : `We could not fully analyze ${lead.companyWebsite} automatically (${scrapedData?.error || 'fetch error'}). A manual review of UX, clarity, and conversion paths is recommended.`,
    growthOpportunities: `1) Sharpen homepage messaging for ideal customer segments. 2) Add proof points (case studies, metrics, logos). 3) Improve lead capture with a low-friction audit or consultation CTA. 4) Build a lightweight nurture sequence for inbound leads like this one.`,
    automationSuggestions: `Automate lead enrichment (website scrape + CRM fields), AI-generated audit drafts, PDF delivery, and follow-up email sequences. For ${lead.companyName}, connecting form intake to a workflow that researches, summarizes, and emails a tailored report within minutes would improve response time and perceived professionalism.`,
    personalizedOutreach: `Hi ${firstName},\n\nThank you for your interest in SimplifIQ. I reviewed ${lead.companyName} and prepared a short audit based on your public website and business profile. I'd love to walk you through practical automation and growth ideas tailored to your team.\n\nWould you be open to a 20-minute call this week?\n\nBest regards,\nSimplifIQ Team`,
  };

  return {
    success: true,
    source: 'fallback',
    model: null,
    sections,
    error: reason || null,
    generatedAt: new Date().toISOString(),
  };
}

async function callGemini(prompt) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: DEFAULT_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.7,
    },
  });

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return parseJsonFromText(text);
}

/**
 * Generate a personalized business audit from lead + scrape data.
 * Never throws — returns AI content or a structured fallback report.
 */
async function generateAuditReport(lead, scrapedData) {
  log('AI', 'Generating audit report', {
    company: lead.companyName,
    scrapeSuccess: Boolean(scrapedData?.success),
  });

  if (!isApiKeyConfigured()) {
    log('AI', 'GEMINI_API_KEY missing — using fallback report');
    return buildFallbackReport(lead, scrapedData, 'GEMINI_API_KEY not configured');
  }

  try {
    const prompt = buildPrompt(lead, scrapedData);
    const parsed = await callGemini(prompt);
    const sections = normalizeSections(parsed);

    if (!hasMinimumContent(sections)) {
      log('AI', 'AI response too thin — using fallback');
      return buildFallbackReport(lead, scrapedData, 'AI response incomplete');
    }

    log('AI', 'Audit report generated successfully', { model: DEFAULT_MODEL });

    return {
      success: true,
      source: 'ai',
      model: DEFAULT_MODEL,
      sections,
      error: null,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    log('AI', 'Gemini API failed — using fallback', err.message);
    return buildFallbackReport(lead, scrapedData, err.message);
  }
}

module.exports = {
  generateAuditReport,
  isApiKeyConfigured,
  SECTION_KEYS,
};
