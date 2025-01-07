/* tslint:disable */
/* eslint-disable */

/* auto-generated by NAPI-RS */

/** Extracted image metadata */
export interface ExtractedImageMeta {
  /** Image filename */
  filename: string
  fileSizeBytes: number
  /** Two closest to image text lines above or below */
  relatedText: Array<string>
}
export interface ExtractedPage {
  /** Page images */
  pageImages: Array<ExtractedImageMeta>
  /** Page text lines */
  pageTextLines: Array<string>
}
/** Extract text from pdf files in lines and images with related text */
export declare function extractTextAndImages(pdfiumDir: string, pdfPath: string, imagesFolderPath: string): Promise<Array<ExtractedPage>>
