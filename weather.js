(() => {
  const forecastUrl = "https://www.skipass.com/meteo/la-rosiere.html";
  const fallback = document.querySelector("#weather-fallback");
  const status = document.querySelector("#weather-status");
  const tableContainer = document.querySelector("#weather-table-container");
  const tableBody = document.querySelector("#weather-table-body");

  if (!fallback || !status || !tableContainer || !tableBody) {
    console.error("La section météo est incomplète; les prévisions Skipass ne peuvent pas être initialisées.");
    if (status) {
      status.dataset.state = "error";
      status.textContent = "La météo ne peut pas être affichée en raison d’une erreur de configuration.";
    }
    return;
  }

  let requestController = null;

  const windDirections = {
    n: "Nord",
    nne: "Nord-nord-est",
    ne: "Nord-est",
    ene: "Est-nord-est",
    e: "Est",
    ese: "Est-sud-est",
    se: "Sud-est",
    sse: "Sud-sud-est",
    s: "Sud",
    ssw: "Sud-sud-ouest",
    sw: "Sud-ouest",
    wsw: "Ouest-sud-ouest",
    w: "Ouest",
    wnw: "Ouest-nord-ouest",
    nw: "Nord-ouest",
    nnw: "Nord-nord-ouest",
  };

  const makeCell = (label, className = "") => {
    const cell = document.createElement("td");
    cell.dataset.label = label;
    if (className) {
      cell.className = className;
    }
    return cell;
  };

  const weatherDescription = (imageUrl) => {
    const imageName = new URL(imageUrl || forecastUrl, forecastUrl).pathname.split("/").pop()?.toLowerCase() || "";

    if (imageName.includes("snow")) {
      return imageName.includes("light") ? "Faibles chutes de neige" : "Chutes de neige";
    }
    if (imageName.includes("rain") && !imageName.includes("norain")) {
      return imageName.includes("light") ? "Faibles pluies" : "Pluie";
    }
    if (imageName.startsWith("0cloud")) {
      return "Ciel dégagé";
    }
    if (imageName.startsWith("2cloud")) {
      return "Éclaircies";
    }
    if (imageName.includes("cloud")) {
      return "Ciel nuageux";
    }
    return "Conditions météo";
  };

  const getFreezingLevel = (sourceDocument, sourceRow) => {
    const dayId = sourceRow.dataset.day?.match(/day_(\d{8})/)?.[1];
    if (!dayId) {
      return "—";
    }

    const detail = sourceDocument.querySelector(`#day_${dayId}`);
    const levels = [...(detail?.querySelectorAll(".forecast-freezing-levels .freezing-level-value") || [])]
      .map((element) => Number.parseInt(element.textContent.replace(/\D/g, ""), 10))
      .filter(Number.isFinite);

    if (!levels.length) {
      return "—";
    }

    const lowest = Math.min(...levels);
    const highest = Math.max(...levels);
    const format = (value) => new Intl.NumberFormat("fr-FR").format(value);

    return lowest === highest
      ? `${format(lowest)} m`
      : `${format(lowest)}–${format(highest)} m`;
  };

  const getDayLabel = (sourceDocument, sourceRow) => {
    const dateId = sourceRow.dataset.day?.match(/day_(\d{4})(\d{2})(\d{2})/);
    if (!dateId) {
      throw new Error("La date d’une prévision Skipass est manquante.");
    }

    const [, year, month, day] = dateId;
    const date = new Date(Number(year), Number(month) - 1, Number(day), 12);
    const label = new Intl.DateTimeFormat("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(date);
    const detail = sourceDocument.querySelector(`#day_${year}${month}${day}`);

    return {
      label,
      fullLabel: detail?.getAttribute("data-label") || label,
    };
  };

  const createForecastRow = (sourceDocument, sourceRow) => {
    const row = document.createElement("tr");
    const { label, fullLabel } = getDayLabel(sourceDocument, sourceRow);
    const dayCell = makeCell("");
    dayCell.classList.add("weather-day");
    dayCell.textContent = label;
    dayCell.setAttribute("aria-label", fullLabel);
    row.append(dayCell);

    const conditionCell = makeCell("Conditions");
    const condition = document.createElement("div");
    condition.className = "weather-condition";
    const sourceIcon = sourceRow.querySelector("img.weather-icon");
    if (sourceIcon) {
      const iconUrl = new URL(sourceIcon.getAttribute("src"), forecastUrl);
      if (iconUrl.hostname === "skipass.fr" || iconUrl.hostname === "www.skipass.com") {
        const icon = document.createElement("img");
        icon.className = "weather-icon";
        icon.src = iconUrl.href;
        icon.alt = "";
        icon.loading = "lazy";
        condition.append(icon);
        conditionCell.setAttribute("aria-label", weatherDescription(iconUrl.href));
      }
    }
    const conditionText = document.createElement("span");
    conditionText.textContent = weatherDescription(sourceIcon?.src || "");
    condition.append(conditionText);
    conditionCell.append(condition);
    row.append(conditionCell);

    const temperatureCell = makeCell("Temp. max/min à 1 850 m");
    temperatureCell.textContent =
      sourceRow.querySelector(".temperature.max-min")?.textContent.trim().replace(/\s+/g, " ") || "—";
    row.append(temperatureCell);

    const windCell = makeCell("Vent");
    windCell.classList.add("weather-wind");
    const sourceWind = sourceRow.querySelector(".wind");
    const windDirection = [...(sourceWind?.classList || [])]
      .find((className) => Object.hasOwn(windDirections, className));
    const direction = document.createElement("span");
    direction.className = "weather-wind-direction";
    direction.textContent = windDirection ? windDirections[windDirection] : "";
    windCell.append(
      document.createTextNode(sourceWind?.querySelector(".precision-small")?.textContent.trim() || "—"),
      direction,
    );
    row.append(windCell);

    const freezingCell = makeCell("Limite P/N");
    freezingCell.textContent = getFreezingLevel(sourceDocument, sourceRow);
    row.append(freezingCell);

    const snowValues = [...sourceRow.querySelectorAll(".forecast-summary-snow .value")]
      .map((element) => element.textContent.trim());
    const snowCell = makeCell("Neige");
    snowCell.classList.add("weather-snow");
    snowCell.textContent = snowValues[0] && snowValues[0] !== "-" ? `${snowValues[0]} cm` : "—";
    row.append(snowCell);

    const cumulativeCell = makeCell("Cumul");
    cumulativeCell.textContent = snowValues[1] && snowValues[1] !== "-" ? `${snowValues[1]} cm` : "—";
    row.append(cumulativeCell);

    return row;
  };

  const loadForecast = async () => {
    requestController?.abort();
    requestController = new AbortController();
    status.dataset.state = "";
    status.textContent = "Chargement des prévisions Skipass…";

    try {
      const response = await fetch(forecastUrl, {
        mode: "cors",
        credentials: "omit",
        cache: "no-cache",
        referrerPolicy: "no-referrer",
        signal: requestController.signal,
      });

      if (!response.ok) {
        throw new Error(`Skipass a répondu avec le statut ${response.status}.`);
      }

      const sourceDocument = new DOMParser().parseFromString(await response.text(), "text/html");
      const sourceRows = [
        ...sourceDocument.querySelectorAll(".resort-forecast-wrapper .day-summary.show-day"),
      ].slice(0, 8);

      if (sourceRows.length !== 8) {
        throw new Error(`8 jours de prévisions attendus, ${sourceRows.length} reçus.`);
      }

      const rows = sourceRows.map((sourceRow) => createForecastRow(sourceDocument, sourceRow));
      tableBody.replaceChildren(...rows);
      tableContainer.hidden = false;
      fallback.hidden = true;
      status.dataset.state = "success";
      status.textContent = `le ${new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
      })
        .format(new Date())
        .replace(" ", " à ")}`;
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }
      console.error("Impossible de charger les prévisions Skipass.", error);
      const hasPreviousForecast = tableBody.children.length > 0;
      tableContainer.hidden = !hasPreviousForecast;
      fallback.hidden = false;
      status.dataset.state = "error";
      status.textContent = hasPreviousForecast
        ? "La mise à jour a échoué; les dernières données chargées restent affichées."
        : "Les prévisions ne sont pas disponibles pour le moment. Réessayez ou consultez Skipass.";
    }
  };

  document.addEventListener("site:optional-content-consent", (event) => {
    if (event.detail?.accepted) {
      fallback.hidden = true;
      loadForecast();
      return;
    }

    requestController?.abort();
    tableContainer.hidden = true;
    tableBody.replaceChildren();
    fallback.hidden = false;
    status.textContent = "";
    status.dataset.state = "";
  });

})();
