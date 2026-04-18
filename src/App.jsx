import React, { useState, useEffect } from 'react';
import {
  Plus, X, Edit2, Trash2, ExternalLink, Loader2, ShoppingBag, Sparkles,
  Tag as TagIcon, Palette, Link2, AlertCircle, Check, Star, LayoutGrid,
  List, AlertTriangle, ImageOff
} from 'lucide-react';

var DEFAULT_EVENTS = ['Sangeet', 'Mehendi', 'Haldi/Pithi', 'Engagement', 'Ceremony', 'Reception'];
var SUGGESTED_COLORS = ['Red', 'Pink', 'Gold', 'Ivory', 'Burgundy', 'Green', 'Yellow', 'Blue', 'Peach', 'Lavender', 'Maroon', 'Rose'];
var CURRENCIES = ['USD', 'INR', 'GBP', 'EUR', 'CAD', 'AUD'];
var CURRENCY_SYMBOLS = { USD: '$', INR: '₹', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$' };

var fmtPrice = function(p, c) {
  var n = parseFloat(p);
  if (isNaN(n)) return '—';
  return (CURRENCY_SYMBOLS[c] || '$') + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

var load = function(key, fallback) {
  try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch(e) { return fallback; }
};
var save = function(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {} };

export default function App() {
  var _outfits = useState(function() { return load('bw_outfits', []); });
  var outfits = _outfits[0], setOutfits = _outfits[1];
  var _events = useState(function() { return load('bw_events', DEFAULT_EVENTS); });
  var eventTags = _events[0], setEventTags = _events[1];
  var _url = useState('');
  var urlInput = _url[0], setUrlInput = _url[1];
  var _proc = useState(false);
  var processing = _proc[0], setProcessing = _proc[1];
  var _status = useState('');
  var statusMsg = _status[0], setStatusMsg = _status[1];
  var _review = useState(null);
  var reviewOutfit = _review[0], setReviewOutfit = _review[1];
  var _edit = useState(null);
  var editOutfit = _edit[0], setEditOutfit = _edit[1];
  var _fEv = useState('all');
  var filterEvent = _fEv[0], setFilterEvent = _fEv[1];
  var _fCo = useState('all');
  var filterColor = _fCo[0], setFilterColor = _fCo[1];
  var _fav = useState(false);
  var favOnly = _fav[0], setFavOnly = _fav[1];
  var _sort = useState('recent');
  var sortBy = _sort[0], setSortBy = _sort[1];
  var _view = useState(function() { return load('bw_view', 'grid'); });
  var viewMode = _view[0], setViewMode = _view[1];
  var _del = useState(null);
  var confirmDel = _del[0], setConfirmDel = _del[1];
  var _tags = useState(false);
  var manageTags = _tags[0], setManageTags = _tags[1];

  var saveOutfits = function(v) { setOutfits(v); save('bw_outfits', v); };
  var saveEvents = function(v) { setEventTags(v); save('bw_events', v); };
  var saveView = function(v) { setViewMode(v); save('bw_view', v); };

  var extractFromUrl = async function(url) {
    var resp = await fetch('/api/extract?url=' + encodeURIComponent(url));
    var data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Server error ' + resp.status);
    return data;
  };

  var handleAdd = async function() {
    var url = urlInput.trim();
    if (!url) return;
    setProcessing(true);
    setStatusMsg('Fetching page…');

    var parsed = null, err = null;
    try { parsed = await extractFromUrl(url); }
    catch (e) { err = e.message; }

    var es = {
      name: parsed && parsed.name ? 'found' : 'missing',
      vendor: parsed && parsed.vendor ? 'found' : 'missing',
      price: parsed && parsed.price != null ? 'found' : 'missing',
      imageUrl: parsed && parsed.imageUrl ? 'found' : 'missing'
    };

    setReviewOutfit({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      url: url,
      name: (parsed && parsed.name) || '',
      vendor: (parsed && parsed.vendor) || '',
      price: parsed && parsed.price != null ? String(parsed.price) : '',
      currency: (parsed && parsed.currency) || 'USD',
      imageUrl: (parsed && parsed.imageUrl) || '',
      events: [], color: '', notes: '', favorite: false,
      extractionStatus: es, extractionError: err,
      dateAdded: new Date().toISOString()
    });
    setUrlInput(''); setProcessing(false); setStatusMsg('');
  };

  var handleManual = function() {
    setReviewOutfit({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      url: urlInput.trim(), name: '', vendor: '', price: '', currency: 'USD',
      imageUrl: '', events: [], color: '', notes: '', favorite: false,
      extractionStatus: { name: 'missing', vendor: 'missing', price: 'missing', imageUrl: 'missing' },
      extractionError: null, _manual: true, dateAdded: new Date().toISOString()
    });
    setUrlInput('');
  };

  var handleRetry = async function() {
    if (!reviewOutfit || !reviewOutfit.url) return;
    setReviewOutfit(function(o) { return Object.assign({}, o, { _retrying: true, extractionError: null }); });
    var parsed = null, err = null;
    try { parsed = await extractFromUrl(reviewOutfit.url); } catch (e) { err = e.message; }
    setReviewOutfit(function(o) {
      return Object.assign({}, o, {
        name: o.name || (parsed && parsed.name) || '',
        vendor: o.vendor || (parsed && parsed.vendor) || '',
        price: o.price || (parsed && parsed.price != null ? String(parsed.price) : ''),
        currency: o.currency === 'USD' && parsed && parsed.currency ? parsed.currency : o.currency,
        imageUrl: o.imageUrl || (parsed && parsed.imageUrl) || '',
        extractionStatus: {
          name: (o.name || (parsed && parsed.name)) ? 'found' : 'missing',
          vendor: (o.vendor || (parsed && parsed.vendor)) ? 'found' : 'missing',
          price: (o.price || (parsed && parsed.price != null)) ? 'found' : 'missing',
          imageUrl: (o.imageUrl || (parsed && parsed.imageUrl)) ? 'found' : 'missing'
        },
        extractionError: err, _retrying: false
      });
    });
  };

  var toggleFav = function(id) { saveOutfits(outfits.map(function(o) { return o.id === id ? Object.assign({}, o, { favorite: !o.favorite }) : o; })); };
  var delOutfit = function(id) { saveOutfits(outfits.filter(function(o) { return o.id !== id; })); setConfirmDel(null); };

  var allColors = Array.from(new Set(outfits.map(function(o) { return o.color; }).filter(Boolean))).sort();
  var favCount = outfits.filter(function(o) { return o.favorite; }).length;

  var filtered = outfits;
  if (favOnly) filtered = filtered.filter(function(o) { return o.favorite; });
  if (filterEvent !== 'all') {
    if (filterEvent === '__untagged__') filtered = filtered.filter(function(o) { return !o.events.length; });
    else filtered = filtered.filter(function(o) { return o.events.indexOf(filterEvent) !== -1; });
  }
  if (filterColor !== 'all') filtered = filtered.filter(function(o) { return o.color === filterColor; });

  if (sortBy === 'price-high') filtered = filtered.slice().sort(function(a, b) { return (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0); });
  else if (sortBy === 'price-low') filtered = filtered.slice().sort(function(a, b) { return (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0); });
  else if (sortBy === 'vendor') filtered = filtered.slice().sort(function(a, b) { return (a.vendor || '').localeCompare(b.vendor || ''); });
  else if (sortBy === 'favorites') filtered = filtered.slice().sort(function(a, b) { return (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0); });

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #fdf8f3 0%, #fcf0ea 50%, #fbeae2 100%)' }}>
      <div className="h-1 bg-gradient-to-r from-amber-300 via-rose-400 to-amber-300"></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        <header className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 text-amber-700 text-xs uppercase tracking-widest mb-3">
            <span className="w-8 h-px bg-amber-600 opacity-50"></span>
            <Sparkles className="w-3 h-3" />
            <span>Wardrobe</span>
            <Sparkles className="w-3 h-3" />
            <span className="w-8 h-px bg-amber-600 opacity-50"></span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-serif text-rose-950 tracking-tight mb-2">Bridal Wardrobe</h1>
          <p className="text-stone-600 text-sm sm:text-base max-w-xl mx-auto">Paste an outfit link — price, vendor, and image are extracted automatically.</p>
        </header>

        <div className="bg-white bg-opacity-80 backdrop-blur rounded-2xl shadow-sm border border-rose-100 p-5 sm:p-6 mb-8 max-w-3xl mx-auto">
          <label className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Link2 className="w-3.5 h-3.5 text-rose-800" /> Add an outfit
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input type="url" value={urlInput} onChange={function(e) { setUrlInput(e.target.value); }}
              onKeyDown={function(e) { if (e.key === 'Enter' && !processing) handleAdd(); }}
              placeholder="https://vendor.com/outfit-link..."
              className="flex-1 px-4 py-3 rounded-xl border border-stone-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none text-stone-800 placeholder:text-stone-400 bg-white"
              disabled={processing} />
            <button onClick={handleAdd} disabled={processing || !urlInput.trim()}
              className="px-6 py-3 rounded-xl bg-gradient-to-br from-rose-900 to-rose-800 hover:from-rose-800 hover:to-rose-700 disabled:from-stone-300 disabled:to-stone-300 disabled:cursor-not-allowed text-white font-medium flex items-center justify-center gap-2 shadow-sm">
              {processing ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Extracting…</span></> : <><Plus className="w-4 h-4" /><span>Add Outfit</span></>}
            </button>
          </div>
          {statusMsg && <div className="mt-3 text-sm text-rose-800 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{statusMsg}</div>}
          {!processing && <div className="mt-3 text-xs text-stone-500">Site blocked? <button onClick={handleManual} className="text-rose-800 underline underline-offset-2">Enter manually</button></div>}
        </div>

        {outfits.length > 0 && <>
          <div className="flex items-center justify-center mb-8">
            <span className="h-px w-16 bg-gradient-to-r from-transparent to-rose-200"></span>
            <span className="mx-3 text-rose-300">✦</span>
            <span className="h-px w-16 bg-gradient-to-l from-transparent to-rose-200"></span>
          </div>
          <div className="mb-6 space-y-3 bg-white bg-opacity-60 backdrop-blur rounded-2xl p-4 border border-rose-100">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-stone-500 uppercase tracking-wider mr-1">Event</span>
              <Chip active={filterEvent === 'all'} onClick={function() { setFilterEvent('all'); }}>All</Chip>
              {eventTags.map(function(t) { return <Chip key={t} active={filterEvent === t} onClick={function() { setFilterEvent(t); }}>{t}</Chip>; })}
              <Chip active={filterEvent === '__untagged__'} onClick={function() { setFilterEvent('__untagged__'); }} muted>Untagged</Chip>
              <button onClick={function() { setManageTags(true); }} className="text-xs text-rose-800 underline underline-offset-2 ml-1">manage</button>
            </div>
            {allColors.length > 0 && <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-stone-500 uppercase tracking-wider mr-1">Color</span>
              <Chip active={filterColor === 'all'} onClick={function() { setFilterColor('all'); }}>All</Chip>
              {allColors.map(function(c) { return <Chip key={c} active={filterColor === c} onClick={function() { setFilterColor(c); }}>{c}</Chip>; })}
            </div>}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button onClick={function() { setFavOnly(!favOnly); }}
                className={'px-3 py-1.5 rounded-full text-sm flex items-center gap-1.5 ' + (favOnly ? 'bg-amber-500 text-white shadow-sm' : 'bg-white text-stone-700 hover:bg-amber-50 border border-amber-200')}>
                <Star className={'w-3.5 h-3.5 ' + (favOnly ? 'fill-white' : '')} />Favorites {favCount > 0 && '(' + favCount + ')'}
              </button>
              <div className="flex items-center gap-1 ml-auto">
                <select value={sortBy} onChange={function(e) { setSortBy(e.target.value); }}
                  className="text-sm px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-stone-700 outline-none">
                  <option value="recent">Most recent</option>
                  <option value="favorites">Favorites first</option>
                  <option value="price-high">Price: high to low</option>
                  <option value="price-low">Price: low to high</option>
                  <option value="vendor">Vendor A–Z</option>
                </select>
                <div className="flex rounded-lg border border-stone-200 bg-white overflow-hidden ml-1">
                  <button onClick={function() { saveView('grid'); }} className={'px-2.5 py-1.5 ' + (viewMode === 'grid' ? 'bg-rose-900 text-white' : 'text-stone-600 hover:bg-rose-50')}><LayoutGrid className="w-4 h-4" /></button>
                  <button onClick={function() { saveView('list'); }} className={'px-2.5 py-1.5 ' + (viewMode === 'list' ? 'bg-rose-900 text-white' : 'text-stone-600 hover:bg-rose-50')}><List className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          </div>
        </>}

        {outfits.length === 0 ? <Empty /> : filtered.length === 0
          ? <div className="text-center py-16 text-stone-500">No outfits match these filters.</div>
          : viewMode === 'grid'
            ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filtered.map(function(o) { return <Card key={o.id} o={o} onEdit={function() { setEditOutfit(Object.assign({}, o)); }} onDel={function() { setConfirmDel(o); }} onFav={function() { toggleFav(o.id); }} />; })}
              </div>
            : <div className="space-y-3">
                {filtered.map(function(o) { return <Row key={o.id} o={o} onEdit={function() { setEditOutfit(Object.assign({}, o)); }} onDel={function() { setConfirmDel(o); }} onFav={function() { toggleFav(o.id); }} />; })}
              </div>
        }
      </div>

      {reviewOutfit && <OutfitModal o={reviewOutfit} onChange={setReviewOutfit}
        onSave={function() { saveOutfits([reviewOutfit].concat(outfits)); setReviewOutfit(null); }}
        onCancel={function() { setReviewOutfit(null); }} onRetry={handleRetry}
        events={eventTags} onUpdateEvents={saveEvents} title="Review & Tag" saveLabel="Add to Wardrobe" isNew />}

      {editOutfit && <OutfitModal o={editOutfit} onChange={setEditOutfit}
        onSave={function() { saveOutfits(outfits.map(function(x) { return x.id === editOutfit.id ? editOutfit : x; })); setEditOutfit(null); }}
        onCancel={function() { setEditOutfit(null); }}
        events={eventTags} onUpdateEvents={saveEvents} title="Edit Outfit" saveLabel="Save Changes" />}

      {confirmDel && <Modal onClose={function() { setConfirmDel(null); }}>
        <div className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0"><AlertCircle className="w-5 h-5 text-rose-800" /></div>
            <div><h3 className="font-serif text-lg text-rose-950 mb-1">Remove this outfit?</h3><p className="text-sm text-stone-600">"{confirmDel.name || 'Untitled'}" will be deleted.</p></div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={function() { setConfirmDel(null); }} className="px-4 py-2 rounded-lg text-stone-700 hover:bg-stone-100">Cancel</button>
            <button onClick={function() { delOutfit(confirmDel.id); }} className="px-4 py-2 rounded-lg bg-rose-900 hover:bg-rose-800 text-white">Delete</button>
          </div>
        </div>
      </Modal>}

      {manageTags && <TagMgr tags={eventTags} onSave={function(v) { saveEvents(v); setManageTags(false); }} onCancel={function() { setManageTags(false); }} />}
    </div>
  );
}

function Chip(props) {
  var cls = 'px-3 py-1.5 rounded-full text-sm transition ';
  if (props.active) cls += 'bg-rose-900 text-white shadow-sm';
  else if (props.muted) cls += 'bg-stone-100 text-stone-600 hover:bg-stone-200';
  else cls += 'bg-white text-stone-700 hover:bg-rose-50 border border-rose-100';
  return <button onClick={props.onClick} className={cls}>{props.children}</button>;
}

function Img(props) {
  var _st = useState(props.src ? 'loading' : 'none');
  var st = _st[0], setSt = _st[1];
  useEffect(function() {
    if (!props.src) { setSt('none'); return; }
    setSt('loading');
    var i = new Image();
    i.onload = function() { setSt('ok'); };
    i.onerror = function() { setSt('err'); };
    i.src = props.src;
  }, [props.src]);
  if (st === 'ok') return <img src={props.src} alt={props.alt} className={props.className} />;
  if (st === 'err') return <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-rose-400 bg-rose-50 p-2"><ImageOff className="w-8 h-8" /><span className="text-xs text-rose-500">image failed to load</span></div>;
  if (st === 'loading') return <div className="w-full h-full flex items-center justify-center bg-rose-50"><Loader2 className="w-6 h-6 text-rose-300 animate-spin" /></div>;
  return <div className="w-full h-full flex items-center justify-center text-rose-300 bg-rose-50"><ShoppingBag className="w-12 h-12" /></div>;
}

function MissingBadge() {
  return <span className="inline-flex items-center gap-0.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full"><AlertTriangle className="w-2.5 h-2.5" />missing</span>;
}

function Empty() {
  return <div className="text-center py-16 px-4"><div className="inline-flex w-16 h-16 rounded-full bg-rose-100 items-center justify-center mb-4"><ShoppingBag className="w-7 h-7 text-rose-800" /></div>
    <h3 className="font-serif text-xl text-rose-950 mb-2">No outfits yet</h3><p className="text-stone-600 max-w-md mx-auto text-sm">Paste any outfit link above and details will be extracted automatically.</p></div>;
}

function Card(props) {
  var o = props.o;
  var miss = function(f) { return o.extractionStatus && o.extractionStatus[f] === 'missing' && !o[f]; };
  return (
    <div className="group bg-white rounded-2xl border border-rose-100 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
      <div className="aspect-[3/4] bg-rose-50 relative overflow-hidden">
        <Img src={o.imageUrl} alt={o.name} className="w-full h-full object-cover" />
        <button onClick={props.onFav} className={'absolute top-2 left-2 w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition ' + (o.favorite ? 'bg-amber-400 text-white' : 'bg-white bg-opacity-90 hover:bg-white text-stone-400 hover:text-amber-500')}>
          <Star className={'w-4 h-4 ' + (o.favorite ? 'fill-white' : '')} />
        </button>
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
          <button onClick={props.onEdit} className="w-8 h-8 rounded-full bg-white bg-opacity-90 hover:bg-white flex items-center justify-center shadow-sm"><Edit2 className="w-4 h-4 text-stone-700" /></button>
          <button onClick={props.onDel} className="w-8 h-8 rounded-full bg-white bg-opacity-90 hover:bg-white flex items-center justify-center shadow-sm"><Trash2 className="w-4 h-4 text-rose-800" /></button>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-1.5 mb-1">
          {o.vendor ? <span className="text-xs text-amber-800 uppercase tracking-wider font-medium truncate">{o.vendor}</span> : <span className="text-xs text-stone-400 italic">Unknown vendor</span>}
          {miss('vendor') && <MissingBadge />}
        </div>
        <h3 className="font-serif text-stone-900 text-base leading-snug mb-2 line-clamp-2 min-h-[2.5rem]">{o.name || <span className="text-stone-400 italic">Untitled outfit</span>}</h3>
        <div className="flex items-baseline justify-between mb-3">
          <div className="flex items-center gap-1.5"><span className="text-lg font-medium text-rose-900">{fmtPrice(o.price, o.currency)}</span>{miss('price') && <MissingBadge />}</div>
          {o.url && <a href={o.url} target="_blank" rel="noopener noreferrer" className="text-xs text-stone-500 hover:text-rose-800 flex items-center gap-1">view <ExternalLink className="w-3 h-3" /></a>}
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {o.events.length ? o.events.map(function(e) { return <span key={e} className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-900 border border-rose-100">{e}</span>; }) : <span className="text-xs text-stone-400 italic">No events tagged</span>}
        </div>
        {o.color && <div className="text-xs text-stone-500 flex items-center gap-1"><Palette className="w-3 h-3" />{o.color}</div>}
      </div>
    </div>
  );
}

function Row(props) {
  var o = props.o;
  var miss = function(f) { return o.extractionStatus && o.extractionStatus[f] === 'missing' && !o[f]; };
  return (
    <div className="bg-white rounded-xl border border-rose-100 overflow-hidden hover:shadow-md transition flex gap-4 p-3">
      <div className="w-24 h-32 sm:w-28 sm:h-36 rounded-lg bg-rose-50 flex-shrink-0 overflow-hidden"><Img src={o.imageUrl} alt={o.name} className="w-full h-full object-cover" /></div>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              {o.vendor ? <span className="text-xs text-amber-800 uppercase tracking-wider font-medium">{o.vendor}</span> : <span className="text-xs text-stone-400 italic">Unknown vendor</span>}
              {miss('vendor') && <MissingBadge />}
            </div>
            <h3 className="font-serif text-stone-900 text-base leading-snug truncate">{o.name || <span className="text-stone-400 italic">Untitled</span>}</h3>
          </div>
          <button onClick={props.onFav} className={'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ' + (o.favorite ? 'text-amber-500' : 'text-stone-300 hover:text-amber-500')}>
            <Star className={'w-5 h-5 ' + (o.favorite ? 'fill-amber-400' : '')} />
          </button>
        </div>
        <div className="flex items-baseline gap-1.5 mb-2"><span className="text-lg font-medium text-rose-900">{fmtPrice(o.price, o.currency)}</span>{miss('price') && <MissingBadge />}</div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {o.events.length ? o.events.map(function(e) { return <span key={e} className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-900 border border-rose-100">{e}</span>; }) : <span className="text-xs text-stone-400 italic">No events</span>}
          {o.color && <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 flex items-center gap-1"><Palette className="w-2.5 h-2.5" />{o.color}</span>}
        </div>
        <div className="flex items-center gap-3 mt-auto">
          {o.url && <a href={o.url} target="_blank" rel="noopener noreferrer" className="text-xs text-stone-500 hover:text-rose-800 flex items-center gap-1">view <ExternalLink className="w-3 h-3" /></a>}
          <button onClick={props.onEdit} className="text-xs text-stone-500 hover:text-rose-800 flex items-center gap-1"><Edit2 className="w-3 h-3" /> edit</button>
          <button onClick={props.onDel} className="text-xs text-stone-500 hover:text-rose-800 flex items-center gap-1"><Trash2 className="w-3 h-3" /> delete</button>
        </div>
      </div>
    </div>
  );
}

function OutfitModal(props) {
  var o = props.o;
  var _tag = useState('');
  var newTag = _tag[0], setNewTag = _tag[1];
  var _imgK = useState(0);
  var imgKey = _imgK[0], setImgKey = _imgK[1];
  var st = o.extractionStatus || {};
  var missing = ['name','vendor','price','imageUrl'].filter(function(f) { return st[f] === 'missing' && !o[f]; });

  var toggleEv = function(t) {
    var has = o.events.indexOf(t) !== -1;
    props.onChange(Object.assign({}, o, { events: has ? o.events.filter(function(e) { return e !== t; }) : o.events.concat([t]) }));
  };
  var addTag = function() {
    var t = newTag.trim();
    if (!t) return;
    if (props.events.indexOf(t) === -1) props.onUpdateEvents(props.events.concat([t]));
    if (o.events.indexOf(t) === -1) props.onChange(Object.assign({}, o, { events: o.events.concat([t]) }));
    setNewTag('');
  };

  return (
    <Modal onClose={props.onCancel}>
      <div className="flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between flex-shrink-0">
          <h2 className="font-serif text-xl text-rose-950">{props.title}</h2>
          <button onClick={props.onCancel} className="w-8 h-8 rounded-full hover:bg-stone-100 flex items-center justify-center"><X className="w-4 h-4 text-stone-600" /></button>
        </div>
        <div className="overflow-y-auto p-6">
          {props.isNew && o.extractionError && <div className="mb-5 bg-rose-50 border border-rose-200 rounded-lg p-3">
            <div className="flex items-start gap-2 mb-2"><AlertCircle className="w-4 h-4 text-rose-700 flex-shrink-0 mt-0.5" /><div className="text-sm text-rose-900 flex-1"><span className="font-medium">Auto-extraction failed.</span> {o.extractionError}</div></div>
            {props.onRetry && <button onClick={props.onRetry} disabled={o._retrying} className="text-xs text-rose-800 underline underline-offset-2 ml-6 flex items-center gap-1">{o._retrying ? <><Loader2 className="w-3 h-3 animate-spin" /> Retrying…</> : 'Try again'}</button>}
            <div className="text-xs text-rose-700 ml-6 mt-1">You can also fill in the fields manually.</div>
          </div>}
          {props.isNew && !o.extractionError && missing.length > 0 && <div className="mb-5 bg
