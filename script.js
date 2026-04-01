const state = {
  workbook: null,
  sheetName: "",
  headers: [],
  rows: [],
  fileBaseName: "ARCHIVO",
  parts: [],
  pointCuts: [],
  compare: {
    left: {
      fileName: "",
      values: []
    },
    right: {
      fileName: "",
      values: []
    }
  }
};

const excelInput = document.getElementById("excelInput");
const dropZone = document.getElementById("dropZone");
const fileInfo = document.getElementById("fileInfo");
const configPanel = document.getElementById("configPanel");
const resultPanel = document.getElementById("resultPanel");
const messagePanel = document.getElementById("messagePanel");
const summaryText = document.getElementById("summaryText");
const partsList = document.getElementById("partsList");
const rowsMode = document.getElementById("rowsMode");
const partsMode = document.getElementById("partsMode");
const customTwoMode = document.getElementById("customTwoMode");
const pointsMode = document.getElementById("pointsMode");
const rowsPerPartInput = document.getElementById("rowsPerPart");
const partsCountInput = document.getElementById("partsCount");
const part1RowsInput = document.getElementById("part1Rows");
const part2RowsInput = document.getElementById("part2Rows");
const pointsCountInput = document.getElementById("pointsCount");
const pointsBar = document.getElementById("pointsBar");
const splitPointsSummary = document.getElementById("splitPointsSummary");
const partsCounters = document.getElementById("partsCounters");
const evenlyDistributeBtn = document.getElementById("evenlyDistributeBtn");

const splitBtn = document.getElementById("splitBtn");
const resetBtn = document.getElementById("resetBtn");
const downloadAllBtn = document.getElementById("downloadAllBtn");
const leftDropZone = document.getElementById("leftDropZone");
const rightDropZone = document.getElementById("rightDropZone");
const leftCsvInput = document.getElementById("leftCsvInput");
const rightCsvInput = document.getElementById("rightCsvInput");
const leftFileInfo = document.getElementById("leftFileInfo");
const rightFileInfo = document.getElementById("rightFileInfo");
const leftSearchInput = document.getElementById("leftSearchInput");
const rightSearchInput = document.getElementById("rightSearchInput");
const leftSheetBody = document.getElementById("leftSheetBody");
const rightSheetBody = document.getElementById("rightSheetBody");
const leftSheetWrap = document.getElementById("leftSheetWrap");
const rightSheetWrap = document.getElementById("rightSheetWrap");
const leftMatchInfo = document.getElementById("leftMatchInfo");
const rightMatchInfo = document.getElementById("rightMatchInfo");
const leftStats = document.getElementById("leftStats");
const rightStats = document.getElementById("rightStats");
const compareSummary = document.getElementById("compareSummary");

const pointsDragState = {
  active: false,
  index: -1
};

init();

function init() {
  dropZone.addEventListener("click", () => excelInput.click());
  dropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      excelInput.click();
    }
  });

  excelInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  });

  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragover");
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      excelInput.files = event.dataTransfer.files;
      handleFile(file);
    }
  });

  document.querySelectorAll('input[name="splitMode"]').forEach((radio) => {
    radio.addEventListener("change", updateModeVisibility);
  });

  splitBtn.addEventListener("click", splitFile);
  resetBtn.addEventListener("click", resetState);
  downloadAllBtn.addEventListener("click", () => {
    state.parts.forEach((part) => downloadPart(part));
  });
  pointsCountInput.addEventListener("input", handlePointsCountChange);
  evenlyDistributeBtn.addEventListener("click", distributePointsEvenly);
  window.addEventListener("resize", () => {
    if (state.rows.length && getSelectedMode() === "points") {
      renderPointsBar();
    }
  });

  setupCompareUploader("left");
  setupCompareUploader("right");
  leftSearchInput.addEventListener("input", () => renderCompareList("left"));
  rightSearchInput.addEventListener("input", () => renderCompareList("right"));
  setupCompareScrollSync();

  updateModeVisibility();
  renderPointsBar();
}

