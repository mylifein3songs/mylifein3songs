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

    console.log('[verify-otp] Request:', { email, code: code ? 'provided' : 'missing', action });

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code required' });
    }

    // Validate code format (6 digits)
    if (code.length !== 6 || !/^\d+$/.test(code)) {
      return res.status(400).json({ error: 'Invalid code format' });
    }

    // For signup: try to create user if doesn't exist
    if (action === 'signup') {
      console.log('[verify-otp] Signup action - creating/updating user');
      
      // Try to insert new user
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{ email: email.toLowerCase() }])
        .select()
        .single();

      if (insertError) {
        console.log('[verify-otp] Insert error (might be duplicate):', insertError.message);
        // If error is "duplicate key", that's ok - user already exists
        if (!insertError.message.includes('duplicate') && !insertError.message.includes('Unique')) {
          console.error('[verify-otp] Real insert error:', insertError.message);
          return res.status(500).json({ 
            error: 'Failed to create user',
            details: insertError.message
          });
        }
      }

      const user = newUser || { email: email.toLowerCase() };

      // Create JWT token
      const token = jwt.sign(
        { email: email.toLowerCase() },
        jwtSecret,
        { expiresIn: '30d' }
      );

      console.log('[verify-otp] Signup successful for:', email);

      return res.status(200).json({
        success: true,
        message: 'Signup successful',
        token: token,
        user: {
          email: email.toLowerCase()
        }
      });
    }

    // For login: user must exist
    if (action === 'login') {
      console.log('[verify-otp] Login action - checking user exists');
      
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (!userData || userError) {
        console.log('[verify-otp] User not found:', email);
        return res.status(400).json({ error: 'User not found' });
      }

      // Update last_login
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('email', email.toLowerCase());

      // Create JWT token
      const token = jwt.sign(
        { email: email.toLowerCase(), userId: userData.id },
        jwtSecret,
        { expiresIn: '30d' }
      );

      console.log('[verify-otp] Login successful for:', email);

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        token: token,
        user: {
          email: userData.email,
          id: userData.id
        }
      });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (error) {
    console.error('[verify-otp] Error:', error.message);
    return res.status(500).json({
      error: 'Server error',
      details: error.message
    });
  }
};
