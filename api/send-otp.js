const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');

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
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Store OTP server-side in Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Upsert so resending replaces the previous code
    const { error: upsertError } = await supabase
      .from('otp_codes')
      .upsert(
        { email: email.toLowerCase(), code, expires_at: expiresAt },
        { onConflict: 'email' }
      );

    if (upsertError) {
      console.error('[send-otp] Failed to store OTP:', upsertError);
      return res.status(500).json({ error: 'Failed to generate verification code' });
    }

    console.log('[send-otp] Sending to:', email);

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

    // NOTE: Do NOT return the code to the client
    return res.status(200).json({
      success: true,
      message: `OTP sent to ${email}`
    });

  } catch (error) {
    console.error('[send-otp] Error:', error.message);
    return res.status(500).json({
      error: 'Server error',
      details: error.message
    });
  }
};
