import { useLocation } from 'react-router-dom';
import {
  DashboardSkeleton,
  SessionsPageSkeleton,
  MeasurementsSkeleton,
  TemplatesSkeleton,
  ListSkeleton,
} from './LoadingSkeletons';

/**
 * Smart loading fallback that shows appropriate skeleton based on route
 */
export function SmartSuspenseFallback() {
  const location = useLocation();
  const path = location.pathname;

  // Match route to appropriate skeleton
  if (path === '/' || path.startsWith('/dashboard')) {
    return <DashboardSkeleton />;
  }

  if (path.startsWith('/sessions')) {
    return <SessionsPageSkeleton />;
  }

  if (path.startsWith('/measurements')) {
    return <MeasurementsSkeleton />;
  }

  if (path.startsWith('/templates')) {
    return <TemplatesSkeleton />;
  }

  // Generic fallback for other routes
  return (
    <div className="p-4 max-w-5xl mx-auto">
      <ListSkeleton items={6} />
    </div>
  );
}
