

// This is kinda similar to https://github.com/redboltz/number-allocator ,
// but allows allocating a range, and has worse complexity (O(n) instead of
// O(n·log(n)) ).

export default class Allocator {
	constructor(max = Number.MAX_SAFE_INTEGER) {
		

		this._max = max;
		// The 'points' structure is effectively a linked list of
		// start points of free/allocated regions.
		this._points = new Map();
		this._points.set(0, {
			free: true,
			next: max,
		});
	}

	
	allocateBlock(size) {
		if (size === 0) {
			return NaN;
		}
		let prev = 0;
		let ptr = 0;

		while (true) {
			const block = this._points.get(ptr);
			const end = ptr + size;

			if (block.free) {
				if (ptr === 0 && end < block.next) {
					// Allocate at the very beginning
					this._points.set(0, { free: false, next: end });
					this._points.set(end, { free: true, next: block.next });
					return 0;
				}
				if (ptr === 0 && end === block.next) {
					// Allocate at the very beginning, merge with next block
					const nextBlock = this._points.get(end);
					this._points.set(0, { free: false, next: nextBlock.next });
					this._points.delete(block.next);
					return 0;
				}
				if (end < block.next) {
					// Increase the size of the previous, used, block
					this._points.set(prev, { free: false, next: end });
					this._points.delete(ptr);
					this._points.set(end, { free: true, next: block.next });
					return ptr;
				}
				if (end === block.next) {
					// Allocate an entire free block,
					// merge neighbouring used blocks
					const nextBlock = this._points.get(end);
					this._points.set(prev, { free: false, next: nextBlock.next });
					this._points.delete(ptr);
					this._points.delete(block.next);
					return ptr;
				}
			}

			prev = ptr;
			ptr = block.next;
			if (ptr <= prev) {
				throw new Error(`Bad allocation map: tried to go backwards`);
			}
			// 			if (ptr === Number.MAX_SAFE_INTEGER) {
			if (ptr >= this._max) {
				throw new Error(`No allocatable space`);
			}
		}
	}

	
	deallocateBlock(start, size) {
		if (size === 0) {
			return this;
		}
		let prev = 0;
		let ptr = 0;
		const end = start + size;

		while (true) {
			const block = this._points.get(ptr);

			if (!block.free) {
				if (ptr === 0 && start === 0 && end === block.next) {
					// Deallocate entire block at beginning
					const nextBlock = this._points.get(end);
					this._points.set(0, { free: true, next: nextBlock.next });
					this._points.delete(end);
					return this;
				}
				if (ptr === 0 && start === 0 && end < block.next) {
					// Deallocate partial block at beginning,
					// lower next block start
					this._points.set(0, { free: true, next: end });
					this._points.set(end, { free: false, next: block.next });
					return this;
				}

				if (ptr === start && end < block.next) {
					// Deallocate at the beginning of a used block
					// Grow the previous free block
					this._points.set(prev, { free: true, next: end });
					this._points.delete(ptr);
					this._points.set(end, { free: false, next: block.next });
					return this;
				}
				if (ptr === start && end === block.next) {
					// Deallocate the entire block
					// Merge neighbouring free blocks
					const nextBlock = this._points.get(block.next);
					this._points.set(prev, { free: true, next: nextBlock.next });
					this._points.delete(ptr);
					this._points.delete(block.next);
					return this;
				}
				if (ptr < start && end === block.next) {
					// Deallocate the end of the block
					// Grow the next free block
					const nextBlock = this._points.get(block.next);
					this._points.set(ptr, { free: false, next: start });
					this._points.delete(block.next);
					this._points.set(start, { free: true, next: nextBlock.next });
					return this;
				}
				if (ptr < start && end < block.next) {
					// Deallocate middle of a block
					this._points.set(ptr, { free: false, next: start });
					this._points.set(start, { free: true, next: end });
					this._points.set(end, { free: false, next: block.next });
					return;
				}
			}

			prev = ptr;
			ptr = block.next;
			if (ptr <= prev) {
				throw new Error(`Bad allocation map: tried to go backwards`);
			}
			// if (start === Number.MAX_SAFE_INTEGER) {
			if (ptr >= this._max) {
				throw new Error(`Could not deallocate. Sparse?`);
			}
		}
	}

	
	forEachBlock(fn) {
		if (this._points.size <= 1) {
			return this;
		}
		let ptr = 0;
		while (true) {
			const block = this._points.get(ptr);
			if (!block) {
				throw new Error(
					`Bad allocation map: was modified inside a forEach() callback`
				);
			}
			if (!block.free) {
				fn(ptr, block.next - ptr);
			}
			if (block.next <= ptr) {
				throw new Error(`Bad allocation map: tried to go backwards`);
			}
			ptr = block.next;
			if (ptr >= this._max) {
				return this;
			}
		}
	}
}
