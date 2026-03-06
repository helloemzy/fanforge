const buildVerificationHtml = ({ username, verificationUrl }) => {
  return `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #1f2530;">
      <h1 style="font-size: 22px; margin-bottom: 12px;">Verify your FanForge email</h1>
      <p style="margin: 0 0 12px;">Hi ${username},</p>
      <p style="margin: 0 0 16px;">
        Confirm this email to unlock verified-reader access and protect full chapters from scraping.
      </p>
      <p style="margin: 0 0 16px;">
        <a href="${verificationUrl}" style="display: inline-block; background: #8f341f; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 8px;">
          Verify email
        </a>
      </p>
      <p style="margin: 0; font-size: 13px; color: #4a5361;">
        If the button does not work, open this link:
        <br />
        <a href="${verificationUrl}" style="color: #8f341f;">${verificationUrl}</a>
      </p>
    </div>
  `;
};

const sendEmailVerification = async ({ toEmail, username, verificationUrl }) => {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!resendApiKey || !fromEmail) {
    console.warn('[FanForge] Email provider not configured. Verification link:', verificationUrl);
    return {
      sent: false,
      reason: 'provider-not-configured',
    };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: 'Verify your FanForge account',
        html: buildVerificationHtml({ username, verificationUrl }),
        text: `Verify your FanForge account: ${verificationUrl}`,
      }),
    });

    if (!response.ok) {
      return {
        sent: false,
        reason: 'provider-error',
      };
    }

    return { sent: true };
  } catch (_error) {
    return {
      sent: false,
      reason: 'network-error',
    };
  }
};

module.exports = {
  sendEmailVerification,
};
