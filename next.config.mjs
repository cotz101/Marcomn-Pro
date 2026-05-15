/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['quill'],
  devIndicators: false,
  async redirects() {
    return [
      {
        source: '/blog',
        destination: '/mblog',
        permanent: true,
      },
      {
        source: '/Blog',
        destination: '/mblog',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
