"use strict";

/*
 * JupyterLab HTML → IPYNB
 * Browser-only converter
 *
 * No server.
 * No upload.
 * No Python required.
 *
 * Designed around the structure produced by JupyterLab HTML exports.
 */

/* ============================================================
   GLOBAL STATE
   ============================================================ */

let convertedNotebook = null;
let outputFilename = "recovered.ipynb";


/* ============================================================
   SAFE DOM HELPERS
   ============================================================ */

function $(id) {
  return window.document.getElementById(id);
}

function setText(id, value) {
  const element = $(id);

  if (element) {
    element.textContent = String(value);
  }
}

function show(element) {
  if (element) {
    element.classList.remove("hidden");
  }
}

function hide(element) {
  if (element) {
    element.classList.add("hidden");
  }
}


/* ============================================================
   UI ELEMENTS
   ============================================================ */

const fileInput = $("fileInput");
const dropZone = $("dropZone");
const statusBox = $("status");
const report = $("report");
const downloadButton = $("downloadButton");


/* ============================================================
   STATUS
   ============================================================ */

function showStatus(message, error = false) {
  if (!statusBox) {
    console[error ? "error" : "log"](message);
    return;
  }

  statusBox.textContent = message;
  statusBox.classList.remove("hidden");
  statusBox.classList.toggle("error", error);
}


/* ============================================================
   FILE INPUT
   ============================================================ */

if (fileInput) {
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];

    if (file) {
      convertFile(file);
    }
  });
}


/* ============================================================
   DRAG & DROP
   ============================================================ */

if (dropZone) {
  dropZone.addEventListener("dragover", event => {
    event.preventDefault();

    dropZone.classList.add("dragging");

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragging");
  });

  dropZone.addEventListener("drop", event => {
    event.preventDefault();

    dropZone.classList.remove("dragging");

    const file = event.dataTransfer?.files?.[0];

    if (!file) {
      showStatus("No file was dropped.", true);
      return;
    }

    convertFile(file);
  });
}


/* ============================================================
   DOWNLOAD
   ============================================================ */

if (downloadButton) {
  downloadButton.addEventListener("click", downloadNotebook);
}

function downloadNotebook() {
  if (!convertedNotebook) {
    showStatus(
      "There is no converted notebook to download.",
      true
    );

    return;
  }

  try {
    const json = JSON.stringify(
      convertedNotebook,
      null,
      1
    );

    const blob = new Blob(
      [json],
      {
        type: "application/x-ipynb+json;charset=utf-8"
      }
    );

    const url = URL.createObjectURL(blob);

    const link =
      window.document.createElement("a");

    link.href = url;
    link.download = outputFilename;

    link.style.display = "none";

    window.document.body.appendChild(link);

    link.click();

    link.remove();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);

  } catch (error) {
    console.error(error);

    showStatus(
      `Download failed: ${error.message}`,
      true
    );
  }
}


/* ============================================================
   HTML ENTITY DECODING
   ============================================================ */

function decodeEntities(text) {
  if (!text) {
    return "";
  }

  const textarea =
    window.document.createElement("textarea");

  textarea.innerHTML = text;

  return textarea.value;
}


/* ============================================================
   CODE NORMALIZATION
   ============================================================ */

function cleanCode(source) {
  if (source == null) {
    return "";
  }

  source = String(source);

  source = decodeEntities(source);

  source = source
    .replace(/\u00a0/g, " ")
    .replace(/\u200b/g, "")
    .replace(/\ufeff/g, "");

  source = source
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  /*
   * IMPORTANT:
   *
   * Do NOT:
   *
   *   split(/\s+/)
   *   collapse spaces
   *   trim every line
   *   use get_text("\n")
   *
   * Python indentation and spacing must survive.
   */

  return source.replace(/^\n+|\n+$/g, "");
}


/* ============================================================
   DATA URL → MIME BUNDLE
   ============================================================ */

function dataUrlToMime(src) {
  if (!src || !src.startsWith("data:")) {
    return null;
  }

  const match = src.match(
    /^data:([^;,]+)(?:;[^,]*)?;base64,(.*)$/s
  );

  if (!match) {
    return null;
  }

  const mime = match[1];
  const data = match[2]
    .replace(/\s+/g, "");

  try {
    /*
     * Validate the base64.
     *
     * We don't actually need to decode/re-encode it.
     * The notebook stores the base64 payload.
     */
    window.atob(data);
  } catch {
    return null;
  }

  return {
    [mime]: data
  };
}


