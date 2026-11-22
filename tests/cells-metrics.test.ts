import { describe, expect, it } from 'vitest';
import { isGroupedNumber, norm, parseAsOn, toNumCell, toTextCell } from '@/lib/data/cells';
import { parseSegmentHeader } from '@/lib/data/parse';
import { achievementRatio, compare, outstandingState, statusFromRatio, variance } from '@/lib/metrics';
import { bucketKey, isOver120 } from '@/lib/selectors';

describe('numeric cells keep the source figure', () => {
  it('passes real numbers through unchanged', () => {
    expect(toNumCell(176000000, 'x').value).toBe(176000000);
    expect(toNumCell(0.67, 'x').value).toBe(0.67);
    expect(toNumCell(0, 'x')).toMatchObject({ status: 'ok', value: 0 });
  });
  it('reads correctly grouped numbers typed as text (Google Sheet stores INR as text)', () => {
    expect(toNumCell('17,60,00,000', 'x')).toMatchObject({ status: 'ok', value: 176000000, fromText: true });
    expect(toNumCell('-6,23,20,000', 'x')).toMatchObject({ status: 'ok', value: -62320000 });
    expect(toNumCell('6,02,41,60,000', 'x').value).toBe(6024160000);
    expect(toNumCell('176,000,000', 'x').value).toBe(176000000);
    expect(toNumCell('45,000', 'x').value).toBe(45000);
    expect(toNumCell('120%', 'x').value).toBeCloseTo(1.2);
  });
  it('marks truncated / non-numeric text as needs clarification with no value', () => {
    for (const t of ['1,03', '1,52', 'TBD', '1,2,3', '12,34']) {
      const c = toNumCell(t, 'x');
      expect(c.status, t).toBe('needs_clarification');
      expect(c.value, t).toBeNull();
      expect(c.raw).toBe(t);
    }
    expect(isGroupedNumber('1,03')).toBe(false);
    expect(isGroupedNumber('1,03,000')).toBe(true);
  });
  it('treats blanks as empty, not zero', () => {
    expect(toNumCell(null, 'x')).toMatchObject({ status: 'empty', value: null });
    expect(toNumCell('  ', 'x')).toMatchObject({ status: 'empty', value: null });
  });
  it('keeps date text exactly as shown', () => {
    expect(toTextCell('01/12/2024', 'x').text).toBe('01/12/2024');
  });
});

describe('label matching', () => {
  it('normalises curly quotes, dashes and spacing', () => {
    expect(norm('Budget- April’26 Till June’26')).toBe(norm("Budget - April'26 Till June'26"));
    expect(norm('31 – 60 days')).toBe('31-60 days');
  });
  it('parses segment headers, including the sheet spelling "Residencial"', () => {
    expect(parseSegmentHeader('Nyati Elenor (Residencial)')).toEqual({ project: 'Nyati Elenor', segment: 'residential' });
    expect(parseSegmentHeader('Nyati Elenor (Commercial) INR')).toEqual({ project: 'Nyati Elenor', segment: 'commercial' });
    expect(parseSegmentHeader('Total')).toEqual({ project: null, segment: 'total' });
    expect(parseSegmentHeader('Nyati Elenor (Parking)')).toBeNull();
  });
  it('reads the "as on" date', () => {
    expect(parseAsOn('Parameter - As on 1st July 2026')).toEqual({ iso: '2026-07-01', label: '1st July 2026' });
    expect(parseAsOn('Parameter (in INR) - As on 01/07/2026')?.iso).toBe('2026-07-01');
    expect(parseAsOn('Parameter')).toBeNull();
  });
  it('normalises ageing buckets', () => {
    expect(bucketKey('01 – 30 days')).toBe('1-30');
    expect(bucketKey('0-30 days')).toBe('1-30');
    expect(bucketKey('> 120 days')).toBe('>120');
    expect(isOver120('>120 days')).toBe(true);
    expect(isOver120('91 – 120 days')).toBe(false);
  });
});

describe('variance and percentage logic', () => {
  it('variance = achieved − target', () => {
    expect(variance(49, 40)).toBe(9);
    expect(variance(63562, 95742)).toBe(-32180);
    expect(variance(null, 40)).toBeNull();
  });
  it('ratio = achieved ÷ target; >100% is valid; target 0 gives no ratio', () => {
    expect(achievementRatio(256000000, 152000000)).toBeCloseTo(1.684, 3);
    expect(achievementRatio(5, 0)).toBeNull();
  });
  it('status thresholds', () => {
    expect(statusFromRatio(1.68)).toBe('good');
    expect(statusFromRatio(1)).toBe('good');
    expect(statusFromRatio(0.85)).toBe('warning');
    expect(statusFromRatio(0.14)).toBe('critical');
    expect(statusFromRatio(null)).toBe('unknown');
  });
  it('negative outstanding is an advance, not an error', () => {
    expect(outstandingState(-39000000)).toBe('advance');
    expect(outstandingState(1000000)).toBe('outstanding');
    expect(outstandingState(0)).toBe('nil');
  });
  it('status uses the sheet % when present, never replacing it', () => {
    const c = compare(toNumCell(30, 'a'), toNumCell(23, 'b'), undefined, toNumCell(1, 'c'));
    expect(c.statusRatio).toBe(1);
    expect(c.computedRatio).toBeCloseTo(0.7667, 3);
    const unclear = compare(toNumCell('1,03', 'a'), toNumCell(18, 'b'));
    expect(unclear.status).toBe('unknown');
    expect(unclear.computedVariance).toBeNull();
  });
});
