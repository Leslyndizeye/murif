import dynamic from 'next/dynamic';

const LegacyApp = dynamic(() => import('../../../App'), { ssr: false });

export default function UserDashboardCompatibilityPage() {
  return <LegacyApp />;
}
