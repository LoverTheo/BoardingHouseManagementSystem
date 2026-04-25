// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Import our database configuration
const { connectDB } = require('./config/db');

// Import our newly created routes
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const roomRoutes = require('./routes/roomRoutes');
const billRoutes = require('./routes/billRoutes'); // 👈 add this

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB, then start the server
connectDB().then(() => {
    
    // Wire up the routes. Notice how the URLs match your frontend requests exactly!
    app.use('/api', authRoutes);            // Handles /api/login
    app.use('/api/student', studentRoutes); // Handles /api/student/...
    app.use('/api/admin', adminRoutes);     // Handles /api/admin/...
    app.use('/api/rooms', roomRoutes);
    app.use('/api/bills', billRoutes); // 👈 add this

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
    
}).catch(err => {
    console.error("--- ❌ Connection Error ---", err);
});