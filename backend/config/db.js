// backend/config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI;
        if (!uri) {
            throw new Error("MONGO_URI is missing! Check your .env file.");
        }

        // Mongoose connects once and stays connected for all models
        await mongoose.connect(uri);
        
        console.log("--- ✅ Mongoose Connected to Atlas ---");
    } catch (err) {
        console.error("--- ❌ Mongoose Connection Error ---", err.message);
        process.exit(1); // Stop the server if DB fails
    }
};

// We don't need getStudentsCollection anymore because the Models handle this!
module.exports = { connectDB };