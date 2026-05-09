const { Resend } = require('resend');

// Initialize Resend
const resendKey = process.env.RESEND_API_KEY;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

console.log('[send-otp] Initializing:', {
  resendKey: resendKey ? 'SET' : 'MISSING',
  supabaseUrl: supabaseUrl ? 'SET' : 'MISSING',
  supabaseKey: supabaseKey ? 'SET' : 'MISSING'
});

const resend = new Resend(resendKey);

// Generate random 6-digit code
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports = async (req, res) => {
  console.log('[send-otp] Request received:', { method: req.method });
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, action } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    
    console.log('[send-otp] Generated OTP:', { email, code, expiresAt });

    // Use direct REST API call instead of JS client
    console.log('[send-otp] Inserting via REST API directly...');
    
    const insertResponse = await fetch(`${supabaseUrl}/rest/v1/otp_codes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        email: email.toLowerCase(),
        code: code,
        action: action || 'login',
        expires_at: expiresAt,
        used: false
      })
    });

    console.log('[send-otp] REST API response status:', insertResponse.status);
    
    const insertData = await insertResponse.text();
    console.log('[send-otp] REST API response:', insertData.substring(0, 500));

    if (!insertResponse.ok) {
      console.error('[send-otp] REST API error:', {
        status: insertResponse.status,
        response: insertData
      });
      return res.status(500).json({ 
        error: 'Failed to store OTP',
        details: insertData
      });
    }

    console.log('[send-otp] OTP stored successfully');

    // Send email via Resend
    console.log('[send-otp] Sending email via Resend...');
    
    const emailResponse = await resend.emails.send({
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

    if (emailResponse.error) {
      console.error('[send-otp] Email send error:', emailResponse.error);
      return res.status(500).json({ 
        error: 'Failed to send email',
        details: emailResponse.error.message
      });
    }

    console.log('[send-otp] Email sent successfully');

    return res.status(200).json({
      success: true,
      message: `OTP sent to ${email}`
    });

  } catch (error) {
    console.error('[send-otp] Unhandled error:', {
      message: error.message,
      stack: error.stack
    });
    return res.status(500).json({
      error: 'Server error',
      details: error.message
    });
  }
};
