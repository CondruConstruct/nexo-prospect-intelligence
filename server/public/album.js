(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const token = new URLSearchParams(location.hash.slice(1)).get("event");
  window.addEventListener("hashchange", () => location.reload());
  let cursor = null,
    busy = false,
    galleryBusy = false,
    generation = 0,
    selecting = false,
    downloadBusy = false,
    eventInfo = null,
    previewIndex = -1,
    previewGeneration = 0;
  const photos = new Map(),
    selected = new Set(),
    urls = new Set(),
    thumbQueue = [];
  let thumbActive = 0;
  let galleryController = new AbortController();
  let previewController = new AbortController(),
    previewUrl = null;
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
      if (
        (res.status === 429 || res.status === 503) &&
        path.endsWith("/thumbnail") &&
        attempt < 3
      ) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1200 * (attempt + 1)),
        );
        return request(path, options, attempt + 1);
      }
      const body = await res.json().catch(() => ({}));
      const code = body.error?.code || body.code || body.error;
      const errors = {
        QUOTA_EXCEEDED:
          "Spațiul albumului este plin. Contactează administratorul.",
        PHOTO_LIMIT_EXCEEDED: "Albumul a atins numărul maxim de fotografii.",
        INVALID_IMAGE:
          "Alege o fotografie JPEG, PNG sau WebP validă, în limita de megapixeli a albumului.",
        FILE_TOO_LARGE: "Fotografia depășește limita permisă.",
        RATE_LIMITED:
          "Prea multe încercări. Așteaptă puțin și încearcă din nou.",
        EMPTY_ALBUM: "Albumul nu conține încă fotografii.",
        TOO_MANY_PHOTOS:
          "Selectează cel mult 1.000 de fotografii sau folosește Descarcă toate.",
      };
      throw new Error(
        errors[code] ||
          ([400, 409, 413].includes(res.status) &&
          typeof body.error === "string"
            ? body.error
            : "") ||
          (res.status === 404 || res.status === 401
            ? "Albumul sau fotografia nu mai este disponibilă."
            : res.status === 413
              ? "Fotografia depășește limita permisă."
              : res.status === 429 || res.status === 503
                ? "Serviciul este ocupat momentan. Încearcă din nou în câteva momente."
                : "Operațiunea nu a reușit. Încearcă din nou."),
      );
    }
    return res;
  }
  function revoke(url) {
    if (url) {
      URL.revokeObjectURL(url);
      urls.delete(url);
    }
  }
  function revokeAll() {
    for (const url of urls) URL.revokeObjectURL(url);
    urls.clear();
  }
  async function metadata() {
    const data = await (await request("")).json();
    const event = (eventInfo = data.event || data);
    $("pixel-limit").textContent = String(
      (event.maxImagePixels || 24000000) / 1000000,
    );
    $("file-limit").textContent = bytes(
      event.maxFileBytes || 200 * 1024 * 1024,
    );
    $("title").textContent = event.name;
    $("details").textContent = [
      event.location,
      event.eventDate
        ? new Date(event.eventDate + "T12:00:00").toLocaleDateString("ro-RO", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : "",
    ]
      .filter(Boolean)
      .join(" · ");
    $("retention").textContent =
      "Fotografiile sunt disponibile până la " +
      new Date(event.expiresAt).toLocaleDateString("ro-RO") +
      ".";
    $("capacity").textContent =
      `${event.photoCount || 0}${event.maxPhotos ? " / " + event.maxPhotos : ""} fotografii · ${bytes(event.usedBytes || 0)} / ${bytes(event.quotaBytes)}`;
    $("photo-count").textContent =
      `${event.photoCount || 0} fotografii în album`;
    $("download-all").disabled = downloadBusy || !event.photoCount;
    return event;
  }
  function selectionUI() {
    $("selection-bar").hidden = !selecting;
    $("gallery").classList.toggle("selecting", selecting);
    $("select-mode").setAttribute("aria-pressed", String(selecting));
    $("select-mode").textContent = selecting
      ? "Închide selecția"
      : "Selectează";
    $("selection-count").textContent = selected.size
      ? `${selected.size} selectate`
      : "Selectează fotografii";
    $("download-selected").disabled = !selected.size || downloadBusy;
    $("select-all").disabled = !photos.size;
    for (const el of $("gallery").children) {
      const on = selected.has(el.dataset.id);
      el.classList.toggle("selected", on);
      el.querySelector("input").checked = on;
    }
  }
  function toggle(photo) {
    selecting = true;
    if (selected.has(photo.id)) selected.delete(photo.id);
    else selected.add(photo.id);
    selectionUI();
  }
  async function archive(ids, button) {
    if (downloadBusy) return;
    if (ids && ids.length > 1000)
      return message(
        "Selectează cel mult 1.000 de fotografii sau folosește Descarcă toate.",
        true,
      );
    downloadBusy = true;
    const label = button.innerHTML;
    button.textContent = "Se pregătește…";
    $("download-all").disabled = true;
    selectionUI();
    try {
      const data = await (
        await request("/download-ticket", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoIds: ids }),
        })
      ).json();
      const link = document.createElement("a");
      const url = new URL(data.downloadUrl, location.origin);
      if (
        url.origin !== location.origin ||
        !url.pathname.startsWith("/api/downloads/")
      )
        throw new Error(
          "Linkul de descărcare nu este disponibil. Încearcă din nou.",
        );
      link.href = url.href;
      link.download = "";
      document.body.append(link);
      link.click();
      link.remove();
      message(
        "Descărcarea arhivei începe. Fotografiile sunt păstrate la calitatea originală.",
      );
      if ($("preview").open)
        $("preview-status").textContent = "Descărcarea arhivei începe.";
    } catch (e) {
      message(e.message, true);
      if ($("preview").open) $("preview-status").textContent = e.message;
    } finally {
      downloadBusy = false;
      button.innerHTML = label;
      $("download-all").disabled = !eventInfo?.photoCount;
      selectionUI();
    }
  }
  function card(photo) {
    const el = document.createElement("article");
    el.className = "album-tile";
    el.dataset.id = photo.id;
    const open = document.createElement("button");
    open.className = "photo-open";
    open.type = "button";
    open.setAttribute("aria-label", "Deschide fotografia " + photos.size);
    const image = document.createElement("img");
    image.alt = "Fotografie de la eveniment";
    image.loading = "lazy";
    image.dataset.photoId = photo.id;
    image.dataset.generation = generation;
    image.onload = () => {
      image.classList.add("loaded");
      const ratio = Math.max(
        0.55,
        Math.min(2.3, image.naturalWidth / image.naturalHeight || 1),
      );
      el.style.setProperty("--ratio", ratio);
    };
    open.append(image);
    open.onclick = () => {
      if (selecting) toggle(photo);
      else showPreview([...photos.keys()].indexOf(photo.id));
    };
    const label = document.createElement("label");
    label.className = "photo-check";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.setAttribute("aria-label", "Selectează fotografia " + photos.size);
    checkbox.onchange = () => toggle(photo);
    label.append(checkbox);
    el.append(open, label);
    if (photo.description) {
      const caption = document.createElement("p");
      caption.className = "photo-description";
      caption.textContent = photo.description;
      el.append(caption);
    }
    observer.observe(image);
    return el;
  }
  async function drainThumbs() {
    if (thumbActive >= 1 || !thumbQueue.length) return;
    const image = thumbQueue.shift(),
      ownGeneration = Number(image.dataset.generation);
    if (ownGeneration !== generation) return drainThumbs();
    thumbActive++;
    try {
      const blob = await (
        await request(
          "/photos/" + encodeURIComponent(image.dataset.photoId) + "/thumbnail",
          { signal: galleryController.signal },
        )
      ).blob();
      if (ownGeneration === generation) {
        const url = URL.createObjectURL(blob);
        urls.add(url);
        image.src = url;
      }
    } catch (e) {
      if (e.name !== "AbortError") image.alt = "Previzualizare indisponibilă";
    } finally {
      thumbActive--;
      drainThumbs();
    }
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        if (entry.isIntersecting) {
          observer.unobserve(entry.target);
          thumbQueue.push(entry.target);
          drainThumbs();
        }
    },
    { rootMargin: "180px" },
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
        galleryController.abort();
        galleryController = new AbortController();
        observer.disconnect();
        thumbQueue.length = 0;
        if ($("preview").open) $("preview").close();
        revokeAll();
        photos.clear();
        selected.clear();
        $("gallery").replaceChildren();
      }
      for (const photo of data.photos) {
        if (photos.has(photo.id)) continue;
        photos.set(photo.id, photo);
        $("gallery").append(card(photo));
      }
      cursor = data.nextCursor;
      $("more").hidden = !cursor;
      $("empty").hidden = !!photos.size;
      $("select-mode").disabled = !photos.size;
      selectionUI();
    } finally {
      galleryBusy = false;
      $("refresh").disabled = false;
      $("more").disabled = false;
    }
  }
  async function showPreview(index) {
    const list = [...photos.values()];
    if (index < 0 || index >= list.length) return;
    previewIndex = index;
    const own = ++previewGeneration;
    previewController.abort();
    previewController = new AbortController();
    revoke(previewUrl);
    previewUrl = null;
    const image = $("preview-image");
    image.removeAttribute("src");
    $("preview-count").textContent = `${index + 1} / ${list.length}`;
    $("preview-prev").disabled = index === 0;
    $("preview-next").disabled = index === list.length - 1;
    $("preview-original").disabled = false;
    $("preview-status").textContent = "Se deschide fotografia…";
    if (!$("preview").open) $("preview").showModal();
    const cached = [...$("gallery").children]
      .find((el) => el.dataset.id === list[index].id)
      ?.querySelector("img.loaded");
    if (cached) {
      image.src = cached.src;
      $("preview-status").textContent = "";
      return;
    }
    try {
      const blob = await (
        await request(
          "/photos/" + encodeURIComponent(list[index].id) + "/thumbnail",
          { signal: previewController.signal },
        )
      ).blob();
      if (own !== previewGeneration) return;
      previewUrl = URL.createObjectURL(blob);
      urls.add(previewUrl);
      image.src = previewUrl;
      $("preview-status").textContent = "";
    } catch (e) {
      if (own === previewGeneration && e.name !== "AbortError")
        $("preview-status").textContent = e.message;
    }
  }
  async function originalPreview() {
    const photo = [...photos.values()][previewIndex];
    if (!photo) return;
    const own = ++previewGeneration;
    previewController.abort();
    previewController = new AbortController();
    $("preview-original").disabled = true;
    $("preview-status").textContent = "Se deschide originalul…";
    try {
      const blob = await (
        await request("/photos/" + encodeURIComponent(photo.id) + "/content", {
          signal: previewController.signal,
        })
      ).blob();
      if (own !== previewGeneration) return;
      revoke(previewUrl);
      previewUrl = URL.createObjectURL(blob);
      urls.add(previewUrl);
      $("preview-image").src = previewUrl;
      $("preview-status").textContent = "Original";
    } catch (e) {
      if (own === previewGeneration && e.name !== "AbortError") {
        $("preview-status").textContent = e.message;
        $("preview-original").disabled = false;
      }
    }
  }
  async function upload() {
    if (busy) return;
    const files = [...$("photos").files];
    if (!files.length) return;
    const description = $("photo-description").value.trim();
    $("upload-dialog").close("upload");
    busy = true;
    $("upload-button").disabled = true;
    $("photos").disabled = true;
    $("upload-results").replaceChildren();
    $("upload-progress").hidden = false;
    let passed = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        $("upload-progress").textContent =
          `Se încarcă fotografia ${i + 1} din ${files.length}…`;
        try {
          if (file.size > (eventInfo?.maxFileBytes || 200 * 1024 * 1024))
            throw new Error("Fotografia depășește limita permisă.");
          if (!/\.(jpe?g|png|webp)$/i.test(file.name))
            throw new Error("Alege o fotografie JPEG, PNG sau WebP.");
          const form = new FormData();
          form.append("description", description);
          form.append("photo", file);
          await request("/photos", { method: "POST", body: form });
          passed++;
        } catch (e) {
          const li = document.createElement("li");
          li.className = "notice error";
          li.textContent = `Fotografia ${i + 1}: ${e.message}`;
          $("upload-results").append(li);
        }
      }
      $("upload-progress").textContent =
        passed === files.length
          ? (passed === 1 ? "O fotografie adăugată. Mulțumim pentru amintire!" : `${passed} fotografii adăugate. Mulțumim pentru amintiri!`)
          : `${passed} din ${files.length} fotografii adăugate. Poți selecta din nou fotografiile care nu s-au încărcat.`;
      $("photos").value = "";
      await metadata();
      await gallery(true);
    } catch (e) {
      message(e.message, true);
    } finally {
      busy = false;
      $("upload-button").disabled = false;
      $("photos").disabled = false;
    }
  }
  $("upload-button").onclick = () => $("photos").click();
  $("photos").onchange = () => {
    if (!$("photos").files.length) return;
    $("photo-description").value = "";
    $("upload-file-count").textContent = `${$("photos").files.length} fotografii selectate`;
    $("upload-dialog").showModal();
  };
  $("upload-confirm").onsubmit = (e) => { e.preventDefault(); upload(); };
  $("cancel-upload").onclick = () => $("upload-dialog").close("cancel");
  $("upload-dialog").addEventListener("close", () => {
    if ($("upload-dialog").returnValue !== "upload") $("photos").value = "";
    $("upload-dialog").returnValue = "";
  });
  $("select-mode").onclick = () => {
    selecting = !selecting;
    if (!selecting) selected.clear();
    selectionUI();
  };
  $("clear-selection").onclick = () => {
    selecting = false;
    selected.clear();
    selectionUI();
  };
  $("select-all").onclick = () => {
    for (const id of photos.keys()) selected.add(id);
    selectionUI();
  };
  $("download-all").onclick = () => archive(null, $("download-all"));
  $("download-selected").onclick = () =>
    archive([...selected], $("download-selected"));
  $("preview-original").onclick = originalPreview;
  $("preview-download").onclick = () => {
    const photo = [...photos.values()][previewIndex];
    if (photo) archive([photo.id], $("preview-download"));
  };
  $("refresh").onclick = () =>
    Promise.all([metadata(), gallery(true)])
      .then(() => message(""))
      .catch((e) => message(e.message, true));
  $("more").onclick = () => gallery().catch((e) => message(e.message, true));
  $("close-preview").onclick = () => $("preview").close();
  $("preview-prev").onclick = () => showPreview(previewIndex - 1);
  $("preview-next").onclick = () => showPreview(previewIndex + 1);
  $("preview").addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      showPreview(previewIndex - 1);
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      showPreview(previewIndex + 1);
    }
  });
  $("preview").addEventListener("close", () => {
    previewGeneration++;
    previewController.abort();
    revoke(previewUrl);
    previewUrl = null;
    $("preview-image").removeAttribute("src");
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
