import { JetBrains_Mono, Nunito } from "next/font/google";
import { MuiThemeProvider } from "@/components/providers/mui-theme-provider";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const geistMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Nail Platform",
  description: "Nail diagnosis platform frontend",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <MuiThemeProvider>{children}</MuiThemeProvider>
      </body>
    </html>
  );
}
