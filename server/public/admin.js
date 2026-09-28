"use strict";
(() => {
  const $ = (id) => document.getElementById(id);
  let qrBlob = "",
    guestUrl = "";
  const previews = [];
  let previewBusy = false;
  function nextPreview() {
    if (previewBusy) return;
    const image = previews.shift();
    if (!image) return;
    if (!image.isConnected) {
      nextPreview();
      return;
    }
    previewBusy = true;
    image.onload = image.onerror = () => {
      previewBusy = false;
      nextPreview();
    };
    image.src = image.dataset.src;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        if (entry.isIntersecting) {
          observer.unobserve(entry.target);
          previews.push(entry.target);
        }
      nextPreview();
    },
    { rootMargin: "150px" },
  );
  function notice(message = "", error = false) {
    $("status").textContent = message;
    $("status").className = "notice " + (error ? "error" : "success");
  }
  function auth(active) {
    $("workspace").hidden = !active;
    $("login").hidden = active;
    $("logout").hidden = !active;
    if (!active) {
      $("events").replaceChildren();
      $("qr-panel").hidden = true;
      guestUrl = "";
      $("qr").replaceChildren();
      $("guest-link").removeAttribute("href");
      $("guest-link").textContent = "";
      $("download-qr").removeAttribute("href");
      if (qrBlob) URL.revokeObjectURL(qrBlob);
    }
  }
  async function api(path, method = "GET", body) {
    const response = await fetch("/api/admin" + path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = {};
    try {
      data = await response.json();
    } catch {}
    if (!response.ok) {
      if (response.status === 401) auth(false);
      throw Error(
        response.status === 401
          ? "Sesiunea a expirat sau parola este incorectă. Conectați-vă din nou."
          : typeof data.error === "string"
            ? data.error
            : "Operația nu a reușit. Încercați din nou.",
      );
    }
    return data;
  }
  const node = (tag, text, className) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (className) n.className = className;
    return n;
  };
  const date = (value) => new Date(value).toLocaleString("ro-RO");
  const bytes = (value) =>
    value >= 1024 ** 3
      ? (value / 1024 ** 3).toFixed(2) + " GB"
      : value >= 1024 ** 2
        ? (value / 1024 ** 2).toFixed(1) + " MB"
        : Math.round(value / 1024) + " KB";
  function button(text, action, kind = "secondary") {
    const b = node("button", text, "btn " + kind);
    b.type = "button";
    b.onclick = async () => {
      b.disabled = true;
      notice();
      try {
        await action();
      } catch (error) {
        notice(error.message, true);
      } finally {
        b.disabled = false;
      }
    };
    return b;
  }
  function field(label, name, type, value, options = {}) {
    const l = node("label", label, "field"),
      i = node("input");
    i.name = name;
    i.type = type;
    i.value = value ?? "";
    Object.assign(i, options);
    l.append(i);
    return l;
  }
  function showQr(url, name) {
    const parsed = new URL(url, location.origin);
    if (
      !["https:", "http:"].includes(parsed.protocol) ||
      parsed.origin !== location.origin
    )
      throw Error("Linkul albumului nu este valid.");
    guestUrl = parsed.href;
    const q = qrcode(0, "M");
    q.addData(guestUrl);
    q.make();
    const svg = q.createSvgTag({ cellSize: 5, margin: 20, scalable: true });
    $("qr").innerHTML = svg;
    if (qrBlob) URL.revokeObjectURL(qrBlob);
    qrBlob = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    $("download-qr").href = qrBlob;
    $("guest-link").href = guestUrl;
    $("guest-link").textContent = guestUrl;
    $("qr-title").textContent = name;
    $("qr-panel").hidden = false;
    $("qr-panel").scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  }
  async function eventQr(event, rotate = false) {
    if (
      rotate &&
      !confirm(
        "Înlocuiți linkul și codul QR? Codurile distribuite anterior nu vor mai funcționa.",
      )
    )
      return;
    const result = await api(
      "/events/" +
        encodeURIComponent(event.id) +
        (rotate ? "/rotate-link" : "/link"),
      rotate ? "POST" : "GET",
    );
    showQr(result.url, event.name);
  }
  async function photos(event, container, cursor = "") {
    const result = await api(
      "/events/" +
        encodeURIComponent(event.id) +
        "/photos" +
        (cursor ? "?before=" + encodeURIComponent(cursor) : ""),
    );
    if (!cursor) container.replaceChildren();
    for (const photo of result.photos || []) {
      const card = node("div", undefined, "photo-card");
      const image = node("img");
      image.alt = photo.name;
      image.dataset.src =
        "/api/admin/events/" +
        encodeURIComponent(event.id) +
        "/photos/" +
        encodeURIComponent(photo.id) +
        "/thumbnail";
      card.append(image);
      card.append(
        node("p", photo.name),
        node("p", bytes(photo.bytes) + " · " + date(photo.createdAt), "muted"),
      );
      card.append(
        button(
          "Șterge fotografia",
          async () => {
            if (!confirm("Ștergeți definitiv fotografia „" + photo.name + "”?"))
              return;
            await api(
              "/events/" +
                encodeURIComponent(event.id) +
                "/photos/" +
                encodeURIComponent(photo.id),
              "DELETE",
            );
            card.remove();
            notice(
              "Fotografia a fost ștearsă. Actualizați lista pentru consumul curent.",
            );
          },
          "danger",
        ),
      );
      container.append(card);
      observer.observe(image);
    }
    if (!(result.photos || []).length && !cursor)
      container.append(
        node("p", "Nu sunt fotografii în acest album.", "empty"),
      );
    if (result.nextCursor) {
      const more = button("Mai multe fotografii", async () => {
        await photos(event, container, result.nextCursor);
        more.remove();
      });
      container.append(more);
    }
  }
  function storageState(ready) {
    $("storage-notice").hidden = ready !== false;
  }
  function renderEvent(event) {
    const card = node("article", undefined, "card event-card"),
      top = node("div", undefined, "row between"),
      expired = Date.parse(event.expiresAt) <= Date.now();
    top.append(
      node("h3", event.name),
      node(
        "span",
        event.disabled
          ? "Dezactivat"
          : expired
            ? "Expirat"
            : event.storageConfigured === false
              ? "Stocare indisponibilă"
              : "Activ",
        "badge " + (event.disabled || expired ? "off" : ""),
      ),
    );
    card.append(
      top,
      node("p", event.location || "Locație nespecificată", "muted"),
      node(
        "p",
        `${event.photoCount || 0} fotografii · ${bytes(event.usedBytes || 0)} / ${bytes(event.quotaBytes || event.quotaGB * 1024 ** 3)} · Expiră: ${date(event.expiresAt)}`,
        "event-stats",
      ),
    );
    const progress = node("div", undefined, "progress"),
      bar = node("span");
    bar.style.width =
      Math.min(
        100,
        ((event.usedBytes || 0) /
          (event.quotaBytes || event.quotaGB * 1024 ** 3)) *
          100,
      ) + "%";
    progress.append(bar);
    card.append(progress);
    const actions = node("div", undefined, "row");
    actions.style.marginTop = "18px";
    actions.append(
      button("Cod QR și link", () => eventQr(event)),
      button(event.disabled ? "Reactivează" : "Dezactivează", async () => {
        if (
          !event.disabled &&
          !confirm(
            "Dezactivați albumul? Invitații nu îl vor mai putea accesa până la reactivare.",
          )
        )
          return;
        await api("/events/" + encodeURIComponent(event.id), "PATCH", {
          disabled: !event.disabled,
        });
        await listEvents();
      }),
      button("Înlocuiește linkul", () => eventQr(event, true)),
    );
    card.append(actions);
    const details = node("details"),
      summary = node("summary", "Modifică evenimentul"),
      form = node("form", undefined, "stack"),
      grid = node("div", undefined, "grid two");
    grid.append(
      field("Denumire", "name", "text", event.name, {
        required: true,
        maxLength: 120,
      }),
      field("Locație", "location", "text", event.location, {
        required: true,
        maxLength: 200,
      }),
      field(
        "Spațiu maxim (GB)",
        "quotaGB",
        "number",
        event.quotaGB ?? event.quotaBytes / 1024 ** 3,
        { required: true, min: "0.001", max: "10000", step: "0.001" },
      ),
      field(
        "Număr maxim de fotografii (gol = nelimitat)",
        "maxPhotos",
        "number",
        event.maxPhotos,
        { min: "1", max: "1000000", step: "1" },
      ),
    );
    const expires = field(
      "Data și ora expirării (ora locală)",
      "expiresAt",
      "datetime-local",
      "",
      { required: true },
    );
    const dt = new Date(event.expiresAt);
    expires.querySelector("input").value = new Date(
      dt.getTime() - dt.getTimezoneOffset() * 60000,
    )
      .toISOString()
      .slice(0, 16);
    grid.append(expires);
    const save = node("button", "Salvează modificările", "btn");
    save.type = "submit";
    form.append(grid, save);
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      save.disabled = true;
      try {
        const f = form.elements;
        if (
          Date.parse(f.expiresAt.value) <= Date.now() &&
          !confirm(
            "Această dată expiră imediat albumul și programează ștergerea fotografiilor. Continuați?",
          )
        )
          return;
        await api("/events/" + encodeURIComponent(event.id), "PATCH", {
          name: f.name.value.trim(),
          location: f.location.value.trim(),
          quotaGB: Number(f.quotaGB.value),
          maxPhotos:
            f.maxPhotos.value === "" ? null : Number(f.maxPhotos.value),
          expiresAt: new Date(f.expiresAt.value).toISOString(),
        });
        await listEvents();
        notice("Modificările au fost salvate.");
      } catch (error) {
        notice(error.message, true);
      } finally {
        save.disabled = false;
      }
    };
    details.append(summary, form);
    card.append(details);
    const media = node("details"),
      mediaSummary = node("summary", "Gestionează fotografiile"),
      photoList = node("div", undefined, "photo-grid");
    photoList.style.marginTop = "18px";
    let loaded = false;
    media.ontoggle = async () => {
      if (!media.open || loaded) return;
      loaded = true;
      try {
        await photos(event, photoList);
      } catch (error) {
        loaded = false;
        notice(error.message, true);
      }
    };
    media.append(mediaSummary, photoList);
    card.append(media);
    return card;
  }
  async function listEvents() {
    const result = await api("/events");
    if (result.events?.length) storageState(result.events[0].storageConfigured);
    $("events").replaceChildren();
    for (const event of result.events || [])
      $("events").append(renderEvent(event));
    if (!(result.events || []).length)
      $("events").append(
        node(
          "p",
          "Încă nu sunt evenimente. Creați primul album mai sus.",
          "empty",
        ),
      );
  }
  $("login-form").onsubmit = async (e) => {
    e.preventDefault();
    const b = e.currentTarget.querySelector("button");
    b.disabled = true;
    notice();
    try {
      await api("/login", "POST", { password: $("password").value });
      $("password").value = "";
      auth(true);
      storageState((await api("/session")).storageConfigured);
      await listEvents();
    } catch (error) {
      notice(error.message, true);
    } finally {
      b.disabled = false;
    }
  };
  $("logout").onclick = async () => {
    try {
      await api("/logout", "POST");
      auth(false);
      notice("V-ați deconectat.");
    } catch (error) {
      notice(error.message, true);
    }
  };
  $("create-form").onsubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget,
      b = form.querySelector("button");
    if (!form.reportValidity()) return;
    b.disabled = true;
    notice();
    try {
      const f = form.elements;
      const result = await api("/events", "POST", {
        name: f.name.value.trim(),
        location: f.location.value.trim(),
        eventDate: f.eventDate.value,
        quotaGB: Number(f.quotaGB.value),
        maxPhotos: f.maxPhotos.value === "" ? null : Number(f.maxPhotos.value),
        retentionDays: Number(f.retentionDays.value),
      });
      const event = result.event || result;
      await listEvents();
      form.reset();
      storageState(event.storageConfigured);
      notice(
        event.storageConfigured === false
          ? "Evenimentul a fost creat. Stocarea nu este conectată: verificați serviciul înainte de a distribui codul QR."
          : "Evenimentul a fost creat. Distribuiți codul QR participanților.",
      );
      await eventQr(event);
    } catch (error) {
      notice(error.message, true);
    } finally {
      b.disabled = false;
    }
  };
  $("reload").onclick = async () => {
    try {
      await listEvents();
      notice("Lista a fost actualizată.");
    } catch (error) {
      notice(error.message, true);
    }
  };
  $("close-qr").onclick = () => ($("qr-panel").hidden = true);
  $("print-qr").onclick = () => window.print();
  $("copy-link").onclick = async () => {
    try {
      await navigator.clipboard.writeText(guestUrl);
      notice("Linkul a fost copiat.");
    } catch {
      notice("Copiați manual linkul afișat sub codul QR.", true);
    }
  };
  (async () => {
    try {
      const session = await api("/session");
      auth(true);
      storageState(session.storageConfigured);
      await listEvents();
    } catch (error) {
      auth(false);
      if (!error.message.includes("Sesiunea")) notice(error.message, true);
    }
  })();
})();