function setupCompareScrollSync() {
  let syncing = false;

  const syncScroll = (source, target) => {
    if (syncing) return;
    syncing = true;
    target.scrollTop = source.scrollTop;
    syncing = false;
  };

  leftSheetWrap.addEventListener("scroll", () => syncScroll(leftSheetWrap, rightSheetWrap));
  rightSheetWrap.addEventListener("scroll", () => syncScroll(rightSheetWrap, leftSheetWrap));
}

function handlePointsCountChange() {
  if (!state.rows.length) {
    renderPointsBar();
    return;
  }

  const count = normalizePointCount();
  state.pointCuts = buildEvenCuts(state.rows.length, count);
  renderPointsBar();
}

function normalizePointCount() {
  const requested = Number(pointsCountInput.value);
  let count = Number.isInteger(requested) ? requested : 1;
  count = Math.max(1, count);

  if (state.rows.length > 1) {
    count = Math.min(count, state.rows.length - 1);
  }

  pointsCountInput.value = String(count);
  return count;
}

function buildEvenCuts(totalRows, count) {
  if (totalRows <= 1 || count <= 0) {
    return [];
  }

  const maxCuts = Math.min(count, totalRows - 1);
  const cuts = [];
  let previous = 0;

  for (let i = 1; i <= maxCuts; i++) {
    const minAllowed = previous + 1;
    const maxAllowed = totalRows - (maxCuts - i) - 1;
    let candidate = Math.round((totalRows * i) / (maxCuts + 1));
    candidate = Math.max(minAllowed, Math.min(maxAllowed, candidate));
    cuts.push(candidate);
    previous = candidate;
  }

  return cuts;
}

function sanitizeCuts(cuts, totalRows) {
  const normalized = [...new Set(
    cuts
      .map((value) => Math.round(value))
      .filter((value) => value >= 1 && value <= totalRows - 1)
  )].sort((a, b) => a - b);

  const expectedCount = Math.min(normalizePointCount(), Math.max(0, totalRows - 1));
  if (normalized.length !== expectedCount) {
    return buildEvenCuts(totalRows, expectedCount);
  }

  return normalized;
}

function distributePointsEvenly() {
  if (!state.rows.length) {
    return;
  }

  state.pointCuts = buildEvenCuts(state.rows.length, normalizePointCount());
  renderPointsBar();
}

function renderPointsBar() {
  pointsBar.innerHTML = "";
  partsCounters.innerHTML = "";

  const totalRows = state.rows.length;
  if (!totalRows) {
    splitPointsSummary.textContent = "Partes: 0 | Filas totales: 0";
    return;
  }

  state.pointCuts = sanitizeCuts(state.pointCuts, totalRows);
  const boundaries = [0, ...state.pointCuts, totalRows];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const segment = document.createElement("div");
    const start = boundaries[i];
    const end = boundaries[i + 1];
    segment.className = "points-segment";
    segment.style.left = `${(start / totalRows) * 100}%`;
    segment.style.width = `${((end - start) / totalRows) * 100}%`;
    pointsBar.appendChild(segment);
  }

  state.pointCuts.forEach((cut, index) => {
    const left = (cut / totalRows) * 100;

    const label = document.createElement("span");
    label.className = "point-label";
    label.style.left = `${left}%`;
    label.textContent = String(cut);

    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "point-handle";
    handle.style.left = `${left}%`;
    handle.setAttribute("aria-label", `Punto ${index + 1}, fila ${cut}`);
    handle.addEventListener("pointerdown", (event) => startPointDrag(event, index));

    pointsBar.appendChild(label);
    pointsBar.appendChild(handle);
  });

  renderPartsCounters(boundaries);
  splitPointsSummary.textContent = `Partes: ${boundaries.length - 1} | Filas totales: ${totalRows}`;
}

