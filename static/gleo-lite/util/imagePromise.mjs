

// TODO: This cache is ever increasing. There should be a way to clean it up, since
// it will hold references to potentially big unused images.

const cache = new Map();

export default async function imagePromise(url, fillCache = true) {
	if (url instanceof HTMLImageElement || url instanceof ImageData) {
		return Promise.resolve(url);
	} else if (typeof url === "string") {
		url = new URL(url, document.URL);
	} else if (!(url instanceof URL)) {
		throw new Error(
			"Bad parameter to imagePromise(): must be either a URL or an image."
		);
	}

	const urlStr = url.toString();
	const cached = cache.get(urlStr);
	if (cached) {
		return cached;
	}

	const promise = new Promise((res, rej) => {
		const img = new Image();
		img.addEventListener("load", (ev) => res(ev.target));
		img.addEventListener("error", rej);
		img.addEventListener("abort", rej);
		img.crossOrigin = true;
		img.src = url;
	});
	// const promise = Promise.any(known.map(format=>format.urlToRaster(urlStr)));

	if (fillCache) {
		cache.set(urlStr, promise);
	}
	return promise;
}
