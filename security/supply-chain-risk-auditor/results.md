# Supply Chain Risk Audit - PrivateMPP

**Project:** PrivateMPP  
**Date:** 2026-05-08  
**Auditor:** Claude Code

---

## Executive Summary

PrivateMPP uses **10 external dependencies** across its monorepo packages. After evaluating each against the risk criteria, **no high-risk dependencies** were identified. All dependencies are either:

- Backed by established organizations (Vercel, Meta, OpenRouter)
- Highly popular with active maintenance (Zod: 42k+ stars)
- Maintained by known teams with good security practices (wevm, modelcontextprotocol)

**Overall Security Posture: GOOD**

---

## Dependencies Analyzed

### Direct Dependencies (Production)

| Package | Version | Stars | Maintainer | Risk Level |
|---------|---------|------|------------|------------|
| @modelcontextprotocol/sdk | ^1.25.0 | ~12,400 | modelcontextprotocol org | LOW |
| mppx | ^0.6.16 | ~117 | wevm org | LOW |
| next.js | ^15.1.6 | ~139,000 | Vercel | LOW |
| react | ^19.0.0 | — | Meta | LOW |
| react-dom | ^19.0.0 | — | Meta | LOW |
| zod | ^3.24.1 | ~42,600 | colinhacks (individual) | LOW |
| viem | ^2.47.5 | ~3,500 | wevm org | LOW |
| @openrouter/sdk | ^0.12.35 | ~182 | OpenRouterTeam | LOW |

### Dev Dependencies

| Package | Version | Stars | Maintainer | Risk Level |
|---------|---------|------|------------|------------|
| typescript | ^5.7.3 | — | Microsoft | LOW |
| @types/node | ^22.10.5 | — | Microsoft | LOW |
| @types/react | ^19.0.6 | — | Meta | LOW |
| @types/react-dom | ^19.0.2 | — | Meta | LOW |
| tsx | ^4.19.2 | — |privy-open-source | LOW |

---

## High-Risk Dependencies

**None identified.**

---

## Risk Factor Counts

| Risk Factor | Count |
|-------------|-------|
| Single maintainer (individual) | 1 (zod) |
| Unmaintained | 0 |
| Low popularity | 0 |
| High-risk features (FFI/deserialization) | 0 |
| CVEs present | 0 |
| No security contact | 0 |

---

## Analysis Notes

### Zod (colinhacks)

- **Risk Factor:** Single maintainer (colinhacks)
- **Mitigation:** Despite being a single maintainer, Zod has ~42,600 stars and is one of the most popular TypeScript libraries. The maintainer (Colin) is a well-known, prolific contributor in the TypeScript ecosystem. The project has:
  - Active maintenance (updated 2026-05-07)
  - Large community usage (high likelihood of catching issues)
  - No significant CVE history relative to its popularity

### wevm Organization (mppx, viem)

- Both mppx and viem are maintained by the wevm organization, which specializes in TypeScript interfaces for Ethereum/wallet standards
- Active development with recent updates
- Well-established in the Ethereum development ecosystem

### modelcontextprotocol (MCP SDK)

- Official MCP protocol SDK maintained by the Model Context Protocol organization
- 12k+ stars, strong community adoption
- Recently active (updated 2026-05-07)

---

## Recommendations

1. **Continue monitoring Zod** - While currently low-risk due to popularity, any decision to introduce deserialization features should trigger additional scrutiny

2. **Pin dependency versions** - Ensure reproducible builds by pinning exact versions in production deployments

3. **Monitor for CVE announcements** - Subscribe to security advisories for:
   - zod (npm audit)
   - viem (wevm security)
   - next.js (Vercel security)

4. **Consider dependency review in CI** - Add periodic supply chain checks to your pipeline

---

## Conclusion

PrivateMPP's dependencies are well-vetted, actively maintained projects from reputable sources. No supply chain risks were identified that would warrant concern for using this codebase in production.