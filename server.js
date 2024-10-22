const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' })); // Increased limit for JSON payloads
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true })); // Increased limit for URL-encoded payloads

// MongoDB connection
const dbURI = 'mongodb+srv://readwrite:feinfeinfein@beyond.26wl0.mongodb.net/BeyondDB';

mongoose.connect(dbURI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000 // Increase timeout to 30 seconds
});


// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  userId: { type: String, required: true, unique: true },
});

const User = mongoose.model('User', userSchema);

// Experience Schema with Base64 image storage and Google Maps link
const experienceSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  type: { type: String, required: true },
  description: { type: String, required: true },
  location: { type: String, required: true },
  maxPeople: { type: Number, required: true },
  images: [{ type: String, required: true }],
  gmapsLink: { type: String, required: true }, // Google Maps link field
  expId: { type: String, required: true },
  rating: { type: Number, default: 0 },
});

const Experience = mongoose.model('Experience', experienceSchema);

// Booking Schema
const bookingSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  expId: { type: String, required: true },
  totalPeople: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  date: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const Booking = mongoose.model('Booking', bookingSchema);

// Register User
app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = Date.now().toString();

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      userId,
    });

    await newUser.save();
    res.status(201).json({ message: 'User registered successfully', userId });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: 'Error registering user' });
  }
});

// Login User
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    res.json({ userId: user.userId });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ message: 'Error logging in' });
  }
});

// Upload Experience
app.post('/upload-experience', async (req, res) => {
  const {
    userId,
    name,
    price,
    type,
    description,
    location,
    maxPeople,
    gmapsLink,
    images = []
  } = req.body;

  try {
    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    const base64Images = images.map(image => {
      if (typeof image !== 'string') {
        throw new Error('Invalid image format');
      }
      return image;
    });

    const expId = Date.now().toString();

    const newExperience = new Experience({
      userId: user.userId,
      userName: user.name,
      name,
      price,
      type,
      description,
      location,
      maxPeople,
      gmapsLink,
      images: base64Images,
      expId,
    });

    await newExperience.save();
    res.status(201).json({ message: 'Experience uploaded successfully', experienceId: newExperience.expId });
  } catch (error) {
    console.error("Error uploading experience:", error);
    res.status(500).json({ message: 'Error uploading experience', error: error.message });
  }
});

// Fetch Experiences by User ID
app.get('/get-experiences/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const experiences = await Experience.find({ userId });
    res.json(experiences);
  } catch (error) {
    console.error("Error fetching experiences:", error);
    res.status(500).json({ message: 'Error fetching experiences' });
  }
});

// Search Experiences
app.post('/search', async (req, res) => {
  const { query } = req.body;

  try {
    const experiences = await Experience.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ],
    });
    const response = experiences.map(exp => ({
      _id: exp._id,
      name: exp.name,
      description: exp.description,
      images: exp.images,
      location: exp.location,
      gmapsLink: exp.gmapsLink,
      maxPeople: exp.maxPeople,
      price: exp.price,
      rating: exp.rating,
    }));

    res.json(response);
  } catch (error) {
    console.error("Error searching experiences:", error);
    res.status(500).json({ message: 'Error searching experiences' });
  }
});

// Fetch Experience Details by ID
app.get('/experience/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const experience = await Experience.findById(id);
    if (!experience) {
      return res.status(404).json({ message: 'Experience not found' });
    }

    res.json({
      _id: experience._id,
      name: experience.name,
      description: experience.description,
      images: experience.images,
      location: experience.location,
      gmapsLink: experience.gmapsLink,
      maxPeople: experience.maxPeople,
      price: experience.price,
      rating: experience.rating,
    });
  } catch (error) {
    console.error("Error fetching experience details:", error);
    res.status(500).json({ message: 'Error fetching experience details' });
  }
});

// Book Experience
app.post('/book-experience', async (req, res) => {
  const { userId, expId, totalPeople, totalPrice, date } = req.body;

  try {
    // Validate input
    if (!userId || !expId || !totalPeople || !totalPrice || !date) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Create a new booking
    const newBooking = new Booking({
      userId,
      expId,
      totalPeople,
      totalPrice,
      date,
    });

    await newBooking.save();
    res.status(201).json({ message: 'Booking successful', bookingId: newBooking._id });
  } catch (error) {
    console.error("Error booking experience:", error);
    res.status(500).json({ message: 'Error booking experience', error: error.message });
  }
});

// Fetch Upcoming Bookings
app.get('/bookings/upcoming', async (req, res) => {
  const userId = req.query.userId;

  try {
    const upcomingBookings = await Booking.find({
      userId: userId,
      date: { $gte: new Date() } // Assuming date is stored in ISO format
    }).select('name date status image'); // Select only necessary fields

    res.json(upcomingBookings);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching bookings', error: error.message });
  }
});
// Fetch User Details by User ID
app.get('/user/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Return user details except for the password
    res.json({
      name: user.name,
      email: user.email,
      phone: user.phone || 'N/A', // Replace with actual user phone field if it exists
      userId: user.userId,
    });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ message: 'Error fetching user details' });
  }
});


// Delete User by User ID
app.delete('/delete-user/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await User.findOneAndDelete({ userId });
    if (!result) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: 'Error deleting user' });
  }
});

// Delete Experience by Experience ID
app.delete('/delete-experience/:expId', async (req, res) => {
  const { expId } = req.params;

  try {
    const result = await Experience.findOneAndDelete({ expId });
    if (!result) {
      return res.status(404).json({ message: 'Experience not found' });
    }
    res.status(200).json({ message: 'Experience deleted successfully' });
  } catch (error) {
    console.error("Error deleting experience:", error);
    res.status(500).json({ message: 'Error deleting experience' });
  }
});
// Delete Experience by ID
app.delete('/delete-experience/:expId', async (req, res) => {
  const { expId } = req.params;

  try {
    const deletedExperience = await Experience.findOneAndDelete({ expId });
    if (!deletedExperience) {
      return res.status(404).json({ message: 'Experience not found' });
    }

    res.json({ message: 'Experience deleted successfully' });
  } catch (error) {
    console.error("Error deleting experience:", error);
    res.status(500).json({ message: 'Error deleting experience' });
  }
});

// Fetch All Experiences (used in ListingsPage)
app.get('/experiences', async (req, res) => {
  try {
    const experiences = await Experience.find({});
    res.json(experiences);
  } catch (error) {
    console.error("Error fetching experiences:", error);
    res.status(500).json({ message: 'Error fetching experiences' });
  }
});
// Fetch all Users
app.get('/users', async (req, res) => {
  try {
    const users = await User.find({}, { password: 0 }); // Exclude password from response
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
