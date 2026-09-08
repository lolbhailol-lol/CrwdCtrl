# Security Policy

## Supported versions

Security fixes are applied on the `master` branch of this repository and to the production deployment at [www.crwdctrl.in](https://www.crwdctrl.in).

## Reporting a vulnerability

**Do not open a public GitHub issue for security reports** (especially anything involving auth bypass, payment abuse, or data exposure).

Please email the maintainer via the contact details on [crwdctrl.in](https://www.crwdctrl.in/contact-us) or open a **private** GitHub security advisory on this repo if available.

Include:

- Steps to reproduce
- Impact (what an attacker could do)
- Affected URL / endpoint if known
- Your contact for follow-up

We aim to acknowledge reports within a few days.

## Secrets & configuration

- Never commit `.env` files. Use `.env.example` templates only.
- Frontend `VITE_*` values are public by design (Firebase web config, etc.). Restrict API keys in Google Cloud / Firebase consoles.
- Backend secrets (MongoDB, JWT, payment keys, Firebase Admin, email) must live only in the host environment (e.g. Railway).

## Scope notes

This is an active product codebase shared as a portfolio / open reference. Forks should rotate all credentials and use their own Firebase, MongoDB, and payment projects.
