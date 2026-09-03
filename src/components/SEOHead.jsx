import { Helmet } from 'react-helmet-async';

const BASE_URL = 'https://calliotel.com';
const DEFAULT_IMAGE = 'https://static.prod-images.emergentagent.com/jobs/5583c0f6-ff48-4551-ac03-c80f7e70e692/images/357ec1c27704377050a5a77e16333cf5533a7f904e2a8156c3396780c12ef190.png';

const SEOHead = ({
  title,
  description,
  keywords,
  path = '/',
  image = DEFAULT_IMAGE,
  type = 'website',
  schema = null,
}) => {
  const fullTitle = title
    ? `${title} | Calliotel`
    : 'Calliotel | Virtual Numbers from $1.99 | No Code = No Pay';

  const fullUrl = `${BASE_URL}${path}`;

  return (
    <Helmet>
      {/* Core */}
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      {keywords && <meta name="keywords" content={keywords} />}
      <link rel="canonical" href={fullUrl} />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={fullUrl} />
      <meta property="og:image" content={image} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="Calliotel" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={image} />

      {/* Structured data (JSON-LD) */}
      {schema && (
        <script type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      )}
    </Helmet>
  );
};

/* ── Pre-built schemas for common page types ────────────────── */

export const orgSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Calliotel',
  url: BASE_URL,
  logo: `${BASE_URL}/logo192.png`,
  sameAs: [],
  description:
    'Calliotel provides virtual phone numbers and eSIM data plans across 250+ countries. Starting from $1.35/month with no setup fees. Instant activation, no ID required.',
};

export const webAppSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Calliotel',
  url: BASE_URL,
  applicationCategory: 'CommunicationApplication',
  operatingSystem: 'Web',
  description:
    'Buy virtual phone numbers from $1.35/month. No setup fees. Receive SMS for WhatsApp, Telegram, Google and 800+ services. eSIM data plans in 180+ countries. No ID required.',
  offers: {
    '@type': 'AggregateOffer',
    lowPrice: '1.99',
    highPrice: '9.99',
    priceCurrency: 'USD',
    description: 'Virtual phone numbers starting at $1.99/month. No setup fees.',
  },
};

export const faqSchema = (faqs) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
});

export const serviceSchema = (name, description, price) => ({
  '@context': 'https://schema.org',
  '@type': 'Service',
  name,
  description,
  provider: { '@type': 'Organization', name: 'Calliotel', url: BASE_URL },
  offers: { '@type': 'Offer', price, priceCurrency: 'USD' },
});

export default SEOHead;
