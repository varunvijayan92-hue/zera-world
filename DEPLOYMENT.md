# ZeraWorld deployment and domain setup

Status: the domain zeraworld.com has not been purchased or verified yet. Do not claim it is connected until the DNS records and live deployment are confirmed in the hosting provider.

## 1. Local development

Use localhost during development until the production domain is purchased and verified.

Environment:

- APP_URL=http://localhost:3000
- NEXT_PUBLIC_APP_URL=http://localhost:3000
- DATABASE_URL=postgresql://... (local or dev database)
- JWT_SECRET=<local secret>
- NEXTAUTH_SECRET=<local secret>
- NODE_ENV=development

This project is configured to keep localhost as the development default so production code does not depend on hardcoded local URLs.

## 2. Production deployment target

Recommended provider: Vercel.

Set these variables in the Vercel project dashboard or equivalent hosting environment once the domain is available:

- APP_URL=https://zeraworld.com
- NEXT_PUBLIC_APP_URL=https://zeraworld.com
- DATABASE_URL=<managed PostgreSQL connection string>
- JWT_SECRET=<strong random secret>
- NEXTAUTH_SECRET=<strong random secret>
- NODE_ENV=production

For PostgreSQL, use a production provider such as Neon, Supabase, Railway, or another managed PostgreSQL service. Keep the database connection string in the host environment, not in the frontend.

## 3. Domain and HTTPS configuration

Once the domain is registered and the hosting provider supports custom domains:

1. Add the domain to Vercel.
2. Complete the domain verification flow in Vercel.
3. Configure the DNS records with the registrar.
4. Confirm the certificate is issued and HTTPS is active.

Do not mark the domain as connected until the verification step is complete.

### DNS record guidance

For the root domain (zeraworld.com):

- A record or ALIAS to the Vercel IPs / Vercel DNS target, depending on the registrar.
- If the registrar supports ALIAS, use that for the apex domain.

For www:

- CNAME to cname.vercel-dns.com

This project is configured for a canonical-domain redirect when APP_URL is set, so www requests can be redirected to the root domain once the live domain is verified.

## 4. Redirect behavior

The app uses a configurable redirect rule driven by APP_URL/NEXT_PUBLIC_APP_URL. It does not assume a live domain until the production URL is set and the domain is verified.

## 5. Secure cookies and production behavior

Production cookies use HTTPS-only settings when the app is running under an HTTPS URL. The app also sets security headers for production deployments to keep the session and application metadata protected.

## 6. Verification checklist before launch

Before claiming the website is live:

- [ ] Domain is purchased and active
- [ ] DNS records are propagated
- [ ] Vercel custom domain is verified
- [ ] HTTPS certificate is issued successfully
- [ ] Database connection works in production
- [ ] App URL and NEXT_PUBLIC_APP_URL match the deployed domain
- [ ] Login and dashboard work on the live domain

## 7. Production provider notes

Useful providers:

- Vercel for app hosting
- Neon or Supabase for PostgreSQL
- Cloudflare for DNS when desired

Vercel is the simplest path for this Next.js deployment because it supports custom domains, HTTPS, and environment variables directly.
