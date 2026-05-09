/**
 * Vercel Serverless Function: /api/send-otp
 * 
 * Receives an email address, generates a 6-digit OTP, stores it in Supabase
 * with a 10-minute expiry, and sends it via Resend email service.
 * 
 * Called by: doSignup(), doLogin(), email change flow
 */

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

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

  // Extract email from query params (GET) or body (POST)
  const email = 
    (req.method === 'GET' ? req.query.email : req.body?.email) || '';

  // Validate email format
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  try {
    // Generate a random 6-digit code
    const code = generateOTPCode();

    // Calculate expiry time (10 minutes from now)
    const now = new Date();
    const expiryTime = new Date(now.getTime() + 10 * 60 * 1000);

    // Store in Supabase otp_codes table
    const { error: storeError } = await supabase
      .from('otp_codes')
      .insert({
        email: email.toLowerCase(),
        code,
        created_at: now.toISOString(),
        expires_at: expiryTime.toISOString(),
        used: false,
      });

    if (storeError) {
      console.error('Supabase insert error:', storeError);
      return res.status(500).json({ 
        error: 'Failed to generate verification code. Please try again.' 
      });
    }

    // Send email via Resend
    const { error: emailError } = await resend.emails.send({
      from: 'My Life in 3 Songs <hello@mylifein3songs.com>',
      to: email.toLowerCase(),
      subject: 'Your login code',
      html: buildEmailHTML(code),
    });

    if (emailError) {
      console.error('Resend email error:', emailError);
      return res.status(500).json({ 
        error: 'Failed to send email. Please try again.' 
      });
    }

    // Success
    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Unexpected error in send-otp:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Generate a random 6-digit OTP code
 */
function generateOTPCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Build the HTML email template
 */
function buildEmailHTML(code) {
  const spacedCode = code.split('').join(' ');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #1E2A4A; }
        .container { max-width: 400px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding-bottom: 20px; }
        .logo-text { font-size: 16px; font-weight: 600; color: #1E2A4A; margin: 0; }
        .content { text-align: center; }
        .code-display { 
          font-size: 36px; 
          font-weight: bold; 
          letter-spacing: 8px; 
          font-family: 'Courier New', monospace; 
          margin: 20px 0;
          padding: 20px;
          background-color: #FAF8F5;
          border-radius: 8px;
        }
        .expiry { 
          font-size: 12px; 
          color: #999; 
          margin-top: 15px; 
        }
        .footer { 
          font-size: 11px; 
          color: #BBB; 
          margin-top: 30px; 
          text-align: center; 
        }
        .note { 
          background-color: #FFFAF0; 
          border-left: 3px solid #E8A042; 
          padding: 10px 12px; 
          font-size: 12px; 
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <p class="logo-text">My Life in 3 Songs</p>
        </div>
        
        <div class="content">
          <p>Your verification code is:</p>
          
          <div class="code-display">${spacedCode}</div>
          
          <p class="expiry">This code expires in 10 minutes.</p>
          
          <div class="note">
            <strong>Didn't request this code?</strong><br>
            You can safely ignore this email. Your account won't be created unless you enter this code.
          </div>
        </div>
        
        <div class="footer">
          <p>My Life in 3 Songs — mylifein3songs.com</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
