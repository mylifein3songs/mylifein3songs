const { Resend } = require('resend');

const resendKey = process.env.RESEND_API_KEY;

console.log('[send-otp] Resend key:', resendKey ? 'SET' : 'MISSING');

const resend = new Resend(resendKey);

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, action } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const code = generateOTP();
    
    console.log('[send-otp] Sending to:', email, 'Code:', code);

    // Just send the email - don't try to store in Supabase
    const result = await resend.emails.send({
      from: 'My Life in 3 Songs <hello@mylifein3songs.com>',
      to: email,
      subject: 'Your verification code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2>Your verification code</h2>
          <p>Enter this code to sign in or create your account:</p>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; margin: 0;">${code}</p>
          </div>
          <p style="color: #666; font-size: 14px;">This code expires in 10 minutes.</p>
          <p style="color: #666; font-size: 12px;">If you didn't request this code, you can safely ignore this email.</p>
        </div>
      `
    });

    if (result.error) {
      console.error('[send-otp] Email error:', result.error);
      return res.status(500).json({ 
        error: 'Failed to send email',
        details: result.error.message
      });
    }

    console.log('[send-otp] Email sent successfully');

    return res.status(200).json({
      success: true,
      message: `OTP sent to ${email}`,
      code: code  // Return code to client for validation
    });

  } catch (error) {
    console.error('[send-otp] Error:', error.message);
    return res.status(500).json({
      error: 'Server error',
      details: error.message
    });
  }
};
