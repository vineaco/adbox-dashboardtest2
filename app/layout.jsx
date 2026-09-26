import './globals.css';
import Sidebar from './components/Sidebar';

export const metadata = {
  title: 'adbox | Fleet control',
  description: 'Provision Raspberry Pi ad boxes, plan geo-targeted campaigns and monitor playback.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <Sidebar />
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
