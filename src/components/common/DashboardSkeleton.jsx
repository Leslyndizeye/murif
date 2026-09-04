import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton placeholder shaped like the real IT Dashboard layout
 * (4 stat cards, Document Signature Workflow, Quick Actions),
 * shown briefly while dashboard data is loading instead of a blank/spinner screen.
 */
const DashboardSkeleton = ({ darkMode = false }) => {
  const cardBg = darkMode ? 'bg-slate-800/60' : 'bg-white';
  const pageBg = darkMode ? 'bg-slate-950' : 'bg-slate-50';

  return (
    <div className={`${darkMode ? 'dark' : ''}`}>
      <div className={`min-h-screen ${pageBg} p-8`}>
        <Skeleton className="h-9 w-64 mb-3" />
        <Skeleton className="h-5 w-80 mb-8" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`rounded-xl p-6 ${cardBg} border border-border`}>
              <Skeleton className="h-8 w-16 mx-auto mb-3" />
              <Skeleton className="h-4 w-24 mx-auto" />
            </div>
          ))}
        </div>

        <Skeleton className="h-6 w-56 mb-5" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`rounded-xl p-6 ${cardBg} border border-border`}>
              <Skeleton className="h-8 w-10 mx-auto mb-3" />
              <Skeleton className="h-4 w-32 mx-auto" />
            </div>
          ))}
        </div>

        <Skeleton className="h-6 w-40 mb-5" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`rounded-xl p-6 ${cardBg} border border-border flex items-center justify-center`}>
              <Skeleton className="h-10 w-10 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardSkeleton;
