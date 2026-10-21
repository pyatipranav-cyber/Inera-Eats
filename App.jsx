import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { ChevronDown, Home as HomeIcon, MapPin, Receipt, Search as SearchIcon, ShoppingBag, User } from 'lucide-react';
import { useStore } from './store.jsx';
import { BRAND, BrandMark, Empty } from './ui.jsx';
import AddressSheet from './AddressSheet.jsx';
import Home from './Home.jsx';
import Search from './Search.jsx';
import Restaurant from './Restaurant.jsx';
import Checkout from './Checkout.jsx';
import Track from './Track.jsx';
import Orders from './Orders.jsx';
import Account from './Account.jsx';

function Header({ onPickAddress }) {
  const { cartCount, address } = useStore();
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="brand" aria-label={`${BRAND} home`}>
          <BrandMark />
          <span>inera eats</span>
        </Link>
        <button type="button" className="loc-btn" onClick={onPickAddress} aria-label="Change delivery address">
          <MapPin size={18} />
          <div style={{ minWidth: 0 }}>
            <strong>{address ? address.label : 'Add address'} <ChevronDown size={14} style={{ verticalAlign: 'middle' }} /></strong>
            <span>{address ? address.area : 'Where should we deliver?'}</span>
          </div>
        </button>
        <nav className="topnav" aria-label="Main">
          <NavLink to="/search"><SearchIcon size={18} /> Search</NavLink>
          <NavLink to="/orders"><Receipt size={18} /> Orders</NavLink>
          <NavLink to="/account"><User size={18} /> Account</NavLink>
          <NavLink to="/cart">
            <ShoppingBag size={18} /> Cart
            {cartCount > 0 && <span className="count-badge">{cartCount}</span>}
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

function BottomNav() {
  const { cartCount } = useStore();
  return (
    <nav className="bottomnav" aria-label="Main">
      <NavLink to="/" end><HomeIcon size={22} />Home</NavLink>
      <NavLink to="/search"><SearchIcon size={22} />Search</NavLink>
      <NavLink to="/orders"><Receipt size={22} />Orders</NavLink>
      <NavLink to="/cart">
        <ShoppingBag size={22} />Cart
        {cartCount > 0 && <span className="count-badge">{cartCount}</span>}
      </NavLink>
    </nav>
  );
}

function NotFound() {
  return (
    <main className="page narrow">
      <Empty emoji="🍽️" title="This page isn't on the menu" action={<Link className="btn btn-primary" to="/">Go to home</Link>}>
        The link may be old or mistyped.
      </Empty>
    </main>
  );
}

export default function App() {
  const [addrOpen, setAddrOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  const hideBottom = pathname === '/cart';

  return (
    <>
      <Header onPickAddress={() => setAddrOpen(true)} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<Search />} />
        <Route path="/r/:id" element={<Restaurant />} />
        <Route path="/cart" element={<Checkout onPickAddress={() => setAddrOpen(true)} />} />
        <Route path="/order/:id" element={<Track />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/account" element={<Account onPickAddress={() => setAddrOpen(true)} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {!hideBottom && <BottomNav />}
      <AddressSheet open={addrOpen} onClose={() => setAddrOpen(false)} />
    </>
  );
}
