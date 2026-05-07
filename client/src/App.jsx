import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Home from './pages/Home';
import Details from './pages/Details';
import Profile from './pages/Profile';
import Payment from './pages/Payment';
import MomoPayment from './pages/MomoPayment';
import Search from './pages/Search';
import BookingHistory from './pages/BookingHistory';
import Admin from './pages/Admin';
import HostDashboard from './pages/HostDashboard';
import ATM from './pages/ATM';
import EmailClone from './pages/EmailClone';
import MagicLogin from './pages/MagicLogin';
import SetupPassword from './pages/SetupPassword';
import SmsClone from './pages/SmsClone';

function RouteTracker() {
  const location = useLocation();

  useEffect(() => {
    const trackVisit = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        await fetch('/api/tracking/visit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            page_path: location.pathname,
            user_id: user ? user.id : null
          })
        });
      } catch (err) {
        // Silent error
      }
    };
    trackVisit();
  }, [location]);

  return null;
}

function App() {
  return (
    <Router>
      <RouteTracker />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/details/:id" element={<Details />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/payment" element={<Payment />} />
        <Route path="/momo-payment/:bookingId" element={<MomoPayment />} />
        <Route path="/search" element={<Search />} />
        <Route path="/bookings" element={<BookingHistory />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/host" element={<HostDashboard />} />
        <Route path="/atm" element={<ATM />} />
        <Route path="/admin/email-clone" element={<EmailClone />} />
        <Route path="/admin/sms-clone" element={<SmsClone />} />
        <Route path="/l/:code" element={<MagicLogin />} />
        <Route path="/setup-password" element={<SetupPassword />} />
      </Routes>
    </Router>
  )
}

export default App;
