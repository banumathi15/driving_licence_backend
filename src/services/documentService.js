import { createWorker } from "tesseract.js";
import * as pdfjsModule from "pdfjs-dist/legacy/build/pdf.js";
import { fileTypeFromBuffer } from "file-type";

const pdfjsLib = pdfjsModule.getDocument ? pdfjsModule : pdfjsModule.default;

const MAX_PAGES = 15;

async function ocrImage(buffer) {
  const worker = await createWorker("eng");

  try {
    const result = await worker.recognize(buffer);
    return result.data.text?.trim() || "";
  } finally {
    await worker.terminate();
  }
}

async function extractPdfPages(buffer) {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const pages = [];
  const count = Math.min(pdf.numPages, MAX_PAGES);

  // Extract text from each PDF page.
  for (let pageNo = 1; pageNo <= count; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();

    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    pages.push({ page: pageNo, text });
  }

  // Use OCR for scanned pages that contain little or no text.
  for (const item of pages) {
    if (item.text.length < 20) {
      const page = await pdf.getPage(item.page);
      const viewport = page.getViewport({ scale: 2 });

      const { createCanvas } = await import("@napi-rs/canvas").catch(() => ({
        createCanvas: null,
      }));

      if (!createCanvas) {
        throw new Error(
          "This scanned PDF needs PDF page rendering. Install the '@napi-rs/canvas' dependency or upload page images.",
        );
      }

      const canvas = createCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height),
      );

      const ctx = canvas.getContext("2d");

      await page.render({
        canvasContext: ctx,
        viewport,
      }).promise;

      item.text = await ocrImage(canvas.toBuffer("image/png"));
    }
  }

  return pages;
}

export async function processDocument(buffer, originalName) {
  const type = await fileTypeFromBuffer(buffer);
  const mime = type?.mime;

  let pages = [];

  if (mime === "application/pdf") {
    pages = await extractPdfPages(buffer);
  } else if (["image/png", "image/jpeg"].includes(mime)) {
    pages = [{ page: 1, text: await ocrImage(buffer) }];
  } else {
    throw Object.assign(
      new Error(
        "Unsupported file content. Upload a valid PDF, PNG, or JPEG file.",
      ),
      { status: 415 },
    );
  }

  const text = pages
    .map((p) => `[Page ${p.page}]\n${p.text}`)
    .join("\n\n")
    .trim();

  if (!text) {
    throw Object.assign(
      new Error(
        "No readable text was found. Try a clearer scan or a higher-resolution image.",
      ),
      { status: 422 },
    );
  }

  return {
    pages,
    text,
    originalName: originalName.replace(/[^\w.\- ]/g, "_").slice(0, 120),
  };
}
