const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/admin');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ---------- USER MANAGEMENT ----------
router.get('/users', adminAuth, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.put('/users/:id/role', adminAuth, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  if (!['ADMIN', 'ARTIST', 'LISTENER'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  try {
    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, name: true, role: true },
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

router.delete('/users/:id', adminAuth, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.user.delete({ where: { id } });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ---------- CONTENT MANAGEMENT ----------
router.get('/content', adminAuth, async (req, res) => {
  try {
    const content = await prisma.content.findMany({
      include: { artist: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(content);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

router.put('/content/:id/approve', adminAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const content = await prisma.content.update({
      where: { id },
      data: { status: 'APPROVED' },
    });
    res.json(content);
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve content' });
  }
});

router.put('/content/:id/reject', adminAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const content = await prisma.content.update({
      where: { id },
      data: { status: 'REJECTED' },
    });
    res.json(content);
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject content' });
  }
});

router.delete('/content/:id', adminAuth, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.content.delete({ where: { id } });
    res.json({ message: 'Content deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete content' });
  }
});

// ---------- STATS ----------
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    const totalArtists = await prisma.user.count({ where: { role: 'ARTIST' } });
    const totalListeners = await prisma.user.count({ where: { role: 'LISTENER' } });
    const totalContent = await prisma.content.count();
    const totalApproved = await prisma.content.count({ where: { status: 'APPROVED' } });
    const totalPending = await prisma.content.count({ where: { status: 'PENDING' } });
    res.json({ totalUsers, totalArtists, totalListeners, totalContent, totalApproved, totalPending });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
