const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

// Initialize clients
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const jwtSecret = process.env.JWT_SECRET;

if (!supabaseUrl || !supabaseKey || !jwtSecret) {
  console.error('Missing environment variables:', {
    supabaseUrl: !!supabaseUrl,
    supabaseKey: !!supabaseKey,
    jwtSecret: !!jwtSecret
  });
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  // Only POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, code, action } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }

    // Look up the OTP code
    const { data: otpData, error: otpError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('code', code)
      .eq('used', false)
      .single();

    if (otpError || !otpData) {
      console.error('OTP lookup error:', otpError);
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    // Check if code has expired
    const now = new Date();
    const expiresAt = new Date(otpData.expires_at);
    if (now > expiresAt) {
      return res.status(400).json({ error: 'Code has expired' });
    }

    // Mark code as used (prevents replay attacks)
    const { error: updateError } = await supabase
      .from('otp_codes')
      .update({ used: true })
      .eq('id', otpData.id);

    if (updateError) {
      console.error('Error marking OTP as used:', updateError);
      return res.status(500).json({ error: 'Failed to process verification' });
    }

    // Check if user exists
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    let user = userData;

    // If action is 'signup' and user doesn't exist, create user
    if (action === 'signup' && !userData) {
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([
          {
            email: email.toLowerCase(),
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (insertError) {
        console.error('Error creating user:', insertError);
        return res.status(500).json({ error: 'Failed to create account' });
      }

      user = newUser;
    } else if (!userData && action !== 'signup') {
      // User doesn't exist and not signing up
      return res.status(400).json({ error: 'User not found' });
    }

    // Update last_login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('email', email.toLowerCase());

    // Create JWT token
    const token = jwt.sign(
      { email: email.toLowerCase(), userId: user.id },
      jwtSecret,
      { expiresIn: '30d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Verification successful',
      token: token,
      user: {
        email: user.email,
        id: user.id
      }
    });

  } catch (error) {
    console.error('Unhandled error in verify-otp:', error);
    return res.status(500).json({
      error: 'A server error occurred',
      details: error.message
    });
  }
};
