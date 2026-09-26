// The dashboard never talks to adbox-server directly from the browser: all
// traffic goes through app/api/[...path]/route.js, which attaches ADMIN_API_KEY
// server side. That keeps the admin credential out of client bundles.
const nextConfig = {
  reactStrictMode: true
};

export default nextConfig;