/* ============================================================
   IMAGE EXTRACTION
   ============================================================ */

function extractImages(element) {
  const outputs = [];

  if (!element) {
    return outputs;
  }

  const images =
    element.querySelectorAll("img");

  images.forEach(img => {
    const src =
      img.getAttribute("src") || "";

    const bundle =
      dataUrlToMime(src);

    if (!bundle) {
      return;
    }

    outputs.push({
      output_type: "display_data",
      data: bundle,
      metadata: {}
    });
  });

  return outputs;
}


/* ============================================================
   HTML OUTPUT EXTRACTION
   ============================================================ */

function extractRenderedHTML(outputArea) {
  const outputs = [];

  if (!outputArea) {
    return outputs;
  }

  const rendered =
    outputArea.querySelector(
      ".jp-RenderedHTMLCommon"
    );

  if (!rendered) {
    return outputs;
  }

  /*
   * Do not convert rendered HTML to Markdown here.
   *
   * HTML output should remain HTML output.
   */

  const content =
    rendered.innerHTML.trim();

  if (!content) {
    return outputs;
  }

  outputs.push({
    output_type: "display_data",

    data: {
      "text/html": content
    },

    metadata: {}
  });

  return outputs;
}


/* ============================================================
   TEXT OUTPUT EXTRACTION
   ============================================================ */

function extractTextOutputs(outputArea) {
  const outputs = [];

  if (!outputArea) {
    return outputs;
  }

  /*
   * JupyterLab console/stream output normally lives
   * inside <pre>.
   */

  const preTags =
    outputArea.querySelectorAll("pre");

  if (preTags.length) {
    const parts = [];

    preTags.forEach(pre => {
      const text =
        pre.textContent || "";

      if (text) {
        parts.push(text);
      }
    });

    const text =
      parts.join("\n");

    if (text.trim()) {
      outputs.push({
        output_type: "stream",
        name: "stdout",
        text
      });
    }

    return outputs;
  }

  /*
   * Fallback for outputs that don't use <pre>.
   *
   * Avoid grabbing text from known Jupyter UI elements.
   */

  const clone =
    outputArea.cloneNode(true);

  clone
    .querySelectorAll(
      ".jp-InputPrompt, " +
      ".jp-OutputPrompt, " +
      ".jp-Collapser, " +
      ".jp-InputCollapser, " +
      ".jp-OutputCollapser, " +
      ".jp-RenderedHTMLCommon, " +
      "img"
    )
    .forEach(element => {
      element.remove();
    });

  const text =
    clone.textContent
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  if (text) {
    outputs.push({
      output_type: "stream",
      name: "stdout",
      text: text + "\n"
    });
  }

  return outputs;
}


/* ============================================================
   OUTPUT EXTRACTION
   ============================================================ */

function extractOutputs(cellDiv) {
  const outputs = [];

  if (!cellDiv) {
    return outputs;
  }

  const outputArea =
    cellDiv.querySelector(
      ".jp-OutputArea"
    );

  if (!outputArea) {
    return outputs;
  }

  /*
   * Images
   */
  outputs.push(
    ...extractImages(outputArea)
  );

  /*
   * Rendered HTML
   */
  outputs.push(
    ...extractRenderedHTML(outputArea)
  );

  /*
   * Text / stream output
   */
  outputs.push(
    ...extractTextOutputs(outputArea)
  );

  return outputs;
}


/* ============================================================
   EXECUTION COUNT
   ============================================================ */

function getExecutionCount(cellDiv) {
  if (!cellDiv) {
    return null;
  }

  const prompt =
    cellDiv.querySelector(
      ".jp-InputPrompt"
    );

  if (!prompt) {
    return null;
  }

  const text =
    prompt.textContent || "";

  /*
   * Handles:
   *
   * In [1]:
   * In [ 1 ]:
   * In[1]:
   */

  const match =
    text.match(
      /In\s*\[\s*(\d+)\s*\]/i
    );

  if (!match) {
    return null;
  }

  return Number(match[1]);
}


/* ============================================================
   MARKDOWN CONVERSION
   ============================================================ */

