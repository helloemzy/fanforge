const crypto = require('node:crypto');

const escapeHtml = (text) => {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
};

const textToParagraphs = (text) => {
  const escaped = escapeHtml(text);

  return escaped
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replaceAll('\n', '<br>')}</p>`)
    .join('');
};

const previewTextByWords = (text, maxWords = 420) => {
  if (maxWords <= 0) {
    return '';
  }

  const words = text.trim().split(/\s+/u);

  if (words.length <= maxWords) {
    return text;
  }

  return `${words.slice(0, maxWords).join(' ')}\n\n[Preview ends here.]`;
};

const watermarkText = (text, seed) => {
  const words = text.split(/(\s+)/u);

  if (words.length < 12) {
    return text;
  }

  const hash = crypto.createHash('sha256').update(seed).digest();
  const watermarkChars = ['\u200b', '\u200c', '\u200d', '\u2060'];
  const output = [];
  let wordCounter = 0;

  for (const token of words) {
    output.push(token);

    if (!token.trim() || /\s+/u.test(token)) {
      continue;
    }

    wordCounter += 1;

    if (wordCounter % 13 === 0) {
      const hashByte = hash[(wordCounter / 13) % hash.length];
      const index = hashByte % watermarkChars.length;
      output.push(watermarkChars[index]);
    }
  }

  return output.join('');
};

const textToParagraphsWithWatermark = (text, seed) => {
  return textToParagraphs(watermarkText(text, seed));
};

const shortDate = (iso) => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
};

module.exports = {
  textToParagraphs,
  textToParagraphsWithWatermark,
  previewTextByWords,
  shortDate,
};
