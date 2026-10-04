"use strict";

const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const statusBox = document.getElementById("status");
const report = document.getElementById("report");
const downloadButton = document.getElementById("downloadButton");

let convertedNotebook = null;
let outputFilename = "recovered.ipynb";

fileInput.addEventListener("change", () => {
  if (fileInput.files.length) {
    convertFile(fileInput.files[0]);
  }
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("dragging");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragging");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("dragging");

  const file = event.dataTransfer.files[0];

  if (file) {
    convertFile(file);
  }
});

downloadButton.addEventListener("click", () => {
  if (!convertedNotebook) return;

  const blob = new Blob(
    [JSON.stringify(convertedNotebook, null, 1)],
    { type: "application/x-ipynb+json" }
  );

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = outputFilename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
});


function showStatus(message, error = false) {
  statusBox.textContent = message;
  statusBox.classList.remove("hidden");

  statusBox.classList.toggle("error", error);
}


function cleanCode(source) {
  if (!source) return "";

  source = decodeEntities(source);

  source = source
    .replace(/\u00a0/g, " ")
    .replace(/\u200b/g, "")
    .replace(/\ufeff/g, "");

  source = source
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  return source.replace(/^\n+|\n+$/g, "");
}


function decodeEntities(text) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}


function dataUrlToMime(src) {
  if (!src || !src.startsWith("data:")) {
    return null;
  }

  const match = src.match(
    /^data:([^;,]+)(?:;[^,]*)?;base64,(.*)$/s
  );

  if (!match) return null;

  const mime = match[1];
  const data = match[2].replace(/\s+/g, "");

  try {
    atob(data);
  } catch {
    return null;
  }

  return {
    [mime]: data
  };
}


function extractImages(element) {
  const outputs = [];

  if (!element) return outputs;

  const images = element.querySelectorAll("img");

  for (const img of images) {
    const bundle = dataUrlToMime(
      img.getAttribute("src")
    );

    if (!bundle) continue;

    outputs.push({
      output_type: "display_data",
      data: bundle,
      metadata: {}
    });
  }

  return outputs;
}


function htmlToMarkdown(element) {
  if (!element) return "";

  const clone = element.cloneNode(true);

  clone
    .querySelectorAll(
      ".anchor-link, .jp-InputPrompt, .jp-OutputPrompt, .jp-Collapser, .jp-InputCollapser, .jp-OutputCollapser, script, style"
    )
    .forEach(el => el.remove());

  return markdownFromNode(clone)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(line => line.trimEnd())
    .join("\n")
    .trim();
}


function markdownFromNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.nodeValue
      .replace(/\u00a0/g, " ");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const tag = node.tagName.toLowerCase();

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
    case "b":
      return `**${children().trim()}**`;

    case "em":
    case "i":
      return `*${children().trim()}*`;

    case "del":
    case "s":
      return `~~${children().trim()}~~`;

    case "code":
      if (node.parentElement?.tagName.toLowerCase() === "pre") {
        return node.textContent;
      }

      return "`" + node.textContent + "`";

    case "pre":
      return `\n\`\`\`\n${node.textContent}\n\`\`\`\n\n`;

    case "br":
      return "\n";

    case "hr":
      return "\n---\n\n";

    case "a": {
      const text = children().trim();
      const href = node.getAttribute("href");

      if (!href) return text;

      return `[${text}](${href})`;
    }

    case "img": {
      const alt = node.getAttribute("alt") || "";
      const src = node.getAttribute("src") || "";

      return `![${alt}](${src})`;
    }

    case "ul":
      return (
        "\n" +
        Array.from(node.children)
          .map(li => {
            return "- " +
              markdownFromNode(li)
                .trim()
                .replace(/\n/g, "\n  ");
          })
          .join("\n") +
        "\n\n"
      );

    case "ol":
      return (
        "\n" +
        Array.from(node.children)
          .map((li, index) => {
            return `${index + 1}. ` +
              markdownFromNode(li)
                .trim()
                .replace(/\n/g, "\n   ");
          })
          .join("\n") +
        "\n\n"
      );

    case "li":
      return children();

    case "blockquote":
      return (
        "\n" +
        children()
          .trim()
          .split("\n")
          .map(line => "> " + line)
          .join("\n") +
        "\n\n"
      );

    case "p":
    case "div":
      return `\n${children()}\n\n`;

    case "table":
      return tableToMarkdown(node);

    default:
      return children();
  }
}


function tableToMarkdown(table) {
  const rows = Array.from(
    table.querySelectorAll("tr")
  );

  if (!rows.length) return "";

  const data = rows.map(row =>
    Array.from(row.children).map(cell =>
      cell.textContent
        .trim()
        .replace(/\|/g, "\\|")
        .replace(/\n/g, " ")
    )
  );

  if (!data.length) return "";

  const width = data[0].length;

  let result = "\n";

  result += "|" + data[0].map(x => ` ${x} `).join("|") + "|\n";
  result += "|" + Array(width).fill("---").join("|") + "|\n";

  for (const row of data.slice(1)) {
    while (row.length < width) row.push("");

    result +=
      "|" +
      row.map(x => ` ${x} `).join("|") +
      "|\n";
  }

  return result + "\n";
}


