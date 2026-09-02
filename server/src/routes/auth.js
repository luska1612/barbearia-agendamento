const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

function getHash() {
  return process.env.ADMIN_PASSWORD_HASH || null;
}

router.post('/login', async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Senha é obrigatória' });
    const hash = getHash();
    const plain = process.env.ADMIN_PASSWORD;
    let ok = false;
    if (hash) ok = await bcrypt.compare(password, hash);
    else if (plain) ok = password === plain;
    else ok = password === 'admin123';
    if (!ok) return res.status(401).json({ error: 'Senha incorreta' });
    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET || 'dev-secret-change-me', { expiresIn: process.env.JWT_EXPIRES_IN || '12h' });
    res.json({ token, expiresIn: process.env.JWT_EXPIRES_IN || '12h' });
  } catch(e){ next(e); }
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ role: req.user.role });
});

module.exports = router;
