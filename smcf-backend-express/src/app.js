const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const userRoutes = require('./routes/userRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandlers');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/users', userRoutes);

// Health
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// Error handlers
app.use(notFound);
app.use(errorHandler);

module.exports = app;
