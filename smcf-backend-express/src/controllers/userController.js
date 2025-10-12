const User = require('../models/User');

// Create user
const createUser = async (req, res, next) => {
  try {
    const { name, email, phone, role, age } = req.body;
    const user = await User.create({ name, email, phone, role, age });
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
};

// Read all users
const getUsers = async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).lean();
    res.json(users);
  } catch (err) {
    next(err);
  }
};

// Read single user
const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) { next(err); }
};

// Update user
const updateUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) { next(err); }
};

// Delete user
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};

module.exports = { createUser, getUsers, getUser, updateUser, deleteUser };
