import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
import SetupPassword from './pages/SetupPassword';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/details/:id" element={<Details />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/payment" element={<Payment />} />
        <Route path="/momo-payment/:bookingId" element={<MomoPayment />} />
        <Route path="/search" element={<Search />} />
        <Route path="/bookings" element={<BookingHistory />} />
        <Route path="/quan-ly" element={<Admin />} />
        <Route path="/host" element={<HostDashboard />} />
        <Route path="/atm" element={<ATM />} />
        <Route path="/admin/email-clone" element={<EmailClone />} />
        <Route path="/setup-password" element={<SetupPassword />} />
      </Routes>
    </Router>
  )
}

export default App;

