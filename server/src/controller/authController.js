import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const loginUser = async (req, res) => {
  try {
    const { phone, password, role } = req.body;
    let user = await User.findOne({ phone });

    if (!user) {
      user = await User.create({
        name: role === 'DOCTOR' ? 'Dr. Arvind Sharma' : role === 'ADMIN' ? 'Dr. Sunita Rao (CMO)' : 'Sunita Devi (ASHA)',
        phone,
        password: password || '123456',
        role: role || 'ASHA_WORKER',
        phcCenter: 'PHC Kunda Hub'
      });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name },
      process.env.JWT_SECRET || 'secretkey',
      { expiresIn: '7d' }
    );

    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};