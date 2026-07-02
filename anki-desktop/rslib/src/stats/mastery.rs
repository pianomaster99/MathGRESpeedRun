// Copyright: Ankitects Pty Ltd and contributors
// License: GNU AGPL, version 3 or later; http://www.gnu.org/licenses/agpl.html

//! Per-topic mastery summary.
//!
//! Groups cards by note tag ("topic") and, for each topic, reports how many
//! cards are "mastered" (predicted FSRS recall >= a threshold) and the mean
//! predicted recall. This powers the exam-readiness dashboard, so it must be
//! fast on large collections — it uses two bulk queries (all cards + all note
//! tags) rather than per-card lookups.

use std::collections::HashMap;

use fsrs::FSRS;
use fsrs::FSRS5_DEFAULT_DECAY;

use crate::card::Card;
use crate::prelude::*;
use crate::scheduler::timing::SchedTimingToday;
use crate::search::SortMode;

/// Predicted probability of recalling a card right now (0.0-1.0). Unstudied
/// cards (no FSRS memory state) count as 0.
fn predicted_recall(card: &Card, timing: &SchedTimingToday, fsrs: Option<&FSRS>) -> f32 {
    match (card.memory_state, fsrs) {
        (Some(state), Some(fsrs)) => {
            let seconds = card.seconds_since_last_review(timing).unwrap_or(0);
            let decay = card.decay.unwrap_or(FSRS5_DEFAULT_DECAY);
            fsrs.current_retrievability_seconds(state.into(), seconds, decay)
        }
        _ => 0.0,
    }
}

#[derive(Default)]
struct TopicAcc {
    total: u32,
    mastered: u32,
    recall_sum: f64,
}

