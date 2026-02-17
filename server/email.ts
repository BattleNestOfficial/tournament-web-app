const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

type Recipient = {
  email: string;
  name?: string;
};

type SendEmailOptions = {
  to: Recipient[];
  subject: string;
  htmlContent: string;
  textContent: string;
};

function getBrevoConfig() {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "BattleNest";
  return { apiKey, senderEmail, senderName };
}

function buildAppUrl(path: string, params?: Record<string, string>) {
  const baseUrl = process.env.APP_BASE_URL?.trim();
  if (!baseUrl) return null;

  const url = new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

export function isBrevoConfigured() {
  const { apiKey, senderEmail } = getBrevoConfig();
  return Boolean(apiKey && senderEmail);
}

export async function sendBrevoEmail(options: SendEmailOptions) {
  const { apiKey, senderEmail, senderName } = getBrevoConfig();
  if (!apiKey || !senderEmail) {
    throw new Error("Brevo is not configured. Missing BREVO_API_KEY or BREVO_SENDER_EMAIL");
  }

  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: options.to,
      subject: options.subject,
      htmlContent: options.htmlContent,
      textContent: options.textContent,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Brevo send failed (${response.status}): ${errorText}`);
  }
}

export async function sendVerificationEmail(params: {
  toEmail: string;
  username?: string | null;
  token: string;
}) {
  const verifyUrl = buildAppUrl("/auth", {
    mode: "verify-email",
    token: params.token,
  });

  const greetingName = params.username?.trim() || "Player";
  const actionText = verifyUrl
    ? `Click this link to verify your email: ${verifyUrl}`
    : `Use this verification token in the app: ${params.token}`;
  const htmlAction = verifyUrl
    ? `<p><a href="${verifyUrl}" target="_blank" rel="noopener noreferrer">Verify Email</a></p>`
    : `<p><b>Verification Token:</b> ${params.token}</p>`;

  await sendBrevoEmail({
    to: [{ email: params.toEmail, name: greetingName }],
    subject: "Verify your BattleNest email",
    textContent: `Hi ${greetingName},\n\n${actionText}\n\nIf you did not create this account, ignore this email.`,
    htmlContent: `
      <p>Hi ${greetingName},</p>
      <p>Welcome to BattleNest. Verify your email to secure your account and enable protected actions.</p>
      ${htmlAction}
      <p>If you did not create this account, you can ignore this email.</p>
    `,
  });
}

export async function sendPasswordResetEmail(params: {
  toEmail: string;
  username?: string | null;
  token: string;
}) {
  const resetUrl = buildAppUrl("/auth", {
    mode: "reset-password",
    token: params.token,
  });

  const greetingName = params.username?.trim() || "Player";
  const actionText = resetUrl
    ? `Click this link to reset your password: ${resetUrl}`
    : `Use this reset token in the app: ${params.token}`;
  const htmlAction = resetUrl
    ? `<p><a href="${resetUrl}" target="_blank" rel="noopener noreferrer">Reset Password</a></p>`
    : `<p><b>Reset Token:</b> ${params.token}</p>`;

  await sendBrevoEmail({
    to: [{ email: params.toEmail, name: greetingName }],
    subject: "BattleNest password reset",
    textContent: `Hi ${greetingName},\n\n${actionText}\n\nIf you did not request this, ignore this email.`,
    htmlContent: `
      <p>Hi ${greetingName},</p>
      <p>We received a request to reset your BattleNest password.</p>
      ${htmlAction}
      <p>If you did not request this, ignore this email.</p>
    `,
  });
}

export async function sendContactSecurityAlert(params: {
  toEmail: string;
  username?: string | null;
  changedEmail: boolean;
  changedPhone: boolean;
  withdrawalLockUntil: Date;
}) {
  const greetingName = params.username?.trim() || "Player";
  const changed: string[] = [];
  if (params.changedEmail) changed.push("email");
  if (params.changedPhone) changed.push("phone");
  const changedText = changed.length ? changed.join(" and ") : "contact details";
  const lockUntilText = params.withdrawalLockUntil.toLocaleString("en-IN");

  await sendBrevoEmail({
    to: [{ email: params.toEmail, name: greetingName }],
    subject: "BattleNest security alert: contact details changed",
    textContent: `Hi ${greetingName},\n\nYour ${changedText} was updated on BattleNest.\nWithdrawals are locked until ${lockUntilText} for account safety.\n\nIf this was not you, contact support immediately.`,
    htmlContent: `
      <p>Hi ${greetingName},</p>
      <p>Your <b>${changedText}</b> was updated on BattleNest.</p>
      <p>For your security, withdrawals are locked until <b>${lockUntilText}</b>.</p>
      <p>If this was not you, contact support immediately.</p>
    `,
  });
}
