import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Home, History, Clock, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomNavigationProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  pendingCount?: number;
}

export function BottomNavigation({ 
  currentPage, 
  onNavigate, 
  pendingCount = 0 
}: BottomNavigationProps) {
  const navItems = [
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      active: currentPage === 'home'
    },
    {
      id: 'history',
      label: 'History',
      icon: History,
      active: currentPage === 'history'
    },
    {
      id: 'pending',
      label: 'Pending',
      icon: Clock,
      active: currentPage === 'pending',
      badge: pendingCount > 0 ? pendingCount : undefined
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      active: currentPage === 'settings'
    }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
      <div className="grid grid-cols-4 h-16">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <Button
              key={item.id}
              variant="ghost"
              className={cn(
                "flex flex-col items-center justify-center space-y-1 h-full rounded-none relative",
                item.active 
                  ? "text-blue-600 bg-blue-50" 
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              )}
              onClick={() => onNavigate(item.id)}
            >
              <IconComponent className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
              
              {item.badge && (
                <Badge 
                  variant="destructive" 
                  className="absolute top-1 right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </Badge>
              )}
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
