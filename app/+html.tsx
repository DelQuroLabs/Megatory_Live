import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

/** Web-only document shell. Lets us load Nunito and stop the tab dock looking like default browser buttons. */
export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />
        <ScrollViewStyleReset />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root { height: 100%; background: #F5F8FB; }
              body {
                margin: 0;
                font-family: Nunito, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                color: #15284C;
              }
              /* RN-web turns Pressable into <div> or <button>; keep the dock from growing extra browser chrome. */
              button { font-family: inherit; -webkit-tap-highlight-color: transparent; }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
