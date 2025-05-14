#![deny(clippy::all)]

#[macro_use]
extern crate napi_derive;
use image::ImageFormat;
use itertools::{Itertools, Position};
use once_cell::sync::OnceCell;
use pdfium_render::prelude::*;
use std::cmp::Ordering;
use std::env;
use std::fs::{create_dir_all, File};
use std::path::{Path, PathBuf};

static PDFIUM: OnceCell<Pdfium> = OnceCell::new();

#[napi(object)]
/// Extracted image metadata
pub struct ExtractedImageMeta {
  /// Image filename
  pub filename: String,
  pub file_size_bytes: u32,
  /// Two closest to image text lines above or below
  pub related_text: Vec<String>,
}

#[napi(object)]
pub struct ExtractedPage {
  /// Page images
  pub page_images: Vec<ExtractedImageMeta>,
  /// Page text lines
  pub page_text_lines: Vec<String>,
}

// top y position and item
#[derive(Clone)]
enum TextLineOrImage {
  TextLine(String),
  /// image filename
  Image(String),
}

// allowed vertical objects position difference to consider them same line
static SAME_LINE_RANGE_DIFF: f32 = 5.0;

#[napi(catch_unwind)]
/// Extract text from pdf files in lines and images with related text
pub async fn extract_text_and_images(
  // Path to pdfium library bindings
  pdfium_dir: String,
  pdf_path: String,
  images_folder_path: String,
) -> napi::Result<Vec<ExtractedPage>> {
  // Init library once
  let pdfium = PDFIUM.get_or_try_init(|| -> napi::Result<Pdfium> {
    let pdfium_dir = PathBuf::from(pdfium_dir);

    let pdfium_platform_library_folder = if env::consts::OS == "macos" {
      if env::consts::ARCH == "aarch64" {
        "pdfium-mac-arm64/lib"
      } else {
        "pdfium-mac-x64/lib"
      }
    } else {
      if env::consts::ARCH == "aarch64" {
        "pdfium-linux-arm64/lib"
      } else {
        "pdfium-linux-x64/lib"
      }
    };
    let pdfium_platform_library_path = pdfium_dir.join(pdfium_platform_library_folder);

    let binary_path = Pdfium::pdfium_platform_library_name_at_path(&pdfium_platform_library_path);
    let bindings = Pdfium::bind_to_library(binary_path.clone()).map_err(|err| {
      eprintln!("{}", err);
      napi::Error::from_reason(format!(
        "Failed to bind to external Pdfium library bindings. ARCH: {}, OS: {}, binary_path: {:?}, path exists: {}",
        env::consts::ARCH,
        env::consts::OS,
        binary_path.clone(),
        binary_path.exists(),
      ))
    })?;
    // Bind library to pdfium binary
    let pdfium: Pdfium = Pdfium::new(bindings);

    Ok(pdfium)
  })?;

  // Create images folder if not exist
  let images_folder_path = Path::new(&images_folder_path);
  create_dir_all(images_folder_path)?;
  let mut image_filename_idx = 1;

  // Pdfium will only load the portions of the document it actually needs into memory. This is more efficient than loading the entire document into memory, especially when working with large documents, and allows for working with documents larger than the amount of available memory.
  let reader =
    File::open(pdf_path).map_err(|_| napi::Error::from_reason("Failed to open pdf document"))?;
  let document: PdfDocument<'_> = pdfium
    .load_pdf_from_reader(reader, None)
    .map_err(|_| napi::Error::from_reason("Failed to read pdf document"))?;

  let mut result: Vec<ExtractedPage> = vec![];

  for page in document.pages().iter() {
    // Retrieving the text from a text object is done internally by loading the "text page"
    // associated with the page the object is attached to, then asking that text page for the
    // text related to the object. Therefore, when iterating over many text objects (as we
    // are doing here), it is slightly faster to load the text page once rather than loading
    // it and closing it every time we access an object:
    let text_page: PdfPageText<'_> = page
      .text()
      .map_err(|_| napi::Error::from_reason("Failed to read pdf document page"))?;

    let mut texts_and_images = page
      .objects()
      .iter()
      .filter(|o| match o.object_type() {
        PdfPageObjectType::Image => true,
        PdfPageObjectType::Text => {
          if let Some(text) = o.as_text_object() {
            let object_text = text_page.for_object(text);
            return !object_text.trim().is_empty();
          }
          false
        }
        _ => false,
      })
      .collect::<Vec<_>>();

    // Sort from top to bottom
    texts_and_images.sort_by(|a, b| {
      let a_bounds = a.bounds();
      let b_bounds = b.bounds();

      if a_bounds.is_err() || b_bounds.is_err() {
        return Ordering::Equal;
      }

      let a_bounds = a_bounds.unwrap();
      let b_bounds = b_bounds.unwrap();

      b_bounds.top().cmp(&a_bounds.top())
    });

    // Sort items on the same line or close from left to right
    let mut groups: Vec<(f32, usize, usize)> = vec![]; // same line items line top/start/end

    // Combine items on the same line in groups
    for i in 0..texts_and_images.len() {
      let current = texts_and_images.get(i);
      if current.is_none() {
        break;
      }

      let current_bounds = current.unwrap().bounds();
      if current_bounds.is_err() {
        break;
      }
      let current_bounds = current_bounds.unwrap();

      if groups.is_empty() {
        let current_group: (f32, usize, usize) = (current_bounds.top().value, i, i);
        groups.push(current_group);
        continue;
      }

      let last_group = groups.last().unwrap();
      let is_same_line = current_bounds.top().value == last_group.0
        || (current_bounds.top().value - last_group.0).abs() < SAME_LINE_RANGE_DIFF;

      if is_same_line {
        let updated_last_group = (last_group.0, last_group.1, i);
        groups.pop();
        groups.push(updated_last_group);
        continue;
      } else {
        let current_group: (f32, usize, usize) = (current_bounds.top().value, i, i);
        groups.push(current_group);
        continue;
      }
    }

    // Sort groups from left to right
    for item in groups {
      texts_and_images[item.1..item.2 + 1].sort_by(|a, b| {
        let a_bounds = a.bounds();
        let b_bounds = b.bounds();

        if a_bounds.is_err() || b_bounds.is_err() {
          return Ordering::Equal;
        }

        let a_bounds = a_bounds.unwrap();
        let b_bounds = b_bounds.unwrap();

        a_bounds.left().cmp(&b_bounds.left())
      });
    }

    // sorted page text lines and images
    let mut page_text_lines_and_images: Vec<TextLineOrImage> = vec![];

    // iterator helpers
    let mut page_text_line: String = "".to_owned();
    let mut last_top_pos: f32 = -1.0;

    texts_and_images
      .iter()
      .with_position()
      .for_each(|(position, o)| {
        let top_pos = match o.bounds() {
          Ok(v) => v.top().value,
          Err(_) => 0.0,
        };

        match o.object_type() {
          // extract images with related text
          PdfPageObjectType::Image => {
            if let Some(image) = o.as_image_object() {
              if let Ok(image) = image.get_raw_image() {
                let image_filename = format!("image-{}.png", image_filename_idx);
                image_filename_idx += 1;
                let img_path = images_folder_path.join(&image_filename);

                let result = image.save_with_format(img_path, ImageFormat::Png);

                match result {
                  Ok(_) => {
                    // push text line if present
                    if !page_text_line.is_empty() {
                      page_text_lines_and_images
                        .push(TextLineOrImage::TextLine(page_text_line.clone()));
                      page_text_line = "".to_owned();
                    }

                    page_text_lines_and_images.push(TextLineOrImage::Image(image_filename.clone()));
                  }
                  Err(err) => {
                    eprintln!("failed to save image - {}, {}", image_filename, err)
                  }
                };
              }
            }
          }
          // extract text in lines
          PdfPageObjectType::Text => {
            if let Some(t) = o.as_text_object() {
              if last_top_pos == -1.0 {
                page_text_line.push_str(&t.text().trim());
              }
              // text is on the same line with small vertical position misalignment
              else if top_pos > last_top_pos - SAME_LINE_RANGE_DIFF {
                page_text_line.push_str(" ");
                page_text_line.push_str(&t.text().trim());
              } else {
                if !page_text_line.is_empty() {
                  page_text_lines_and_images
                    .push(TextLineOrImage::TextLine(page_text_line.clone()));
                  page_text_line = "".to_owned();
                }

                page_text_line.push_str(&t.text().trim());
              }
            }
          }
          _ => {}
        };

        if position == Position::Last {
          // last text line of page
          if !page_text_line.is_empty() {
            page_text_lines_and_images.push(TextLineOrImage::TextLine(page_text_line.clone()));
          }
        }

        last_top_pos = top_pos;
      });

    // map result
    let mut page_text_lines: Vec<String> = vec![];
    let mut page_images: Vec<ExtractedImageMeta> = vec![];

    // map text lines
    page_text_lines_and_images
      .iter()
      .for_each(|item| match item {
        TextLineOrImage::TextLine(text) => page_text_lines.push(text.clone()),
        _ => {}
      });

    // map images
    // remove artifacts and small text lines which will be hard to relate to image
    let page_text_lines_filtered_and_images: Vec<TextLineOrImage> = page_text_lines_and_images
      .iter()
      .cloned()
      .filter(|item| match item {
        TextLineOrImage::TextLine(v) => v.chars().count() >= 2,
        _ => true,
      })
      .collect();

    page_text_lines_filtered_and_images
      .iter()
      .enumerate()
      .with_position()
      .for_each(|(position, (idx, item))| match item {
        TextLineOrImage::Image(filename) => {
          let related_text: Vec<String>;

          if position == Position::First {
            let next_two_text_lines: Vec<String> = page_text_lines_filtered_and_images
              .iter()
              .skip(idx)
              .filter_map(|item| match item {
                TextLineOrImage::TextLine(v) => Some(v.clone()),
                _ => None,
              })
              .take(2)
              .collect();

            related_text = next_two_text_lines;
          } else {
            let mut previous_two_text_lines: Vec<String> = page_text_lines_filtered_and_images
              .iter()
              .skip(idx - 2)
              .filter_map(|item| match item {
                TextLineOrImage::TextLine(v) => Some(v.clone()),
                _ => None,
              })
              .take(2)
              .collect();
            previous_two_text_lines.reverse();

            related_text = previous_two_text_lines;
          }

          let file_path = images_folder_path.join(&filename);
          let mut file_size_bytes: u32 = 0;
          if let Ok(x) = std::fs::metadata(file_path) {
            file_size_bytes = x.len() as u32;
          };

          let meta = ExtractedImageMeta {
            filename: filename.clone(),
            related_text,
            file_size_bytes,
          };
          page_images.push(meta);
        }
        _ => {}
      });

    let page_result = ExtractedPage {
      page_images,
      page_text_lines,
    };

    result.push(page_result);
  }

  Ok(result)
}

