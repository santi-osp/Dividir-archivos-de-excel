const state = {
  workbook: null,
  sheetName: "",
  headers: [],
  rows: [],
  fileBaseName: "ARCHIVO",
  parts: []
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
const rowsPerPartInput = document.getElementById("rowsPerPart");
const partsCountInput = document.getElementById("partsCount");
const part1RowsInput = document.getElementById("part1Rows");
const part2RowsInput = document.getElementById("part2Rows");

const splitBtn = document.getElementById("splitBtn");
const resetBtn = document.getElementById("resetBtn");
const downloadAllBtn = document.getElementById("downloadAllBtn");

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

  updateModeVisibility();
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

  excelInput.value = "";
  fileInfo.textContent = "";
  fileInfo.classList.add("hidden");
  configPanel.classList.add("hidden");
  resultPanel.classList.add("hidden");
  partsList.innerHTML = "";
  clearMessage();
}
