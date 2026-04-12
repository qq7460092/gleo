

/// TODO: Does using `fetch` offer any benefit?? The logic could be changed.

export default function abortableImagePromise(url, controller) {
	if (!controller) {
		controller = new AbortController();
	}

	const img = new Image();
	return new Promise((res, rej) => {
		img.addEventListener("load", (ev) => res(ev.target));
		img.addEventListener("error", rej);
		img.addEventListener("abort", rej);
		controller.signal.addEventListener("abort", (reason) => {
			img.src = "";
			rej(reason);
		});

		img.crossOrigin = true;
		img.src = url;
	});
}
