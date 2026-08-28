const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mapping_power';
  await mongoose.connect(uri);
  console.log(`Connected to MongoDB at ${uri}`);
}

module.exports = { connectDB };
