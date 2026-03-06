const app = require('../src/app');

const parseCsrf = (html) => {
  const match = html.match(/name="_csrf"\s+value="([^"]+)"/);

  if (!match) {
    throw new Error('Unable to find CSRF token in HTML');
  }

  return match[1];
};

const parseInputValue = (html, name) => {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`name="${escapedName}"\\s+value="([^"]*)"`);
  const match = html.match(pattern);

  if (!match) {
    throw new Error(`Unable to find input "${name}" in HTML`);
  }

  return match[1];
};

const parseHrefByPrefix = (html, pathPrefix) => {
  const escapedPrefix = pathPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`href="(${escapedPrefix}[^"]*)"`);
  const match = html.match(pattern);

  if (!match) {
    throw new Error(`Unable to find href starting with "${pathPrefix}" in HTML`);
  }

  return match[1];
};

const mergeCookies = (jar, response) => {
  const setCookie = response.headers.getSetCookie();

  for (const cookieLine of setCookie) {
    const [cookiePair] = cookieLine.split(';');
    const [name, value] = cookiePair.split('=');
    jar[name] = value;
  }
};

const toCookieHeader = (jar) => {
  return Object.entries(jar)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
};

const run = async () => {
  const server = app.listen(0);

  try {
    const uniqueId = Date.now().toString();
    const secretMarker = `smoke_secret_${uniqueId}`;
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const cookies = {};

    const home = await fetch(`${baseUrl}/`, { redirect: 'manual' });

    if (home.status !== 200) {
      throw new Error(`Expected home 200, got ${home.status}`);
    }

    mergeCookies(cookies, home);

    const registerPage = await fetch(`${baseUrl}/auth/register`, {
      headers: {
        cookie: toCookieHeader(cookies),
      },
      redirect: 'manual',
    });

    if (registerPage.status !== 200) {
      throw new Error(`Expected register page 200, got ${registerPage.status}`);
    }

    mergeCookies(cookies, registerPage);

    const registerHtml = await registerPage.text();
    const registerCsrf = parseCsrf(registerHtml);

    const registerResponse = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: toCookieHeader(cookies),
      },
      redirect: 'manual',
      body: new URLSearchParams({
        _csrf: registerCsrf,
        next: '/',
        username: `smoke_${uniqueId.slice(-8)}`,
        email: `smoke_${uniqueId}@example.com`,
        password: 'AreallyLongPass123',
      }),
    });

    if (registerResponse.status !== 200) {
      throw new Error(`Expected register response 200, got ${registerResponse.status}`);
    }

    mergeCookies(cookies, registerResponse);
    const registerResponseHtml = await registerResponse.text();
    let verifyPath;

    try {
      verifyPath = parseHrefByPrefix(registerResponseHtml, '/auth/verify-email?token=');
    } catch (_error) {
      const verifySentPage = await fetch(
        `${baseUrl}/auth/verify-email/sent?next=${encodeURIComponent('/')}`,
        {
          headers: {
            cookie: toCookieHeader(cookies),
          },
          redirect: 'manual',
        }
      );

      if (verifySentPage.status !== 200) {
        throw new Error(`Expected verify-email-sent page 200, got ${verifySentPage.status}`);
      }

      const verifySentHtml = await verifySentPage.text();
      const verifySentCsrf = parseCsrf(verifySentHtml);
      const resendResponse = await fetch(`${baseUrl}/auth/verify-email/resend`, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          cookie: toCookieHeader(cookies),
        },
        redirect: 'manual',
        body: new URLSearchParams({
          _csrf: verifySentCsrf,
          next: '/',
        }),
      });

      if (resendResponse.status !== 200) {
        throw new Error(`Expected resend verification response 200, got ${resendResponse.status}`);
      }

      const resendHtml = await resendResponse.text();
      verifyPath = parseHrefByPrefix(resendHtml, '/auth/verify-email?token=');
    }

    const verifyEmailResponse = await fetch(`${baseUrl}${verifyPath}`, {
      headers: {
        cookie: toCookieHeader(cookies),
      },
      redirect: 'manual',
    });

    if (verifyEmailResponse.status !== 302) {
      throw new Error(`Expected verify email redirect 302, got ${verifyEmailResponse.status}`);
    }

    const editorPage = await fetch(`${baseUrl}/works/new`, {
      headers: {
        cookie: toCookieHeader(cookies),
      },
      redirect: 'manual',
    });

    if (editorPage.status !== 200) {
      throw new Error(`Expected editor page 200, got ${editorPage.status}`);
    }

    const editorHtml = await editorPage.text();
    const editorCsrf = parseCsrf(editorHtml);

    const createWork = await fetch(`${baseUrl}/works/new`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: toCookieHeader(cookies),
      },
      redirect: 'manual',
      body: new URLSearchParams({
        _csrf: editorCsrf,
        title: 'Smoke Test Story',
        fandom: 'Original',
        rating: 'Teen',
        status: 'WIP',
        tags: 'test, smoke',
        summary: 'This is a generated summary that clears validation quickly.',
        content:
          'This is a longer smoke test body that is safely above minimum length. '.repeat(25) +
          `\n\nFinal hidden marker: ${secretMarker}`,
      }),
    });

    if (createWork.status !== 302) {
      throw new Error(`Expected publish redirect 302, got ${createWork.status}`);
    }

    const location = createWork.headers.get('location');

    if (!location || !location.startsWith('/works/')) {
      throw new Error(`Expected redirect to work detail, got ${location}`);
    }

    const detailPage = await fetch(`${baseUrl}${location}`, {
      headers: {
        cookie: toCookieHeader(cookies),
      },
      redirect: 'manual',
    });

    if (detailPage.status !== 200) {
      throw new Error(`Expected detail page 200, got ${detailPage.status}`);
    }

    const detailHtml = await detailPage.text();

    if (!detailHtml.includes('Smoke Test Story')) {
      throw new Error('Detail page missing expected story title');
    }

    if (!detailHtml.includes('Verify you are human')) {
      throw new Error('Expected locked reader view before human verification');
    }

    if (detailHtml.includes(secretMarker)) {
      throw new Error('Secret marker should not be visible in locked preview');
    }

    const humanCheckPage = await fetch(
      `${baseUrl}/auth/human-check?next=${encodeURIComponent(location)}`,
      {
        headers: {
          cookie: toCookieHeader(cookies),
        },
        redirect: 'manual',
      }
    );

    if (humanCheckPage.status !== 200) {
      throw new Error(`Expected human check page 200, got ${humanCheckPage.status}`);
    }

    const humanCheckHtml = await humanCheckPage.text();
    const humanCheckCsrf = parseCsrf(humanCheckHtml);
    const challengeToken = parseInputValue(humanCheckHtml, 'challengeToken');
    const challengeParts = challengeToken.split('.');

    if (challengeParts.length < 3) {
      throw new Error('Human challenge token format is invalid');
    }

    const challengeAnswer = String(Number(challengeParts[1]) + Number(challengeParts[2]));

    await new Promise((resolve) => {
      setTimeout(resolve, 1900);
    });

    const humanCheckSubmit = await fetch(`${baseUrl}/auth/human-check`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: toCookieHeader(cookies),
      },
      redirect: 'manual',
      body: new URLSearchParams({
        _csrf: humanCheckCsrf,
        next: location,
        website: '',
        challengeToken,
        challengeAnswer,
      }),
    });

    if (humanCheckSubmit.status !== 302) {
      throw new Error(`Expected human check submit redirect 302, got ${humanCheckSubmit.status}`);
    }

    mergeCookies(cookies, humanCheckSubmit);

    const unlockedDetail = await fetch(`${baseUrl}${location}`, {
      headers: {
        cookie: toCookieHeader(cookies),
      },
      redirect: 'manual',
    });

    if (unlockedDetail.status !== 200) {
      throw new Error(`Expected unlocked detail page 200, got ${unlockedDetail.status}`);
    }

    const unlockedDetailHtml = await unlockedDetail.text();

    if (!unlockedDetailHtml.includes(secretMarker)) {
      throw new Error('Unlocked reader view missing expected full-text marker');
    }

    const unlockedCsrf = parseCsrf(unlockedDetailHtml);
    const progressResponse = await fetch(`${baseUrl}${location}/progress`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: toCookieHeader(cookies),
      },
      redirect: 'manual',
      body: JSON.stringify({
        _csrf: unlockedCsrf,
        progressPercent: 62,
        wordsRead: 320,
      }),
    });

    if (progressResponse.status !== 204) {
      throw new Error(`Expected reading progress response 204, got ${progressResponse.status}`);
    }

    const returnHome = await fetch(`${baseUrl}/`, {
      headers: {
        cookie: toCookieHeader(cookies),
      },
      redirect: 'manual',
    });

    if (returnHome.status !== 200) {
      throw new Error(`Expected return home 200, got ${returnHome.status}`);
    }

    const returnHomeHtml = await returnHome.text();

    if (!returnHomeHtml.includes('Continue reading')) {
      throw new Error('Home page missing continue reading shelf after progress save');
    }

    console.log('Smoke check passed.');
  } finally {
    server.close();
  }
};

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
