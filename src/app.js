const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const app = express();

const corsOptions = {
  origin: '*',
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.use(express.json());

// Serve uploaded files as static
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/game',  require('./routes/game.routes'));
app.use('/api/cards', require('./routes/card.routes'));
app.use('/api/codes', require('./routes/code.routes'));
app.use('/api/admin', require('./routes/admin.routes'));

// Health check
app.get('/', (req, res) => res.json({ status: 'T3LALY API running ✅' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));