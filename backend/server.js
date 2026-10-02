import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/foodflow';

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log('MongoDB Connection Error: ', err));

// --- SCHEMAS ---
const mealLogSchema = new mongoose.Schema({
  center_id: Number,
  meal_id: Number,
  quantity_prepared: Number,
  quantity_consumed: Number,
  date: { type: Date, default: Date.now }
});
const MealLog = mongoose.model('MealLog', mealLogSchema);

const surplusListingSchema = new mongoose.Schema({
  itemName: String,
  quantity: Number,
  condition: String, 
  routeType: String, 
  status: { type: String, default: 'Available' }, 
  claimedBy: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});
const SurplusListing = mongoose.model('SurplusListing', surplusListingSchema);


// --- CONSTANTS ---
const REUSE_SUGGESTIONS = {
  1993: 'Apples -> Apple Pie / Stewed Apples',
  2539: 'Rice -> Vegetable Pulao / Fried Rice',
  2139: 'Beverages -> Fruit Punch / Smoothies',
  2631: 'Pizza -> Pizza Croutons',
  1248: 'Indian Bread -> Bread Crumbs / Thickened Curry',
  1778: 'Pasta -> Cold Pasta Salad'
};
const DEFAULT_SUGGESTION = 'Donate to nearest NGO or repurpose for staff meal';


// --- ENDPOINTS ---

// Feature 1: Demand & Surplus Predictor
app.post('/api/surplus/forecast', async (req, res) => {
  try {
    const { center_id, meal_id, quantity_prepared } = req.body;
    let predicted_orders = 0;
    try {
      const mlResponse = await axios.post('http://localhost:5000/predict-demand', { center_id, meal_id }, { timeout: 3000 });
      predicted_orders = mlResponse.data.predicted_orders;
    } catch (error) {
      console.warn("ML Service unreachable, using fallback average");
      predicted_orders = Math.floor(quantity_prepared * 0.85); 
    }

    const expected_surplus = Math.max(0, quantity_prepared - predicted_orders);
    const suggestion = REUSE_SUGGESTIONS[meal_id] || DEFAULT_SUGGESTION;

    res.json({
      predicted_demand: predicted_orders,
      expected_surplus: expected_surplus,
      reuse_suggestion: suggestion,
      status: expected_surplus > 0 ? 'Surplus Expected' : 'Optimal'
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Feature 3: Surplus Marketplace Routing
app.post('/api/listings', async (req, res) => {
  try {
    const listing = new SurplusListing(req.body);
    await listing.save();
    res.json(listing);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/listings', async (req, res) => {
  try {
    const listings = await SurplusListing.find().sort({ createdAt: -1 });
    res.json(listings);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/listings/:id/claim', async (req, res) => {
  try {
    const { claimedBy } = req.body;
    const listing = await SurplusListing.findByIdAndUpdate(
      req.params.id, 
      { status: 'Claimed', claimedBy },
      { new: true }
    );
    res.json(listing);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Bonus Feature: QR Mock
app.get('/api/qr/generate', (req, res) => {
  res.json({ message: "QR Code Payload Generated", qr_data: JSON.stringify({ center_id: 55, meal_id: 1993, batch: 'A1' }) });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Node Backend running on port ${PORT}`); });
