import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Pay At Table",
  description: "A simple, secure and convenient way to pay your restaurant bill.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster
          position="top-center"
          theme="light"
          richColors
          closeButton
          duration={4500}
          visibleToasts={2}
          offset={16}
          mobileOffset={16}
          toastOptions={{
            classNames: {
              toast: "rounded-2xl shadow-lg",
            },
          }}
        />
      </body>
    </html>
  );
}