function htmlToMarkdown(element) {
  if (!element) {
    return "";
  }

  const clone =
    element.cloneNode(true);

  /*
   * Remove Jupyter UI.
   */

  clone
    .querySelectorAll(
      [
        ".anchor-link",
        ".jp-InputPrompt",
        ".jp-OutputPrompt",
        ".jp-Collapser",
        ".jp-InputCollapser",
        ".jp-OutputCollapser",
        ".jp-OutputArea",
        "script",
        "style"
      ].join(",")
    )
    .forEach(el => el.remove());

  let markdown =
    markdownFromNode(clone);

  markdown = decodeEntities(markdown);

  markdown = markdown
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  /*
   * Remove trailing whitespace but preserve
   * indentation.
   */

  markdown = markdown
    .split("\n")
    .map(line => line.replace(/[ \t]+$/g, ""))
    .join("\n");

  return markdown.trim();
}


/* ============================================================
   NODE → MARKDOWN
   ============================================================ */

function markdownFromNode(node) {
  if (!node) {
    return "";
  }

  if (node.nodeType === Node.TEXT_NODE) {
    return node.nodeValue || "";
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const tag =
    node.tagName.toLowerCase();

  const children = () =>
    Array.from(node.childNodes)
      .map(markdownFromNode)
      .join("");

  switch (tag) {

    case "h1":
      return `\n# ${children().trim()}\n\n`;

    case "h2":
      return `\n## ${children().trim()}\n\n`;

    case "h3":
      return `\n### ${children().trim()}\n\n`;

    case "h4":
      return `\n#### ${children().trim()}\n\n`;

    case "h5":
      return `\n##### ${children().trim()}\n\n`;

    case "h6":
      return `\n###### ${children().trim()}\n\n`;

    case "strong":
    case "b": {
      const content =
        children().trim();

      return content
        ? `**${content}**`
        : "";
    }

    case "em":
    case "i": {
      const content =
        children().trim();

      return content
        ? `*${content}*`
        : "";
    }

    case "del":
    case "s": {
      const content =
        children().trim();

      return content
        ? `~~${content}~~`
        : "";
    }

    case "code":

      /*
       * Block code is handled by <pre>.
       */

      if (
        node.parentElement &&
        node.parentElement.tagName.toLowerCase() === "pre"
      ) {
        return node.textContent || "";
      }

      return "`" +
        (node.textContent || "") +
        "`";

    case "pre": {
      const code =
        node.textContent || "";

      return (
        "\n```text\n" +
        code.replace(/\n+$/, "") +
        "\n```\n\n"
      );
    }

    case "br":
      return "\n";

    case "hr":
      return "\n---\n\n";

    case "a": {
      const text =
        children().trim();

      const href =
        node.getAttribute("href");

      if (!href) {
        return text;
      }

      return `[${text}](${href})`;
    }

    case "img": {
      const alt =
        node.getAttribute("alt") || "";

      const src =
        node.getAttribute("src") || "";

      /*
       * For markdown cells, preserve image references.
       * Embedded data URLs remain embedded.
       */

      return `![${alt}](${src})`;
    }

    case "ul": {
      const items =
        Array.from(node.children)
          .filter(child =>
            child.tagName.toLowerCase() === "li"
          );

      return (
        "\n" +
        items
          .map(li => {
            const content =
              markdownFromNode(li)
                .trim()
                .replace(/\n/g, "\n  ");

            return `- ${content}`;
          })
          .join("\n") +
        "\n\n"
      );
    }

    case "ol": {
      const items =
        Array.from(node.children)
          .filter(child =>
            child.tagName.toLowerCase() === "li"
          );

      return (
        "\n" +
        items
          .map((li, index) => {
            const content =
              markdownFromNode(li)
                .trim()
                .replace(/\n/g, "\n   ");

            return `${index + 1}. ${content}`;
          })
          .join("\n") +
        "\n\n"
      );
    }

    case "li":
      return children();

    case "blockquote": {
      const content =
        children()
          .trim()
          .split("\n")
          .map(line => `> ${line}`)
          .join("\n");

      return `\n${content}\n\n`;
    }

    case "table":
      return tableToMarkdown(node);

    case "thead":
    case "tbody":
    case "tfoot":
    case "tr":
    case "td":
    case "th":
      return children();

    case "p":
      return `\n${children()}\n\n`;

    case "div":
      return `\n${children()}\n\n`;

    case "span":
      return children();

    default:
      return children();
  }
}


/* ============================================================
   TABLE → MARKDOWN
   ============================================================ */

function tableToMarkdown(table) {
  if (!table) {
    return "";
  }

  const rows =
    Array.from(
      table.querySelectorAll("tr")
    );

  if (!rows.length) {
    return "";
  }

  const data =
    rows.map(row =>
      Array.from(row.children)
        .map(cell =>
          (cell.textContent || "")
            .trim()
            .replace(/\|/g, "\\|")
            .replace(/\n/g, " ")
        )
    );

  if (!data.length) {
    return "";
  }

  const width =
    Math.max(
      ...data.map(row => row.length)
    );

  if (!width) {
    return "";
  }

  data.forEach(row => {
    while (row.length < width) {
      row.push("");
    }
  });

  let result = "\n";

  result +=
    "|" +
    data[0]
      .map(value => ` ${value} `)
      .join("|") +
    "|\n";

  result +=
    "|" +
    Array(width)
      .fill(" --- ")
      .join("|") +
    "|\n";

  for (const row of data.slice(1)) {
    result +=
      "|" +
      row
        .map(value => ` ${value} `)
        .join("|") +
      "|\n";
  }

  return result + "\n";
}


/* ============================================================
   CELL ID
   ============================================================ */

function createCellId() {
  if (
    window.crypto &&
    typeof window.crypto.randomUUID === "function"
  ) {
    return window.crypto.randomUUID();
  }

  if (
    window.crypto &&
    typeof window.crypto.getRandomValues === "function"
  ) {
    const bytes =
      new Uint8Array(16);

    window.crypto.getRandomValues(bytes);

    return (
      "cell-" +
      Array.from(bytes)
        .map(byte =>
          byte.toString(16).padStart(2, "0")
        )
        .join("")
    );
  }

  return (
    "cell-" +
    Date.now() +
    "-" +
    Math.random()
      .toString(16)
      .slice(2)
  );
}


/* ============================================================
   NOTEBOOK CREATION
   ============================================================ */

function createNotebook(cells) {
  return {
    cells,

    metadata: {
      kernelspec: {
        display_name: "Python 3",
        language: "python",
        name: "python3"
      },

      language_info: {
        name: "python"
      }
    },

    nbformat: 4,
    nbformat_minor: 5
  };
}


/* ============================================================
   BASIC NOTEBOOK VALIDATION
   ============================================================ */

function validateNotebook(notebook) {
  if (!notebook) {
    throw new Error(
      "Notebook object was not created."
    );
  }

  if (!Array.isArray(notebook.cells)) {
    throw new Error(
      "Notebook cells are invalid."
    );
  }

  if (notebook.nbformat !== 4) {
    throw new Error(
      "Invalid notebook format."
    );
  }

  notebook.cells.forEach((cell, index) => {
    if (!cell.id) {
      throw new Error(
        `Cell ${index + 1} has no ID.`
      );
    }

    if (
      cell.cell_type !== "code" &&
      cell.cell_type !== "markdown" &&
      cell.cell_type !== "raw"
    ) {
      throw new Error(
        `Cell ${index + 1} has an invalid cell type.`
      );
    }

    if (typeof cell.source !== "string") {
      throw new Error(
        `Cell ${index + 1} has invalid source.`
      );
    }
  });

  return true;
}


/* ============================================================
   FILE VALIDATION
   ============================================================ */

function validateInputFile(file) {
  if (!file) {
    throw new Error(
      "No file was selected."
    );
  }

  const name =
    file.name.toLowerCase();

  const isHTML =
    name.endsWith(".html") ||
    name.endsWith(".htm") ||
    file.type === "text/html";

  if (!isHTML) {
    throw new Error(
      "Please choose a JupyterLab .html file."
    );
  }

  if (file.size === 0) {
    throw new Error(
      "The selected file is empty."
    );
  }
}


/* ============================================================
   FIND JUPYTER CELLS
   ============================================================ */

function findJupyterCells(parsedHTML) {
  /*
   * Primary JupyterLab selector.
   */

  let cells =
    parsedHTML.querySelectorAll(
      "div.jp-Cell.jp-Notebook-cell"
    );

  if (cells.length) {
    return Array.from(cells);
  }

  /*
   * Some exports may have slightly different
   * class combinations.
   */

  cells =
    parsedHTML.querySelectorAll(
      ".jp-Notebook .jp-Cell"
    );

  if (cells.length) {
    return Array.from(cells);
  }

  /*
   * Last useful fallback.
   */

  cells =
    parsedHTML.querySelectorAll(
      ".jp-Cell"
    );

  return Array.from(cells);
}


/* ============================================================
   EXTRACT CODE SOURCE
   ============================================================ */

function extractCodeSource(cellDiv) {
  /*
   * This is intentionally modeled after the
   * working Python implementation.
   */

  const editor =
    cellDiv.querySelector(
      ".jp-CodeMirrorEditor.jp-InputArea-editor"
    );

  if (editor) {
    const pre =
      editor.querySelector("pre");

    if (pre) {
      /*
       * CRITICAL:
       *
       * textContent concatenates syntax-highlight
       * spans without inserting artificial newlines.
       */

      return cleanCode(
        pre.textContent || ""
      );
    }

    return cleanCode(
      editor.textContent || ""
    );
  }

  /*
   * Fallback.
   */

  const pre =
    cellDiv.querySelector("pre");

  if (pre) {
    return cleanCode(
      pre.textContent || ""
    );
  }

  /*
   * Last resort.
   */

  return cleanCode(
    cellDiv.textContent || ""
  );
}


/* ============================================================
   RECONSTRUCT NOTEBOOK
   ============================================================ */

function reconstructNotebook(cellDivs) {
  const cells = [];

  let codeCount = 0;
  let markdownCount = 0;
  let unknownCount = 0;
  let outputCount = 0;
  let imageCount = 0;

  const diagnostics = [];

  cellDivs.forEach((cellDiv, index) => {
    const cellNumber = index + 1;

    const classes =
      new Set(
        Array.from(cellDiv.classList)
      );

    /*
     * CODE
     */

    if (classes.has("jp-CodeCell")) {
      codeCount++;

      const source =
        extractCodeSource(cellDiv);

      const outputs =
        extractOutputs(cellDiv);

      outputCount += outputs.length;

      outputs.forEach(output => {
        if (
          output.data &&
          Object.keys(output.data)
            .some(key =>
              key.startsWith("image/")
            )
        ) {
          imageCount++;
        }
      });

      const cell = {
        cell_type: "code",

        execution_count:
          getExecutionCount(cellDiv),

        id: createCellId(),

        metadata: {},

        outputs,

        source
      };

      cells.push(cell);

      diagnostics.push({
        cell: cellNumber,
        type: "code",
        chars: source.length,
        lines: source
          ? source.split("\n").length
          : 0
      });

      return;
    }

    /*
     * MARKDOWN
     */

    if (
      classes.has("jp-MarkdownCell") ||
      classes.has("jp-Markdown-cell")
    ) {
      markdownCount++;

      const rendered =
        cellDiv.querySelector(
          ".jp-RenderedHTMLCommon"
        );

      const source =
        rendered
          ? htmlToMarkdown(rendered)
          : "";

      cells.push({
        cell_type: "markdown",

        id: createCellId(),

        metadata: {},

        source
      });

      diagnostics.push({
        cell: cellNumber,
        type: "markdown",
        chars: source.length,
        lines: source
          ? source.split("\n").length
          : 0
      });

      return;
    }

    /*
     * UNKNOWN CELL
     */

    unknownCount++;

    /*
     * Try to recover unknown cells containing code.
     */

    const pre =
      cellDiv.querySelector("pre");

    if (pre) {
      const source =
        cleanCode(
          pre.textContent || ""
        );

      cells.push({
        cell_type: "code",
        execution_count: null,
        id: createCellId(),
        metadata: {},
        outputs: [],
        source
      });

      codeCount++;

      diagnostics.push({
        cell: cellNumber,
        type: "unknown → code",
        chars: source.length,
        lines: source
          ? source.split("\n").length
          : 0
      });

      return;
    }

    /*
     * Try rendered Markdown.
     */

    const rendered =
      cellDiv.querySelector(
        ".jp-RenderedHTMLCommon"
      );

    if (rendered) {
      const source =
        htmlToMarkdown(rendered);

      cells.push({
        cell_type: "markdown",
        id: createCellId(),
        metadata: {},
        source
      });

      markdownCount++;

      diagnostics.push({
        cell: cellNumber,
        type: "unknown → markdown",
        chars: source.length,
        lines: source
          ? source.split("\n").length
          : 0
      });

      return;
    }

    /*
     * Preserve completely empty unknown cells
     * as Markdown rather than silently dropping them.
     */

    cells.push({
      cell_type: "markdown",
      id: createCellId(),
      metadata: {},
      source: ""
    });

    markdownCount++;

    diagnostics.push({
      cell: cellNumber,
      type: "unknown → empty markdown",
      chars: 0,
      lines: 0
    });
  });

  return {
    notebook: createNotebook(cells),

    statistics: {
      originalCells: cellDivs.length,
      recoveredCells: cells.length,
      codeCells: codeCount,
      markdownCells: markdownCount,
      unknownCells: unknownCount,
      outputs: outputCount,
      images: imageCount
    },

    diagnostics
  };
}


/* ============================================================
   MAIN CONVERSION
   ============================================================ */

async function convertFile(file) {
  hide(report);

  convertedNotebook = null;

  try {
    validateInputFile(file);

    showStatus(
      `Reading ${file.name}...`
    );

    /*
     * Read locally.
     */

    const rawHTML =
      await file.text();

    if (!rawHTML.trim()) {
      throw new Error(
        "The HTML file is empty."
      );
    }

    showStatus(
      "Parsing JupyterLab HTML..."
    );

    /*
     * IMPORTANT:
     *
     * Never call this variable "document".
     * That would shadow window.document.
     */

    const parser =
      new DOMParser();

    const parsedHTML =
      parser.parseFromString(
        rawHTML,
        "text/html"
      );

    /*
     * Find notebook cells.
     */

    const cellDivs =
      findJupyterCells(parsedHTML);

    if (!cellDivs.length) {
      throw new Error(
        "No JupyterLab notebook cells were found. Make sure the file was exported from JupyterLab as HTML."
      );
    }

    showStatus(
      `Recovering ${cellDivs.length} notebook cells...`
    );

    /*
     * Reconstruct.
     */

    const result =
      reconstructNotebook(cellDivs);

    /*
     * Validate.
     */

    validateNotebook(
      result.notebook
    );

    /*
     * Store globally for download.
     */

    convertedNotebook =
      result.notebook;

    /*
     * Filename.
     */

    const base =
      file.name.replace(
        /\.(html?|HTML?)$/,
        ""
      );

    outputFilename =
      `${base}_RECOVERED.ipynb`;

    /*
     * Statistics.
     */

    const stats =
      result.statistics;

    setText(
      "totalCells",
      stats.recoveredCells
    );

    setText(
      "codeCells",
      stats.codeCells
    );

    setText(
      "markdownCells",
      stats.markdownCells
    );

    setText(
      "outputs",
      stats.outputs
    );

    setText(
      "images",
      stats.images
    );

    /*
     * Show report.
     */

    show(report);

    showStatus(
      `✓ Successfully recovered ${stats.recoveredCells} cells from ${file.name}.`
    );

    /*
     * Console diagnostics.
     *
     * Useful when testing unusual notebooks.
     */

    console.group(
      "Jupyter HTML → IPYNB"
    );

    console.log(
      "Input:",
      file.name
    );

    console.log(
      "Original cells:",
      stats.originalCells
    );

    console.log(
      "Recovered cells:",
      stats.recoveredCells
    );

    console.log(
      "Code cells:",
      stats.codeCells
    );

    console.log(
      "Markdown cells:",
      stats.markdownCells
    );

    console.log(
      "Unknown cells:",
      stats.unknownCells
    );

    console.log(
      "Outputs:",
      stats.outputs
    );

    console.log(
      "Images:",
      stats.images
    );

    console.table(
      result.diagnostics
    );

    console.groupEnd();

  } catch (error) {
    convertedNotebook = null;

    console.error(
      "Jupyter conversion failed:",
      error
    );

    hide(report);

    showStatus(
      `Conversion failed: ${error.message || error}`,
      true
    );
  }
}


/* ============================================================
   OPTIONAL GLOBAL DEBUG API
   ============================================================ */

/*
 * These make debugging from the browser console easier.
 *
 * Example:
 *
 *   convertedNotebook
 *
 * or:
 *
 *   window.jupyterConverter
 */

window.jupyterConverter = {
  convertFile,
  cleanCode,
  htmlToMarkdown,
  extractOutputs,
  validateNotebook,

  get notebook() {
    return convertedNotebook;
  }
};
