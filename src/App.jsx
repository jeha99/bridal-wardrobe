jsx
import React, { useState, useEffect } from 'react';
import {
  Plus, X, Edit2, Trash2, ExternalLink, Loader2, ShoppingBag, Sparkles,
  Tag as TagIcon, Palette, Link2, AlertCircle, Check, Star, LayoutGrid,
  List, AlertTriangle, ImageOff
} from 'lucide-react';

const DEFAULT_EVENTS = ['Sangeet', 'Mehendi', 'Haldi/Pithi', 'Engagement', 'Ceremony', 'Reception'];
const SUGGESTED_COLORS = ['Red', 'Pink', 'Gold', 'Ivory', 'Burgundy', 'Green', 'Yellow', 'Blue', 'Peach', 'Lavender', 'Maroon', 'Rose'];
const CURRENCIES = ['USD', 'INR', 'GBP', 'EUR', 'CAD', 'AUD'];
const CURRENCY_SYMBOLS = { USD: '$', INR: '₹', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$' };

const fmtPrice = (p, c) => {
  const n = parseFloat(p);
  if (isNaN(n)) return '—';
  return (CURRENCY_SYMBOLS[c] || '$') + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

const load = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
};
const save = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };

export default function App() {
  const [outfits, setOutfits] = useState(() => load('bw_outfits', []));
  const [eventTags, setEventTags] = useState(() => load('bw_events', DEFAULT_EVENTS));
  const [urlInput, setUrlInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [reviewOutfit, setReviewOutfit] = useState(null);
  const [editOutfit, setEditOutfit] = useState(null);
  const [filterEvent, setFilterEvent] = useState('all');
  const [filterColor, setFilterColor] = useState('all');
  const [favOnly, setFavOnly] = useState(false);
  const [sortBy, setSortBy] = useState('recent');
  const [viewMode, setViewMode] = useState(() => load('bw_view', 'grid'));
  const [confirmDel, setConfirmDel] = useState(null);
  const [manageTags, setManageTags] = useState(false);

  const saveOutfits = (v) => { setOutfits(v); save('bw_outfits', v); };
  const saveEvents = (v) => { setEventTags(v); save('bw_events', v); };
  const saveView = (v) => { setViewMode(v); save('bw_view', v); };

  // ── Extraction ──
  const extractFromUrl = async (url) => {
    const resp = await fetch(`/api/extract?url=${encodeURIComponent(url)}`);
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || `Server error ${resp.status}`);
    return data;
  };

  const handleAdd = async () => {
    const url = urlInput.trim();
    if (!url) return;
    setProcessing(true);
    setStatusMsg('Fetching page…');

    let parsed = null, err = null;
    try { parsed = await extractFromUrl(url); }
    catch (e) { err = e.message; }

    const es = {
      name: parsed?.name ? 'found' : 'missing',
      vendor: parsed?.vendor ? 'found' : 'missing',
      price: parsed?.price != null ? 'found' : 'missing',
      imageUrl: parsed?.imageUrl ? 'found' : 'missing'
    };

    setReviewOutfit({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      url,
      name: parsed?.name || '',
      vendor: parsed?.vendor || '',
      price: parsed?.price != null ? String(parsed.price) : '',
      currency: parsed?.currency || 'USD',
      imageUrl: parsed?.imageUrl || '',
      events: [], color: '', notes: '', favorite: false,
      extractionStatus: es, extractionError: err,
      dateAdded: new Date().toISOString()
    });
    setUrlInput(''); setProcessing(false); setStatusMsg('');
  };

  const handleManual = () => {
    setReviewOutfit({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      url: urlInput.trim(), name: '', vendor: '', price: '', currency: 'USD',
      imageUrl: '', events: [], color: '', notes: '', favorite: false,
      extractionStatus: { name:'missing', vendor:'missing', price:'missing', imageUrl:'missing' },
      extractionError: null, _manual: true, dateAdded: new Date().toISOString()
    });
    setUrlInput('');
  };

  const handleRetry = async () => {
    if (!reviewOutfit?.url) return;
    setReviewOutfit(o => ({ ...o, _retrying: true, extractionError: null }));
    let parsed = null, err = null;
    try { parsed = await extractFromUrl(reviewOutfit.url); } catch (e) { err = e.message; }
    setReviewOutfit(o => ({
      ...o,
      name: o.name || parsed?.name || '',
      vendor: o.vendor || parsed?.vendor || '',
      price: o.price || (parsed?.price != null ? String(parsed.price) : ''),
      currency: o.currency === 'USD' && parsed?.currency ? parsed.currency : o.currency,
      imageUrl: o.imageUrl || parsed?.imageUrl || '',
      extractionStatus: {
        name: (o.name || parsed?.name) ? 'found' : 'missing',
        vendor: (o.vendor || parsed?.vendor) ? 'found' : 'missing',
        price: (o.price || parsed?.price != null) ? 'found' : 'missing',
        imageUrl: (o.imageUrl || parsed?.imageUrl) ? 'found' : 'missing'
      },
      extractionError: err, _retrying: false
    }));
  };

  const toggleFav = (id) => saveOutfits(outfits.map(o => o.id === id ? { ...o, favorite: !o.favorite } : o));
  const delOutfit = (id) => { saveOutfits(outfits.filter(o => o.id !== id)); setConfirmDel(null); };

  // ── Filtering ──
  const allColors = [...new Set(outfits.map(o => o.color).filter(Boolean))].sort();
  const favCount = outfits.filter(o => o.favorite).length;

  let filtered = outfits;
  if (favOnly) filtered = filtered.filter(o => o.favorite);
  if (filterEvent !== 'all') {
    filtered = filterEvent === '__untagged__'
      ? filtered.filter(o => !o.events.length)
      : filtered.filter(o => o.events.includes(filterEvent));
  }
  if (filterColor !== 'all') filtered = filtered.filter(o => o.color === filterColor);

  const sorters = {
    'price-high': (a, b) => (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0),
    'price-low': (a, b) => (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0),
    'vendor': (a, b) => (a.vendor || '').localeCompare(b.vendor || ''),
    'favorites': (a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0)
  };
  if (sorters[sortBy]) filtered = [...filtered].sort(sorters[sortBy]);

  // ── Render ──
  return (
    
      
      

        {/* Header */}
        
          
            
            Wardrobe
          
          Bridal Wardrobe
          
            Paste an outfit link — price, vendor, and image are extracted automatically.
          
        

        {/* Input */}
        
          
             Add an outfit
          
          
            <input type="url" value={urlInput} onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !processing && handleAdd()}
              placeholder="https://vendor.com/outfit-link..."
              className="flex-1 px-4 py-3 rounded-xl border border-stone-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none text-stone-800 placeholder:text-stone-400 bg-white"
              disabled={processing} />
            
              {processing ? <>Extracting…</>
                : <>Add Outfit</>}
            
          
          {statusMsg && {statusMsg}}
          {!processing && Site blocked? Enter manually}
        

        {/* Filters */}
        {outfits.length > 0 && <>
          
            
            ✦
            
          
          
            
              Event
              <Chip active={filterEvent === 'all'} onClick={() => setFilterEvent('all')}>All
              {eventTags.map(t => <Chip key={t} active={filterEvent === t} onClick={() => setFilterEvent(t)}>{t})}
              <Chip active={filterEvent === '__untagged__'} onClick={() => setFilterEvent('__untagged__')} muted>Untagged
              <button onClick={() => setManageTags(true)} className="text-xs text-rose-800 underline underline-offset-2 ml-1">manage
            
            {allColors.length > 0 && 
              Color
              <Chip active={filterColor === 'all'} onClick={() => setFilterColor('all')}>All
              {allColors.map(c => <Chip key={c} active={filterColor === c} onClick={() => setFilterColor(c)}>{c})}
            }
            
              <button onClick={() => setFavOnly(!favOnly)}
                className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-1.5 ${favOnly ? 'bg-amber-500 text-white shadow-sm' : 'bg-white text-stone-700 hover:bg-amber-50 border border-amber-200'}`}>
                Favorites {favCount > 0 && `(${favCount})`}
              
              
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                  className="text-sm px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-stone-700 outline-none">
                  Most recentFavorites first
                  Price: high→lowPrice: low→high
                  Vendor A–Z
                
                
                  <button onClick={() => saveView('grid')} className={`px-2.5 py-1.5 ${viewMode === 'grid' ? 'bg-rose-900 text-white' : 'text-stone-600 hover:bg-rose-50'}`}>
                  <button onClick={() => saveView('list')} className={`px-2.5 py-1.5 ${viewMode === 'list' ? 'bg-rose-900 text-white' : 'text-stone-600 hover:bg-rose-50'}`}>
                
              
            
          
        </>}

        {/* Gallery */}
        {outfits.length === 0 ?  : filtered.length === 0
          ? No outfits match these filters.
          : viewMode === 'grid'
            ? 
                {filtered.map(o => <Card key={o.id} o={o} onEdit={() => setEditOutfit({...o})} onDel={() => setConfirmDel(o)} onFav={() => toggleFav(o.id)} />)}
              
            : 
                {filtered.map(o => <Row key={o.id} o={o} onEdit={() => setEditOutfit({...o})} onDel={() => setConfirmDel(o)} onFav={() => toggleFav(o.id)} />)}
              
        }
      

      {/* Modals */}
      {reviewOutfit && <OutfitModal o={reviewOutfit} onChange={setReviewOutfit} onSave={() => { saveOutfits([reviewOutfit, ...outfits]); setReviewOutfit(null); }}
        onCancel={() => setReviewOutfit(null)} onRetry={handleRetry} events={eventTags} onUpdateEvents={saveEvents} title="Review & Tag" saveLabel="Add to Wardrobe" isNew />}

      {editOutfit && <OutfitModal o={editOutfit} onChange={setEditOutfit} onSave={() => { saveOutfits(outfits.map(x => x.id === editOutfit.id ? editOutfit : x)); setEditOutfit(null); }}
        onCancel={() => setEditOutfit(null)} events={eventTags} onUpdateEvents={saveEvents} title="Edit Outfit" saveLabel="Save Changes" />}

      {confirmDel && <Modal onClose={() => setConfirmDel(null)}>
        
          
            
            Remove this outfit?"{confirmDel.name || 'Untitled'}" will be deleted.
          
          
            <button onClick={() => setConfirmDel(null)} className="px-4 py-2 rounded-lg text-stone-700 hover:bg-stone-100">Cancel
            <button onClick={() => delOutfit(confirmDel.id)} className="px-4 py-2 rounded-lg bg-rose-900 hover:bg-rose-800 text-white">Delete
          
        
      }

      {manageTags && <TagMgr tags={eventTags} onSave={v => { saveEvents(v); setManageTags(false); }} onCancel={() => setManageTags(false)} />}
    
  );
}

// ── Sub-components ──

function Chip({ active, onClick, children, muted }) {
  return {children};
}

function Img({ src, alt, className }) {
  const [st, setSt] = useState(src ? 'loading' : 'none');
  useEffect(() => { if (!src) { setSt('none'); return; } setSt('loading'); const i = new Image(); i.onload = () => setSt('ok'); i.onerror = () => setSt('err'); i.src = src; }, [src]);
  if (st === 'ok') return ;
  if (st === 'err') return image failed to load;
  if (st === 'loading') return ;
  return ;
}

function MissingBadge() {
  return missing;
}

function Empty() {
  return 
    No outfits yetPaste any outfit link above and details will be extracted automatically.;
}

function Card({ o, onEdit, onDel, onFav }) {
  const miss = (f) => o.extractionStatus?.[f] === 'missing' && !o[f];
  return (
    
      
        
        <button onClick={onFav} className={`absolute top-2 left-2 w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition ${o.favorite ? 'bg-amber-400 text-white' : 'bg-white/90 hover:bg-white text-stone-400 hover:text-amber-500'}`}>
          
        
        
          
          
        
      
      
        {o.vendor ? {o.vendor} : Unknown vendor}{miss('vendor') && }
        {o.name || Untitled outfit}
        
          {fmtPrice(o.price, o.currency)}{miss('price') && }
          {o.url && view }
        
        {o.events.length ? o.events.map(e => {e}) : No events tagged}
        {o.color && {o.color}}
      
    
  );
}

function Row({ o, onEdit, onDel, onFav }) {
  const miss = (f) => o.extractionStatus?.[f] === 'missing' && !o[f];
  return (
    
      
      
        
          
            {o.vendor ? {o.vendor} : Unknown vendor}{miss('vendor') && }
            {o.name || Untitled}
          
          
        
        {fmtPrice(o.price, o.currency)}{miss('price') && }
        
          {o.events.length ? o.events.map(e => {e}) : No events}
          {o.color && {o.color}}
        
        
          {o.url && view }
           edit
           delete
        
      
    
  );
}

function OutfitModal({ o, onChange, onSave, onCancel, onRetry, events, onUpdateEvents, title, saveLabel, isNew }) {
  const [newTag, setNewTag] = useState('');
  const [imgKey, setImgKey] = useState(0);
  const st = o.extractionStatus || {};
  const missing = ['name','vendor','price','imageUrl'].filter(f => st[f] === 'missing' && !o[f]);

  const toggleEv = (t) => { const has = o.events.includes(t); onChange({ ...o, events: has ? o.events.filter(e => e !== t) : [...o.events, t] }); };
  const addTag = () => { const t = newTag.trim(); if (!t) return; if (!events.includes(t)) onUpdateEvents([...events, t]); if (!o.events.includes(t)) onChange({ ...o, events: [...o.events, t] }); setNewTag(''); };

  return (
    
      
        
          {title}
          
        
        
          {isNew && o.extractionError && 
            Auto-extraction failed. {o.extractionError}
            {onRetry && {o._retrying ? <> Retrying…</> : 'Try again'}}
            You can also fill in the fields manually.
          }
          {isNew && !o.extractionError && missing.length > 0 && Couldn't auto-detect: {missing.join(', ')}.}

          
            
              
              <Field label="Image URL" miss={st.imageUrl === 'missing' && !o.imageUrl}>
                <input type="url" value={o.imageUrl} onChange={e => { onChange({ ...o, imageUrl: e.target.value }); setImgKey(k => k+1); }} placeholder="https://..." className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none" />
              
              Right-click the photo on the vendor site → "Copy Image Address" → paste above.
            
            
              <Field label="Outfit name" miss={st.name === 'missing' && !o.name}><input type="text" value={o.name} onChange={e => onChange({ ...o, name: e.target.value })} placeholder="e.g. Rose Gold Lehenga Set" className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none" />
              <Field label="Vendor / Designer" miss={st.vendor === 'missing' && !o.vendor}><input type="text" value={o.vendor} onChange={e => onChange({ ...o, vendor: e.target.value })} placeholder="e.g. Seema Gujral" className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none" />
              
                <Field label="Price" miss={st.price === 'missing' && !o.price}><input type="text" value={o.price} onChange={e => onChange({ ...o, price: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="0" className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none" />
                <select value={o.currency} onChange={e => onChange({ ...o, currency: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none bg-white">{CURRENCIES.map(c => {c})}
              
              
                <input type="text" value={o.color} onChange={e => onChange({ ...o, color: e.target.value })} placeholder="e.g. Red & Gold" className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none" />
                {SUGGESTED_COLORS.slice(0, 8).map(c => <button key={c} type="button" onClick={() => onChange({ ...o, color: c })} className="text-xs px-2 py-0.5 rounded-full bg-stone-100 hover:bg-rose-50 text-stone-600 hover:text-rose-900">{c})}
              
              
                {events.map(t => { const sel = o.events.includes(t); return <button key={t} type="button" onClick={() => toggleEv(t)} className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-1 ${sel ? 'bg-rose-900 text-white shadow-sm' : 'bg-rose-50 text-rose-900 border border-rose-100 hover:bg-rose-100'}`}>{sel && }{t}; })}
                <input type="text" value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="Add custom event" className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-stone-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none" />Add
              
              <textarea value={o.notes} onChange={e => onChange({ ...o, notes: e.target.value })} placeholder="Fitting notes, accessories…" rows={2} className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none resize-none" />
              <input type="checkbox" checked={!!o.favorite} onChange={e => onChange({ ...o, favorite: e.target.checked })} className="w-4 h-4 rounded accent-amber-500" />Mark as favorite
              {o.url &&  View original page}
            
          
        
        
          Cancel
          {isNew && }{saveLabel}
        
      
    
  );
}

function TagMgr({ tags, onSave, onCancel }) {
  const [cur, setCur] = useState([...tags]);
  const [inp, setInp] = useState('');
  const add = () => { const t = inp.trim(); if (!t || cur.includes(t)) return; setCur([...cur, t]); setInp(''); };
  return 
    Manage Events
    {cur.map(t => {t}<button onClick={() => setCur(cur.filter(x => x !== t))} className="hover:text-rose-700">)}{!cur.length && No events.}
    <input type="text" value={inp} onChange={e => setInp(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())} placeholder="New event name" className="flex-1 px-3 py-2 rounded-lg border border-stone-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none" />Add
    Cancel<button onClick={() => onSave(cur)} className="px-4 py-2 rounded-lg bg-rose-900 hover:bg-rose-800 text-white">Save
  ;
}

function Field({ label, children, miss }) {
  return {label}{miss && }{children};
}

function Modal({ children, onClose }) {
  return <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-hidden" onClick={e => e.stopPropagation()}>{children};
}
