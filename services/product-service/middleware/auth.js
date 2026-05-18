const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token tidak ditemukan' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token tidak valid' });
    req.user = user;
    next();
  });
};

const verifyAdmin = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Akses ditolak' });
    next();
  });
};

// Any authenticated user can sell (buyer/seller are unified)
const verifyPenjual = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role === 'admin' || req.user.role === 'penjual' || 
        req.user.role === 'pembeli' || req.user.role === 'user') {
      next();
    } else {
      return res.status(403).json({ message: 'Akses ditolak' });
    }
  });
};

module.exports = { verifyToken, verifyAdmin, verifyPenjual };
