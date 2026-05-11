import { Resend } from 'resend';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, subject, message } = req.body;

  // Validate input
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Send email to YOUR email address (the admin/site owner)
    const response = await resend.emails.send({
      from: 'noreply@mylifein3songs.com', // Must be a domain you own/verified in Resend
      to: process.env.CONTACT_EMAIL_TO, // Your email address (set in env vars)
      subject: `New Contact Form: ${subject}`,
      html: `
        <h2>New Message from My Life in 3 Songs</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
      `
    });

    if (response.error) {
      console.error('Resend error:', response.error);
      return res.status(500).json({ error: 'Failed to send email' });
    }

    // Optionally: Also send a confirmation email to the user
    await resend.emails.send({
      from: 'noreply@mylifein3songs.com',
      to: email,
      subject: 'We received your message',
      html: `
        <h2>Thank you for contacting us!</h2>
        <p>Hi ${escapeHtml(name)},</p>
        <p>We've received your message and will get back to you as soon as possible.</p>
        <p><strong>Your message:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
        <p>Best regards,<br>My Life in 3 Songs</p>
      `
    });

    return res.status(200).json({ 
      message: 'Email sent successfully'
    });

  } catch (error) {
    console.error('Contact form error:', error);
    return res.status(500).json({ error: 'Server error sending email' });
  }
}

// Helper function to escape HTML and prevent injection
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