#[napi(catch_unwind)]
/// Extract text from pdf files in lines
pub async fn extract_text(
  // Path to pdfium library bindings
  pdfium_dir: String,
  pdf_path: String,
) -> napi::Result<Vec<String>> {
  // Init library once
  let pdfium = PDFIUM.get_or_try_init(|| -> napi::Result<Pdfium> {
    let pdfium_dir = PathBuf::from(pdfium_dir);

    let pdfium_platform_library_folder = if env::consts::OS == "macos" {
      if env::consts::ARCH == "aarch64" {
        "pdfium-mac-arm64/lib"
      } else {
        "pdfium-mac-x64/lib"
      }
    } else {
      if env::consts::ARCH == "aarch64" {
        "pdfium-linux-arm64/lib"
      } else {
        "pdfium-linux-x64/lib"
      }
    };
    let pdfium_platform_library_path = pdfium_dir.join(pdfium_platform_library_folder);

    let binary_path = Pdfium::pdfium_platform_library_name_at_path(&pdfium_platform_library_path);
    let bindings = Pdfium::bind_to_library(binary_path.clone()).map_err(|err| {
      eprintln!("{}", err);
      napi::Error::from_reason(format!(
        "Failed to bind to external Pdfium library bindings. ARCH: {}, OS: {}, binary_path: {:?}, path exists: {}",
        env::consts::ARCH,
        env::consts::OS,
        binary_path.clone(),
        binary_path.exists(),
      ))
    })?;
    // Bind library to pdfium binary
    let pdfium: Pdfium = Pdfium::new(bindings);

    Ok(pdfium)
  })?;

  // Pdfium will only load the portions of the document it actually needs into memory. This is more efficient than loading the entire document into memory, especially when working with large documents, and allows for working with documents larger than the amount of available memory.
  let reader =
    File::open(pdf_path).map_err(|_| napi::Error::from_reason("Failed to open pdf document"))?;
  let document: PdfDocument<'_> = pdfium
    .load_pdf_from_reader(reader, None)
    .map_err(|_| napi::Error::from_reason("Failed to read pdf document"))?;

  let mut result: Vec<String> = vec![];

  for page in document.pages().iter() {
    let text_page: PdfPageText<'_> = page
      .text()
      .map_err(|_| napi::Error::from_reason("Failed to read pdf document page"))?;

      let texts = page.objects()
      .iter()
      .filter_map(|o| {
              o.as_text_object()
              .map(|text| text_page.for_object(text).trim().to_string())
      })
      .collect::<Vec<String>>();
      
      let combined_text = texts.join("");
      
      if !combined_text.trim().is_empty() {
          result.push(combined_text);
      }

    }

  Ok(result)
}
