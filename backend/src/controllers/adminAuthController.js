const jwt = require('jsonwebtoken');
const User = require('../model/usermodel');

exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt:', { email }); // Debugging

    if (
      email !== process.env.ADMIN_EMAIL ||
      password !== process.env.ADMIN_PASSWORD
    ) {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    const token = jwt.sign(
      { role: 'admin', email },
      process.env.ADMIN_JWT_SECRET,
      { expiresIn: '1d' }
    );

    console.log('Login successful, token generated:', token); // Debugging

    res.json({
      success: true,
      token,
      user: { email, role: 'admin' }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};
