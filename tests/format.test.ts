import { describe, expect, it } from 'vitest';
import {
  MINUS,
  formatArea,
  formatINR,
  formatINRAxis,
  formatINRFull,
  formatIndianNumber,
  formatPct,
  formatRate,
  formatSigned,
} from '@/lib/format';

describe('Indian number formatter', () => {
  it('groups digits the Indian way', () => {
    expect(formatIndianNumber(0)).toBe('0');
    expect(formatIndianNumber(999)).toBe('999');
    expect(formatIndianNumber(1000)).toBe('1,000');
    expect(formatIndianNumber(100000)).toBe('1,00,000');
    expect(formatIndianNumber(12345678)).toBe('1,23,45,678');
    expect(formatIndianNumber(6024160000)).toBe('6,02,41,60,000');
    expect(formatIndianNumber(816645)).toBe('8,16,645');
  });
  it('handles negatives and decimals', () => {
    expect(formatIndianNumber(-62320000)).toBe(`${MINUS}6,23,20,000`);
    expect(formatIndianNumber(1234.5, 2)).toBe('1,234.50');
    expect(formatIndianNumber(-0.001, 0)).toBe('0');
  });
  it('shows full rupees', () => {
    expect(formatINRFull(176000000)).toBe('₹17,60,00,000');
    expect(formatINRFull(-39000000)).toBe(`${MINUS}₹3,90,00,000`);
  });
  it('shows compact Cr / Lakh', () => {
    expect(formatINR(220000000)).toBe('₹22.00 Cr');
    expect(formatINR(2444300000)).toBe('₹244.43 Cr');
    expect(formatINR(1000000)).toBe('₹10.00 Lakh');
    expect(formatINR(45000)).toBe('₹45,000');
    expect(formatINR(-39000000)).toBe(`${MINUS}₹3.90 Cr`);
  });
  it('formats axis ticks briefly', () => {
    expect(formatINRAxis(0)).toBe('₹0');
    expect(formatINRAxis(500000000)).toBe('₹50 Cr');
    expect(formatINRAxis(25000000)).toBe('₹2.5 Cr');
    expect(formatINRAxis(4000000)).toBe('₹40 L');
  });
  it('formats area and rate', () => {
    expect(formatArea(95742)).toBe('95,742 sq.ft.');
    expect(formatRate(10932)).toBe('₹10,932/sq.ft.');
  });
});

describe('percentages', () => {
  it('displays ratios as percent; over 100% is valid', () => {
    expect(formatPct(1.2)).toBe('120%');
    expect(formatPct(1.68)).toBe('168%');
    expect(formatPct(0.67)).toBe('67%');
    expect(formatPct(0.14)).toBe('14%');
    expect(formatPct(0)).toBe('0%');
    expect(formatPct(0.7667, 1)).toBe('76.7%');
    expect(formatPct(-0.25)).toBe(`${MINUS}25%`);
  });
});

describe('signed variance', () => {
  it('prefixes + for positive and the minus sign for negative', () => {
    expect(formatSigned('units', 9)).toBe('+9');
    expect(formatSigned('area', -32180)).toBe(`${MINUS}32,180 sq.ft.`);
    expect(formatSigned('inr', 104000000)).toBe('+₹10.40 Cr');
    expect(formatSigned('units', 0)).toBe('0');
  });
});
