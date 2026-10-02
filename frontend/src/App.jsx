import { useState, useRef, useEffect } from 'react';
import { 
  Home, Calculator, Camera, ShoppingBag, PieChart as PieChartIcon, 
  Settings, HelpCircle, Search, Bell, UploadCloud, MapPin, X, Menu
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default Leaflet marker icons in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const KITCHEN_COORDS = [28.6139, 77.2090];
const NGO_COORDS = [28.6304, 77.2177];

// Mock Data for Charts
const impactData = [
  { month: 'Jan', mealsSaved: 400 }, { month: 'Feb', mealsSaved: 550 },
  { month: 'Mar', mealsSaved: 680 }, { month: 'Apr', mealsSaved: 900 },
  { month: 'May', mealsSaved: 1140 }, { month: 'Jun', mealsSaved: 1420 },
];
const pieData = [
  { name: 'Donated to NGOs', value: 55 }, { name: 'Discounted Resale', value: 30 },
  { name: 'Composted', value: 10 }, { name: 'Other', value: 5 }
];
const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#6B7280'];

const dummyImages = [
  'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500&q=80',
  'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=500&q=80',
  'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=500&q=80',
  'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&q=80',
];

export default function App() {
  const [activeTab, setActiveTab] = useState('impact');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Demand State
  const [formData, setFormData] = useState({ center_id: 55, meal_id: 1993, quantity_prepared: 500 });
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
  const [activeRoute, setActiveRoute] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [mapLoading, setMapLoading] = useState(false);

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
    setDemandLoading(true); 
    try {
      const response = await fetch('http://localhost:3000/api/surplus/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ center_id: parseInt(formData.center_id), meal_id: parseInt(formData.meal_id), quantity_prepared: parseInt(formData.quantity_prepared) })
      });
      const result = await response.json();
      setDemandResult(result);
      if (result.expected_surplus > 0) {
        await fetch('http://localhost:3000/api/listings', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemName: `Meal Batch #${formData.meal_id}`, quantity: result.expected_surplus, condition: 'Fresh', routeType: 'Resale' })
        });
      }
    } catch (err) { console.error(err); } finally { setDemandLoading(false); }
  };

  const handleFreshnessSubmit = async () => {
    if (!selectedFile) return;
    setFreshnessLoading(true); 
    const fd = new FormData(); fd.append('image', selectedFile);
    try {
      const response = await fetch('http://localhost:5000/check-freshness', { method: 'POST', body: fd });
      const result = await response.json();
      setFreshnessResult(result);
      await fetch('http://localhost:3000/api/listings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemName: "Scanned Produce", quantity: 50, condition: result.status, routeType: result.status === 'Fresh' ? 'Resale' : 'Donation' })
      });
    } catch (err) { console.error(err); } finally { setFreshnessLoading(false); }
  };

  const claimListing = async (id, claimedBy) => {
    try {
      await fetch(`http://localhost:3000/api/listings/${id}/claim`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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

  const getTabColor = () => {
    switch (activeTab) {
      case 'demand': return 'bg-blue-600';
      case 'freshness': return 'bg-purple-600';
      case 'market': return 'bg-orange-500';
      case 'impact': return 'bg-emerald-600';
      default: return 'bg-gray-800';
    }
  };

  const navItems = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'demand', icon: Calculator, label: 'Demand Predictor' },
    { id: 'freshness', icon: Camera, label: 'Freshness Checker' },
    { id: 'market', icon: ShoppingBag, label: 'Surplus Marketplace' },
    { id: 'impact', icon: PieChartIcon, label: 'Impact Dashboard' },
  ];

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans overflow-hidden">
      
      {/* MOBILE OVERLAY */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-gray-900/50 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 w-72 bg-white border-r border-gray-100 flex flex-col justify-between z-50 transform transition-transform duration-300 md:relative md:w-64 md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div>
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold">🍃</div>
              <span className="text-2xl font-black tracking-tight text-gray-800">FoodFlow</span>
            </div>
            <button className="md:hidden text-gray-500" onClick={() => setIsMobileMenuOpen(false)}>
              <X size={24} />
            </button>
          </div>
          
          <nav className="px-4 mt-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button 
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive ? `${getTabColor()} text-white shadow-md shadow-opacity-20` : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  <span className={`font-semibold text-sm ${isActive ? 'font-bold' : ''}`}>{item.label}</span>
                </button>
              )
            })}
            
            <div className="pt-6 pb-2">
              <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Preferences</p>
            </div>
            <button className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-gray-500 hover:bg-gray-50 transition-all">
              <Settings size={20} /> <span className="font-semibold text-sm">Settings</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-gray-500 hover:bg-gray-50 transition-all">
              <HelpCircle size={20} /> <span className="font-semibold text-sm">Help & Support</span>
            </button>
          </nav>
        </div>

        <div className="p-6 mt-auto">
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-5 rounded-2xl border border-emerald-200 relative overflow-hidden">
            <h3 className="text-emerald-800 font-black text-lg leading-tight z-10 relative">Good Food<br/>Brighter<br/>Tomorrows</h3>
            <div className="absolute -bottom-4 -right-4 text-6xl opacity-30">🍃</div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* TOP HEADER */}
        <header className="h-20 bg-white/50 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-4 md:px-8 z-10">
          <div className="flex items-center gap-4">
            <button className="md:hidden text-gray-600 p-2 hover:bg-gray-100 rounded-lg" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu size={24} />
            </button>
            <div className="hidden md:flex items-center bg-gray-100 px-4 py-2.5 rounded-full w-96 border border-transparent focus-within:bg-white focus-within:border-gray-300 transition-colors">
              <Search size={18} className="text-gray-400" />
              <input type="text" placeholder="Search anything..." className="bg-transparent border-none outline-none ml-3 w-full text-sm font-medium text-gray-700 placeholder-gray-400" />
            </div>
          </div>
          <div className="flex items-center gap-4 md:gap-6">
            <div className="relative cursor-pointer hover:bg-gray-100 p-2 rounded-full transition-colors hidden sm:block">
              <Bell size={22} className="text-gray-600" />
              <span className="absolute top-1 right-2 w-2 h-2 bg-orange-500 rounded-full border-2 border-white"></span>
            </div>
            <div className="flex items-center gap-3 cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-gray-800 text-white flex items-center justify-center font-bold text-sm shadow-md">S</div>
              <div className="hidden sm:block">
                <p className="text-sm font-bold text-gray-800 leading-tight">Siddhant</p>
                <p className="text-xs font-medium text-gray-500">Admin</p>
              </div>
            </div>
          </div>
        </header>

        {/* SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-50 to-transparent opacity-50 pointer-events-none rounded-full blur-3xl -z-10"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-emerald-50 to-transparent opacity-50 pointer-events-none rounded-full blur-3xl -z-10"></div>

          {/* PAGE TITLE */}
          <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                {activeTab === 'impact' && 'Impact Dashboard'}
                {activeTab === 'demand' && 'Demand Predictor'}
                {activeTab === 'freshness' && 'Freshness Checker'}
                {activeTab === 'market' && 'Surplus Marketplace'}
                {activeTab === 'home' && 'Welcome Back, Siddhant 👋'}
              </h1>
              <p className="text-gray-500 font-medium mt-1">
                {activeTab === 'impact' && 'Turning Surplus into Smiles 🍃'}
                {activeTab === 'demand' && 'Predict food demand and reduce future waste using AI'}
                {activeTab === 'freshness' && 'Upload food images to check freshness using AI'}
                {activeTab === 'market' && 'Buy, resell or donate surplus food to reduce waste'}
              </p>
            </div>
            
            {activeTab === 'impact' && (
              <div className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm font-bold text-gray-600 shadow-sm flex items-center gap-2 cursor-pointer hover:bg-gray-50 transition-colors w-full md:w-auto justify-center">
                <span>🗓 Jan 2024 - Jun 2024</span>
              </div>
            )}
            {activeTab === 'market' && (
              <button className="w-full md:w-auto bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm shadow-blue-200 hover:bg-blue-700 transition-colors flex justify-center items-center gap-2">
                <span>+</span> Add Item
              </button>
            )}
          </div>

          {/* --- TAB: IMPACT DASHBOARD --- */}
          {activeTab === 'impact' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { title: 'Meals Saved', value: '1,420', sub: '↑ 24% from last month', color: 'emerald', icon: '🍴' },
                  { title: 'Food Rescued', value: '320 kg', sub: '↑ 18% from last month', color: 'blue', icon: '📦' },
                  { title: 'Meals Donated', value: '540', sub: '↓ 12% from last month', color: 'red', icon: '❤️' },
                  { title: 'CO₂ Avoided', value: '1.2 T', sub: '↑ 28% from last month', color: 'orange', icon: '🌱' }
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div className={`w-12 h-12 rounded-2xl bg-${stat.color}-50 flex items-center justify-center text-2xl`}>{stat.icon}</div>
                    </div>
                    <div>
                      <p className="text-3xl font-black text-gray-800 mb-1">{stat.value}</p>
                      <p className="text-sm font-bold text-gray-500 mb-3">{stat.title}</p>
                      <p className={`text-xs font-bold ${stat.sub.includes('↑') ? 'text-emerald-500' : 'text-red-500'}`}>{stat.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <h2 className="text-lg font-black text-gray-800">Food Saved Over Time (Meals)</h2>
                    <select className="bg-gray-50 border border-gray-200 text-sm font-bold text-gray-600 rounded-lg px-3 py-1 outline-none w-full sm:w-auto">
                      <option>Meals Saved</option>
                    </select>
                  </div>
                  <div className="h-72 w-full -ml-4 sm:ml-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={impactData} margin={{top: 20, right: 20, left: 0, bottom: 0}}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12, fontWeight: 600}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12, fontWeight: 600}} width={40} />
                        <RechartsTooltip contentStyle={{borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                        <Line type="monotone" dataKey="mealsSaved" stroke="#3B82F6" strokeWidth={4} dot={{r: 6, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 8}} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col">
                  <h2 className="text-lg font-black text-gray-800 mb-2 text-center sm:text-left">Redistribution Breakdown</h2>
                  <div className="flex-1 flex flex-col justify-center relative mt-4">
                    <div className="h-48 relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} innerRadius={60} outerRadius={85} paddingAngle={2} dataKey="value" stroke="none">
                            {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                          </Pie>
                          <RechartsTooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-black text-gray-800">1,420</span>
                        <span className="text-xs font-bold text-gray-400">Total Meals</span>
                      </div>
                    </div>
                    <div className="mt-6 space-y-3 px-4">
                      {pieData.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{backgroundColor: PIE_COLORS[i]}}></span>
                            <span className="font-semibold text-gray-600 truncate">{item.name}</span>
                          </div>
                          <span className="font-bold text-gray-800 ml-2">{item.value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --- TAB: DEMAND PREDICTOR --- */}
          {activeTab === 'demand' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-xl">📦</div>
                  <h2 className="text-xl font-black text-gray-800">Log Today's Batch</h2>
                </div>
                
                <form onSubmit={handleDemandSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-600 mb-2">Expected Attendance</label>
                    <div className="relative">
                      <input type="number" className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-12 pr-16 font-bold text-gray-800 outline-none focus:border-blue-500 transition-colors" value={formData.center_id} onChange={e => setFormData({...formData, center_id: e.target.value})} required />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">👥</span>
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">people</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-600 mb-2">Meals Prepared ID</label>
                    <div className="relative">
                      <input type="number" className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-12 pr-12 font-bold text-gray-800 outline-none focus:border-blue-500 transition-colors" value={formData.meal_id} onChange={e => setFormData({...formData, meal_id: e.target.value})} required />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">🍴</span>
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">id</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-600 mb-2">Quantity Prepared (kg)</label>
                    <div className="relative">
                      <input type="number" className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-12 pr-12 font-bold text-gray-800 outline-none focus:border-blue-500 transition-colors" value={formData.quantity_prepared} onChange={e => setFormData({...formData, quantity_prepared: e.target.value})} required />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">⚖️</span>
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">kg</span>
                    </div>
                  </div>
                  <button type="submit" disabled={demandLoading} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex justify-center items-center gap-2">
                    {demandLoading ? 'Analyzing...' : <><Calculator size={18} /> Predict Demand</>}
                  </button>
                </form>
              </div>

              {demandResult && (
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between h-full animate-fade-in-up">
                  <div className="flex justify-between items-start mb-8">
                    <h2 className="text-xl font-black text-gray-800">AI Forecast Result</h2>
                    <span className="bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1 rounded-md flex items-center gap-1">✨ AI Powered</span>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-6 mb-8 text-center sm:text-left">
                    <div className="w-16 h-16 flex-shrink-0 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                      <Calculator size={28} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-500 mb-1">Estimated Demand</p>
                      <p className="text-4xl font-black text-gray-900 tracking-tight">{demandResult.predicted_demand} <span className="text-sm text-gray-400 font-bold ml-1">meals</span></p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-2xl text-center w-full sm:w-auto">
                      <p className="text-emerald-600 font-black text-lg">↓ {demandResult.expected_surplus}</p>
                      <p className="text-xs font-bold text-emerald-700 mt-1">Surplus Detected</p>
                    </div>
                  </div>

                  <div className="mb-8">
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{width: `${Math.min(100, (demandResult.predicted_demand / formData.quantity_prepared) * 100)}%`}}></div>
                    </div>
                    <div className="flex justify-between mt-2 text-sm font-bold text-gray-500">
                      <span>Prepared: {formData.quantity_prepared}</span>
                      <span>Suggested: {demandResult.predicted_demand}</span>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-100 p-5 rounded-2xl flex gap-4 items-start">
                    <span className="text-xl shrink-0">💡</span>
                    <div>
                      <h4 className="font-black text-blue-900 mb-1">AI Insight</h4>
                      <p className="text-sm text-blue-800 font-medium leading-relaxed">Based on historical data, you can reduce preparation by approximately {demandResult.expected_surplus} meals today. {demandResult.reuse_suggestion}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* --- TAB: FRESHNESS CHECKER --- */}
          {activeTab === 'freshness' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 h-full flex flex-col">
                <div className="flex-1 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center bg-gray-50/50 hover:bg-gray-50 cursor-pointer transition-colors relative p-6 min-h-[250px]" onClick={() => fileInputRef.current.click()}>
                  <UploadCloud size={48} className="text-blue-500 mb-4" />
                  <p className="font-bold text-gray-700 text-lg mb-1 text-center">Drop or click to upload</p>
                  <p className="text-sm font-medium text-gray-400">Supports JPG, PNG (Max 5MB)</p>
                  {imagePreview && <img src={imagePreview} className="absolute inset-0 w-full h-full object-cover rounded-2xl z-10 p-1" />}
                </div>
                <input type="file" ref={fileInputRef} onChange={(e) => { setSelectedFile(e.target.files[0]); setImagePreview(URL.createObjectURL(e.target.files[0])); setFreshnessResult(null); }} className="hidden" accept="image/*" />
                
                <div className="mt-8">
                  <p className="text-sm font-bold text-gray-500 mb-3">Try with:</p>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="w-16 h-16 flex-shrink-0 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden cursor-pointer hover:border-purple-500 transition-colors">
                         <img src={dummyImages[i-1]} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
                
                {imagePreview && (
                  <button onClick={handleFreshnessSubmit} disabled={freshnessLoading} className="w-full mt-6 bg-purple-600 text-white font-black py-4 rounded-xl shadow-lg shadow-purple-200 hover:bg-purple-700 transition-all flex justify-center items-center gap-2">
                    {freshnessLoading ? 'Scanning...' : 'Scan Freshness'}
                  </button>
                )}
              </div>

              {freshnessResult && (
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col h-full animate-fade-in-up">
                  <div className="relative h-48 rounded-2xl overflow-hidden mb-8 shadow-sm">
                    <img src={imagePreview} className="w-full h-full object-cover" />
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm">
                      <span className={`w-3 h-3 rounded-full ${freshnessResult.status === 'Fresh' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                      <span className="font-bold text-gray-800">{freshnessResult.status}</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-8 mb-8">
                    <div className="flex-1 flex items-center justify-center flex-col">
                      <h3 className="text-sm font-bold text-gray-500 mb-4">Freshness Score</h3>
                      <div className="relative w-32 h-32 rounded-full border-[12px] border-emerald-500 flex items-center justify-center shadow-inner">
                        <span className="text-4xl font-black text-gray-800">{freshnessResult.confidence.split('.')[0]}%</span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-6 flex flex-col justify-center items-center sm:items-start text-center sm:text-left">
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Estimated Shelf Life</p>
                        <p className="text-lg font-black text-gray-800">{freshnessResult.status === 'Fresh' ? '2 - 3 days' : 'Expired'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">AI Confidence</p>
                        <p className="text-lg font-black text-gray-800">{freshnessResult.confidence}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-100 p-5 rounded-2xl flex gap-4 items-center mt-auto">
                    <span className="text-2xl shrink-0">💡</span>
                    <div>
                      <h4 className="font-black text-blue-900 mb-1">AI Suggestion</h4>
                      <p className="text-sm text-blue-800 font-medium">Looks {freshnessResult.status.toLowerCase()}! Suitable for {freshnessResult.status === 'Fresh' ? 'resale.' : 'compost.'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* --- TAB: SURPLUS MARKETPLACE --- */}
          {activeTab === 'market' && (
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 overflow-x-auto pb-2">
                <div className="flex gap-2 whitespace-nowrap">
                  <button className="bg-orange-500 text-white px-5 py-2 rounded-full font-bold text-sm shadow-sm">All</button>
                  <button className="bg-white text-gray-600 px-5 py-2 rounded-full font-bold text-sm border border-gray-200 hover:bg-gray-50">Fresh</button>
                  <button className="bg-white text-gray-600 px-5 py-2 rounded-full font-bold text-sm border border-gray-200 hover:bg-gray-50">Near Expiry</button>
                  <button className="bg-white text-gray-600 px-5 py-2 rounded-full font-bold text-sm border border-gray-200 hover:bg-gray-50 hidden md:block">Donation</button>
                  <button className="bg-white text-gray-600 px-5 py-2 rounded-full font-bold text-sm border border-gray-200 hover:bg-gray-50 hidden md:block">Resale</button>
                </div>
                <div className="flex items-center gap-2 text-sm font-bold text-gray-600 whitespace-nowrap">
                  <span>Sort by</span>
                  <select className="bg-transparent border-b border-gray-300 outline-none pb-1"><option>Relevance</option></select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                {listings.map((l, i) => (
                  <div key={l._id} className="bg-white rounded-3xl p-3 shadow-sm border border-gray-100 flex flex-col relative overflow-hidden group">
                    <div className="relative h-40 rounded-2xl overflow-hidden mb-4">
                      <img src={dummyImages[i % dummyImages.length]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-3 py-1 rounded-lg shadow-sm">
                        <span className={`text-xs font-black ${l.condition === 'Fresh' ? 'text-emerald-600' : 'text-orange-600'}`}>{l.condition}</span>
                      </div>
                      <div className="absolute top-3 left-3 bg-blue-600 text-white px-3 py-1 rounded-lg shadow-sm">
                        <span className="text-xs font-black">{l.routeType}</span>
                      </div>
                    </div>
                    <div className="px-2 pb-2 flex-1 flex flex-col">
                      <h3 className="font-black text-gray-800 text-lg leading-tight mb-1 truncate">{l.itemName}</h3>
                      <p className="text-sm font-bold text-gray-500 mb-1">{l.quantity} kg</p>
                      <p className="text-xs font-medium text-gray-400 mb-4">{l.condition === 'Fresh' ? 'Cooked Surplus' : 'Processing Byproduct'}</p>
                      
                      <div className="mt-auto flex gap-2">
                        {l.status === 'Available' ? (
                          <>
                            <button onClick={() => claimListing(l._id, 'NGO')} className="flex-1 bg-emerald-100 text-emerald-700 py-2 rounded-xl font-bold text-sm hover:bg-emerald-200 transition-colors">Donate</button>
                            <button onClick={() => claimListing(l._id, 'Vendor')} className="flex-1 bg-blue-600 text-white py-2 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200">Resell</button>
                          </>
                        ) : (
                           <button onClick={() => handleViewRoute(l)} className="w-full bg-gray-100 text-gray-700 py-2 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors flex items-center justify-center gap-2">
                             <MapPin size={16} /> Track Route
                           </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {activeRoute && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-gray-900/40 backdrop-blur-sm animate-fade-in">
                  <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-full">
                    <div className="p-4 md:p-6 border-b border-gray-100 flex justify-between items-center">
                      <div>
                        <h2 className="text-xl md:text-2xl font-black text-gray-800 mb-1">Live Tracking Route</h2>
                        <p className="text-xs md:text-sm font-bold text-gray-500">Kitchen to {activeRoute.claimedBy}</p>
                      </div>
                      <button onClick={() => setActiveRoute(null)} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors shrink-0">
                        <X size={20} />
                      </button>
                    </div>
                    <div className="h-[400px] md:h-[500px] w-full relative">
                      {mapLoading && <div className="absolute inset-0 z-[1000] bg-white/70 flex items-center justify-center font-bold text-gray-500">Calculating Route...</div>}
                      <MapContainer center={KITCHEN_COORDS} zoom={13} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                        <Marker position={KITCHEN_COORDS}><Popup>Kitchen (Origin)</Popup></Marker>
                        <Marker position={NGO_COORDS}><Popup>{activeRoute.claimedBy}</Popup></Marker>
                        {routeCoords.length > 0 && <Polyline positions={routeCoords} color="#3B82F6" weight={5} opacity={0.8} />}
                      </MapContainer>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
        </div>
      </main>
    </div>
  );
}
