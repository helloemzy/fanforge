const blockedAiAgentMatchers = [
  /GPTBot/i,
  /ChatGPT-User/i,
  /CCBot/i,
  /anthropic-ai/i,
  /ClaudeBot/i,
  /cohere-ai/i,
  /Google-Extended/i,
  /Bytespider/i,
  /PerplexityBot/i,
  /Diffbot/i,
  /Amazonbot/i,
  /Meta-ExternalAgent/i,
  /meta-externalfetcher/i,
];

const knownSearchEngineMatchers = [/Googlebot/i, /bingbot/i, /DuckDuckBot/i, /Applebot/i, /YandexBot/i];

const blockedAutomationMatchers = [
  /HeadlessChrome/i,
  /Playwright/i,
  /Puppeteer/i,
  /Selenium/i,
  /PhantomJS/i,
  /curl\//i,
  /Wget\//i,
  /python-requests/i,
  /aiohttp/i,
  /Go-http-client/i,
  /Java\//i,
];

const privatePathMatchers = [
  /^\/auth(?:\/|$)/,
  /^\/works\/new(?:\/|$)/,
  /^\/works\/\d+\/edit(?:\/|$)/,
  /^\/uploads(?:\/|$)/,
  /^\/robots\.txt$/,
  /^\/ai-policy\.txt$/,
];

const resolveRobotsTag = (path) => {
  if (privatePathMatchers.some((matcher) => matcher.test(path))) {
    return 'noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate, noai, noimageai';
  }

  return 'index, follow, noarchive, nosnippet, max-snippet:0, max-image-preview:none, notranslate, noai, noimageai';
};

const classifyRequest = (req) => {
  const userAgent = req.get('user-agent') || '';
  const acceptLanguage = req.get('accept-language') || '';

  const isKnownSearchBot = knownSearchEngineMatchers.some((matcher) => matcher.test(userAgent));
  const isBlockedAiCrawler = blockedAiAgentMatchers.some((matcher) => matcher.test(userAgent));
  const isKnownAutomationClient = blockedAutomationMatchers.some((matcher) => matcher.test(userAgent));
  const isSuspiciousAutomation =
    !isKnownSearchBot &&
    (isKnownAutomationClient || (!acceptLanguage && userAgent.length > 0 && !/Mozilla/i.test(userAgent)));

  return {
    userAgent,
    isKnownSearchBot,
    isBlockedAiCrawler,
    isKnownAutomationClient,
    isSuspiciousAutomation,
  };
};

const attachAiShieldHeaders = (req, res, next) => {
  const robotsTag = resolveRobotsTag(req.path);

  req.requestClassification = classifyRequest(req);
  res.locals.robotsTag = robotsTag;

  res.setHeader('X-Robots-Tag', robotsTag);
  res.setHeader('Permissions-Policy', 'browsing-topics=()');
  next();
};

const blockKnownAiCrawlers = (req, res, next) => {
  const classification = req.requestClassification || classifyRequest(req);

  if (classification.isBlockedAiCrawler) {
    return res.status(403).type('text/plain').send('Access denied by FanForge AI Shield policy.');
  }

  if (classification.isSuspiciousAutomation && /^\/works\/\d+(?:\/|$)/.test(req.path)) {
    return res
      .status(403)
      .type('text/plain')
      .send('Automated access denied. Please use a normal browser session.');
  }

  return next();
};

module.exports = {
  resolveRobotsTag,
  attachAiShieldHeaders,
  blockKnownAiCrawlers,
};