function renderPartsCounters(boundaries) {
  partsCounters.innerHTML = "";

  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i] + 1;
    const end = boundaries[i + 1];
    const size = boundaries[i + 1] - boundaries[i];

    const card = document.createElement("article");
    card.className = "part-counter";

    const title = document.createElement("strong");
    title.textContent = `PARTE ${String(i + 1).padStart(2, "0")}`;

    const amount = document.createElement("span");
    amount.textContent = `${size} fila(s)`;

    const range = document.createElement("small");
    range.textContent = `Filas ${start} a ${end}`;

    card.appendChild(title);
    card.appendChild(amount);
    card.appendChild(range);
    partsCounters.appendChild(card);
  }
}

function startPointDrag(event, index) {
  if (!state.rows.length) {
    return;
  }

  event.preventDefault();
  pointsDragState.active = true;
  pointsDragState.index = index;

  window.addEventListener("pointermove", onPointDrag);
  window.addEventListener("pointerup", stopPointDrag, { once: true });
  window.addEventListener("pointercancel", stopPointDrag, { once: true });
}

function onPointDrag(event) {
  if (!pointsDragState.active || !state.rows.length || state.pointCuts.length === 0) {
    return;
  }

  const rect = pointsBar.getBoundingClientRect();
  if (!rect.width) {
    return;
  }

  const index = pointsDragState.index;
  const totalRows = state.rows.length;
  const previousLimit = index === 0 ? 1 : state.pointCuts[index - 1] + 1;
  const nextLimit = index === state.pointCuts.length - 1 ? totalRows - 1 : state.pointCuts[index + 1] - 1;

  let ratio = (event.clientX - rect.left) / rect.width;
  ratio = Math.max(0, Math.min(1, ratio));

  let row = Math.round(ratio * totalRows);
  row = Math.max(previousLimit, Math.min(nextLimit, row));

  if (state.pointCuts[index] !== row) {
    state.pointCuts[index] = row;
    renderPointsBar();
  }
}

function stopPointDrag() {
  pointsDragState.active = false;
  pointsDragState.index = -1;
  window.removeEventListener("pointermove", onPointDrag);
}

function setupCompareUploader(side) {
  const zone = side === "left" ? leftDropZone : rightDropZone;
  const input = side === "left" ? leftCsvInput : rightCsvInput;

  zone.addEventListener("click", () => input.click());
  zone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      input.click();
    }
  });

  input.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) {
      handleCompareFile(side, file);
    }
  });

  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.classList.add("dragover");
  });

  zone.addEventListener("dragleave", () => {
    zone.classList.remove("dragover");
  });

  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("dragover");
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      input.files = event.dataTransfer.files;
      handleCompareFile(side, file);
    }
  });
}

