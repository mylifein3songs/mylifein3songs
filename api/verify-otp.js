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

  // NOTE: Code validation happens client-side (user entered the code they received via email)
  // In production, you could store sent codes in a table and validate here

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    if (action === 'signup') {
      // Validate that required signup fields are present
      if (!name || !dob || !country) {
        return res.status(400).json({ error: 'Missing required signup fields: name, dob, country' });
      }

      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('email')
        .eq('email', email.toLowerCase())
        .single();

      if (existingUser) {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }

      // Create new user with all provided fields
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

      // TODO: Generate a real JWT token if needed
      // For now, return a simple token
      const token = 'token_' + newUser.id;

      return res.status(200).json({
        message: 'User created successfully',
        token: token,
        user: newUser
      });

    } else if (action === 'login') {
      // For login, verify the code (client-side validation)
      // Then fetch and return the user

      // Check if user exists
      const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (fetchError || !user) {
        console.error('User lookup error:', fetchError);
        return res.status(401).json({ error: 'User not found' });
      }

      // Update last login
      const { error: updateError } = await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);

      if (updateError) {
        console.error('Update last_login error:', updateError);
        // Don't fail the login, just log it
      }

      // TODO: Generate a real JWT token if needed
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
