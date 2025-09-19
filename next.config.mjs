/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // Redirect old companion-related pages to new combined pages
      {
        source: '/settings/user-goals',
        destination: '/settings/prompt',
        permanent: true,
      },
      {
        source: '/settings/ai-goals',
        destination: '/settings/companion-state',
        permanent: true,
      },
      {
        source: '/settings/ai-interests',
        destination: '/settings/companion-state',
        permanent: true,
      },
    ]
  },
};

export default nextConfig;
