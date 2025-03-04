// config/db.js - Database configuration

module.exports = (mongoose) => {
    // MongoDB connection string
    const mongoURI = 'mongodb+srv://ariaaydin:nT2LbleDQfZAv8fb@cluster0.hybd8.mongodb.net/Aux?retryWrites=true&w=majority';
  
    mongoose
      .connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
      .then(() => console.log('Connected to MongoDB'))
      .catch((err) => console.error('MongoDB connection error:', err));
  };