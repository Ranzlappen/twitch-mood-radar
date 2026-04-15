/**
 * CircularBuffer — O(1) push/shift replacement for arrays in hot paths.
 *
 * Standard Array.shift() is O(n) because it re-indexes all elements.
 * This buffer uses a fixed-size ring with head/tail pointers for O(1)
 * push (append) and shift (remove oldest). Auto-grows when full.
 */
export class CircularBuffer {
  /**
   * @param {number} [capacity=1024] — initial capacity (will double when full)
   */
  constructor(capacity = 1024) {
    this._buf = new Array(capacity);
    this._capacity = capacity;
    this._head = 0; // index of oldest element
    this._tail = 0; // index of next write position
    this._size = 0;
  }

  get length() { return this._size; }

  /**
   * Append an item to the end. O(1) amortized.
   */
  push(item) {
    if (this._size === this._capacity) this._grow();
    this._buf[this._tail] = item;
    this._tail = (this._tail + 1) % this._capacity;
    this._size++;
  }

  /**
   * Remove and return the oldest item. O(1).
   * @returns {*} the oldest item, or undefined if empty
   */
  shift() {
    if (this._size === 0) return undefined;
    const item = this._buf[this._head];
    this._buf[this._head] = undefined; // allow GC
    this._head = (this._head + 1) % this._capacity;
    this._size--;
    return item;
  }

  /**
   * Peek at the oldest item without removing. O(1).
   */
  peekFirst() {
    return this._size > 0 ? this._buf[this._head] : undefined;
  }

  /**
   * Access item by logical index (0 = oldest). O(1).
   */
  get(i) {
    if (i < 0 || i >= this._size) return undefined;
    return this._buf[(this._head + i) % this._capacity];
  }

  /**
   * Clear all items. O(1).
   */
  clear() {
    this._buf = new Array(this._capacity);
    this._head = 0;
    this._tail = 0;
    this._size = 0;
  }

  /**
   * Count items matching a predicate. O(n).
   */
  countWhere(predicate) {
    let count = 0;
    for (let i = 0; i < this._size; i++) {
      if (predicate(this._buf[(this._head + i) % this._capacity])) count++;
    }
    return count;
  }

  /**
   * Iterate all items oldest-to-newest.
   */
  *[Symbol.iterator]() {
    for (let i = 0; i < this._size; i++) {
      yield this._buf[(this._head + i) % this._capacity];
    }
  }

  /** @private */
  _grow() {
    const newCap = this._capacity * 2;
    const newBuf = new Array(newCap);
    for (let i = 0; i < this._size; i++) {
      newBuf[i] = this._buf[(this._head + i) % this._capacity];
    }
    this._buf = newBuf;
    this._head = 0;
    this._tail = this._size;
    this._capacity = newCap;
  }
}
