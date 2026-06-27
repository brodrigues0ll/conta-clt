import Header from './Header'
import BottomNav from './BottomNav'
import OfflineBanner from '@/components/OfflineBanner'
import CacheWarmer from '@/components/CacheWarmer'

export default function AppShell({ children }) {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <OfflineBanner />
      <main className="flex-1 overflow-y-auto max-w-2xl w-full mx-auto px-4" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
        {children}
      </main>
      <BottomNav />
      <CacheWarmer />
    </div>
  )
}
