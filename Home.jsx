import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, Leaf, Search as SearchIcon, Timer } from 'lucide-react';
import { CATEGORIES, RESTAURANTS, isOpenNow, formatHour } from './api/_catalog.js';
import { COUPONS, findCoupon } from './api/_pricing.js';
import { useStore } from './store.jsx';
import { Empty, Plate, Rating, rupees, useToast } from './ui.jsx';

function moment() {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return { title: 'Breakfast, sorted.', line: 'Dosas, idlis and filter coffee from kitchens that open early.' };
  if (h >= 11 && h < 16) return { title: "What's for lunch?", line: 'Thalis, biryanis and bowls, delivered to your desk or door.' };
  if (h >= 16 && h < 19) return { title: 'Chai-time cravings?', line: 'Bajjis, rolls and something sweet to go with that cup.' };
  if (h >= 19 && h < 23) return { title: "What's for dinner?", line: 'Pick a kitchen near you and track every step until it reaches your door.' };
  return { title: 'Up late? So are these kitchens.', line: 'Late-night biryani, rolls and ice cream, still delivering.' };
}

const SORTS = [
  { key: 'relevance', label: 'Relevance' },
  { key: 'rating', label: 'Rating' },
  { key: 'eta', label: 'Delivery time' },
  { key: 'cost-asc', label: 'Cost: low to high' },
  { key: 'cost-desc', label: 'Cost: high to low' },
];

