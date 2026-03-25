import "../styles/globals.css";
import { poppins } from "../styles/fonts";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning={true}>
      <body className={`${poppins.className}`} suppressHydrationWarning={true}>
        {children}
      </body>
    </html>
  );
}
