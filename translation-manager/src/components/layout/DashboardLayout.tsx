import Sidebar from './Sidebar';
import ProfileMenu from './ProfileMenu';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  quickActions?: React.ReactNode;
}

export default function DashboardLayout({
  children,
  title,
  subtitle,
  quickActions
}: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen bg-[#F1F8F4]">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {/* Header with Title and Actions */}
        <div className="sticky top-0 z-40 bg-[#F1F8F4] h-16">
          <div className="h-full px-8 flex items-center justify-between gap-8">
            {/* Left: Page Title */}
            {title && (
              <div className="flex-1">
                <h1 className="text-xl font-bold text-[#1E293B] tracking-tight">{title}</h1>
              </div>
            )}

            {/* Right: Quick Actions and Profile Menu */}
            <div className="flex items-center gap-4">
              {/* Quick Actions */}
              {quickActions}

              {/* Divider */}
              {quickActions && (
                <div className="h-6 w-px bg-[#D4E3FC]"></div>
              )}

              {/* Profile Menu */}
              <ProfileMenu />
            </div>
          </div>
        </div>

        {/* Subtitle Section */}
        {subtitle && (
          <div className="bg-[#F1F8F4] px-8 py-1.5">
            <p className="text-xs text-[#64748B]">{subtitle}</p>
          </div>
        )}

        {/* Main Content */}
        <div className="px-8 pt-4 pb-8">
          {children}
        </div>
      </main>
    </div>
  );
}
