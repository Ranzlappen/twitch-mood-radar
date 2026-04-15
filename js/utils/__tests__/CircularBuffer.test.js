import { describe, it, expect } from 'vitest';
import { CircularBuffer } from '../CircularBuffer.js';

describe('CircularBuffer', () => {
  it('push and shift maintain FIFO order', () => {
    const buf = new CircularBuffer(4);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    expect(buf.shift()).toBe(1);
    expect(buf.shift()).toBe(2);
    expect(buf.shift()).toBe(3);
    expect(buf.shift()).toBeUndefined();
  });

  it('tracks length correctly', () => {
    const buf = new CircularBuffer(4);
    expect(buf.length).toBe(0);
    buf.push('a');
    expect(buf.length).toBe(1);
    buf.push('b');
    expect(buf.length).toBe(2);
    buf.shift();
    expect(buf.length).toBe(1);
    buf.shift();
    expect(buf.length).toBe(0);
  });

  it('peekFirst returns oldest without removing', () => {
    const buf = new CircularBuffer(4);
    buf.push(10);
    buf.push(20);
    expect(buf.peekFirst()).toBe(10);
    expect(buf.length).toBe(2); // not removed
  });

  it('peekFirst returns undefined when empty', () => {
    const buf = new CircularBuffer(4);
    expect(buf.peekFirst()).toBeUndefined();
  });

  it('auto-grows when capacity is exceeded', () => {
    const buf = new CircularBuffer(2);
    buf.push(1);
    buf.push(2);
    buf.push(3); // triggers grow
    expect(buf.length).toBe(3);
    expect(buf.shift()).toBe(1);
    expect(buf.shift()).toBe(2);
    expect(buf.shift()).toBe(3);
  });

  it('wraps around correctly', () => {
    const buf = new CircularBuffer(4);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    buf.shift(); // remove 1
    buf.shift(); // remove 2
    buf.push(4);
    buf.push(5);
    buf.push(6); // now wraps around
    expect(buf.shift()).toBe(3);
    expect(buf.shift()).toBe(4);
    expect(buf.shift()).toBe(5);
    expect(buf.shift()).toBe(6);
  });

  it('clear resets to empty', () => {
    const buf = new CircularBuffer(4);
    buf.push(1);
    buf.push(2);
    buf.clear();
    expect(buf.length).toBe(0);
    expect(buf.shift()).toBeUndefined();
  });

  it('countWhere counts matching items', () => {
    const buf = new CircularBuffer(8);
    buf.push(1);
    buf.push(5);
    buf.push(10);
    buf.push(15);
    expect(buf.countWhere(v => v >= 10)).toBe(2);
    expect(buf.countWhere(v => v > 100)).toBe(0);
  });

  it('is iterable with for...of', () => {
    const buf = new CircularBuffer(4);
    buf.push('a');
    buf.push('b');
    buf.push('c');
    const result = [];
    for (const item of buf) result.push(item);
    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('get returns item by logical index', () => {
    const buf = new CircularBuffer(4);
    buf.push(10);
    buf.push(20);
    buf.push(30);
    expect(buf.get(0)).toBe(10);
    expect(buf.get(1)).toBe(20);
    expect(buf.get(2)).toBe(30);
    expect(buf.get(3)).toBeUndefined();
    expect(buf.get(-1)).toBeUndefined();
  });

  it('handles large volume of push/shift cycles', () => {
    const buf = new CircularBuffer(16);
    for (let i = 0; i < 10000; i++) {
      buf.push(i);
      if (buf.length > 100) buf.shift();
    }
    expect(buf.length).toBe(100);
    expect(buf.peekFirst()).toBe(9900);
  });
});
