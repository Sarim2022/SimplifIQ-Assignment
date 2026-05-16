const axios = require('axios');
const cheerio = require('cheerio');

const REQUEST_TIMEOUT_MS = 15000;
const MAX_HEADINGS = 15;
const MAX_ABOUT_LENGTH = 600;
const MIN_ABOUT_LENGTH = 80;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const ABOUT_PATH_HINTS = ['/about', '/about-us', '/about_us', '/company', '/who-we-are', '/our-story'];
const ABOUT_LINK_PATTERN = /about|who we are|our story|company/i;

function log(step, message, meta) {
  const time = new Date().toISOString();
  if (meta !== undefined) {
    console.log(`[${time}] [${step}]`, message, meta);
  } else {
    console.log(`[${time}] [${step}]`, message);
  }
}

function normalizeWebsiteUrl(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isValidWebsite(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function resolveUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

function uniqueLimited(items, max) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= max) break;
  }
  return result;
}

function cleanText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text, max) {
  const cleaned = cleanText(text);
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 3).trim()}...`;
}

function buildFallback(url, error) {
  return {
    success: false,
    url: url || '',
    title: '',
    metaDescription: '',
    headings: [],
    aboutText: '',
    aboutPageUrl: null,
    error: error || 'Unable to scrape website',
    scrapedAt: new Date().toISOString(),
  };
}

async function fetchHtml(url) {
  const response = await axios.get(url, {
    timeout: REQUEST_TIMEOUT_MS,
    maxRedirects: 5,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    validateStatus: (status) => status >= 200 && status < 400,
    responseType: 'text',
  });
  return response.data;
}

function extractTitle($) {
  return (
    cleanText($('title').first().text()) ||
    cleanText($('meta[property="og:title"]').attr('content')) ||
    cleanText($('meta[name="twitter:title"]').attr('content')) ||
    cleanText($('h1').first().text())
  );
}

function extractMetaDescription($) {
  return (
    cleanText($('meta[name="description"]').attr('content')) ||
    cleanText($('meta[property="og:description"]').attr('content')) ||
    cleanText($('meta[name="twitter:description"]').attr('content'))
  );
}

function extractHeadings($) {
  const headings = [];
  $('h1, h2, h3').each((_, el) => {
    const text = cleanText($(el).text());
    if (text.length >= 3) headings.push(text);
  });
  return uniqueLimited(headings, MAX_HEADINGS);
}

function extractParagraphSnippets($) {
  const snippets = [];
  $('main p, article p, section p, .content p, body p').each((_, el) => {
    const text = cleanText($(el).text());
    if (text.length >= 60) snippets.push(text);
  });
  return uniqueLimited(snippets, 5);
}

function extractAboutFromDom($) {
  const candidates = [];

  $('[id*="about" i], [class*="about" i], [id*="company" i], [class*="company" i]').each((_, el) => {
    const text = cleanText($(el).text());
    if (text.length >= MIN_ABOUT_LENGTH) candidates.push(text);
  });

  const paragraphs = extractParagraphSnippets($);
  candidates.push(...paragraphs);

  if (candidates.length === 0) return '';
  return truncate(candidates.sort((a, b) => b.length - a.length)[0], MAX_ABOUT_LENGTH);
}

function findAboutPageUrl($, baseUrl) {
  const found = new Set();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    const label = cleanText($(el).text());
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

    const resolved = resolveUrl(href, baseUrl);
    if (!resolved) return;

    const path = new URL(resolved).pathname.toLowerCase();
    const matchesPath = ABOUT_PATH_HINTS.some((hint) => path === hint || path.startsWith(`${hint}/`));
    const matchesLabel = ABOUT_LINK_PATTERN.test(label) || ABOUT_LINK_PATTERN.test(path);

    if (matchesPath || matchesLabel) found.add(resolved);
  });

  for (const hint of ABOUT_PATH_HINTS) {
    const guessed = resolveUrl(hint, baseUrl);
    if (guessed) found.add(guessed);
  }

  return found.size ? [...found][0] : null;
}

function parseHtml(html, pageUrl) {
  const $ = cheerio.load(html);

  return {
    title: extractTitle($),
    metaDescription: extractMetaDescription($),
    headings: extractHeadings($),
    aboutText: extractAboutFromDom($),
    aboutPageUrl: findAboutPageUrl($, pageUrl),
  };
}

async function enrichAboutFromLinkedPage(aboutPageUrl, currentAboutText) {
  if (!aboutPageUrl || currentAboutText.length >= MIN_ABOUT_LENGTH) {
    return currentAboutText;
  }

  try {
    log('SCRAPE', 'Fetching about page', aboutPageUrl);
    const html = await fetchHtml(aboutPageUrl);
    const $ = cheerio.load(html);
    const aboutFromPage = extractAboutFromDom($);
    if (aboutFromPage.length >= MIN_ABOUT_LENGTH) return aboutFromPage;
  } catch (err) {
    log('SCRAPE', 'About page fetch failed (non-fatal)', err.message);
  }

  return currentAboutText;
}

/**
 * Scrape publicly available company website data.
 * Always resolves — returns fallback object on failure (never throws).
 */
async function scrapeCompanyWebsite(websiteUrl) {
  const url = normalizeWebsiteUrl(websiteUrl);

  if (!url || !isValidWebsite(url)) {
    log('SCRAPE', 'Invalid URL provided', websiteUrl);
    return buildFallback(url, 'Invalid website URL');
  }

  log('SCRAPE', 'Starting scrape', url);

  try {
    const html = await fetchHtml(url);
    const parsed = parseHtml(html, url);

    let aboutText = parsed.aboutText;
    if (parsed.aboutPageUrl) {
      aboutText = await enrichAboutFromLinkedPage(parsed.aboutPageUrl, aboutText);
    }

    const result = {
      success: true,
      url,
      title: parsed.title,
      metaDescription: parsed.metaDescription,
      headings: parsed.headings,
      aboutText: truncate(aboutText, MAX_ABOUT_LENGTH),
      aboutPageUrl: parsed.aboutPageUrl,
      error: null,
      scrapedAt: new Date().toISOString(),
    };

    log('SCRAPE', 'Scrape completed', {
      url,
      title: result.title || '(none)',
      headings: result.headings.length,
      aboutLength: result.aboutText.length,
    });

    return result;
  } catch (err) {
    const message =
      err.code === 'ECONNABORTED'
        ? 'Website request timed out'
        : err.response
          ? `Website returned HTTP ${err.response.status}`
          : err.message || 'Failed to fetch website';

    log('SCRAPE', 'Scrape failed (using fallback)', { url, message });

    return buildFallback(url, message);
  }
}

module.exports = {
  scrapeCompanyWebsite,
  normalizeWebsiteUrl,
};
