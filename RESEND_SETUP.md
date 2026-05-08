# My Life in 3 Songs - Resend Email Integration Setup

## What Changed

Your original HTML file was using **demo mode** with verification codes displayed in the browser. This version moves to **production-ready email delivery** via Resend.

### Key Changes:

1. **Signup**: Now sends OTP via email instead of showing demo code
2. **Login**: Now sends OTP via email instead of showing demo code  
3. **Email Change**: Now sends OTP via email instead of showing demo code
4. **Serverless Functions**: Two new API endpoints handle OTP generation and delivery

## Files to Deploy

### New Files
- `/api/send-otp.js` - Generates OTP, sends via Resend email
- `/api/verify-otp.js` - Validates OTP format (backup endpoint)
- `package.json` - Declares Resend dependency
- `vercel.json` - Vercel configuration for API routes

### Updated File
- `index.html` - Updated to call `/api/send-otp` instead of demo mode

## Deployment Steps

### 1. Push to GitHub

```bash
cd your-local-repo
# Copy these files into your repo:
# - index.html (updated version)
# - api/send-otp.js (new)
# - api/verify-otp.js (new)
# - package.json (updated with Resend dependency)
# - vercel.json (new)

git add .
git commit -m "Add Resend email integration for OTP delivery"
git push origin main
```

### 2. Configure Vercel Environment Variables

In your Vercel dashboard:

1. Go to **Settings → Environment Variables**
2. Make sure these are set:
   - `RESEND_API_KEY` - Your Resend API key
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_ANON_KEY` - Your Supabase anon key

> These should already be configured, but double-check they're present.

### 3. Verify API Routes

Once deployed, test the API:

```bash
# Test send-otp endpoint
curl -X POST https://mylifein3songs.com/api/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","type":"login"}'

# Expected response:
# {
#   "success": true,
#   "code": "847291",
#   "expiresAt": 1234567890000
# }
```

## How It Works

### When User Signs Up:
1. User enters email and details
2. `doSignup()` calls `/api/send-otp`
3. Server generates random 6-digit code
4. Server sends email via Resend with the code
5. Server returns code to browser (stored temporarily)
6. User enters code from email
7. Code is verified client-side
8. Account created in Supabase

### When User Logs In:
1. User enters email
2. `doLogin()` calls `/api/send-otp`
3. Server generates and sends code via email
4. User enters code from email
5. Code verified client-side
6. User logged in with session

### When User Changes Email:
1. User enters new email in account settings
2. `saveDetails()` calls `/api/send-otp`
3. Server sends code to NEW email address
4. User confirms they have access to new email
5. Email is updated in Supabase

## Email Template

The emails look like this:

```
From: My Life in 3 Songs <hello@mylifein3songs.com>
Subject: Your verification code

My Life in 3 Songs

Hi there,

You're almost ready to [log in / create your account / confirm your new email address].
Enter this verification code to continue:

   847291

This code expires in 10 minutes.

⚠️ If you didn't request this code, you can safely ignore this email.

My Life in 3 Songs • hello@mylifein3songs.com
```

## Troubleshooting

### "Failed to send verification code"
- Check that `RESEND_API_KEY` is set in Vercel environment variables
- Check that Resend domain (`mylifein3songs.com`) is verified in Resend dashboard
- Check Vercel function logs for errors

### Email not arriving
- Check spam/junk folder
- Verify SPF, DKIM, DMARC records are set up in your domain DNS
- Check Resend dashboard for delivery logs

### 500 Error from API
- Go to Vercel Dashboard → Functions → Logs
- Look for errors in the function execution
- Check that `resend` package is installed (should happen automatically)

## Testing Locally (Optional)

To test locally before deploying:

```bash
npm install
# Then use Vercel CLI to test functions
vercel dev
```

Then in browser console:
```javascript
fetch('/api/send-otp', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({email: 'test@example.com', type: 'login'})
}).then(r => r.json()).then(console.log)
```

## Next Steps

1. Copy all 4 files to your GitHub repo
2. Commit and push
3. Vercel should auto-deploy
4. Check Environment Variables are set
5. Test by signing up with an email you can access
6. Verify you receive the code email

That's it! Your OTP flow is now fully production-ready.
