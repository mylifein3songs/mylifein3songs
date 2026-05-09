const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

// Initialize clients
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const resendKey = process.env.RESEND_API_KEY;

console.log('[send-otp] Initializing with:', {
  supabaseUrl: supabaseUrl ? 'SET' : 'MISSING',
  supabaseKey: supabaseKey ? 'SET' : 'MISSING',
  resendKey: resendKey ? 'SET' : 'MISSING'
});

const supabase = createClient(supabaseUrl, supabaseKey);
const resend = new Resend(resendKey);

// Generate random 6-digit code
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports = async (req, res) => {
  console.log('[send-otp] Request received:', { method: req.method, body: req.body });
  
  // Only POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, action } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    
    console.log('[send-otp] Generated OTP:', { email, code, expiresAt });

    // Store OTP in Supabase
    console.log('[send-otp] Attempting to insert into otp_codes table...');
    
    const { error: insertError, data: insertData } = await supabase
      .from('otp_codes')
      .insert([
        {
          email: email.toLowerCase(),
          code: code,
          action: action || 'login',
          expires_at: expiresAt.toISOString(),
          used: false
        }
      ]);

    if (insertError) {
      console.error('[send-otp] SUPABASE INSERT ERROR:', {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
        status: insertError.status,
        fullError: JSON.stringify(insertError)
      });
      return res.status(500).json({ 
        error: 'Failed to store OTP',
        details: insertError.message,
        code: insertError.code
      });
    }
    
    console.log('[send-otp] OTP stored successfully in Supabase');

    // Send email via Resend
    console.log('[send-otp] Sending email via Resend...');
    
    const { error: emailError, data: emailData } = await resend.emails.send({
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

    if (emailError) {
      console.error('[send-otp] RESEND EMAIL ERROR:', emailError);
      return res.status(500).json({ error: 'Failed to send email', details: emailError.message });
    }
    
    console.log('[send-otp] Email sent successfully');

    return res.status(200).json({
      success: true,
      message: `OTP sent to ${email}`
    });

  } catch (error) {
    console.error('[send-otp] UNHANDLED ERROR:', {
      message: error.message,
      stack: error.stack,
      fullError: JSON.stringify(error)
    });
    return res.status(500).json({
      error: 'A server error occurred',
      details: error.message
    });
  }
};
