import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import EmergencyBanner from '@/components/EmergencyBanner';

export const metadata: Metadata = {
  title: 'SwasthyaCall — AI Health IVR & Smart Appointment Platform',
  description:
    'Accessible healthcare appointment scheduling via telephone IVR with Gemma 4 Natural Language Understanding in Hindi and English, and unified clinic dashboard.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-teal-100 selection:text-teal-900">
        <EmergencyBanner />
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
