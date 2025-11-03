const mongoose = require('mongoose');
const { Admin } = require('./models');
require('dotenv').config();

const createDefaultAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: 'admin@shrifurniture.com' });
    
    if (existingAdmin) {
      console.log('Default admin already exists');
      return;
    }

    // Create default admin
    const admin = new Admin({
      email: 'admin@shrifurniture.com',
      password: 'admin123',
      name: 'Admin User',
      role: 'admin'
    });

    await admin.save();
    console.log('Default admin created successfully');
    console.log('Email: admin@shrifurniture.com');
    console.log('Password: admin123');

  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

createDefaultAdmin();
