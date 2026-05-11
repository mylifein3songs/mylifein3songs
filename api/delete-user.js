import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  // Validate input
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Use Admin SDK with service role key
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Delete user from database
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('email', email.toLowerCase());

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return res.status(500).json({ error: 'Failed to delete user' });
    }

    return res.status(200).json({ 
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({ error: 'Server error during deletion' });
  }
}
