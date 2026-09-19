const { Resend } = require("resend");
const env = require("../config/env");

function emailConfigured() {
  return Boolean(env.resendApiKey && env.emailFrom);
}

async function sendPasswordResetEmail(to, otp) {
  if (!emailConfigured()) return false;
  const resend = new Resend(env.resendApiKey);
  const { error } = await resend.emails.send({
    from: env.emailFrom,
    to,
    subject: "Your Hospitalia password reset code",
    text: `Your Hospitalia password reset code is ${otp}. It expires in 10 minutes. If you did not request this, you can ignore this message.`,
    html: `<p>Your Hospitalia password reset code is <strong>${otp}</strong>.</p><p>It expires in 10 minutes. If you did not request this, you can ignore this message.</p>`,
  });
  if (error) throw Object.assign(new Error("Password reset email could not be delivered"), { statusCode: 502 });
  return true;
}

module.exports = { emailConfigured, sendPasswordResetEmail };
