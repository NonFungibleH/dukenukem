export const metadata = {
  title: "Duke Nukem Token",
  description: "Mint your 90s-action PFP — ERC‑721",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="bg-neutral-950">
      <body className="bg-neutral-950 text-neutral-100">
        {children}
      </body>
    </html>
  );
}
