use std::collections::HashSet;

use crate::commands::bookmarks::CategoryTreeNodeDto;
use url::Url;

#[derive(Debug, Clone)]
pub struct BookmarkAiInput {
    pub url: String,
    pub title: String,
    pub description_excerpt: Option<String>,
    pub description: Option<String>,
    pub categories: Vec<CategoryTreeNodeDto>,
}

#[derive(Debug, Clone)]
pub struct AiSuggestionDraft {
    pub proposed_primary_category_id: Option<String>,
    pub proposed_description: Option<String>,
    pub proposed_tags: Vec<String>,
}

pub async fn generate_bookmark_ai_suggestions(input: BookmarkAiInput) -> Result<AiSuggestionDraft, String> {
    Ok(generate_heuristic_ai_suggestions(&input))
}

fn generate_heuristic_ai_suggestions(input: &BookmarkAiInput) -> AiSuggestionDraft {
    let content = build_content_text(input);
    let content_lower = content.to_lowercase();
    let tokens = collect_tokens(&content_lower);

    let proposed_primary_category_id = select_category(&content_lower, &tokens, &input.categories);
    let proposed_description = build_description(input);
    let proposed_tags = build_tags(&content_lower, &tokens, &input.url);

    AiSuggestionDraft {
        proposed_primary_category_id,
        proposed_description,
        proposed_tags,
    }
}

fn build_content_text(input: &BookmarkAiInput) -> String {
    [Some(input.title.as_str()), input.description_excerpt.as_deref(), input.description.as_deref(), Some(input.url.as_str())]
        .into_iter()
        .flatten()
        .collect::<Vec<_>>()
        .join(" ")
}

fn collect_tokens(content: &str) -> HashSet<String> {
    content
        .split(|character: char| !character.is_alphanumeric())
        .filter(|token| token.len() >= 3)
        .filter(|token| !STOP_WORDS.contains(token))
        .map(|token| token.to_string())
        .collect()
}

fn select_category(
    content_lower: &str,
    tokens: &HashSet<String>,
    categories: &[CategoryTreeNodeDto],
) -> Option<String> {
    let flattened = flatten_categories(categories);
    let mut best_match: Option<(&CategoryTreeNodeDto, usize)> = None;
    let mut fallback_unsorted: Option<String> = None;

    for category in flattened {
        if category.id == "system-unsorted" {
            fallback_unsorted = Some(category.id.clone());
            continue;
        }

        let category_name_lower = category.name.to_lowercase();
        let category_tokens = category_name_lower
            .split(|character: char| !character.is_alphanumeric())
            .filter(|token| token.len() >= 2)
            .collect::<Vec<_>>();

        let mut score = 0usize;

        for token in category_tokens {
            if tokens.contains(token) || content_lower.contains(token) {
                score += 1;
            }
        }

        if score > 0 && best_match.map(|(_, best_score)| score > best_score).unwrap_or(true) {
            best_match = Some((category, score));
        }
    }

    best_match
        .map(|(category, _)| category.id.clone())
        .or(fallback_unsorted)
}

fn flatten_categories(categories: &[CategoryTreeNodeDto]) -> Vec<&CategoryTreeNodeDto> {
    let mut flattened = Vec::new();

    for category in categories {
        flattened.push(category);
        flattened.extend(flatten_categories(&category.children));
    }

    flattened
}

fn build_description(input: &BookmarkAiInput) -> Option<String> {
    let title = input.title.trim();
    let source = input
        .description
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| input.description_excerpt.as_deref().filter(|value| !value.trim().is_empty()));

    let candidate = if let Some(body) = source {
        let trimmed_body = normalize_sentence(body);
        if trimmed_body.is_empty() {
            title.to_string()
        } else if trimmed_body.to_lowercase().contains(&title.to_lowercase()) {
            trimmed_body
        } else {
            format!("{title}. {trimmed_body}")
        }
    } else if let Ok(parsed) = Url::parse(&input.url) {
        format!("Saved link from {}.", parsed.host_str().unwrap_or("this site"))
    } else {
        title.to_string()
    };

    let normalized = normalize_sentence(&candidate);
    if normalized.is_empty() {
        None
    } else {
        Some(truncate_text(&normalized, 220))
    }
}

