import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, type } = req.body;

  // Validate input
  if (!email || !type) {
    return res.status(400).json({ error: 'Email and type are required' });
  }

  if (!['signup', 'login', 'email-change'].includes(type)) {
    return res.status(400).json({ error: 'Invalid type' });
  }

  // Generate a random 6-digit OTP code
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    // Send email via Resend
    const response = await resend.emails.send({
      from: 'My Life in 3 Songs <hello@mylifein3songs.com>',
      to: email,
      subject: 'Your verification code',
      html: getEmailTemplate(code, type),
    });

    if (response.error) {
      console.error('Resend error:', response.error);
      return res.status(500).json({ error: 'Failed to send email' });
    }

    // Return the code to be stored client-side temporarily
    // (It will also be sent via email)
    return res.status(200).json({
      success: true,
      code: code, // Return to client for storage during OTP flow
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    return res.status(500).json({ error: 'Failed to send verification code' });
  }
}

function getEmailTemplate(code, type) {
  const typeLabel = {
    signup: 'create your account',
    login: 'log in',
    'email-change': 'confirm your new email address',
  }[type];

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1E2A4A; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .code-box { 
            background: #f5f5f5; 
            border: 2px solid #1E2A4A; 
            border-radius: 8px; 
            padding: 20px; 
            text-align: center; 
            margin: 30px 0; 
          }
          .code { 
            font-size: 32px; 
            font-weight: bold; 
            letter-spacing: 4px; 
            color: #1E2A4A; 
            font-family: 'Courier New', monospace; 
          }
          .footer { 
            font-size: 12px; 
            color: #666; 
            text-align: center; 
            margin-top: 30px; 
            border-top: 1px solid #eee; 
            padding-top: 20px; 
          }
          .warning { color: #d32f2f; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>My Life in 3 Songs</h2>
          </div>
          
          <p>Hi there,</p>
          
          <p>You're almost ready to ${typeLabel}. Enter this verification code to continue:</p>
          
          <div class="code-box">
            <div class="code">${code}</div>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            This code expires in <strong>10 minutes</strong>.
          </p>
          
          <p class="warning">
            ⚠️ If you didn't request this code, you can safely ignore this email.
          </p>
          
          <div class="footer">
            <p>My Life in 3 Songs • hello@mylifein3songs.com</p>
          </div>
        </div>
      </body>
    </html>
  `;
}
