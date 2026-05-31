import './globals.css';

export const metadata = {
  title: 'Cienna Cleaning Platform',
  description: 'Cleaning operations platform for the Cienna suite',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
