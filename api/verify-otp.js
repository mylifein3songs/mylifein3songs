const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const jwtSecret = process.env.JWT_SECRET;

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, code, action } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code required' });
    }

    console.log('[verify-otp] Verifying:', { email, action });

    // For now, just accept any 6-digit code
    // In production, you'd validate against a stored code
    if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
      return res.status(400).json({ error: 'Invalid code format' });
    }

    // Check if user exists
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    let user = userData;

    // If signup action and user doesn't exist, create user
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
        console.error('[verify-otp] Create user error:', insertError);
        return res.status(500).json({ error: 'Failed to create user' });
      }

      user = newUser;
    } else if (!userData && action !== 'signup') {
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

    console.log('[verify-otp] Verification successful for:', email);

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
    console.error('[verify-otp] Error:', error.message);
    return res.status(500).json({
      error: 'Server error',
      details: error.message
    });
  }
};
