const net = require('net');

const BLOCKED_HOSTNAMES = new Set([
    'metadata.google.internal',
    'metadata.goog',
    'metadata.azure.com',
    'instance-data',
    'metadata',
]);

const BLOCKED_TLDS = [
    '.local',
    '.internal',
    '.lan',
    '.corp',
    '.home',
    '.intranet',
    '.arpa',
    '.localdomain',
    '.svc',
    '.cluster',
];

const DEV_LOOPBACK_HOSTS = new Set([
    'localhost',
    '127.0.0.1',
    '::1',
    '0:0:0:0:0:0:0:1',
    'host.docker.internal',
]);

function isBlockedIpv4(ip) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
        return true;
    }

    const [a, b] = parts;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a === 127) return true; // 127.0.0.0/8
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 192 && b === 0 && (parts[2] === 0 || parts[2] === 2)) return true;
    if (a === 198 && (b === 18 || b === 19)) return true; // Benchmarking
    if (a === 198 && b === 51 && parts[2] === 100) return true;
    if (a === 203 && b === 0 && parts[2] === 113) return true;
    if (a >= 224) return true; // Multicast & reserved

    return false;
}

function extractMappedIpv4(ipv6) {
    const lower = ipv6.toLowerCase();
    const mappedPrefix = '::ffff:';
    if (!lower.startsWith(mappedPrefix)) return null;

    const suffix = lower.slice(mappedPrefix.length);
    if (net.isIPv4(suffix)) {
        return suffix;
    }

    // Handle hex representation (e.g., ::ffff:a9fe:a9fe)
    const hexGroups = suffix.split(':');
    if (hexGroups.length === 2 && hexGroups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) {
        const hi = parseInt(hexGroups[0], 16);
        const lo = parseInt(hexGroups[1], 16);
        return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    }

    return null;
}

function isBlockedIpv6(ip) {
    const lower = ip.toLowerCase();
    if (lower === '::' || lower === '0:0:0:0:0:0:0:0') return true;
    if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;

    const mappedV4 = extractMappedIpv4(lower);
    if (mappedV4) {
        return isBlockedIpv4(mappedV4);
    }

    const firstHextet = lower.split(':')[0];
    if (firstHextet) {
        const val = parseInt(firstHextet, 16);
        if (!Number.isNaN(val)) {
            if ((val & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
            if ((val & 0xfe00) === 0xfc00) return true; // fc00::/7 ULA
            if ((val & 0xff00) === 0xff00) return true; // ff00::/8 multicast
        }
    }

    return false;
}

/**
 * Validates custom upstream OpenAI-compatible target URLs to prevent SSRF attacks
 * while optionally permitting loopback targets during local development.
 */
function validateTargetUrl(rawUrl, options = {}) {
    if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
        return { valid: false, reason: 'Target URL must be a non-empty string.' };
    }

    const trimmed = rawUrl.trim();
    if (trimmed.length > 2048) {
        return { valid: false, reason: 'Target URL exceeds maximum length.' };
    }

    // Block ASCII control chars or whitespace injection inside URL
    const hasControlOrWhitespace = /\s/.test(trimmed) || [...trimmed].some((ch) => {
        const code = ch.charCodeAt(0);
        return code < 32 || code === 127;
    });
    if (hasControlOrWhitespace) {
        return { valid: false, reason: 'Target URL contains invalid control or whitespace characters.' };
    }

    let parsed;
    try {
        parsed = new URL(trimmed);
    } catch {
        return { valid: false, reason: 'Target URL is not a valid URL.' };
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { valid: false, reason: `Unsupported protocol "${parsed.protocol}". Only HTTP and HTTPS are allowed.` };
    }

    if (parsed.username || parsed.password) {
        return { valid: false, reason: 'Embedded credentials in Target URL are not permitted.' };
    }

    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
    if (!hostname) {
        return { valid: false, reason: 'Target URL must include a valid hostname.' };
    }

    if (BLOCKED_HOSTNAMES.has(hostname)) {
        return { valid: false, reason: `Target hostname "${hostname}" is blocked for security reasons.` };
    }

    const allowLocal = options.allowLocal ?? (process.env.ALLOW_LOCAL_TARGETS !== 'false');

    if (DEV_LOOPBACK_HOSTS.has(hostname)) {
        if (!allowLocal) {
            return { valid: false, reason: 'Local loopback targets are disabled in this environment.' };
        }
        return { valid: true, normalizedUrl: parsed.href };
    }

    const ipVersion = net.isIP(hostname);
    if (ipVersion === 4) {
        if (isBlockedIpv4(hostname)) {
            return { valid: false, reason: `Private or reserved IPv4 target "${hostname}" is not permitted.` };
        }
        return { valid: true, normalizedUrl: parsed.href };
    }

    if (ipVersion === 6) {
        if (isBlockedIpv6(hostname)) {
            return { valid: false, reason: `Private or reserved IPv6 target "${hostname}" is not permitted.` };
        }
        return { valid: true, normalizedUrl: parsed.href };
    }

    // Domain name validation
    if (hostname.includes('..') || !hostname.includes('.')) {
        return { valid: false, reason: `Single-label or malformed hostname "${hostname}" is not permitted.` };
    }

    for (const tld of BLOCKED_TLDS) {
        if (hostname === tld.slice(1) || hostname.endsWith(tld)) {
            return { valid: false, reason: `Internal domain "${hostname}" is not permitted.` };
        }
    }

    if (hostname.endsWith('.localhost')) {
        if (!allowLocal) {
            return { valid: false, reason: 'Local loopback targets are disabled in this environment.' };
        }
        return { valid: true, normalizedUrl: parsed.href };
    }

    return { valid: true, normalizedUrl: parsed.href };
}

module.exports = { validateTargetUrl };

