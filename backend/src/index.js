require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'kwimbo-vibes',
    resource_type: 'auto',
    public_id: (req, file) => Date.now() + '-' + Math.round(Math.random() * 1e9),
  },
});

const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Missing fields' });
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'User exists' });
    const hashed = await bcrypt.hash(password, 10);
    const userRole = role === 'ADMIN' ? 'ADMIN' : role === 'ARTIST' ? 'ARTIST' : 'LISTENER';
    const user = await prisma.user.create({ data: { email, password: hashed, name, role: userRole } });
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ token, user: { id: user.id, email, name, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email, name: user.name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Auth middleware
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Upload content (only artists)
app.post('/api/content', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (user.role !== 'ARTIST') return res.status(403).json({ error: 'Only artists can upload' });
  const { title, genre, type } = req.body;
  const content = await prisma.content.create({
    data: {
      title: title || 'Untitled',
      type: type === 'VIDEO' ? 'VIDEO' : 'MUSIC',
      fileUrl: req.file.path,
      artistId: user.id,
      genre: genre || '',
      status: 'APPROVED',
    },
  });
  res.status(201).json(content);
});

// Feed (public)
app.get('/api/feed', async (req, res) => {
  const contents = await prisma.content.findMany({
    where: { status: 'APPROVED' },
    include: { artist: { select: { name: true, avatar: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(contents);
});

// My content (artist)
app.get('/api/content/my', auth, async (req, res) => {
  const contents = await prisma.content.findMany({
    where: { artistId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json(contents);
});

// Like endpoint (example)
app.post('/api/content/:id/like', auth, async (req, res) => {
  // Placeholder
  res.json({ liked: true });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
