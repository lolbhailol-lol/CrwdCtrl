import { Outlet } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import BottomNav from '../components/BottomNav'
import DataSourceBanner from '../components/DataSourceBanner'

export default function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <Navbar />
      <DataSourceBanner />
      <main className="flex-1 pb-nav md:pb-0">
        <Outlet />
      </main>
      <Footer />
      <BottomNav />
    </div>
  )
}
