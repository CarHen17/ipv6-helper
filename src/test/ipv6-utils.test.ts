import { describe, it, expect } from 'vitest';
import {
  validateIPv6,
  expandIPv6Address,
  shortenIPv6,
  ipv6ToBigInt,
  formatIPv6Address,
  canAggregateBlocks,
  compareBlocks,
  isValidIPv6Format,
  isValidIPv6Address,
  findSubnetForIP,
  generateIPs,
  type BlockData,
  type SubnetData,
} from '../lib/ipv6-utils';

// ---------------------------------------------------------------------------
// validateIPv6
// ---------------------------------------------------------------------------
describe('validateIPv6', () => {
  it('rejects empty string', () => {
    const err = validateIPv6('');
    expect(err).not.toBeNull();
    expect(err!.code).toBe('EMPTY');
  });

  it('rejects whitespace-only string', () => {
    const err = validateIPv6('   ');
    expect(err).not.toBeNull();
    expect(err!.code).toBe('EMPTY');
  });

  it('rejects plain IPv4 address', () => {
    const err = validateIPv6('192.168.0.1/24');
    expect(err).not.toBeNull();
    expect(err!.code).toBe('IPV4_DETECTED');
  });

  it('rejects IPv4 without prefix', () => {
    const err = validateIPv6('10.0.0.1');
    expect(err).not.toBeNull();
    expect(err!.code).toBe('IPV4_DETECTED');
  });

  it('rejects missing CIDR prefix', () => {
    const err = validateIPv6('2001:db8::');
    expect(err).not.toBeNull();
    expect(err!.code).toBe('MISSING_PREFIX');
  });

  it('rejects prefix below 1', () => {
    const err = validateIPv6('2001:db8::/0');
    expect(err).not.toBeNull();
    expect(err!.code).toBe('PREFIX_RANGE');
  });

  it('rejects prefix above 128', () => {
    const err = validateIPv6('2001:db8::/129');
    expect(err).not.toBeNull();
    expect(err!.code).toBe('PREFIX_RANGE');
  });

  it('rejects invalid hex characters', () => {
    const err = validateIPv6('2001:zzzz::/32');
    expect(err).not.toBeNull();
    expect(err!.code).toBe('WRONG_FORMAT');
  });

  it('rejects triple colon', () => {
    const err = validateIPv6('2001:::db8/32');
    expect(err).not.toBeNull();
    expect(err!.code).toBe('WRONG_FORMAT');
  });

  it('rejects two double-colon occurrences', () => {
    const err = validateIPv6('2001::db8::1/32');
    expect(err).not.toBeNull();
    expect(err!.code).toBe('WRONG_FORMAT');
  });

  it('accepts a well-known /32 documentation block', () => {
    expect(validateIPv6('2001:db8::/32')).toBeNull();
  });

  it('accepts full 8-group address with /128', () => {
    expect(validateIPv6('2001:0db8:0000:0000:0000:0000:0000:0001/128')).toBeNull();
  });

  it('accepts loopback address', () => {
    expect(validateIPv6('::1/128')).toBeNull();
  });

  it('accepts unspecified address with prefix /1', () => {
    expect(validateIPv6('::/1')).toBeNull();
  });

  it('accepts /48 typical ISP allocation', () => {
    expect(validateIPv6('2001:db8:1234::/48')).toBeNull();
  });

  it('accepts /64 standard subnet', () => {
    expect(validateIPv6('fe80::/64')).toBeNull();
  });

  it('accepts leading zeros in groups', () => {
    expect(validateIPv6('0064:ff9b::/96')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// expandIPv6Address
// ---------------------------------------------------------------------------
describe('expandIPv6Address', () => {
  it('expands loopback ::1', () => {
    expect(expandIPv6Address('::1/128')).toBe('0000:0000:0000:0000:0000:0000:0000:0001');
  });

  it('expands unspecified ::', () => {
    expect(expandIPv6Address('::/128')).toBe('0000:0000:0000:0000:0000:0000:0000:0000');
  });

  it('expands link-local prefix', () => {
    expect(expandIPv6Address('fe80::/64')).toBe('fe80:0000:0000:0000:0000:0000:0000:0000');
  });

  it('expands documentation block', () => {
    expect(expandIPv6Address('2001:db8::/32')).toBe('2001:0db8:0000:0000:0000:0000:0000:0000');
  });

  it('expands full 8-group address unchanged', () => {
    const full = '2001:0db8:0000:0000:0000:0000:0000:0001/128';
    expect(expandIPv6Address(full)).toBe('2001:0db8:0000:0000:0000:0000:0000:0001');
  });

  it('expands :: in the middle', () => {
    expect(expandIPv6Address('2001:db8::1/128')).toBe('2001:0db8:0000:0000:0000:0000:0000:0001');
  });

  it('expands :: at the beginning', () => {
    expect(expandIPv6Address('::ffff/128')).toBe('0000:0000:0000:0000:0000:0000:0000:ffff');
  });

  it('expands :: at the end', () => {
    expect(expandIPv6Address('2001:db8::/128')).toBe('2001:0db8:0000:0000:0000:0000:0000:0000');
  });

  it('returns error string for two double-colon occurrences', () => {
    // 2001::db8::1 has two :: → more than 2 parts when split by ::
    const result = expandIPv6Address('2001::db8::1/128');
    expect(result).toMatch(/^Erro/);
  });

  it('returns error string for too many groups', () => {
    const result = expandIPv6Address('1:2:3:4:5:6:7:8:9/128');
    expect(result).toMatch(/^Erro/);
  });
});

// ---------------------------------------------------------------------------
// shortenIPv6
// ---------------------------------------------------------------------------
describe('shortenIPv6', () => {
  it('compresses loopback to ::1', () => {
    expect(shortenIPv6('0000:0000:0000:0000:0000:0000:0000:0001')).toBe('::1');
  });

  it('compresses unspecified to ::', () => {
    expect(shortenIPv6('0000:0000:0000:0000:0000:0000:0000:0000')).toBe('::');
  });

  it('compresses all-ones to ffff::... notation', () => {
    expect(shortenIPv6('ffff:0000:0000:0000:0000:0000:0000:0000')).toBe('ffff::');
  });

  it('compresses documentation address correctly', () => {
    expect(shortenIPv6('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe('2001:db8::1');
  });

  it('strips leading zeros from each group', () => {
    expect(shortenIPv6('0064:ff9b:0000:0000:0000:0000:0000:0000')).toBe('64:ff9b::');
  });

  it('does not compress a single zero group (len < 2)', () => {
    // 2001:db8:0:1:2:3:4:5 — only one zero group, should not use ::
    expect(shortenIPv6('2001:0db8:0000:0001:0002:0003:0004:0005')).toBe('2001:db8:0:1:2:3:4:5');
  });

  it('picks the longest run of zeros (RFC 5952)', () => {
    // 2001:0:0:1:0:0:0:1 — runs of 2 and 3; should compress the run of 3
    expect(shortenIPv6('2001:0000:0000:0001:0000:0000:0000:0001')).toBe('2001:0:0:1::1');
  });

  it('returns address unchanged when already contains ::', () => {
    expect(shortenIPv6('2001:db8::1')).toBe('2001:db8::1');
  });

  it('handles empty/null-like inputs gracefully', () => {
    expect(shortenIPv6('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// ipv6ToBigInt
// ---------------------------------------------------------------------------
describe('ipv6ToBigInt', () => {
  it('converts loopback ::1 to 1n', () => {
    expect(ipv6ToBigInt('::1')).toBe(1n);
  });

  it('converts unspecified :: to 0n', () => {
    expect(ipv6ToBigInt('::')).toBe(0n);
  });

  it('converts all-F address to 2^128 - 1', () => {
    const max = (1n << 128n) - 1n;
    expect(ipv6ToBigInt('ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff')).toBe(max);
  });

  it('converts full expanded address correctly', () => {
    expect(ipv6ToBigInt('2001:0db8:0000:0000:0000:0000:0000:0001')).toBeGreaterThan(0n);
  });

  it('produces same BigInt for compressed and expanded forms', () => {
    const compact = ipv6ToBigInt('2001:db8::1');
    const expanded = ipv6ToBigInt('2001:0db8:0000:0000:0000:0000:0000:0001');
    expect(compact).toBe(expanded);
  });

  it('throws on invalid address', () => {
    expect(() => ipv6ToBigInt('not-an-address')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// formatIPv6Address
// ---------------------------------------------------------------------------
describe('formatIPv6Address', () => {
  it('formats 0n as all-zero address', () => {
    expect(formatIPv6Address(0n)).toBe('0000:0000:0000:0000:0000:0000:0000:0000');
  });

  it('formats 1n as loopback expanded form', () => {
    expect(formatIPv6Address(1n)).toBe('0000:0000:0000:0000:0000:0000:0000:0001');
  });

  it('formats max value (2^128-1) as all-F address', () => {
    const max = (1n << 128n) - 1n;
    expect(formatIPv6Address(max)).toBe('ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff');
  });

  it('is inverse of ipv6ToBigInt for expanded addresses', () => {
    const original = '2001:0db8:0000:0000:0000:0000:0000:0001';
    expect(formatIPv6Address(ipv6ToBigInt(original))).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// canAggregateBlocks
// ---------------------------------------------------------------------------
describe('canAggregateBlocks', () => {
  it('rejects fewer than 2 blocks', () => {
    const block: BlockData = { network: '2001:db8::', prefix: 64 };
    const result = canAggregateBlocks([block]);
    expect(result.canAggregate).toBe(false);
  });

  it('rejects blocks with different prefixes', () => {
    const blocks: BlockData[] = [
      { network: '2001:db8::', prefix: 64 },
      { network: '2001:db8:0:1::', prefix: 65 },
    ];
    expect(canAggregateBlocks(blocks).canAggregate).toBe(false);
  });

  it('rejects non-power-of-2 block count', () => {
    const blocks: BlockData[] = [
      { network: '2001:db8::', prefix: 64 },
      { network: '2001:db8:0:1::', prefix: 64 },
      { network: '2001:db8:0:2::', prefix: 64 },
    ];
    expect(canAggregateBlocks(blocks).canAggregate).toBe(false);
  });

  it('rejects non-consecutive blocks', () => {
    const blocks: BlockData[] = [
      { network: '2001:db8::', prefix: 64 },
      { network: '2001:db8:0:2::', prefix: 64 }, // gap at index 1
    ];
    expect(canAggregateBlocks(blocks).canAggregate).toBe(false);
  });

  it('rejects misaligned first block', () => {
    // 2001:db8:0:1::/64 is at index 1; aggregating 2 blocks from /64 requires
    // alignment to /63, so the first block must start at an even /64 boundary
    const blocks: BlockData[] = [
      { network: '2001:db8:0:1::', prefix: 64 },
      { network: '2001:db8:0:2::', prefix: 64 },
    ];
    // These ARE consecutive but block at index 1 is not aligned for /63
    expect(canAggregateBlocks(blocks).canAggregate).toBe(false);
  });

  it('aggregates 2 aligned consecutive /64 blocks into /63', () => {
    const blocks: BlockData[] = [
      { network: '2001:db8::', prefix: 64 },
      { network: '2001:db8:0:1::', prefix: 64 },
    ];
    const result = canAggregateBlocks(blocks);
    expect(result.canAggregate).toBe(true);
    expect(result.aggregatedBlock!.prefix).toBe(63);
    expect(result.aggregatedBlock!.blockCount).toBe(2);
  });

  it('aggregates 4 aligned consecutive /64 blocks into /62', () => {
    const blocks: BlockData[] = [
      { network: '2001:db8::', prefix: 64 },
      { network: '2001:db8:0:1::', prefix: 64 },
      { network: '2001:db8:0:2::', prefix: 64 },
      { network: '2001:db8:0:3::', prefix: 64 },
    ];
    const result = canAggregateBlocks(blocks);
    expect(result.canAggregate).toBe(true);
    expect(result.aggregatedBlock!.prefix).toBe(62);
    expect(result.aggregatedBlock!.blockCount).toBe(4);
  });

  it('aggregates 2 /48 blocks into /47', () => {
    const blocks: BlockData[] = [
      { network: '2001:db8::', prefix: 48 },
      { network: '2001:db8:1::', prefix: 48 },
    ];
    const result = canAggregateBlocks(blocks);
    expect(result.canAggregate).toBe(true);
    expect(result.aggregatedBlock!.prefix).toBe(47);
  });

  it('works regardless of input order (sorts internally)', () => {
    const blocks: BlockData[] = [
      { network: '2001:db8:0:1::', prefix: 64 },
      { network: '2001:db8::', prefix: 64 },
    ];
    const result = canAggregateBlocks(blocks);
    expect(result.canAggregate).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// compareBlocks
// ---------------------------------------------------------------------------
describe('compareBlocks', () => {
  it('identifies identical blocks', () => {
    const b: BlockData = { network: '2001:db8::', prefix: 32 };
    const result = compareBlocks(b, b);
    expect(result.relationship).toBe('identical');
  });

  it('identifies b2 contained in b1', () => {
    const b1: BlockData = { network: '2001:db8::', prefix: 32 };
    const b2: BlockData = { network: '2001:db8:1::', prefix: 48 };
    const result = compareBlocks(b1, b2);
    expect(result.relationship).toBe('b2_in_b1');
  });

  it('identifies b1 contained in b2', () => {
    const b1: BlockData = { network: '2001:db8:1::', prefix: 48 };
    const b2: BlockData = { network: '2001:db8::', prefix: 32 };
    const result = compareBlocks(b1, b2);
    expect(result.relationship).toBe('b1_in_b2');
  });

  it('identifies disjoint blocks', () => {
    const b1: BlockData = { network: '2001:db8::', prefix: 32 };
    const b2: BlockData = { network: '2001:db9::', prefix: 32 };
    const result = compareBlocks(b1, b2);
    expect(result.relationship).toBe('disjoint');
  });

  it('identifies two identical /128 hosts as identical', () => {
    const b: BlockData = { network: '2001:db8::1', prefix: 128 };
    expect(compareBlocks(b, b).relationship).toBe('identical');
  });

  it('returns correct size values', () => {
    const b1: BlockData = { network: '2001:db8::', prefix: 32 };
    const b2: BlockData = { network: '2001:db8::', prefix: 32 };
    const result = compareBlocks(b1, b2);
    // /32 has 2^96 addresses
    expect(result.size1).toBe(1n << 96n);
    expect(result.size2).toBe(1n << 96n);
  });
});

// ---------------------------------------------------------------------------
// isValidIPv6Format
// ---------------------------------------------------------------------------
describe('isValidIPv6Format', () => {
  it('accepts full 8-group address', () => {
    expect(isValidIPv6Format('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe(true);
  });

  it('accepts :: compressed address', () => {
    expect(isValidIPv6Format('2001:db8::1')).toBe(true);
  });

  it('accepts ::', () => {
    expect(isValidIPv6Format('::')).toBe(true);
  });

  it('rejects triple colon', () => {
    expect(isValidIPv6Format('2001:::1')).toBe(false);
  });

  it('rejects address with 9 groups', () => {
    expect(isValidIPv6Format('1:2:3:4:5:6:7:8:9')).toBe(false);
  });

  it('rejects invalid hex char', () => {
    expect(isValidIPv6Format('2001:zzzz::1')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidIPv6Address
// ---------------------------------------------------------------------------
describe('isValidIPv6Address', () => {
  it('accepts valid address without prefix', () => {
    expect(isValidIPv6Address('2001:db8::1')).toBe(true);
  });

  it('accepts address with prefix notation', () => {
    expect(isValidIPv6Address('2001:db8::/32')).toBe(true);
  });

  it('rejects plain IPv4', () => {
    expect(isValidIPv6Address('192.168.1.1')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidIPv6Address('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// findSubnetForIP
// ---------------------------------------------------------------------------
describe('findSubnetForIP', () => {
  const subnets: SubnetData[] = [
    {
      subnet: '2001:db8::/64',
      network: '2001:0db8:0000:0000:0000:0000:0000:0000',
      initial: '2001:db8::',
      final: '2001:db8::ffff:ffff:ffff:ffff',
    },
    {
      subnet: '2001:db8:0:1::/64',
      network: '2001:0db8:0000:0001:0000:0000:0000:0000',
      initial: '2001:db8:0:1::',
      final: '2001:db8:0:1:ffff:ffff:ffff:ffff',
    },
  ];

  it('finds an IP in the first subnet', () => {
    const result = findSubnetForIP('2001:db8::1', subnets);
    expect(result.found).toBe(true);
    expect(result.subnet!.subnet).toBe('2001:db8::/64');
  });

  it('finds an IP in the second subnet', () => {
    const result = findSubnetForIP('2001:db8:0:1::1', subnets);
    expect(result.found).toBe(true);
    expect(result.subnet!.subnet).toBe('2001:db8:0:1::/64');
  });

  it('returns not found for IP outside all subnets', () => {
    const result = findSubnetForIP('2001:db9::1', subnets);
    expect(result.found).toBe(false);
  });

  it('returns error for invalid IP', () => {
    const result = findSubnetForIP('not-an-ip', subnets);
    expect(result.found).toBe(false);
  });

  it('returns index 0 for match in first subnet', () => {
    const result = findSubnetForIP('2001:db8::ff', subnets);
    expect(result.index).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// generateIPs
// ---------------------------------------------------------------------------
describe('generateIPs', () => {
  it('generates IPs starting from offset 0', () => {
    const ips = generateIPs('2001:0db8:0000:0000:0000:0000:0000:0000', 0, 3);
    expect(ips).toHaveLength(3);
    expect(ips[0].number).toBe(1);
    expect(ips[1].number).toBe(2);
    expect(ips[2].number).toBe(3);
  });

  it('offset 0 from zero network is :: (network address itself)', () => {
    // generateIPs adds offset to the network BigInt, so offset=0 → the network
    // address (::/128 = 0n), not ::1
    const ips = generateIPs('0000:0000:0000:0000:0000:0000:0000:0000', 0, 1);
    expect(ips[0].ip).toBe('::');
  });

  it('offset 1 from zero network is ::1', () => {
    const ips = generateIPs('0000:0000:0000:0000:0000:0000:0000:0000', 1, 1);
    expect(ips[0].ip).toBe('::1');
  });

  it('generates IPs from an offset', () => {
    const ips = generateIPs('2001:0db8:0000:0000:0000:0000:0000:0000', 10, 2);
    expect(ips[0].number).toBe(11);
    expect(ips[1].number).toBe(12);
  });

  it('IP values increment by 1 each step', () => {
    const ips = generateIPs('2001:0db8:0000:0000:0000:0000:0000:0000', 0, 5);
    for (let i = 1; i < ips.length; i++) {
      const prev = ipv6ToBigInt(ips[i - 1].ip);
      const curr = ipv6ToBigInt(ips[i].ip);
      expect(curr - prev).toBe(1n);
    }
  });
});
