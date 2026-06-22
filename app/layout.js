import './globals.css';
import { buildBoardThemeCss, getBoardThemeSettings } from '../lib/app-settings';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Cienna Cleaning Platform',
  description: 'Cleaning operations platform for the Cienna suite',
};

export default async function RootLayout({ children }) {
  const themeSettings = await getBoardThemeSettings();
  const themeCss = buildBoardThemeCss(themeSettings);

  return (
    <html lang="en">
      <body>
        <style>{themeCss}</style>
        {children}
      </body>
    </html>
  );
}
