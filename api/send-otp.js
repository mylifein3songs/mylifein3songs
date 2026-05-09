/**
 * Vercel Serverless Function: /api/verify-otp
 * 
 * Receives an email and OTP code, verifies it against the otp_codes table,
 * creates/updates the user in the users table, generates a session token,
 * and returns authentication details.
 * 
 * Called by: doVerifyCode(), doVerifyLogin(), email verification flows
 */

import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// JWT secret must be set in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // Only allow GET and POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Extract email and code from query params (GET) or body (POST)
  const email = 
    (req.method === 'GET' ? req.query.email : req.body?.email) || '';
  const code = 
    (req.method === 'GET' ? req.query.code : req.body?.code) || '';

  // Validate inputs
  if (!email || !code) {
    return res.status(400).json({ error: 'Missing email or code' });
  }

  if (!isValidEmail(email) || code.length !== 6 || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Invalid email or code format' });
  }

  try {
    const now = new Date();

    // Query Supabase for matching OTP code
    const { data: otpRecords, error: queryError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('code', code)
      .eq('used', false)
      .gt('expires_at', now.toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (queryError) {
      console.error('OTP query error:', queryError);
      return res.status(500).json({ error: 'Verification failed' });
    }

    // If no valid OTP found
    if (!otpRecords || otpRecords.length === 0) {
      return res.status(401).json({ 
        error: 'Invalid or expired code. Please request a new one.' 
      });
    }

    const otpRecord = otpRecords[0];

    // Mark OTP as used (prevent replay attacks)
    const { error: markError } = await supabase
      .from('otp_codes')
      .update({ used: true })
      .eq('id', otpRecord.id);

    if (markError) {
      console.error('Error marking OTP as used:', markError);
      // Don't fail here; token generation is more important
    }

    // Check if user exists
    const { data: existingUser, error: selectError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    // Note: .single() throws error if no row found, which is expected
    let user = existingUser;

    // If user doesn't exist, create a stub account
    if (!existingUser) {
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email: email.toLowerCase(),
          name: '',
          dob: null,
          country: null,
          city: null,
          songs: null,
          notes: '',
          views: 0,
          created_at: now.toISOString(),
          last_login: now.toISOString(),
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating user:', createError);
        return res.status(500).json({ error: 'Failed to create account' });
      }

      user = newUser;
    } else {
      // Update last_login for existing user
      await supabase
        .from('users')
        .update({ last_login: now.toISOString() })
        .eq('email', email.toLowerCase());
    }

    // Generate session token (JWT)
    const expiresIn = 24 * 60 * 60; // 24 hours
    const sessionToken = jwt.sign(
      {
        email: email.toLowerCase(),
        userId: user.id,
        type: 'session',
      },
      JWT_SECRET,
      { expiresIn }
    );

    const expiresAt = new Date(now.getTime() + expiresIn * 1000).toISOString();

    // Store session token in user record
    const { error: updateError } = await supabase
      .from('users')
      .update({
        session_token: sessionToken,
        session_token_expires_at: expiresAt,
      })
      .eq('email', email.toLowerCase());

    if (updateError) {
      console.error('Error storing session token:', updateError);
      // Still return success; token is valid even if not stored
    }

    // Return success with token and user info
    return res.status(200).json({
      success: true,
      token: sessionToken,
      email: email.toLowerCase(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        dob: user.dob,
        country: user.country,
        city: user.city,
        songs: user.songs,
        notes: user.notes,
        views: user.views,
      },
    });

  } catch (err) {
    console.error('Unexpected error in verify-otp:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