export function RestaurantCard({ r }) {
  const open = isOpenNow(r);
  const offer = findCoupon(r.offer);
  return (
    <Link to={`/r/${r.id}`} className={`rcard ${open ? '' : 'closed'}`}>
      <div className="rcard-art" style={{ '--tint': r.tint }}>
        <Plate className="p1" emoji={r.art[0]} />
        <Plate className="p2" emoji={r.art[1]} />
        <Plate className="p3" emoji={r.art[2]} />
        {open && offer && <div className="rcard-offer">{offer.title}</div>}
        {!open && <span className="closed-tag">Opens at {formatHour(r.hours[0])}</span>}
        {r.pureVeg && <span className="pv-tag"><Leaf size={12} /> Pure veg</span>}
      </div>
      <div className="rcard-body">
        <div className="rcard-name">{r.name}</div>
        <div className="rcard-meta">
          <Rating value={r.rating} />
          <span>{r.eta}–{r.eta + 8} mins</span>
        </div>
        <div className="rcard-sub">{r.cuisines.join(', ')}</div>
        <div className="rcard-sub">{r.area}, {r.distanceKm} km. {rupees(r.costForTwo)} for two</div>
      </div>
    </Link>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const toast = useToast();
  const { dispatch } = useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(null);
  const [sort, setSort] = useState('relevance');
  const [f, setF] = useState({ veg: false, rated: false, fast: false, budget: false });
  const m = moment();

  const list = useMemo(() => {
    let out = RESTAURANTS.filter((r) =>
      (!cat || r.tags.includes(cat))
      && (!f.veg || r.pureVeg)
      && (!f.rated || r.rating >= 4.4)
      && (!f.fast || r.eta <= 25)
      && (!f.budget || r.costForTwo <= 300));
    const by = {
      rating: (a, b) => b.rating - a.rating,
      eta: (a, b) => a.eta - b.eta,
      'cost-asc': (a, b) => a.costForTwo - b.costForTwo,
      'cost-desc': (a, b) => b.costForTwo - a.costForTwo,
    }[sort];
    if (by) out = [...out].sort(by);
    // Closed kitchens always sink to the bottom.
    return out.sort((a, b) => Number(isOpenNow(b)) - Number(isOpenNow(a)));
  }, [cat, sort, f]);

  const activeFilters = Boolean(cat) || Object.values(f).some(Boolean);
  const clearAll = () => { setCat(null); setF({ veg: false, rated: false, fast: false, budget: false }); };
  const toggle = (k) => setF((s) => ({ ...s, [k]: !s[k] }));
  const openNow = RESTAURANTS.filter((r) => isOpenNow(r)).length;

  const applyOffer = async (code) => {
    dispatch({ type: 'coupon', code });
    try { await navigator.clipboard?.writeText(code); } catch { /* clipboard blocked: the coupon is still saved */ }
    toast(`${code} will be applied at checkout`);
  };

  return (
    <main className="page">
      <section className="hero">
        <div className="hero-row">
          <div style={{ display: 'grid', gap: 18 }}>
            <h1>{m.title}</h1>
            <p className="lede">{m.line} {openNow} kitchens are delivering to you right now.</p>
            <form
              className="searchbox"
              role="search"
              onSubmit={(e) => { e.preventDefault(); navigate(`/search?q=${encodeURIComponent(q.trim())}`); }}
            >
              <SearchIcon size={20} />
              <label htmlFor="home-search" className="sr-only">Search for a dish or restaurant</label>
              <input id="home-search" className="input" placeholder="Search for biryani, dosa, pizza…" value={q} onChange={(e) => setQ(e.target.value)} />
            </form>
          </div>
          <div className="hero-plates" aria-hidden="true">
            <Plate emoji="🍛" tint="#FBE6D4" size={190} className="hp1" />
            <Plate emoji="🫓" tint="#E4F3E8" size={120} className="hp2" />
            <Plate emoji="🍨" tint="#DDF0F7" size={96} className="hp3" />
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="offers-h">
        <div className="section-head"><h2 id="offers-h">Offers for you</h2></div>
        <div className="offers">
          {COUPONS.map((c) => (
            <button key={c.code} type="button" className="offer-card" onClick={() => applyOffer(c.code)}>
              <strong>{c.title}</strong>
              <span className="muted small">{c.terms}</span>
              <span className="code-tag">{c.code}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="cats-h">
        <div className="section-head"><h2 id="cats-h">What are you craving?</h2></div>
        <div className="cats">
          {CATEGORIES.map((c) => (
            <button key={c.key} type="button" className="cat" aria-pressed={cat === c.key} onClick={() => setCat(cat === c.key ? null : c.key)}>
              <Plate emoji={c.emoji} />
              {c.label}
            </button>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="list-h">
        <div className="section-head">
          <h2 id="list-h">{cat ? `${CATEGORIES.find((c) => c.key === cat).label} near you` : 'Kitchens near you'}</h2>
          <span className="muted small">{list.length} found</span>
        </div>
        <div className="chips" style={{ marginBottom: 18 }}>
          <label className="chip">
            <span className="sr-only">Sort by</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
              {SORTS.map((s) => <option key={s.key} value={s.key}>Sort: {s.label}</option>)}
            </select>
            <ChevronDown size={14} />
          </label>
          <button type="button" className="chip" aria-pressed={f.veg} onClick={() => toggle('veg')}><Leaf size={14} /> Pure veg</button>
          <button type="button" className="chip" aria-pressed={f.rated} onClick={() => toggle('rated')}>Rated 4.4+</button>
          <button type="button" className="chip" aria-pressed={f.fast} onClick={() => toggle('fast')}><Timer size={14} /> Under 25 mins</button>
          <button type="button" className="chip" aria-pressed={f.budget} onClick={() => toggle('budget')}>Under ₹300 for two</button>
        </div>
        {list.length ? (
          <div className="grid-rest">{list.map((r) => <RestaurantCard key={r.id} r={r} />)}</div>
        ) : (
          <Empty emoji="🔍" title="No kitchens match these filters" action={<button type="button" className="btn btn-primary" onClick={clearAll}>Clear filters</button>}>
            Try removing a filter or picking a different craving.
          </Empty>
        )}
        {activeFilters && list.length > 0 && (
          <p style={{ marginTop: 24 }}><button type="button" className="btn-text" onClick={clearAll}>Clear all filters</button></p>
        )}
      </section>
    </main>
  );
}
