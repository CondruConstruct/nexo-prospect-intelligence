(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const token = new URLSearchParams(location.hash.slice(1)).get("event");
  window.addEventListener("hashchange", () => location.reload());
  let cursor = null,
    busy = false,
    galleryBusy = false,
    generation = 0;
  const urls = new Set();
  const bytes = (n) =>
    new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 1 }).format(
      n >= 1024 ** 3
        ? n / 1024 ** 3
        : n >= 1024 ** 2
          ? n / 1024 ** 2
          : n / 1024,
    ) + (n >= 1024 ** 3 ? " GB" : n >= 1024 ** 2 ? " MB" : " KB");
  function message(text, error = false) {
    $("status").textContent = text;
    $("status").className = error ? "notice error" : "notice";
    $("status").hidden = !text;
  }
  async function request(path, options = {}, attempt = 0) {
    const res = await fetch("/api/album" + path, {
      ...options,
      headers: { ...options.headers, Authorization: "Bearer " + token },
      cache: "no-store",
      credentials: "omit",
    });
    if (!res.ok) {
      if (res.status === 429 && path.endsWith("/thumbnail") && attempt < 3) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * (attempt + 1)),
        );
        return request(path, options, attempt + 1);
      }
      const body = await res.json().catch(() => ({}));
      const code = body.error?.code || body.code || body.error;
      const errors = {
        QUOTA_EXCEEDED:
          "Spațiul albumului este plin. Contactează administratorul.",
        PHOTO_LIMIT_EXCEEDED: "Albumul a atins numărul maxim de fotografii.",
        INVALID_IMAGE: "Fișierul nu este o imagine JPEG, PNG sau WebP validă.",
        FILE_TOO_LARGE: "Fotografia depășește 200 MB.",
        RATE_LIMITED:
          "Prea multe încercări. Așteaptă puțin și încearcă din nou.",
      };
      throw new Error(
        errors[code] ||
          (typeof body.error === "string" && res.status < 500
            ? body.error
            : res.status === 404 || res.status === 401
              ? "Albumul nu mai este disponibil sau linkul este incorect."
              : res.status === 413
                ? "Fotografia depășește limita permisă."
                : res.status === 429
                  ? "Așteaptă puțin înainte de o nouă încercare."
                  : res.status === 503
                    ? "Stocarea nu este disponibilă momentan. Încearcă din nou mai târziu."
                    : "Operațiunea nu a reușit. Încearcă din nou."),
      );
    }
    return res;
  }
  function revoke() {
    for (const url of urls) URL.revokeObjectURL(url);
    urls.clear();
  }
  async function metadata() {
    const data = await (await request("")).json();
    const event = data.event || data;
    $("title").textContent = event.name;
    $("details").textContent = [
      event.location,
      event.eventDate,
      "Disponibil până la " +
        new Date(event.expiresAt).toLocaleDateString("ro-RO"),
    ]
      .filter(Boolean)
      .join(" · ");
    $("capacity").textContent =
      `${event.photoCount || 0}${event.maxPhotos ? " / " + event.maxPhotos : ""} fotografii · ${bytes(event.usedBytes || 0)} / ${bytes(event.quotaBytes)}`;
    return event;
  }
  async function content(photo, preview, button) {
    button.disabled = true;
    try {
      const blob = await (
        await request("/photos/" + encodeURIComponent(photo.id) + "/content")
      ).blob();
      const url = URL.createObjectURL(blob);
      urls.add(url);
      if (preview) {
        $("preview-name").textContent = photo.name;
        $("preview-image").src = url;
        $("preview").showModal();
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = photo.name;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => {
          URL.revokeObjectURL(url);
          urls.delete(url);
        }, 60000);
      }
    } catch (e) {
      message(e.message, true);
    } finally {
      button.disabled = false;
    }
  }
  function card(photo) {
    const el = document.createElement("article");
    el.className = "photo-card";
    const image = document.createElement("img");
    image.alt = photo.name;
    image.loading = "lazy";
    image.style.cssText =
      "width:100%;aspect-ratio:4/3;object-fit:cover;background:#f1eaff";
    const title = document.createElement("p");
    title.textContent = photo.name;
    title.style.overflowWrap = "anywhere";
    const info = document.createElement("small");
    info.textContent = bytes(photo.bytes);
    const actions = document.createElement("div");
    actions.className = "row";
    for (const [label, preview] of [
      ["Vezi", true],
      ["Descarcă", false],
    ]) {
      const b = document.createElement("button");
      b.className = "btn secondary";
      b.textContent = label;
      b.onclick = () => content(photo, preview, b);
      actions.append(b);
    }
    el.append(image, title, info, actions);
    const ownGeneration = generation;
    observer.observe(image);
    image.dataset.photoId = photo.id;
    image.dataset.generation = ownGeneration;
    return el;
  }
  const thumbQueue = [];
  let thumbActive = 0;
  async function drainThumbs() {
    if (thumbActive >= 2 || !thumbQueue.length) return;
    const image = thumbQueue.shift();
    if (Number(image.dataset.generation) !== generation) return drainThumbs();
    thumbActive++;
    try {
      const blob = await (
        await request(
          "/photos/" + encodeURIComponent(image.dataset.photoId) + "/thumbnail",
        )
      ).blob();
      if (Number(image.dataset.generation) === generation) {
        const url = URL.createObjectURL(blob);
        urls.add(url);
        image.src = url;
      }
    } catch {
      image.alt = "Previzualizare indisponibilă. Apasă Vezi pentru fotografie.";
    } finally {
      thumbActive--;
      drainThumbs();
    }
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        if (entry.isIntersecting) {
          const image = entry.target;
          observer.unobserve(image);
          thumbQueue.push(image);
          drainThumbs();
        }
    },
    { rootMargin: "100px" },
  );
  async function gallery(reset = false) {
    if (galleryBusy) return;
    galleryBusy = true;
    $("refresh").disabled = true;
    $("more").disabled = true;
    try {
      const data = await (
        await request(
          "/photos" +
            (!reset && cursor ? "?before=" + encodeURIComponent(cursor) : ""),
        )
      ).json();
      if (reset) {
        generation++;
        observer.disconnect();
        revoke();
        $("gallery").replaceChildren();
      }
      for (const photo of data.photos) $("gallery").append(card(photo));
      cursor = data.nextCursor;
      $("more").hidden = !cursor;
      $("empty").hidden = !!$("gallery").children.length;
    } finally {
      galleryBusy = false;
      $("refresh").disabled = false;
      $("more").disabled = false;
    }
  }
  $("upload-form").onsubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const files = [...$("photos").files];
    if (!files.length) return;
    busy = true;
    $("upload-button").disabled = true;
    $("photos").disabled = true;
    $("upload-results").replaceChildren();
    $("upload-progress").hidden = false;
    let passed = 0;
    const failed = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        $("upload-progress").textContent =
          `Se încarcă ${i + 1} din ${files.length}: ${file.name}`;
        const line = document.createElement("li");
        try {
          if (file.size > 200 * 1024 * 1024)
            throw new Error("Maximum 200 MB/fotografie.");
          if (!/\.(jpe?g|png|webp)$/i.test(file.name))
            throw new Error("Alege un fișier JPEG, PNG sau WebP.");
          const form = new FormData();
          form.append("photo", file);
          await request("/photos", { method: "POST", body: form });
          passed++;
          line.textContent = file.name + " — încărcată";
        } catch (error) {
          failed.push(file);
          line.textContent = file.name + " — " + error.message;
          line.className = "notice error";
        }
        $("upload-results").append(line);
      }
      $("upload-progress").textContent =
        `${passed} din ${files.length} fotografii încărcate. Mulțumim pentru amintiri!`;
      if (passed === files.length) $("photos").value = "";
      else {
        const remaining = new DataTransfer();
        for (const file of failed) remaining.items.add(file);
        $("photos").files = remaining.files;
      }
      await metadata();
      await gallery(true);
    } catch (error) {
      message(error.message, true);
    } finally {
      busy = false;
      $("upload-button").disabled = false;
      $("photos").disabled = false;
    }
  };
  $("refresh").onclick = () =>
    Promise.all([metadata(), gallery(true)]).catch((e) =>
      message(e.message, true),
    );
  $("more").onclick = () => gallery().catch((e) => message(e.message, true));
  $("close-preview").onclick = () => $("preview").close();
  $("preview").addEventListener("close", () => {
    const url = $("preview-image").src;
    $("preview-image").removeAttribute("src");
    URL.revokeObjectURL(url);
    urls.delete(url);
  });
  window.addEventListener("beforeunload", (e) => {
    if (busy) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  async function init() {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token))
      return message(
        "Deschide linkul primit de la organizator sau scanează codul QR al evenimentului.",
        true,
      );
    try {
      await metadata();
      await gallery(true);
      $("content").hidden = false;
      message("");
    } catch (e) {
      message(e.message, true);
    }
  }
  init();
})();
