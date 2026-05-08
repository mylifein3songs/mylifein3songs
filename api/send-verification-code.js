import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, code } = req.body;

  // Validate input
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required' });
  }

  try {
    const response = await resend.emails.send({
      from: 'noreply@mylifein3songs.com',
      to: email,
      subject: 'Your verification code for My Life in 3 Songs',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Verify your email</h2>
          <p>Your verification code is:</p>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px; text-align: center; margin: 30px 0; color: #d97706;">
            ${code}
          </p>
          <p>This code will expire in 10 minutes.</p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            If you didn't request this code, you can safely ignore this email.
          </p>
        </div>
      `
    });

    // Return success
    return res.status(200).json({ success: true, messageId: response.id });
  } catch (error) {
    console.error('Resend error:', error);
    return res.status(500).json({ error: 'Failed to send verification code' });
  }
}
