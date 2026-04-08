use reqwest::{redirect::Policy, Client};
use scraper::{Html, Selector};
use thiserror::Error;
use url::Url;

#[derive(Debug, Clone)]
pub struct ExtractedMetadata {
    pub title: Option<String>,
    pub favicon: Option<String>,
    pub cover_url: Option<String>,
    pub description_excerpt: Option<String>,
}

#[derive(Debug, Error)]
pub enum MetadataError {
    #[error("invalid url: {0}")]
    Url(#[from] url::ParseError),
    #[error("http request failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("metadata response was empty")]
    EmptyResponse,
}

pub async fn extract_metadata(target_url: &str) -> Result<ExtractedMetadata, MetadataError> {
    let parsed_url = Url::parse(target_url)?;
    let client = Client::builder()
        .redirect(Policy::limited(5))
        .user_agent("PerchLink/0.1 (+local metadata extraction)")
        .build()?;

    let response = client.get(parsed_url.clone()).send().await?.error_for_status()?;
    let final_url = response.url().clone();
    let body = response.text().await?;

    if body.trim().is_empty() {
        return Err(MetadataError::EmptyResponse);
    }

    let document = Html::parse_document(&body);
    let title = first_non_empty(&[
        extract_title(&document),
        extract_meta_content(&document, "property", "og:title"),
        extract_meta_content(&document, "name", "twitter:title"),
    ]);
    let favicon = extract_favicon(&document, &final_url)
        .or_else(|| Some(final_url.join("/favicon.ico").ok()?.to_string()));
    let cover_url = first_non_empty(&[
        extract_meta_content(&document, "property", "og:image"),
        extract_meta_content(&document, "name", "twitter:image"),
    ]);
    let description_excerpt = first_non_empty(&[
        extract_meta_content(&document, "name", "description"),
        extract_meta_content(&document, "property", "og:description"),
        extract_text_excerpt(&document),
    ]);

    Ok(ExtractedMetadata {
        title,
        favicon,
        cover_url,
        description_excerpt,
    })
}

fn extract_title(document: &Html) -> Option<String> {
    let selector = Selector::parse("title").ok()?;
    let value = document.select(&selector).next()?.text().collect::<String>();
    normalize_text(&value)
}

fn extract_meta_content(document: &Html, attribute: &str, expected: &str) -> Option<String> {
    let selector = Selector::parse("meta").ok()?;

    document.select(&selector).find_map(|element| {
        let attrs = element.value();
        let attribute_value = attrs.attr(attribute)?;
        if !attribute_value.eq_ignore_ascii_case(expected) {
            return None;
        }

        normalize_text(attrs.attr("content")?)
    })
}

fn extract_favicon(document: &Html, base_url: &Url) -> Option<String> {
    let selector = Selector::parse("link").ok()?;

    document.select(&selector).find_map(|element| {
        let attrs = element.value();
        let rel = attrs.attr("rel")?.to_ascii_lowercase();
        if !rel.contains("icon") {
            return None;
        }

        let href = attrs.attr("href")?;
        base_url.join(href).ok().map(|url| url.to_string())
    })
}

fn extract_text_excerpt(document: &Html) -> Option<String> {
    let body_selector = Selector::parse("body").ok()?;
    let text = document
        .select(&body_selector)
        .next()
        .map(|body| body.text().collect::<Vec<_>>().join(" "))?;
    let normalized = normalize_text(&text)?;

    if normalized.len() <= 220 {
        return Some(normalized);
    }

    Some(format!("{}...", &normalized[..217]))
}

fn normalize_text(value: &str) -> Option<String> {
    let normalized = value.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    }
}

fn first_non_empty(values: &[Option<String>]) -> Option<String> {
    values.iter().flatten().find(|value| !value.trim().is_empty()).cloned()
}
