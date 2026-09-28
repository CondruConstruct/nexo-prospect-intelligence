"use strict";
(() => {
  const $ = (id) => document.getElementById(id);
  let qrBlob = "",
    guestUrl = "";
  let allEvents = [];
  let listing = null;
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
      allEvents = [];
      $("overview-rows").replaceChildren();
      $("overview-stats").replaceChildren();
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
      if (photo.description)
        card.append(node("p", photo.description, "admin-photo-description"));
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
    card.id = "event-" + event.id;
    card.tabIndex = -1;
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
    if (event.deletionAt)
      card.append(
        node(
          "p",
          "Ștergere automată programată: " +
            date(event.deletionAt) +
            (expired ? " · Accesul invitaților este închis." : ""),
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
        Number((event.quotaGB ?? event.quotaBytes / 1024 ** 3).toFixed(3)),
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
            "Această dată expiră imediat accesul la album. Fotografiile se șterg după 3 zile de la expirare; dacă termenul a trecut, ștergerea poate începe imediat. Continuați?",
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
  function eventState(event) {
    const expired = Date.parse(event.expiresAt) <= Date.now();
    const deletionAt = event.deletionAt ? Date.parse(event.deletionAt) : null;
    if (expired) {
      if (deletionAt && deletionAt > Date.now())
        return { label: "Expirat · 3 zile de păstrare", kind: "grace" };
      return {
        label:
          event.usedBytes > 0
            ? "Ștergere programată"
            : "Expirat · fără fotografii",
        kind: "due",
      };
    }
    if (event.disabled) return { label: "Dezactivat", kind: "disabled" };
    if (Date.parse(event.expiresAt) <= Date.now() + 7 * 86400000)
      return { label: "Expiră în curând", kind: "soon" };
    return { label: "Activ", kind: "active" };
  }
  function renderOverview() {
    const query = $("event-search").value.trim().toLocaleLowerCase("ro");
    const filter = $("event-filter").value;
    const visible = allEvents.filter((event) => {
      const state = eventState(event);
      const matches =
        !query ||
        [event.name, event.location]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("ro")
          .includes(query);
      return (
        matches &&
        (filter === "all" ||
          (filter === "stored" && event.usedBytes > 0) ||
          (filter === "active" &&
            !event.disabled &&
            Date.parse(event.expiresAt) > Date.now()) ||
          (filter === "disabled" && event.disabled) ||
          state.kind === filter)
      );
    });
    const sort = $("event-sort").value;
    visible.sort((a, b) =>
      sort === "storage"
        ? b.usedBytes - a.usedBytes
        : sort === "recent"
          ? Date.parse(b.createdAt) - Date.parse(a.createdAt)
          : sort === "name"
            ? a.name.localeCompare(b.name, "ro")
            : Number(Date.parse(a.expiresAt) <= Date.now()) -
                Number(Date.parse(b.expiresAt) <= Date.now()) ||
              Date.parse(a.expiresAt) - Date.parse(b.expiresAt),
    );
    $("overview-count").textContent =
      `${visible.length} din ${allEvents.length} albume`;
    $("overview-rows").replaceChildren();
    $("events").replaceChildren();
    observer.disconnect();
    previews.length = 0;
    for (const event of visible) {
      const row = node("tr"),
        name = node("td"),
        storage = node("td"),
        expiration = node("td"),
        deletion = node("td"),
        status = node("td"),
        action = node("td");
      name.append(
        node("strong", event.name),
        node("small", event.location || "Locație nespecificată"),
      );
      storage.append(
        node("strong", `${event.photoCount || 0} fotografii`),
        node(
          "small",
          `${bytes(event.usedBytes || 0)} / ${bytes(event.quotaBytes || 0)}`,
        ),
      );
      expiration.append(node("time", date(event.expiresAt)));
      expiration.firstChild.dateTime = event.expiresAt;
      if (event.deletionAt) {
        deletion.append(node("time", date(event.deletionAt)));
        deletion.firstChild.dateTime = event.deletionAt;
      } else deletion.textContent = "—";
      const state = eventState(event);
      status.append(node("span", state.label, "badge status-" + state.kind));
      if (event.disabled && !["active", "disabled"].includes(state.kind))
        status.append(node("small", "Dezactivat"));
      action.append(
        button("Gestionează", () => {
          const card = $("event-" + event.id);
          card.scrollIntoView({
            block: "start",
            behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "auto"
              : "smooth",
          });
          card.focus({ preventScroll: true });
        }),
      );
      row.append(name, storage, expiration, deletion, status, action);
      $("overview-rows").append(row);
      $("events").append(renderEvent(event));
    }
    if (!visible.length) {
      const row = node("tr"),
        cell = node(
          "td",
          allEvents.length
            ? "Niciun album nu corespunde filtrelor."
            : "Nu există încă albume. Creează primul eveniment mai jos.",
          "empty",
        );
      cell.colSpan = 6;
      row.append(cell);
      $("overview-rows").append(row);
    }
    $("overview-stats").replaceChildren();
    for (const [value, label] of [
      [allEvents.filter((e) => e.usedBytes > 0).length, "albume cu fotografii"],
      [
        bytes(allEvents.reduce((sum, e) => sum + (e.usedBytes || 0), 0)),
        "spațiu folosit",
      ],
      [
        allEvents.filter((e) => eventState(e).kind === "soon").length,
        "expiră în următoarele 7 zile",
      ],
    ]) {
      const stat = node("div", undefined, "overview-stat");
      stat.append(node("strong", String(value)), node("span", label));
      $("overview-stats").append(stat);
    }
  }
  async function listEvents() {
    if (listing) return listing;
    listing = (async () => {
      $("reload").disabled = true;
      $("overview-count").textContent = "Se încarcă toate albumele…";
      const fetched = new Map();
      let offset = 0;
      try {
        for (;;) {
          const result = await api("/events?offset=" + offset + "&limit=250");
          for (const event of result.events || []) fetched.set(event.id, event);
          $("overview-count").textContent = `${fetched.size} albume încărcate…`;
          if (result.nextOffset === null || result.nextOffset === undefined)
            break;
          if (
            !Number.isSafeInteger(result.nextOffset) ||
            result.nextOffset <= offset
          )
            throw new Error(
              "Lista albumelor nu a putut fi încărcată complet. Încercați din nou.",
            );
          offset = result.nextOffset;
        }
        allEvents = [...fetched.values()];
        if (allEvents.length) storageState(allEvents[0].storageConfigured);
        renderOverview();
      } catch (error) {
        $("overview-count").textContent =
          "Actualizarea listei nu a reușit. Apăsați Actualizează.";
        throw error;
      } finally {
        $("reload").disabled = false;
      }
    })();
    try {
      return await listing;
    } finally {
      listing = null;
    }
  }
  $("event-search").addEventListener("input", renderOverview);
  $("event-filter").addEventListener("change", renderOverview);
  $("event-sort").addEventListener("change", renderOverview);
  $("login-form").onsubmit = async (e) => {
    e.preventDefault();
    const b = e.currentTarget.querySelector("button");
    b.disabled = true;
    notice();
    try {
      await api("/login", "POST", {
        username: $("username").value.trim(),
        password: $("password").value,
      });
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
