# AG Digital Hub — ag-digitalhub.eu

Site statique B2B pour garages automobiles (BE/FR/LU). Génération de rendez-vous via système automatisé.

## Stack

- HTML / CSS / JS (vanilla) — aucun framework
- PHP (`submit.php`) — formulaire de contact avec rate limiting
- Hébergement : Hostinger hPanel (Business Hosting)

## Structure

```
├── index.html                      # Page principale
├── mentions-legales.html           # Mentions légales
├── politique-de-confidentialite.html
├── conditions-generales.html       # CGV
├── submit.php                      # Backend formulaire (PHP)
├── assets/
│   └── main.js                     # JS externalisé (IntersectionObserver + form)
├── .htaccess                       # Headers sécurité + HTTPS redirect + cache
├── .well-known/
│   └── security.txt                # RFC 9116
├── robots.txt
├── sitemap.xml
├── favicon.png
└── og-image.jpg
```

## Déploiement

Déploiement manuel via MCP Hostinger ou hPanel :

```bash
zip -r deploy.zip . --exclude "*.zip" --exclude ".git/*" --exclude "README.md"
# Puis upload via hPanel File Manager ou API Hostinger
```

## Sécurité

- CSP : `script-src 'self'` (pas d'inline JS)
- HSTS : `max-age=31536000; includeSubDomains; preload`
- CORP / COOP : `same-origin`
- Rate limiting PHP : 5 req/min par IP
- Validation téléphone regex + neutralisation header injection
- Consentement RGPD validé côté serveur

## Responsable

Nadine Guiza — [contact@ag-digitalhub.eu](mailto:contact@ag-digitalhub.eu)
