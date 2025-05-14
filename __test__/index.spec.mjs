import test from "ava";
import { extractTextAndImages, extractText } from "../index.js";
import path from "path";
import fs from "node:fs/promises";
import { tmpdir } from "os";
import { randomUUID, createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync } from "fs";

const pdfium_dirname = path.join(import.meta.dirname, "..");
const pdfPath = path.join(import.meta.dirname, "./pdf-test-with-images.pdf");
const pdfPath2 = path.join(import.meta.dirname, "./pdf-test-with-out-images.pdf");

const imagesFolderPath = path.join(tmpdir(), randomUUID());
if (!existsSync(imagesFolderPath)) {
  mkdirSync(imagesFolderPath);
}
for (const file of await fs.readdir(imagesFolderPath)) {
  await fs.unlink(path.join(imagesFolderPath, file));
}

test("should extract images and text from pdf", async (t) => {
  const res = await extractTextAndImages(
    pdfium_dirname,
    pdfPath,
    imagesFolderPath
  );

  // check text extraction
  t.deepEqual(res, [
    {
      pageImages: [
        {
          filename: "image-1.png",
          relatedText: ["1. How to program", "AA-FFF222 - AY"],
          fileSizeBytes: 43119,
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
          fileSizeBytes: 260899,
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
          fileSizeBytes: 92681,
        },
        {
          filename: "image-4.png",
          relatedText: ["Here is a key", "Some text here and there"],
          fileSizeBytes: 368679,
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
  t.is(
    image1hash,
    "4de1a60f162b504d6fe7b931c25ce182a50175345039a51ebf291952ca97a700"
  );
  t.is(
    image2hash,
    "8eca99e6200d12fb24f3f789f38917036427d5c5e61c98c40487de3bf2d2a0f8"
  );
  t.is(
    image3hash,
    "521ffc0509eedf7bcb30d227c10eab545abeb848493b63b9b9f1f695b1f69738"
  );
  t.is(
    image4hash,
    "d87d22dd0a9b22857633ffc8457438466c0573b9885f4386d75564abe6da81ee"
  );
});

test("should extract only text from pdf with images", async(t)=>{

  const res= await extractText(pdfium_dirname,
    pdfPath)

  t.deepEqual(res, [
    '1.How to programAA-FFF222 - AYTSCode V1.2',
    'List of required itemsN.IndexItem1.ATSCode version 1.22.BPC or laptop3.CTable4.DMouse or touchpad5.IGood mood6.FInternet7.GKeyboard8.HBrowser',
    'What is Lorem Ipsum?Lorem Ipsum is simply dummy text of the printing and typesetting industry.Lorem Ipsum has been the industry\'s standard dummy text ever since the 1500s, when an unknown printer took a galley of type andscrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting,remaining essentially unchanged.It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktoppublishing software like Aldus PageMaker including versions of Lorem Ipsum.Contrary to popular belief, is not simply random text. It has roots in a piece of classicalLatin literature from 45 BC, making it over 2000 years old.Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, lookedup one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, andgoing through the cites of the word in classical literature, discovered the undoubtablesource. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of "de Finibus Bonorumet Malorum" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This bookis a treatise on the theory of ethics, very popular during the Renaissance.See animal below.',
    'What is it?Probably this is electricity:Some text here and thereHere is a key'
      ] )
})

test("should extract text from pdf with no images", async(t)=>{

  const res= await extractText(pdfium_dirname,
    pdfPath2)

  t.deepEqual(res, [
    'Sample PDFThis is a simple PDF file. Fun fun fun.Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Phasellus facilisis odio sed mi.Curabitur suscipit. Nullam vel nisi. Etiam semper ipsum ut lectus. Proin aliquam, erat egetpharetra commodo, eros mi condimentum quam, sed commodo justo quam ut velit.Integer a erat. Cras laoreet ligula cursus enim. Aenean scelerisque velit et tellus.Vestibulum dictum aliquet sem. Nulla facilisi. Vestibulum accumsan ante vitae elit. Nullaerat dolor, blandit in, rutrum quis, semper pulvinar, enim. Nullam varius congue risus.Vivamus sollicitudin, metus ut interdum eleifend, nisi tellus pellentesque elit, tristiqueaccumsan eros quam et risus. Suspendisse libero odio, mattis sit amet, aliquet eget,hendrerit vel, nulla. Sed vitae augue. Aliquam erat volutpat. Aliquam feugiat vulputate nisl.Suspendisse quis nulla pretium ante pretium mollis. Proin velit ligula, sagittis at, egestas a,pulvinar quis, nisl.Pellentesque sit amet lectus. Praesent pulvinar, nunc quis iaculis sagittis, justo quamlobortis tortor, sed vestibulum dui metus venenatis est. Nunc cursus ligula. Nulla facilisi.Phasellus ullamcorper consectetuer ante. Duis tincidunt, urna id condimentum luctus, nibhante vulputate sapien, id sagittis massa orci ut enim. Pellentesque vestibulum convallissem. Nulla consequat quam ut nisl. Nullam est. Curabitur tincidunt dapibus lorem. Proinvelit turpis, scelerisque sit amet, iaculis nec, rhoncus ac, ipsum. Phasellus lorem arcu,feugiat eu, gravida eu, consequat molestie, ipsum. Nullam vel est ut ipsum volutpatfeugiat. Aenean pellentesque.In mauris. Pellentesque dui nisi, iaculis eu, rhoncus in, venenatis ac, ante. Ut odio justo,scelerisque vel, facilisis non, commodo a, pede. Cras nec massa sit amet tortor volutpatvarius. Donec lacinia, neque a luctus aliquet, pede massa imperdiet ante, at varius lorempede sed sapien. Fusce erat nibh, aliquet in, eleifend eget, commodo eget, erat. Fusceconsectetuer. Cras risus tortor, porttitor nec, tristique sed, convallis semper, eros. Fuscevulputate ipsum a mauris. Phasellus mollis. Curabitur sed urna. Aliquam nec sapien nonnibh pulvinar convallis. Vivamus facilisis augue quis quam. Proin cursus aliquet metus.Suspendisse lacinia. Nulla at tellus ac turpis eleifend scelerisque. Maecenas a pede vitaeenim commodo interdum. Donec odio. Sed sollicitudin dui vitae justo.Morbi elit nunc, facilisis a, mollis a, molestie at, lectus. Suspendisse eget mauris eu tellusmolestie cursus. Duis ut magna at justo dignissim condimentum. Cum sociis natoquepenatibus et magnis dis parturient montes, nascetur ridiculus mus. Vivamus varius. Ut sitamet diam suscipit mauris ornare aliquam. Sed varius. Duis arcu. Etiam tristique massaeget dui. Phasellus congue. Aenean est erat, tincidunt eget, venenatis quis, commodo at,quam.'
  ]);
})

async function calculateHashForBuffer(data) {
  const hash = createHash("sha256");
  hash.update(data);
  return hash.digest("hex");
}
