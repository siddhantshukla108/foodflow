import { useState, useRef, useEffect } from 'react';

function App() {
  const [activeTab, setActiveTab] = useState('demand');
  const [error, setError] = useState('');
  
  // Demand State
  const [formData, setFormData] = useState({ center_id: 55, meal_id: 1993, quantity_prepared: '' });
  const [demandLoading, setDemandLoading] = useState(false);
  const [demandResult, setDemandResult] = useState(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  
  // Freshness State
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [freshnessLoading, setFreshnessLoading] = useState(false);
  const [freshnessResult, setFreshnessResult] = useState(null);
  const fileInputRef = useRef(null);

  // Marketplace State
  const [listings, setListings] = useState([]);
  const [marketLoading, setMarketLoading] = useState(false);

  // Fetch Marketplace Data
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

  // Handlers
  const handleDemandSubmit = async (e) => {
    e.preventDefault();
    setDemandLoading(true); setError('');
    try {
      const response = await fetch('http://localhost:3000/api/surplus/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          center_id: parseInt(formData.center_id),
          meal_id: parseInt(formData.meal_id),
          quantity_prepared: parseInt(formData.quantity_prepared)
        })
      });
      if (!response.ok) throw new Error('Failed to fetch forecast');
      const result = await response.json();
      setDemandResult(result);
      
      // Auto-post to marketplace if surplus exists
      if (result.expected_surplus > 0) {
        await fetch('http://localhost:3000/api/listings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemName: `Meal Batch #${formData.meal_id}`,
            quantity: result.expected_surplus,
            condition: 'Fresh',
            routeType: 'Resale'
          })
        });
      }
    } catch (err) { setError(err.message); } finally { setDemandLoading(false); }
  };

  const handleFreshnessSubmit = async () => {
    if (!selectedFile) return;
    setFreshnessLoading(true); setError('');
    const fd = new FormData();
    fd.append('image', selectedFile);
    try {
      const response = await fetch('http://localhost:5000/check-freshness', { method: 'POST', body: fd });
      if (!response.ok) throw new Error('Failed to analyze image');
      const result = await response.json();
      setFreshnessResult(result);
      
      // Auto-post to marketplace based on condition
      await fetch('http://localhost:3000/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemName: "Scanned Produce",
          quantity: 50,
          condition: result.status,
          routeType: result.status === 'Fresh' ? 'Resale' : 'Donation'
        })
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
      fetchListings(); // Refresh board
    } catch (err) { console.error(err); }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <header className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
          <h1 className="text-3xl font-black text-gray-800 tracking-tight mb-2">FoodFlow</h1>
          <div className="flex justify-center gap-3 mt-6 flex-wrap">
            <button onClick={() => setActiveTab('demand')} className={`px-5 py-2 rounded-full font-bold transition-colors ${activeTab === 'demand' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>1. Demand Predictor</button>
            <button onClick={() => setActiveTab('freshness')} className={`px-5 py-2 rounded-full font-bold transition-colors ${activeTab === 'freshness' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>2. Freshness Checker</button>
            <button onClick={() => setActiveTab('market')} className={`px-5 py-2 rounded-full font-bold transition-colors ${activeTab === 'market' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>3. Surplus Marketplace</button>
          </div>
        </header>

        {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl text-center font-bold">{error}</div>}

        {/* --- TAB 1: DEMAND --- */}
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

        {/* --- TAB 2: FRESHNESS --- */}
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

        {/* --- TAB 3: MARKETPLACE --- */}
        {activeTab === 'market' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Donations Column */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-blue-100">
              <h2 className="text-xl font-black text-blue-800 mb-4 flex items-center gap-2">NGO Donations <span className="text-sm font-medium bg-blue-100 px-2 py-1 rounded-md text-blue-600">Near Expiry</span></h2>
              <div className="space-y-4">
                {listings.filter(l => l.routeType === 'Donation').map(l => (
                  <div key={l._id} className={`p-4 rounded-2xl border ${l.status === 'Available' ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div><p className="font-bold text-lg">{l.itemName}</p><p className="text-sm text-gray-500">Qty: {l.quantity}</p></div>
                      <span className="text-xs font-bold px-2 py-1 bg-white rounded-md">{l.status}</span>
                    </div>
                    {l.status === 'Available' ? (
                      <button onClick={() => claimListing(l._id, 'Hope Shelter NGO')} className="w-full py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700">Claim for NGO</button>
                    ) : (
                      <p className="text-sm font-bold text-gray-500 text-center">Claimed by {l.claimedBy}</p>
                    )}
                  </div>
                ))}
                {listings.filter(l => l.routeType === 'Donation').length === 0 && <p className="text-gray-400 italic text-sm">No donations available.</p>}
              </div>
            </div>

            {/* Resale Column */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border-green-100">
              <h2 className="text-xl font-black text-green-800 mb-4 flex items-center gap-2">Discounted Resale <span className="text-sm font-medium bg-green-100 px-2 py-1 rounded-md text-green-600">Fresh Surplus</span></h2>
              <div className="space-y-4">
                {listings.filter(l => l.routeType === 'Resale').map(l => (
                  <div key={l._id} className={`p-4 rounded-2xl border ${l.status === 'Available' ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
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
                {listings.filter(l => l.routeType === 'Resale').length === 0 && <p className="text-gray-400 italic text-sm">No resale items available.</p>}
              </div>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}

export default App;
