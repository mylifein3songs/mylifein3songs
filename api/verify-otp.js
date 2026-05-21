import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, code, action, name, dob, country, city } = req.body;

  // Validate input
  if (!email || !code || !action) {
    return res.status(400).json({ error: 'Missing required fields: email, code, action' });
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // --- SERVER-SIDE OTP VALIDATION ---
    const { data: otpRecord, error: otpError } = await supabase
      .from('otp_codes')
      .select('code, expires_at')
      .eq('email', email.toLowerCase())
      .single();

    if (otpError || !otpRecord) {
      return res.status(401).json({ error: 'No verification code found for this email. Please request a new one.' });
    }

    if (new Date() > new Date(otpRecord.expires_at)) {
      // Clean up expired code
      await supabase.from('otp_codes').delete().eq('email', email.toLowerCase());
      return res.status(401).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    if (otpRecord.code !== code) {
      return res.status(401).json({ error: 'Invalid verification code.' });
    }

    // Code is valid — delete it so it can't be reused
    await supabase.from('otp_codes').delete().eq('email', email.toLowerCase());
    // --- END OTP VALIDATION ---

    if (action === 'signup') {
      if (!name || !dob || !country) {
        return res.status(400).json({ error: 'Missing required signup fields: name, dob, country' });
      }

      const { data: existingUser } = await supabase
        .from('users')
        .select('email')
        .eq('email', email.toLowerCase())
        .single();

      if (existingUser) {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }

      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{
          email: email.toLowerCase(),
          name: name || null,
          dob: dob || null,
          country: country || null,
          city: city || null,
          songs: null,
          notes: '',
          views: 0,
          last_login: new Date().toISOString()
        }])
        .select()
        .single();

      if (insertError) {
        console.error('Insert error:', insertError);
        return res.status(500).json({ error: 'Failed to create user. Please try again.' });
      }

      const token = 'token_' + newUser.id;

      return res.status(200).json({
        message: 'User created successfully',
        token: token,
        user: newUser
      });

    } else if (action === 'login') {
      const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (fetchError || !user) {
        console.error('User lookup error:', fetchError);
        return res.status(401).json({ error: 'User not found' });
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);

      if (updateError) {
        console.error('Update last_login error:', updateError);
      }

      const token = 'token_' + user.id;

      return res.status(200).json({
        message: 'Login verified successfully',
        token: token,
        user: user
      });

    } else {
      return res.status(400).json({ error: 'Invalid action. Must be "signup" or "login"' });
    }

  } catch (error) {
    console.error('Verification error:', error);
    return res.status(500).json({ error: 'Server error during verification' });
  }
}
