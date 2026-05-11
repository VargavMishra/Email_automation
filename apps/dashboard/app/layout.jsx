import { Cormorant_Garamond, Manrope } from 'next/font/google';
import './globals.css';

const display = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700']
});

const body = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700']
});

export const metadata = {
  title: 'Studio Delivery Console',
  description: 'Admin dashboard for photo delivery automation.',
  icons: {
    icon: '/pics/favicon3.ico'
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/flag-icons@7.2.3/css/flag-icons.min.css"
        />
      </head>
      <body className={`${display.variable} ${body.variable}`}>
        {children}
      </body>
    </html>
  );
}

