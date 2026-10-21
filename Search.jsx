import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, X } from 'lucide-react';
import { CATEGORIES, RESTAURANTS, allItems, getRestaurant, isOpenNow } from './api/_catalog.js';
import { useStore } from './store.jsx';
import { Adder, Empty, Plate, Rating, VegMark, rupees } from './ui.jsx';

export default function Search() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const { qtyOf, addItem, setItemQty } = useStore();
  const term = q.trim().toLowerCase();

  const results = useMemo(() => {
    if (term.length < 2) return { rests: [], dishes: [] };
    const rests = RESTAURANTS.filter((r) => r.name.toLowerCase().includes(term) || r.cuisines.some((c) => c.toLowerCase().includes(term)));
    const dishes = allItems()
      .filter(({ item }) => item.name.toLowerCase().includes(term) || item.desc.toLowerCase().includes(term))
      .slice(0, 30);
    return { rests, dishes };
  }, [term]);

  const update = (v) => {
    setQ(v);
    setParams(v ? { q: v } : {}, { replace: true });
  };

  return (
    <main className="page narrow">
      <div style={{ paddingTop: 24, display: 'grid', gap: 16 }}>
        <h1 style={{ fontSize: 34 }}>Search</h1>
        <div className="searchbox">
          <SearchIcon size={20} />
          <label htmlFor="search" className="sr-only">Search for a dish or restaurant</label>
          <input id="search" className="input" autoFocus placeholder="Dish, restaurant or cuisine" value={q} onChange={(e) => update(e.target.value)} />
          {q && <button type="button" className="icon-btn" style={{ position: 'absolute', right: 8, width: 38, height: 38 }} onClick={() => update('')} aria-label="Clear search"><X size={18} /></button>}
        </div>
      </div>

      {term.length < 2 && (
        <section className="section">
          <h2 style={{ marginBottom: 14 }}>Popular right now</h2>
          <div className="chips" style={{ flexWrap: 'wrap' }}>
            {CATEGORIES.map((c) => (
              <button key={c.key} type="button" className="chip" onClick={() => update(c.label)}>{c.emoji} {c.label}</button>
            ))}
          </div>
        </section>
      )}

      {term.length >= 2 && !results.rests.length && !results.dishes.length && (
        <Empty emoji="🤔" title={`Nothing found for "${q.trim()}"`}>Check the spelling or try a broader word like "biryani" or "coffee".</Empty>
      )}

      {results.rests.length > 0 && (
        <section className="section">
          <h2 style={{ marginBottom: 6 }}>Restaurants</h2>
          {results.rests.map((r) => (
            <Link key={r.id} to={`/r/${r.id}`} className="rest-hit">
              <div className="mini" style={{ '--tint': r.tint }}>{r.art[0]}</div>
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: 17 }}>{r.name}</strong>
                <div className="dotless small"><Rating value={r.rating} /> <span>{r.eta}–{r.eta + 8} mins</span> {!isOpenNow(r) && <span className="muted">Closed now</span>}</div>
                <div className="muted small">{r.cuisines.join(', ')}</div>
              </div>
            </Link>
          ))}
        </section>
      )}

      {results.dishes.length > 0 && (
        <section className="section">
          <h2 style={{ marginBottom: 6 }}>Dishes</h2>
          {results.dishes.map(({ item, restaurantId }) => {
            const r = getRestaurant(restaurantId);
            const qty = qtyOf(item.id);
            return (
              <div key={item.id} className="dish-hit">
                <Plate emoji={item.emoji} tint={r.tint} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><VegMark veg={item.veg} /><strong>{item.name}</strong></div>
                  <div className="small">{rupees(item.price)}</div>
                  <Link to={`/r/${r.id}`} className="muted small">from {r.name}</Link>
                </div>
                <Adder
                  name={item.name}
                  qty={qty}
                  disabled={!isOpenNow(r)}
                  onAdd={() => addItem(r.id, item.id)}
                  onInc={() => setItemQty(item.id, qty + 1)}
                  onDec={() => setItemQty(item.id, qty - 1)}
                />
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}
