import { Analytics } from '@vercel/analytics/react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { TrekDataProvider } from './context/TrekDataContext'
import MainLayout from './layouts/MainLayout'
import Home from './pages/Home'
import Explore from './pages/Explore'
import TrekDetails from './pages/TrekDetails'
import About from './pages/About'
import Contact from './pages/Contact'
import Alerts from './pages/Alerts'
import ScoutStatus from './pages/ScoutStatus'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <TrekDataProvider>
      <BrowserRouter>
        <Routes>
          <Route path="scout/:slug" element={<ScoutStatus />} />
          <Route element={<MainLayout />}>
            <Route index element={<Home />} />
            <Route path="explore" element={<Explore />} />
            <Route path="trek/:slug" element={<TrekDetails />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="about" element={<About />} />
            <Route path="contact" element={<Contact />} />
            <Route path="home" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Analytics />
    </TrekDataProvider>
  )
}