function handleCompareFile(side, file) {
  if (!/\.csv$/i.test(file.name)) {
    showError("En la sección de comparación solo se permiten archivos CSV.");
    return;
  }

  clearMessage();
  const reader = new FileReader();

  reader.onload = (event) => {
    try {
      const workbook = XLSX.read(event.target.result, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

      const values = data
        .map((row) => {
          const value = Array.isArray(row) ? row[0] : row;
          return String(value ?? "").trim();
        })
        .filter((value) => value !== "");

      if (!values.length) {
        showError("El CSV no contiene datos válidos en la primera columna.");
        return;
      }

      state.compare[side].fileName = file.name;
      state.compare[side].values = values;

      const info = side === "left" ? leftFileInfo : rightFileInfo;
      info.textContent = `${file.name} | ${values.length} fila(s)`;
      info.classList.remove("hidden");

      renderCompareList(side);
      updateCompareSummary();
    } catch (error) {
      showError("No se pudo leer el CSV en la sección de comparación.");
      console.error(error);
    }
  };

  reader.readAsArrayBuffer(file);
}

function renderCompareList(side) {
  const values = state.compare[side].values;
  const queryInput = side === "left" ? leftSearchInput : rightSearchInput;
  const body = side === "left" ? leftSheetBody : rightSheetBody;
  const info = side === "left" ? leftMatchInfo : rightMatchInfo;
  const stats = side === "left" ? leftStats : rightStats;
  const query = queryInput.value.trim();
  const normalizedQuery = query.toUpperCase();

  const rows = values.map((value, index) => ({
    rowNumber: index + 1,
    value
  }));

  const filtered = !normalizedQuery
    ? rows
    : rows.filter((row) => row.value.toUpperCase().includes(normalizedQuery));

  body.innerHTML = "";

  if (!values.length) {
    info.textContent = "0 resultados";
    stats.textContent = "Filas totales: 0 | Fila final visible: 0";
    return;
  }

  const otherSide = side === "left" ? "right" : "left";
  const otherSet = new Set(state.compare[otherSide].values.map((value) => value.toUpperCase()));

  const visible = filtered.slice(0, 1200);
  visible.forEach((row) => {
    const tr = document.createElement("tr");

    const indexCell = document.createElement("td");
    indexCell.className = "row-index";
    indexCell.textContent = String(row.rowNumber);

    const valueCell = document.createElement("td");
    appendHighlightedText(valueCell, row.value, query);

    const commonCell = document.createElement("td");
    const isCommon = otherSet.has(row.value.toUpperCase());
    commonCell.textContent = isCommon ? "SI" : "";
    if (isCommon) {
      commonCell.classList.add("common-yes");
    }

    tr.appendChild(indexCell);
    tr.appendChild(valueCell);
    tr.appendChild(commonCell);
    body.appendChild(tr);
  });

  if (filtered.length > visible.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 3;
    td.textContent = `Mostrando ${visible.length} de ${filtered.length} resultados.`;
    tr.appendChild(td);
    body.appendChild(tr);
  }

  info.textContent = `${filtered.length} resultado(s) de ${values.length} fila(s)`;
  const finalVisible = filtered.length ? filtered[filtered.length - 1].rowNumber : 0;
  stats.textContent = `Filas totales: ${values.length} | Fila final visible: ${finalVisible}`;
}

function appendHighlightedText(container, text, query) {
  if (!query) {
    container.textContent = text;
    return;
  }

  const source = text;
  const lowerSource = source.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let cursor = 0;
  let index = lowerSource.indexOf(lowerQuery, cursor);

  if (index === -1) {
    container.textContent = text;
    return;
  }

  while (index !== -1) {
    if (index > cursor) {
      container.appendChild(document.createTextNode(source.slice(cursor, index)));
    }

    const mark = document.createElement("mark");
    mark.textContent = source.slice(index, index + query.length);
    container.appendChild(mark);

    cursor = index + query.length;
    index = lowerSource.indexOf(lowerQuery, cursor);
  }

  if (cursor < source.length) {
    container.appendChild(document.createTextNode(source.slice(cursor)));
  }
}

function updateCompareSummary() {
  const leftValues = state.compare.left.values;
  const rightValues = state.compare.right.values;

  if (!leftValues.length || !rightValues.length) {
    compareSummary.textContent = "Carga ambos archivos para ver coincidencias.";
    return;
  }

  const leftSet = new Set(leftValues.map((value) => value.toUpperCase()));
  const rightSet = new Set(rightValues.map((value) => value.toUpperCase()));
  let commonCount = 0;
  leftSet.forEach((value) => {
    if (rightSet.has(value)) {
      commonCount += 1;
    }
  });

  compareSummary.textContent = `CSV A: ${leftValues.length} filas (fila final ${leftValues.length}) | CSV B: ${rightValues.length} filas (fila final ${rightValues.length}) | Codigos en comun: ${commonCount}`;
}

function updateModeVisibility() {
  const selected = getSelectedMode();

  document.querySelectorAll(".mode-card").forEach((card) => {
    const radio = card.querySelector('input[name="splitMode"]');
    card.classList.toggle("active", radio.checked);
  });

  rowsMode.classList.toggle("hidden", selected !== "rows");
  partsMode.classList.toggle("hidden", selected !== "parts");
  customTwoMode.classList.toggle("hidden", selected !== "custom-two");
  pointsMode.classList.toggle("hidden", selected !== "points");

  if (selected === "points") {
    renderPointsBar();
  }
}

function getSelectedMode() {
  return document.querySelector('input[name="splitMode"]:checked')?.value || "rows";
}

function handleFile(file) {
  clearMessage();
  const reader = new FileReader();

  reader.onload = (event) => {
    try {
      const arrayBuffer = event.target.result;
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

      if (!data.length) {
        showError("El archivo está vacío.");
        return;
      }

      const [headers, ...rows] = data;

      if (!headers || headers.length === 0) {
        showError("No se pudo detectar una fila de encabezados válida.");
        return;
      }

      state.workbook = workbook;
      state.sheetName = sheetName;
      state.headers = headers;
      state.rows = rows;
      state.fileBaseName = sanitizeBaseName(file.name);
      state.parts = [];

      fileInfo.textContent = `Archivo: ${file.name} | Hoja: ${sheetName} | Filas de datos: ${rows.length}`;
      fileInfo.classList.remove("hidden");
      configPanel.classList.remove("hidden");
      resultPanel.classList.add("hidden");

      part1RowsInput.value = Math.max(1, Math.floor(rows.length / 2)) || 1;
      part2RowsInput.value = Math.max(1, rows.length - Number(part1RowsInput.value)) || 1;
      pointsCountInput.max = String(Math.max(1, rows.length - 1));
      pointsCountInput.disabled = rows.length < 2;
      evenlyDistributeBtn.disabled = rows.length < 2;
      state.pointCuts = buildEvenCuts(rows.length, normalizePointCount());
      renderPointsBar();
    } catch (error) {
      showError("No se pudo leer el archivo. Verifica que sea Excel válido.");
      console.error(error);
    }
  };

  reader.readAsArrayBuffer(file);
}

function splitFile() {
  clearMessage();

  if (!state.rows.length) {
    showError("Primero sube un archivo con datos.");
    return;
  }

  const mode = getSelectedMode();
  let parts = [];

  if (mode === "rows") {
    const rowsPerPart = Number(rowsPerPartInput.value);
    if (!Number.isInteger(rowsPerPart) || rowsPerPart < 1) {
      showError("Ingresa una cantidad válida de filas por parte.");
      return;
    }
    parts = splitByRows(state.rows, rowsPerPart);
  }

  if (mode === "parts") {
    const partsCount = Number(partsCountInput.value);
    if (!Number.isInteger(partsCount) || partsCount < 2) {
      showError("Ingresa una cantidad válida de partes (mínimo 2).");
      return;
    }
    if (partsCount > state.rows.length) {
      showError("La cantidad de partes no puede ser mayor que la cantidad de filas.");
      return;
    }
    parts = splitByPartCount(state.rows, partsCount);
  }

  if (mode === "custom-two") {
    const part1 = Number(part1RowsInput.value);
    const part2 = Number(part2RowsInput.value);
    if (!Number.isInteger(part1) || !Number.isInteger(part2) || part1 < 1 || part2 < 1) {
      showError("Ingresa valores válidos para parte 1 y parte 2.");
      return;
    }

    const total = part1 + part2;
    if (total !== state.rows.length) {
      showError(`Parte 1 + Parte 2 debe sumar exactamente ${state.rows.length} filas.`);
      return;
    }

    parts = [
      state.rows.slice(0, part1),
      state.rows.slice(part1, part1 + part2)
    ];
  }

  if (mode === "points") {
    if (state.rows.length < 2) {
      showError("Necesitas al menos 2 filas para dividir con puntos.");
      return;
    }

    const count = normalizePointCount();
    state.pointCuts = sanitizeCuts(state.pointCuts, state.rows.length);

    if (state.pointCuts.length !== count) {
      state.pointCuts = buildEvenCuts(state.rows.length, count);
    }

    if (!state.pointCuts.length) {
      showError("No se pudieron generar cortes válidos para dividir.");
      return;
    }

    parts = splitByCutPoints(state.rows, state.pointCuts);
    renderPointsBar();
  }

  state.parts = parts.map((rows, index) => ({
    rows,
    index: index + 1,
    fileName: buildFileName(state.fileBaseName, index + 1)
  }));

  renderResults();
}

function splitByRows(rows, rowsPerPart) {
  const result = [];
  for (let i = 0; i < rows.length; i += rowsPerPart) {
    result.push(rows.slice(i, i + rowsPerPart));
  }
  return result;
}

function splitByPartCount(rows, count) {
  const result = [];
  const baseSize = Math.floor(rows.length / count);
  let remainder = rows.length % count;
  let start = 0;

  for (let i = 0; i < count; i++) {
    const size = baseSize + (remainder > 0 ? 1 : 0);
    const end = start + size;
    result.push(rows.slice(start, end));
    start = end;
    if (remainder > 0) remainder -= 1;
  }

  return result;
}

function splitByCutPoints(rows, cuts) {
  const result = [];
  let start = 0;

  cuts.forEach((cut) => {
    result.push(rows.slice(start, cut));
    start = cut;
  });

  result.push(rows.slice(start));
  return result.filter((chunk) => chunk.length > 0);
}

function renderResults() {
  partsList.innerHTML = "";

  summaryText.textContent = `Se generaron ${state.parts.length} parte(s) desde ${state.rows.length} fila(s) de datos.`;

  state.parts.forEach((part) => {
    const row = document.createElement("article");
    row.className = "part-item";

    const meta = document.createElement("div");
    meta.className = "part-meta";

    const name = document.createElement("div");
    name.className = "part-name";
    name.textContent = part.fileName;

    const rows = document.createElement("div");
    rows.className = "part-rows";
    rows.textContent = `${part.rows.length} fila(s)`;

    meta.appendChild(name);
    meta.appendChild(rows);

    const button = document.createElement("button");
    button.className = "btn btn-ghost";
    button.textContent = "Descargar";
    button.addEventListener("click", () => downloadPart(part));

    row.appendChild(meta);
    row.appendChild(button);
    partsList.appendChild(row);
  });

  resultPanel.classList.remove("hidden");
}

function downloadPart(part) {
  const sheetData = [state.headers, ...part.rows];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  const csvContent = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csvContent], { type: "text/plain;charset=utf-8;" });
  const safeFileName = `${part.fileName.replace(/\.[^/.]+$/, "")}.csv`;
  triggerDownload(blob, safeFileName);
}

