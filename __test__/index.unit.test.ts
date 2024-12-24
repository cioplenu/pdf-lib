import { describe, expect, it } from "vitest";
import { extractTextAndImages } from "../index.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "node:fs/promises";
import { tmpdir } from "os";
import { randomUUID, createHash } from "crypto";
import { existsSync, mkdirSync, readFile, readFileSync } from "fs";

describe("pdf export", async (t) => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const pdfium_dirname = path.join(__dirname, "..");
  const pdfPath = path.join(__dirname, "./pdf-test-with-images.pdf");

  const imagesFolderPath = path.join(tmpdir(), randomUUID());
  if (!existsSync(imagesFolderPath)) {
    mkdirSync(imagesFolderPath);
  }
  for (const file of await fs.readdir(imagesFolderPath)) {
    await fs.unlink(path.join(imagesFolderPath, file));
  }

  it("should extract images and text from pdf", async () => {
    const res = extractTextAndImages(pdfium_dirname, pdfPath, imagesFolderPath);

    // check text extraction
    expect(res).toStrictEqual([
      {
        pageImages: [
          {
            filename: "image-1.png",
            relatedText: ["1. How to program", "AA-FFF222 - AY"],
          },
        ],
        pageTextLines: ["1. How to program", "AA-FFF222 - AY", "TSCode V1.2"],
      },
      {
        pageImages: [],
        pageTextLines: [
          "List of required items",
          "N. Index Item",
          "1. A TSCode version 1.2",
          "2. B PC or laptop",
          "3. C Table",
          "4. D Mouse or touchpad",
          "5. I Good mood",
          "6. F Internet",
          "7. G Keyboard",
          "8. H Browser",
        ],
      },
      {
        pageImages: [
          {
            filename: "image-2.png",
            relatedText: [
              "See animal below.",
              "is a treatise on the theory of ethics, very popular during the Renaissance.",
            ],
          },
        ],
        pageTextLines: [
          "What is Lorem Ipsum?",
          "Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
          "Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and",
          "scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting,",
          "remaining essentially unchanged.",
          "It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop",
          "publishing software like Aldus PageMaker including versions of Lorem Ipsum.",
          "Contrary to popular belief, is not simply random text. It has roots in a piece of classical",
          "Latin literature from 45 BC, making it over 2000 years old.",
          "Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked",
          "up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and",
          "going through the cites of the word in classical literature, discovered the undoubtable",
          'source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of "de Finibus Bonorum',
          'et Malorum" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book',
          "is a treatise on the theory of ethics, very popular during the Renaissance.",
          "See animal below.",
        ],
      },
      {
        pageImages: [
          {
            filename: "image-3.png",
            relatedText: ["Probably this is electricity:", "What is it?"],
          },
          {
            filename: "image-4.png",
            relatedText: ["Here is a key", "Some text here and there"],
          },
        ],
        pageTextLines: [
          "What is it?",
          "Probably this is electricity:",
          "Some text here and there",
          "Here is a key",
        ],
      },
    ]);

    // check image files extraction
    const image1hash = await calculateHashForBuffer(
      readFileSync(`${imagesFolderPath}/image-1.png`)
    );
    const image2hash = await calculateHashForBuffer(
      readFileSync(`${imagesFolderPath}/image-2.png`)
    );
    const image3hash = await calculateHashForBuffer(
      readFileSync(`${imagesFolderPath}/image-3.png`)
    );
    const image4hash = await calculateHashForBuffer(
      readFileSync(`${imagesFolderPath}/image-4.png`)
    );
    expect(image1hash).toBe(
      "4de1a60f162b504d6fe7b931c25ce182a50175345039a51ebf291952ca97a700"
    );
    expect(image2hash).toBe(
      "8eca99e6200d12fb24f3f789f38917036427d5c5e61c98c40487de3bf2d2a0f8"
    );
    expect(image3hash).toBe(
      "521ffc0509eedf7bcb30d227c10eab545abeb848493b63b9b9f1f695b1f69738"
    );
    expect(image4hash).toBe(
      "d87d22dd0a9b22857633ffc8457438466c0573b9885f4386d75564abe6da81ee"
    );
  });
});

async function calculateHashForBuffer(data: Buffer) {
  const hash = createHash("sha256");
  hash.update(data);
  return hash.digest("hex");
}
