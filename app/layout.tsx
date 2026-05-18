import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Demonstrateur IA — Region Lovers',
  description:
    'Outils de démonstration des capacités IA : fact checking, classification, base de données',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased bg-gray-50">{children}</body>
    </html>
  );
}
