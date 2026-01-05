const jwt = require('jsonwebtoken');

exports.adminLogin = (req, res) => {
  const { email, password } = req.body;

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

  res.json({
    token,
    user: { email, role: 'admin' }
  });
};
