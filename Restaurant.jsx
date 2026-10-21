import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, ChevronDown, ChevronUp, Clock, Flame, IndianRupee, Leaf, MapPin, Search as SearchIcon } from 'lucide-react';
import { getRestaurant, isOpenNow, formatHour } from './api/_catalog.js';
import { COUPONS } from './api/_pricing.js';
import { useStore } from './store.jsx';
import { Adder, Empty, Plate, Rating, Sheet, VegMark, rupees } from './ui.jsx';

export function DishRow({ item, restaurant, open }) {
  const { qtyOf, addItem, setItemQty } = useStore();
  const qty = qtyOf(item.id);
  return (
    <article className="dish">
      <div className="dish-info">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <VegMark veg={item.veg} />
          {item.bestseller && <span className="bestseller"><Flame size={13} /> Bestseller</span>}
        </div>
        <h3 className="dish-name">{item.name}</h3>
        <div className="dish-price">{rupees(item.price)}</div>
        <p className="dish-desc">{item.desc}</p>
      </div>
      <div className="dish-side">
        <Plate emoji={item.emoji} tint={restaurant.tint} />
        <Adder
          name={item.name}
          qty={qty}
          disabled={!open}
          onAdd={() => addItem(restaurant.id, item.id)}
          onInc={() => setItemQty(item.id, qty + 1)}
          onDec={() => setItemQty(item.id, qty - 1)}
        />
      </div>
    </article>
  );
}

export default function Restaurant() {
  const { id } = useParams();
  const navigate = useNavigate();
  const r = getRestaurant(id);
  const { cartRestaurant, cartCount, cartSubtotal } = useStore();
  const [q, setQ] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [nonVegOnly, setNonVegOnly] = useState(false);
  const [best, setBest] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const [menuOpen, setMenuOpen] = useState(false);

  const sections = useMemo(() => {
    if (!r) return [];
    const term = q.trim().toLowerCase();
    return r.menu
      .map((s) => ({
        ...s,
        items: s.items.filter((i) =>
          (!vegOnly || i.veg) && (!nonVegOnly || !i.veg) && (!best || i.bestseller)
          && (!term || i.name.toLowerCase().includes(term) || i.desc.toLowerCase().includes(term))),
      }))
      .filter((s) => s.items.length);
  }, [r, q, vegOnly, nonVegOnly, best]);

  if (!r) {
    return (
      <main className="page narrow">
        <Empty emoji="🍽️" title="Restaurant not found" action={<Link className="btn btn-primary" to="/">See kitchens near you</Link>}>
          It may have been removed from the app.
        </Empty>
      </main>
    );
  }

  const open = isOpenNow(r);
  const showCartBar = cartRestaurant && cartRestaurant.id === r.id && cartCount > 0;
  const slug = (name) => `sec-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return (
    <main className="page narrow" style={{ paddingBottom: 200 }}>
      <div className="rhead">
        <div className="rhead-top">
          <button type="button" className="icon-btn" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} aria-label="Back"><ArrowLeft size={20} /></button>
        </div>
        <div className="rinfo">
          <h1>{r.name}</h1>
          <p className="muted">{r.cuisines.join(', ')}</p>
          <div className="rinfo-stats">
            <span><Rating value={r.rating} /> {r.ratingCount} ratings</span>
            <span><Clock size={16} /> {r.eta}–{r.eta + 8} mins</span>
            <span><MapPin size={16} /> {r.area}, {r.distanceKm} km</span>
            <span><IndianRupee size={16} /> {r.costForTwo} for two</span>
            {r.pureVeg && <span style={{ color: 'var(--leaf)' }}><Leaf size={16} /> Pure veg</span>}
          </div>
          {!open && <div className="notice">Closed now. Opens at {formatHour(r.hours[0])}. You can browse the menu, but ordering is paused.</div>}
          <div className="chips">
            {COUPONS.map((c) => (
              <span key={c.code} className="chip" style={{ cursor: 'default' }}><span className="code-tag" style={{ padding: '0 6px' }}>{c.code}</span> {c.title}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="menu-tools">
        <div className="searchbox">
          <SearchIcon size={18} />
          <label htmlFor="menu-search" className="sr-only">Search this menu</label>
          <input id="menu-search" className="input" style={{ height: 46 }} placeholder={`Search in ${r.name}`} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="chips">
          <button type="button" className="toggle" aria-pressed={vegOnly} onClick={() => { setVegOnly(!vegOnly); setNonVegOnly(false); }}>
            <span className="knob" /> Veg only
          </button>
          {!r.pureVeg && (
            <button type="button" className="toggle nv" aria-pressed={nonVegOnly} onClick={() => { setNonVegOnly(!nonVegOnly); setVegOnly(false); }}>
              <span className="knob" /> Non-veg
            </button>
          )}
          <button type="button" className="chip" aria-pressed={best} onClick={() => setBest(!best)}><Flame size={14} /> Bestsellers</button>
          <button type="button" className="chip" onClick={() => setMenuOpen(true)}><BookOpen size={14} /> Menu</button>
        </div>
      </div>

      {sections.length === 0 && (
        <Empty emoji="🥄" title="No dishes match" action={<button type="button" className="btn btn-primary" onClick={() => { setQ(''); setVegOnly(false); setNonVegOnly(false); setBest(false); }}>Show full menu</button>}>
          Clear the search or filters to see the full menu.
        </Empty>
      )}

      {sections.map((s) => {
        const isCollapsed = collapsed[s.name];
        return (
          <section key={s.name} className="menu-section" id={slug(s.name)} style={{ scrollMarginTop: 200 }}>
            <button type="button" aria-expanded={!isCollapsed} onClick={() => setCollapsed({ ...collapsed, [s.name]: !isCollapsed })}>
              <h2>{s.name} <span className="muted" style={{ fontWeight: 500 }}>({s.items.length})</span></h2>
              {isCollapsed ? <ChevronDown /> : <ChevronUp />}
            </button>
            {!isCollapsed && s.items.map((item) => <DishRow key={item.id} item={item} restaurant={r} open={open} />)}
          </section>
        );
      })}

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Jump to">
        <div style={{ display: 'grid' }}>
          {r.menu.map((s) => (
            <button
              key={s.name}
              type="button"
              className="bill-row"
              style={{ border: 0, background: 'none', padding: '14px 0', fontWeight: 600, fontSize: 16, borderBottom: '1px solid var(--line)' }}
              onClick={() => {
                setMenuOpen(false);
                setCollapsed({ ...collapsed, [s.name]: false });
                setTimeout(() => document.getElementById(slug(s.name))?.scrollIntoView({ behavior: 'smooth' }), 60);
              }}
            >
              <span>{s.name}</span><span className="muted">{s.items.length}</span>
            </button>
          ))}
        </div>
      </Sheet>

      {showCartBar && (
        <Link to="/cart" className="cartbar">
          <div>
            <strong>{cartCount} item{cartCount > 1 ? 's' : ''} | {rupees(cartSubtotal)}</strong>
            <div className="small" style={{ opacity: 0.75 }}>Taxes and fees are added at checkout</div>
          </div>
          <span className="btn btn-primary btn-sm">View cart</span>
        </Link>
      )}
    </main>
  );
}
