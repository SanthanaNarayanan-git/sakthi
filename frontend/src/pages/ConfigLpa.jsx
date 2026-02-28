import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Save, Plus, Trash2, ArrowLeft, Loader, Settings } from 'lucide-react';

const ConfigLpa = ({ onBack }) => {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const API_BASE = `${process.env.REACT_APP_API_URL}/api/config/lpa`;

    useEffect(() => { fetchConfig(); }, []);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/master`);
            setItems(res.data.config || []);
        } catch (error) { console.error(error); }
        setLoading(false);
    };

    const handleAddRow = () => {
        setItems([...items, { id: Date.now(), slNo: items.length + 1, description: '', isDeleted: false, isNew: true }]);
    };

    const handleSave = async () => {
        try {
            const activeData = items.filter(c => !(c.isNew && c.isDeleted));
            await axios.post(`${API_BASE}/master`, { config: activeData });
            alert("LPA Schema Updated Successfully!");
            if (onBack) onBack(); else navigate('/admin');
        } catch (error) { alert("Failed to save."); }
    };

    return (
        <div className="min-h-screen bg-[#2d2d2d] flex flex-col pb-20">
            <div className="h-1.5 bg-[#ff9100] shadow-[0_0_15px_rgba(255,145,0,0.5)]" />
            <div className="bg-[#222] border-b border-white/5 py-4 px-10 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center gap-6">
                    <button onClick={onBack} className="text-white/50 hover:text-[#ff9100] p-2 rounded-lg hover:bg-white/5"><ArrowLeft /></button>
                    <h1 className="text-2xl font-black text-white uppercase tracking-wider">Edit LPA Checklist Fields</h1>
                </div>
                <button onClick={handleSave} className="bg-[#ff9100] hover:bg-orange-500 text-white font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 uppercase text-sm">
                    <Save size={16} /> Save Changes
                </button>
            </div>
            <div className="max-w-4xl w-full mx-auto p-10">
                <div className="bg-[#383838] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                    <div className="bg-black/20 grid grid-cols-12 gap-4 p-4 border-b border-white/5 text-[10px] font-black text-white/50 uppercase text-center">
                        <div className="col-span-2">S.No</div>
                        <div className="col-span-8 text-left">Check Point Description</div>
                        <div className="col-span-2">Action</div>
                    </div>
                    {loading ? <div className="p-20 text-center text-[#ff9100]"><Loader className="animate-spin inline mr-2" /> Loading...</div> : (
                        <div className="divide-y divide-white/5">
                            {items.map((cp, idx) => (
                                <div key={cp.id} className="grid grid-cols-12 gap-4 p-4 items-center">
                                    <div className="col-span-2 text-center font-bold text-white/50">{idx + 1}</div>
                                    <div className="col-span-8"><textarea value={cp.description} onChange={e => setItems(items.map(i => i.id === cp.id ? {...i, description: e.target.value} : i))} className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white text-sm" rows="2" /></div>
                                    <div className="col-span-2 flex justify-center">
                                        <button onClick={() => setItems(items.filter(i => i.id !== cp.id))} className="text-red-400 hover:text-red-600"><Trash2 size={18} /></button>
                                    </div>
                                </div>
                            ))}
                            <div className="p-4 bg-black/10">
                                <button onClick={handleAddRow} className="w-full py-4 border-2 border-dashed border-white/20 hover:border-[#ff9100] rounded-xl text-white/50 hover:text-[#ff9100] font-bold uppercase text-xs">
                                    <Plus size={16} className="inline mr-2" /> Add Check Point
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConfigLpa;