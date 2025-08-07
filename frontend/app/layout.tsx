import "./globals.css";
import { ClientProviders } from "./providers";

export const metadata = {
  title: 'Tornado Cash - Solana Privacy Mixer',
  description: 'Anonymize your on-chain holdings with zero-knowledge proofs on Solana',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
