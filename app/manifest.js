export default function manifest() {
  return {
    name: 'Cienna Cleaning Platform',
    short_name: 'Cienna Clean',
    description: 'Cleaning operations platform for the Cienna suite',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f8fafc',
    theme_color: '#0f5146',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };
}
