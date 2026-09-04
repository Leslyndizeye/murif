import dynamic from 'next/dynamic';

// The existing app (react-router-dom, all pages, auth, everything) is mounted
// here unchanged, client-side only. Every URL Next.js receives falls through
// to this one catch-all page; react-router-dom then reads window.location
// itself and handles routing exactly as it did under Create React App.
const LegacyApp = dynamic(() => import('../App'), { ssr: false });

export default function CatchAllPage() {
  return <LegacyApp />;
}