function triggerDownload(blob, fileName) {
  if (window.navigator && typeof window.navigator.msSaveOrOpenBlob === "function") {
    window.navigator.msSaveOrOpenBlob(blob, fileName);
    return;
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.style.display = "none";
  anchor.href = url;
  anchor.setAttribute("download", fileName);

  document.body.appendChild(anchor);
  anchor.click();

  setTimeout(() => {
    URL.revokeObjectURL(url);
    anchor.remove();
  }, 0);
}

function buildFileName(baseName, index) {
  const partNumber = String(index).padStart(2, "0");
  return `${baseName}_PARTE_${partNumber}`;
}

function sanitizeBaseName(fileName) {
  const withoutExt = fileName.replace(/\.[^/.]+$/, "");
  const normalized = withoutExt
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "ARCHIVO";

  return normalized.toUpperCase();
}

function showError(message) {
  messagePanel.textContent = message;
  messagePanel.classList.remove("hidden");
}

function clearMessage() {
  messagePanel.textContent = "";
  messagePanel.classList.add("hidden");
}

function resetState() {
  state.workbook = null;
  state.sheetName = "";
  state.headers = [];
  state.rows = [];
  state.fileBaseName = "ARCHIVO";
  state.parts = [];
  state.pointCuts = [];

  excelInput.value = "";
  fileInfo.textContent = "";
  fileInfo.classList.add("hidden");
  configPanel.classList.add("hidden");
  resultPanel.classList.add("hidden");
  partsList.innerHTML = "";
  pointsCountInput.value = "2";
  pointsCountInput.max = "9999";
  pointsCountInput.disabled = false;
  evenlyDistributeBtn.disabled = false;
  renderPointsBar();
  clearMessage();
}