fn build_tags(content_lower: &str, tokens: &HashSet<String>, url: &str) -> Vec<String> {
    let mut tags = Vec::new();
    let mut seen = HashSet::new();

    let keyword_groups = [
        ("ai", &["ai", "llm", "gpt", "prompt", "model"][..]),
        ("docs", &["docs", "documentation", "reference", "api"][..]),
        ("tutorial", &["guide", "tutorial", "howto", "walkthrough"][..]),
        ("react", &["react", "jsx", "hooks"][..]),
        ("typescript", &["typescript", "tsconfig", "ts"][..]),
        ("javascript", &["javascript", "nodejs", "npm"][..]),
        ("rust", &["rust", "cargo", "tauri"][..]),
        ("design", &["design", "ui", "ux", "layout"][..]),
        ("productivity", &["productivity", "workflow", "notes", "pkm"][..]),
        ("video", &["video", "youtube", "watch"][..]),
        ("news", &["news", "release", "announcement"][..]),
    ];

    for (tag, markers) in keyword_groups {
        if markers
            .iter()
            .any(|marker| tokens.contains(*marker) || content_lower.contains(marker))
        {
            push_unique_tag(&mut tags, &mut seen, tag);
        }
    }

    if let Ok(parsed) = Url::parse(url) {
        if let Some(host) = parsed.host_str() {
            for part in host.split('.') {
                if part.len() >= 3 && !HOST_STOP_WORDS.contains(&part) {
                    push_unique_tag(&mut tags, &mut seen, part);
                }
            }
        }
    }

    tags.truncate(4);
    tags
}

fn push_unique_tag(tags: &mut Vec<String>, seen: &mut HashSet<String>, candidate: &str) {
    let normalized = candidate.trim().to_lowercase();

    if normalized.is_empty() || seen.contains(&normalized) {
        return;
    }

    seen.insert(normalized.clone());
    tags.push(normalized);
}

fn normalize_sentence(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ").trim().to_string()
}

fn truncate_text(value: &str, max_len: usize) -> String {
    let mut truncated = value.trim().to_string();

    if truncated.len() <= max_len {
        return truncated;
    }

    truncated.truncate(max_len);
    while truncated.ends_with(char::is_whitespace) || truncated.ends_with(',') || truncated.ends_with(';') {
        truncated.pop();
    }

    format!("{truncated}...")
}

const STOP_WORDS: [&str; 18] = [
    "the",
    "and",
    "for",
    "with",
    "this",
    "that",
    "from",
    "your",
    "into",
    "about",
    "https",
    "http",
    "www",
    "com",
    "net",
    "org",
    "you",
    "are",
];

const HOST_STOP_WORDS: [&str; 8] = ["www", "com", "net", "org", "io", "app", "dev", "co"];

#[cfg(test)]
mod tests {
    use super::*;

    fn category(id: &str, name: &str) -> CategoryTreeNodeDto {
        CategoryTreeNodeDto {
            id: id.to_string(),
            name: name.to_string(),
            slug: None,
            parent_id: None,
            sort_order: 0,
            is_system: id == "system-unsorted",
            bookmark_count: 0,
            created_at: "2026-04-09T00:00:00.000Z".to_string(),
            updated_at: "2026-04-09T00:00:00.000Z".to_string(),
            children: vec![],
        }
    }

    #[test]
    fn generate_bookmark_ai_suggestions_picks_matching_category() {
        let draft = generate_heuristic_ai_suggestions(&BookmarkAiInput {
            url: "https://react.dev/learn".to_string(),
            title: "React Hooks Guide".to_string(),
            description_excerpt: Some("Documentation and walkthrough for React hooks.".to_string()),
            description: None,
            categories: vec![category("system-unsorted", "Unsorted"), category("cat-dev", "Development")],
        });

        assert_eq!(draft.proposed_primary_category_id, Some("cat-dev".to_string()));
        assert!(draft.proposed_tags.iter().any(|tag| tag == "react"));
    }

    #[test]
    fn build_description_uses_title_and_excerpt() {
        let description = build_description(&BookmarkAiInput {
            url: "https://example.com".to_string(),
            title: "Example Article".to_string(),
            description_excerpt: Some("A concise explanation of the topic.".to_string()),
            description: None,
            categories: vec![category("system-unsorted", "Unsorted")],
        });

        assert_eq!(description, Some("Example Article. A concise explanation of the topic.".to_string()));
    }
}
