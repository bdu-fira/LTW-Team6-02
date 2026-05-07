import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import axios from 'axios'

// Cấu hình Base URL cho toàn bộ ứng dụng
// Khi chạy Local (chưa có VITE_API_URL), nó sẽ là chuỗi rỗng '' và dùng đường dẫn tương đối để Vite proxy
// Khi deploy lên mạng, bạn set biến VITE_API_URL=https://... trên Vercel thì toàn bộ App sẽ tự gọi link đó
axios.defaults.baseURL = import.meta.env.VITE_API_URL || '';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