function extractOutputs(cell) {
  const outputs = [];

  const outputArea = cell.querySelector(
    ".jp-OutputArea"
  );

  if (!outputArea) return outputs;

  // Images
  outputs.push(
    ...extractImages(outputArea)
  );

  // Rendered HTML
  const renderedHTML =
    outputArea.querySelector(
      ".jp-RenderedHTMLCommon"
    );

  if (renderedHTML) {
    const content =
      renderedHTML.innerHTML.trim();

    if (content) {
      outputs.push({
        output_type: "display_data",
        data: {
          "text/html": content
        },
        metadata: {}
      });
    }
  }

  // Preformatted text
  const preTags =
    outputArea.querySelectorAll("pre");

  if (preTags.length) {
    const parts = [];

    preTags.forEach(pre => {
      if (pre.textContent) {
        parts.push(pre.textContent);
      }
    });

    const text = parts.join("\n");

    if (text.trim()) {
      outputs.push({
        output_type: "stream",
        name: "stdout",
        text
      });
    }
  } else {
    const text =
      outputArea.textContent.trim();

    if (text) {
      outputs.push({
        output_type: "stream",
        name: "stdout",
        text: text + "\n"
      });
    }
  }

  return outputs;
}


function getExecutionCount(cell) {
  const prompt = cell.querySelector(
    ".jp-InputPrompt"
  );

  if (!prompt) return null;

  const text = prompt.textContent || "";

  const match = text.match(
    /In\s*\[\s*(\d+)\s*\]/
  );

  return match
    ? Number(match[1])
    : null;
}


function createCellId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return (
    "cell-" +
    Math.random()
      .toString(16)
      .slice(2) +
    Date.now()
  );
}


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


async function convertFile(file) {
  report.classList.add("hidden");

  showStatus(
    `Reading ${file.name}...`
  );

  try {
    const rawHTML =
      await file.text();

    const parser =
      new DOMParser();

    const document =
      parser.parseFromString(
        rawHTML,
        "text/html"
      );

    const cellDivs =
      document.querySelectorAll(
        "div.jp-Cell.jp-Notebook-cell"
      );

    if (!cellDivs.length) {
      throw new Error(
        "No JupyterLab notebook cells were found. Make sure this is a JupyterLab HTML export."
      );
    }

    const cells = [];

    let codeCount = 0;
    let markdownCount = 0;
    let outputCount = 0;
    let imageCount = 0;

    cellDivs.forEach(cellDiv => {
      const classes =
        new Set(cellDiv.classList);

      // CODE CELL
      if (classes.has("jp-CodeCell")) {
        codeCount++;

        const editor =
          cellDiv.querySelector(
            ".jp-CodeMirrorEditor.jp-InputArea-editor"
          );

        let source = "";

        if (editor) {
          const pre =
            editor.querySelector("pre");

          source = pre
            ? pre.textContent
            : editor.textContent;
        } else {
          const pre =
            cellDiv.querySelector("pre");

          if (pre) {
            source = pre.textContent;
          }
        }

        source = cleanCode(source);

        const outputs =
          extractOutputs(cellDiv);

        outputCount += outputs.length;

        outputs.forEach(output => {
          if (
            output.output_type ===
              "display_data" &&
            Object.keys(output.data)
              .some(key =>
                key.startsWith("image/")
              )
          ) {
            imageCount++;
          }
        });

        cells.push({
          cell_type: "code",
          execution_count:
            getExecutionCount(cellDiv),
          id: createCellId(),
          metadata: {},
          outputs,
          source
        });

        return;
      }

      // MARKDOWN CELL
      if (classes.has("jp-MarkdownCell")) {
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

        return;
      }

      // UNKNOWN CELL
      const pre =
        cellDiv.querySelector("pre");

      if (pre) {
        cells.push({
          cell_type: "code",
          execution_count: null,
          id: createCellId(),
          metadata: {},
          outputs: [],
          source: cleanCode(
            pre.textContent
          )
        });

        codeCount++;
      }
    });

    if (!cells.length) {
      throw new Error(
        "No notebook cells could be recovered."
      );
    }

    convertedNotebook =
      createNotebook(cells);

    const base =
      file.name.replace(
        /\.(html?|HTML?)$/,
        ""
      );

    outputFilename =
      `${base}_RECOVERED.ipynb`;

    document.getElementById(
      "totalCells"
    ).textContent = cells.length;

    document.getElementById(
      "codeCells"
    ).textContent = codeCount;

    document.getElementById(
      "markdownCells"
    ).textContent = markdownCount;

    document.getElementById(
      "outputs"
    ).textContent = outputCount;

    document.getElementById(
      "images"
    ).textContent = imageCount;

    report.classList.remove("hidden");

    showStatus(
      `Successfully recovered ${cells.length} notebook cells from ${file.name}.`
    );

  } catch (error) {
    console.error(error);

    showStatus(
      `Conversion failed: ${error.message}`,
      true
    );
  }
}
