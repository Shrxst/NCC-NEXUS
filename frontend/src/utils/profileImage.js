const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function withCacheBuster(url, salt = Date.now()) {
  const joiner = String(url).includes("?") ? "&" : "?";
  return `${url}${joiner}v=${salt}`;
}

function tryLoadImage(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const img = new Image();
    let timer = null;

    const done = (ok) => {
      if (timer) clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve(ok);
    };

    timer = setTimeout(() => done(false), timeoutMs);
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.src = url;
  });
}

export async function resolveProfileImage(imageUrl, fallback = "", options = {}) {
  if (!imageUrl) return fallback;

  const attempts = Number(options.attempts || 4);
  const delayMs = Number(options.delayMs || 500);
  const timeoutMs = Number(options.timeoutMs || 5000);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const candidate = withCacheBuster(imageUrl, `${Date.now()}-${attempt}`);
    const ok = await tryLoadImage(candidate, timeoutMs);
    if (ok) return candidate;
    if (attempt < attempts - 1) {
      await wait(delayMs);
    }
  }

  return fallback || withCacheBuster(imageUrl);
}
