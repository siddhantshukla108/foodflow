import { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default Leaflet marker icons in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Mock coordinates for the Hackathon Demo
const KITCHEN_COORDS = [28.6139, 77.2090];
const NGO_COORDS = [28.6304, 77.2177];

// Mock Data for Dashboard
const impactData = [
  { month: 'Jan', mealsSaved: 400, emissionsReduced: 120 },
  { month: 'Feb', mealsSaved: 550, emissionsReduced: 150 },
  { month: 'Mar', mealsSaved: 680, emissionsReduced: 190 },
  { month: 'Apr', mealsSaved: 900, emissionsReduced: 250 },
  { month: 'May', mealsSaved: 1150, emissionsReduced: 320 },
  { month: 'Jun', mealsSaved: 1420, emissionsReduced: 410 },
];
const pieData = [
  { name: 'Donated to NGOs', value: 65 },
  { name: 'Discounted Resale', value: 35 },
];
const PIE_COLORS = ['#3B82F6', '#10B981'];

function App() {
  const [activeTab, setActiveTab] = useState('demand');
  const [error, setError] = useState('');
  
  // Demand State
  const [formData, setFormData] = useState({ center_id: 55, meal_id: 1993, quantity_prepared: '' });
  const [demandLoading, setDemandLoading] = useState(false);
  const [demandResult, setDemandResult] = useState(null);
  
  // Freshness State
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [freshnessLoading, setFreshnessLoading] = useState(false);
  const [freshnessResult, setFreshnessResult] = useState(null);
  const fileInputRef = useRef(null);

  // Marketplace State
  const [listings, setListings] = useState([]);
  
  // Maps State
  const [activeRoute, setActiveRoute] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [mapLoading, setMapLoading] = useState(false);

  // Waste Log State
  const [wasteLogs, setWasteLogs] = useState([
    { id: 1, item: 'Potato Peels', weight: 12.5, reason: 'Processing Byproduct', date: '2023-10-01' },
    { id: 2, item: 'Spoiled Tomatoes', weight: 4.2, reason: 'Rotten', date: '2023-10-02' }
  ]);
  const [wasteForm, setWasteForm] = useState({ item: '', weight: '', reason: 'Processing Byproduct' });

  const fetchListings = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/listings');
      const data = await res.json();
      setListings(Array.isArray(data) ? data : []);
    } catch (err) { console.error("Failed to fetch listings"); }
  };

  useEffect(() => {
    if (activeTab === 'market') fetchListings();
  }, [activeTab]);

  const handleDemandSubmit = async (e) => {
    e.preventDefault();
    setDemandLoading(true); setError('');
    try {
      const response = await fetch('http://localhost:3000/api/surplus/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ center_id: parseInt(formData.center_id), meal_id: parseInt(formData.meal_id), quantity_prepared: parseInt(formData.quantity_prepared) })
      });
      if (!response.ok) throw new Error('Failed to fetch forecast');
      const result = await response.json();
      setDemandResult(result);
      if (result.expected_surplus > 0) {
        await fetch('http://localhost:3000/api/listings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemName: `Meal Batch #${formData.meal_id}`, quantity: result.expected_surplus, condition: 'Fresh', routeType: 'Resale' })
        });
      }
    } catch (err) { setError(err.message); } finally { setDemandLoading(false); }
  };

  const handleFreshnessSubmit = async () => {
    if (!selectedFile) return;
    setFreshnessLoading(true); setError('');
    const fd = new FormData(); fd.append('image', selectedFile);
    try {
      const response = await fetch('http://localhost:5000/check-freshness', { method: 'POST', body: fd });
      if (!response.ok) throw new Error('Failed to analyze image');
      const result = await response.json();
      setFreshnessResult(result);
      await fetch('http://localhost:3000/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemName: "Scanned Produce", quantity: 50, condition: result.status, routeType: result.status === 'Fresh' ? 'Resale' : 'Donation' })
      });
    } catch (err) { setError(err.message); } finally { setFreshnessLoading(false); }
  };

  const claimListing = async (id, claimedBy) => {
    try {
      await fetch(`http://localhost:3000/api/listings/${id}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimedBy })
      });
      fetchListings();
    } catch (err) { console.error(err); }
  };

  const handleViewRoute = async (listing) => {
    setActiveRoute(listing);
    setMapLoading(true);
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${KITCHEN_COORDS[1]},${KITCHEN_COORDS[0]};${NGO_COORDS[1]},${NGO_COORDS[0]}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        const coords = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
        setRouteCoords(coords);
      }
    } catch (error) { console.error("OSRM Routing Error", error); }
    setMapLoading(false);
  };

  const handleWasteSubmit = (e) => {
    e.preventDefault();
    const newLog = {
      id: Date.now(),
      item: wasteForm.item,
      weight: parseFloat(wasteForm.weight),
      reason: wasteForm.reason,
      date: new Date().toISOString().split('T')[0]
    };
    setWasteLogs([newLog, ...wasteLogs]);
    setWasteForm({ item: '', weight: '', reason: 'Processing Byproduct' });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <header className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
          <h1 className="text-3xl font-black text-gray-800 tracking-tight mb-2">FoodFlow</h1>
          <div className="flex justify-center gap-3 mt-6 flex-wrap">
            <button onClick={() => setActiveTab('demand')} className={`px-5 py-2 rounded-full font-bold transition-colors ${activeTab === 'demand' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>1. Demand Predictor</button>
            <button onClick={() => setActiveTab('freshness')} className={`px-5 py-2 rounded-full font-bold transition-colors ${activeTab === 'freshness' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>2. Freshness Checker</button>
            <button onClick={() => setActiveTab('market')} className={`px-5 py-2 rounded-full font-bold transition-colors ${activeTab === 'market' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>3. Surplus Marketplace</button>
            <button onClick={() => setActiveTab('impact')} className={`px-5 py-2 rounded-full font-bold transition-colors ${activeTab === 'impact' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>4. Impact Dashboard</button>
          </div>
        </header>

        {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl text-center font-bold">{error}</div>}

        {activeTab === 'demand' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold mb-6">Log Today's Batch</h2>
              <form onSubmit={handleDemandSubmit} className="space-y-4">
                <input type="number" placeholder="Center ID" className="w-full px-4 py-3 rounded-xl border bg-gray-50" value={formData.center_id} onChange={e => setFormData({...formData, center_id: e.target.value})} required />
                <input type="number" placeholder="Meal ID" className="w-full px-4 py-3 rounded-xl border bg-gray-50" value={formData.meal_id} onChange={e => setFormData({...formData, meal_id: e.target.value})} required />
                <input type="number" placeholder="Quantity Prepared" className="w-full px-4 py-3 rounded-xl border bg-gray-50" value={formData.quantity_prepared} onChange={e => setFormData({...formData, quantity_prepared: e.target.value})} required />
                <button type="submit" disabled={demandLoading} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700">{demandLoading ? 'Analyzing...' : 'Predict Demand'}</button>
              </form>
            </div>
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold mb-6">Forecast</h2>
              {demandResult ? (
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-xl"><p className="text-gray-500 text-sm">Predicted Demand</p><p className="text-3xl font-black">{demandResult.predicted_demand}</p></div>
                  {demandResult.expected_surplus > 0 && (
                    <div className="p-6 bg-orange-50 border border-orange-100 rounded-xl">
                      <p className="text-orange-800 font-bold">Surplus: {demandResult.expected_surplus} orders</p>
                      <p className="mt-2 text-sm text-orange-600">Action: Posted to Marketplace (Resale)</p>
                    </div>
                  )}
                </div>
              ) : <p className="text-gray-400">Submit form to see forecast.</p>}
            </div>
          </div>
        )}

        {activeTab === 'freshness' && (
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold mb-2">AI Freshness Checker</h2>
            <div onClick={() => fileInputRef.current.click()} className="border-4 border-dashed border-gray-200 rounded-3xl p-8 cursor-pointer hover:bg-gray-50 mb-6">
              {imagePreview ? <img src={imagePreview} className="mx-auto h-48 object-cover rounded-xl" /> : <p className="font-bold text-gray-400 py-12">Click to Upload Photo</p>}
            </div>
            <input type="file" ref={fileInputRef} onChange={(e) => { setSelectedFile(e.target.files[0]); setImagePreview(URL.createObjectURL(e.target.files[0])); setFreshnessResult(null); }} className="hidden" accept="image/*" />
            {imagePreview && <button onClick={handleFreshnessSubmit} className="w-full bg-emerald-500 text-white font-bold py-4 rounded-xl hover:bg-emerald-600">Scan Image</button>}
            {freshnessResult && (
              <div className={`mt-8 p-6 rounded-2xl border ${freshnessResult.status === 'Fresh' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                <p className="text-4xl font-black">{freshnessResult.status}</p>
                <p className="text-sm mt-2">Posted to Marketplace ({freshnessResult.status === 'Fresh' ? 'Resale' : 'Donation'})</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'market' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-blue-100">
                <h2 className="text-xl font-black text-blue-800 mb-4">NGO Donations <span className="text-sm bg-blue-100 px-2 py-1 rounded text-blue-600">Near Expiry</span></h2>
                <div className="space-y-4">
                  {listings.filter(l => l.routeType === 'Donation').map(l => (
                    <div key={l._id} className={`p-4 rounded-2xl border ${l.status === 'Available' ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-100 opacity-80'}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div><p className="font-bold text-lg">{l.itemName}</p><p className="text-sm text-gray-500">Qty: {l.quantity}</p></div>
                        <span className="text-xs font-bold px-2 py-1 bg-white rounded-md">{l.status}</span>
                      </div>
                      {l.status === 'Available' ? (
                        <button onClick={() => claimListing(l._id, 'Hope Shelter NGO')} className="w-full py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700">Claim for NGO</button>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm font-bold text-gray-500 text-center">Claimed by {l.claimedBy}</p>
                          <button onClick={() => handleViewRoute(l)} className="w-full py-2 bg-gray-200 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-300">View Delivery Route</button>
                        </div>
                      )}
                    </div>
                  ))}
                  {listings.filter(l => l.routeType === 'Donation').length === 0 && <p className="text-gray-400 text-sm">No donations available.</p>}
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl shadow-sm border-green-100">
                <h2 className="text-xl font-black text-green-800 mb-4">Discounted Resale <span className="text-sm bg-green-100 px-2 py-1 rounded text-green-600">Fresh Surplus</span></h2>
                <div className="space-y-4">
                  {listings.filter(l => l.routeType === 'Resale').map(l => (
                    <div key={l._id} className={`p-4 rounded-2xl border ${l.status === 'Available' ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100 opacity-80'}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div><p className="font-bold text-lg">{l.itemName}</p><p className="text-sm text-gray-500">Qty: {l.quantity}</p></div>
                        <span className="text-xs font-bold px-2 py-1 bg-white rounded-md">{l.status}</span>
                      </div>
                      {l.status === 'Available' ? (
                        <button onClick={() => claimListing(l._id, 'Local Vendor XYZ')} className="w-full py-2 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700">Claim for Resale</button>
                      ) : (
                        <p className="text-sm font-bold text-gray-500 text-center">Claimed by {l.claimedBy}</p>
                      )}
                    </div>
                  ))}
                  {listings.filter(l => l.routeType === 'Resale').length === 0 && <p className="text-gray-400 text-sm">No resale items available.</p>}
                </div>
              </div>
            </div>

            {activeRoute && (
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-800">Fastest Route to {activeRoute.claimedBy}</h2>
                  <button onClick={() => { setActiveRoute(null); setRouteCoords([]); }} className="text-gray-400 hover:text-gray-600 font-bold">✕ Close Map</button>
                </div>
                
                <div className="relative h-96 rounded-xl overflow-hidden border">
                  {mapLoading && <div className="absolute inset-0 z-[1000] bg-white/70 flex items-center justify-center font-bold text-gray-500 backdrop-blur-sm">Calculating Fastest Route...</div>}
                  <MapContainer center={KITCHEN_COORDS} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={KITCHEN_COORDS}><Popup>Kitchen (Origin)</Popup></Marker>
                    <Marker position={NGO_COORDS}><Popup>{activeRoute.claimedBy} (Destination)</Popup></Marker>
                    {routeCoords.length > 0 && <Polyline positions={routeCoords} color="#4F46E5" weight={5} opacity={0.7} />}
                  </MapContainer>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- TAB 4: IMPACT DASHBOARD --- */}
        {activeTab === 'impact' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Charts Section */}
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold mb-6 text-gray-800">Food Saved Over Time (Meals)</h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={impactData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF'}} />
                      <RechartsTooltip contentStyle={{borderRadius: '0.75rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                      <Line type="monotone" dataKey="mealsSaved" stroke="#4F46E5" strokeWidth={4} dot={{r: 4, fill: '#4F46E5', strokeWidth: 2}} activeDot={{r: 6}} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold mb-6 text-gray-800">Redistribution Breakdown</h2>
                <div className="h-72 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} innerRadius={80} outerRadius={110} paddingAngle={5} dataKey="value" stroke="none">
                        {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                      </Pie>
                      <RechartsTooltip />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Waste Log Sidebar */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col h-full">
              <h2 className="text-xl font-bold mb-2 text-gray-800">Raw Waste Log</h2>
              <p className="text-sm text-gray-500 mb-6">Log unavoidable processing waste.</p>
              
              <form onSubmit={handleWasteSubmit} className="space-y-4 mb-8">
                <input type="text" placeholder="Item (e.g., Potato Peels)" className="w-full px-4 py-3 rounded-xl border bg-gray-50 text-sm" value={wasteForm.item} onChange={e => setWasteForm({...wasteForm, item: e.target.value})} required />
                <input type="number" step="0.1" placeholder="Weight (kg)" className="w-full px-4 py-3 rounded-xl border bg-gray-50 text-sm" value={wasteForm.weight} onChange={e => setWasteForm({...wasteForm, weight: e.target.value})} required />
                <select className="w-full px-4 py-3 rounded-xl border bg-gray-50 text-sm text-gray-700" value={wasteForm.reason} onChange={e => setWasteForm({...wasteForm, reason: e.target.value})}>
                  <option>Processing Byproduct</option>
                  <option>Spoiled / Rotten</option>
                  <option>Dropped / Damaged</option>
                </select>
                <button type="submit" className="w-full bg-gray-800 text-white font-bold py-3 rounded-xl hover:bg-gray-900 transition-colors">Log Waste</button>
              </form>

              <div className="flex-grow overflow-y-auto pr-2 space-y-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Recent Logs</h3>
                {wasteLogs.map(log => (
                  <div key={log.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-sm text-gray-800">{log.item}</p>
                      <p className="text-xs text-gray-500">{log.reason} • {log.date}</p>
                    </div>
                    <span className="font-black text-gray-700">{log.weight}kg</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}

export default App;
