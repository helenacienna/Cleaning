import './globals.css';
import ServiceWorkerRegistration from './ServiceWorkerRegistration';
import { buildBoardThemeCss, getBoardThemeSettings } from '../lib/app-settings';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Cienna Cleaning Platform',
  description: 'Cleaning operations platform for the Cienna suite',
  applicationName: 'Cienna Cleaning Platform',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/favicon.svg',
    apple: '/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    title: 'Cienna Clean',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0f5146',
};

export default async function RootLayout({ children }) {
  const themeSettings = await getBoardThemeSettings();
  const themeCss = buildBoardThemeCss(themeSettings);

  return (
    <html lang="en">
      <body>
        <style>{themeCss}</style>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