impl Collection {
    /// Summarise mastery per topic (note tag).
    ///
    /// * `mastery_threshold` — a card is mastered when its predicted recall is
    ///   `>=` this value. Values `<= 0.0` fall back to a default of `0.9`.
    /// * `topic_prefix` — only tags starting with this prefix are treated as
    ///   topics, and the prefix is stripped from the reported name. Empty means
    ///   every tag is a topic. Cards with no matching tag are grouped under
    ///   `"(untagged)"`.
    pub fn topic_mastery(
        &mut self,
        mastery_threshold: f32,
        topic_prefix: &str,
    ) -> Result<anki_proto::stats::TopicMasteryResponse> {
        let threshold = if mastery_threshold > 0.0 {
            mastery_threshold
        } else {
            0.9
        };
        let timing = self.timing_today()?;

        // Load every card in one pass, plus all their note tags in one query, so
        // this stays O(cards) rather than doing a round-trip per card.
        let guard = self.search_cards_into_table("", SortMode::NoOrder)?;
        let mut cards: Vec<Card> = Vec::new();
        guard.col.storage.for_each_card_in_search(|card| {
            cards.push(card);
            Ok(())
        })?;
        let note_ids: Vec<NoteId> = cards.iter().map(|c| c.note_id).collect();
        let tag_rows = guard.col.storage.get_note_tags_by_id_list(&note_ids)?;
        drop(guard);

        let mut tags_by_note: HashMap<NoteId, Vec<String>> =
            HashMap::with_capacity(tag_rows.len());
        for row in tag_rows {
            tags_by_note.insert(
                row.id,
                row.tags.split_whitespace().map(str::to_string).collect(),
            );
        }

        let fsrs = FSRS::new(None).ok();
        let mut topics: HashMap<String, TopicAcc> = HashMap::new();
        let mut mastered_total = 0u32;

        for card in &cards {
            let recall = predicted_recall(card, &timing, fsrs.as_ref());
            let mastered = recall >= threshold;
            if mastered {
                mastered_total += 1;
            }

            let no_tags = Vec::new();
            let card_tags = tags_by_note.get(&card.note_id).unwrap_or(&no_tags);
            let mut topic_names: Vec<String> = card_tags
                .iter()
                .filter(|t| topic_prefix.is_empty() || t.starts_with(topic_prefix))
                .map(|t| t[topic_prefix.len()..].to_string())
                .filter(|t| !t.is_empty())
                .collect();
            if topic_names.is_empty() {
                topic_names.push("(untagged)".to_string());
            }

            for name in topic_names {
                let acc = topics.entry(name).or_default();
                acc.total += 1;
                if mastered {
                    acc.mastered += 1;
                }
                acc.recall_sum += recall as f64;
            }
        }

        let mut out_topics: Vec<anki_proto::stats::topic_mastery_response::Topic> = topics
            .into_iter()
            .map(|(topic, acc)| anki_proto::stats::topic_mastery_response::Topic {
                topic,
                total: acc.total,
                mastered: acc.mastered,
                average_recall: if acc.total > 0 {
                    (acc.recall_sum / acc.total as f64) as f32
                } else {
                    0.0
                },
            })
            .collect();
        out_topics.sort_by(|a, b| a.topic.cmp(&b.topic));

        Ok(anki_proto::stats::TopicMasteryResponse {
            topics: out_topics,
            mastered_total,
            card_total: cards.len() as u32,
        })
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::card::FsrsMemoryState;

    /// Add a Basic note with the given tags; if `memory` is set, mark its card
    /// as freshly reviewed with that FSRS state (so its recall is ~1.0).
    fn add_card(col: &mut Collection, tags: &[&str], memory: Option<(f32, f32)>) {
        let nt = col.get_notetype_by_name("Basic").unwrap().unwrap();
        let mut note = nt.new_note();
        note.tags = tags.iter().map(|t| t.to_string()).collect();
        col.add_note(&mut note, DeckId(1)).unwrap();
        if let Some((stability, difficulty)) = memory {
            let mut card = col.storage.all_cards_of_note(note.id).unwrap().pop().unwrap();
            card.memory_state = Some(FsrsMemoryState {
                stability,
                difficulty,
            });
            card.last_review_time = Some(TimestampSecs::now());
            col.storage.update_card(&card).unwrap();
        }
    }

    #[test]
    fn no_data_returns_empty() {
        let mut col = Collection::new();
        let out = col.topic_mastery(0.9, "topic::").unwrap();
        assert_eq!(out.card_total, 0);
        assert_eq!(out.mastered_total, 0);
        assert!(out.topics.is_empty());
    }

    #[test]
    fn groups_by_topic_and_counts_mastery() {
        let mut col = Collection::new();
        add_card(&mut col, &["topic::calc"], Some((100.0, 5.0))); // mastered (recall ~1)
        add_card(&mut col, &["topic::calc"], None); // unstudied -> recall 0
        add_card(&mut col, &["topic::alg"], Some((100.0, 5.0))); // mastered

        let out = col.topic_mastery(0.9, "topic::").unwrap();
        assert_eq!(out.card_total, 3);
        assert_eq!(out.mastered_total, 2);

        let calc = out.topics.iter().find(|t| t.topic == "calc").unwrap();
        assert_eq!(calc.total, 2);
        assert_eq!(calc.mastered, 1);
        // mean of ~1.0 and 0.0
        assert!((calc.average_recall - 0.5).abs() < 0.05);

        let alg = out.topics.iter().find(|t| t.topic == "alg").unwrap();
        assert_eq!(alg.total, 1);
        assert_eq!(alg.mastered, 1);
    }

    #[test]
    fn untagged_grouping_and_default_threshold() {
        let mut col = Collection::new();
        // No tag matches the "topic::" prefix -> grouped as "(untagged)".
        add_card(&mut col, &["misc"], None);
        // Passing 0.0 falls back to the 0.9 default (card is unstudied -> not mastered).
        let out = col.topic_mastery(0.0, "topic::").unwrap();
        assert_eq!(out.card_total, 1);
        assert_eq!(out.mastered_total, 0);
        assert_eq!(out.topics.len(), 1);
        assert_eq!(out.topics[0].topic, "(untagged)");
        assert_eq!(out.topics[0].total, 1);
        assert_eq!(out.topics[0].mastered, 0);
    }
}
