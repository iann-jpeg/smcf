import { Router } from 'express';
import SimulationHistory from '../models/SimulationHistory';
import SimulationPreset from '../models/SimulationPreset';
import { protect, AuthRequest } from '../middleware/auth';

const router = Router();

// ─── Simulation History ───────────────────────────────────────────────────────

// @route   GET /api/simulation/history
router.get('/history', protect, async (req: AuthRequest, res, next) => {
  try {
    const records = await SimulationHistory.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ success: true, count: records.length, data: records });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/simulation/history
router.post('/history', protect, async (req: AuthRequest, res, next) => {
  try {
    const record = await SimulationHistory.create({ ...req.body, userId: req.userId });
    res.status(201).json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/simulation/history/:id
router.delete('/history/:id', protect, async (req: AuthRequest, res, next) => {
  try {
    const record = await SimulationHistory.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });
    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
});

// ─── Simulation Presets ───────────────────────────────────────────────────────

// @route   GET /api/simulation/presets
router.get('/presets', protect, async (req: AuthRequest, res, next) => {
  try {
    const presets = await SimulationPreset.find({ userId: req.userId })
      .sort({ sortOrder: 1, createdAt: -1 });
    res.json({ success: true, count: presets.length, data: presets });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/simulation/presets
router.post('/presets', protect, async (req: AuthRequest, res, next) => {
  try {
    const preset = await SimulationPreset.create({ ...req.body, userId: req.userId });
    res.status(201).json({ success: true, data: preset });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/simulation/presets/reorder
router.put('/presets/reorder', protect, async (req: AuthRequest, res, next) => {
  try {
    const { orderedIds } = req.body as { orderedIds: string[] };
    await Promise.all(
      orderedIds.map((id, index) =>
        SimulationPreset.findOneAndUpdate({ _id: id, userId: req.userId }, { sortOrder: index })
      )
    );
    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/simulation/presets/:id
router.put('/presets/:id', protect, async (req: AuthRequest, res, next) => {
  try {
    const preset = await SimulationPreset.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!preset) return res.status(404).json({ success: false, message: 'Preset not found' });
    res.json({ success: true, data: preset });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/simulation/presets/:id
router.delete('/presets/:id', protect, async (req: AuthRequest, res, next) => {
  try {
    const preset = await SimulationPreset.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!preset) return res.status(404).json({ success: false, message: 'Preset not found' });
    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
});

export default router;
