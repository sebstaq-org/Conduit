//! Session browser product read-model commands.

use crate::command::ConsumerResponse;
use crate::error::{optional_string_param, optional_u64_param, path_param, string_param};
use crate::event::RuntimeEventKind;
use crate::manager::{ServiceRuntime, store_lock_error};
use crate::manager_helpers::{absolute_normalized_cwd, current_epoch, paginated_index_entries};
use crate::session_groups::{SessionGroupsQuery, grouped_view, providers_from_target};
use crate::{ProviderFactory, Result};
use acp_discovery::ProviderId;
use serde_json::{Value, json, to_value};
use session_store::{ProjectRow, ProjectSuggestion};
use std::collections::HashSet;

const SESSION_INDEX_REFRESH_INTERVAL_SECONDS: u64 = 30;
const DEFAULT_PROJECT_SUGGESTIONS_LIMIT: usize = 20;
const MAX_PROJECT_SUGGESTIONS_LIMIT: usize = 100;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectListView {
    projects: Vec<ProjectRow>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectSuggestionsView {
    suggestions: Vec<ProjectSuggestion>,
}

struct ProjectSuggestionsQuery {
    query: Option<String>,
    limit: usize,
}

impl<F> ServiceRuntime<F>
where
    F: ProviderFactory,
{
    pub(crate) fn sessions_grouped(
        &mut self,
        id: String,
        provider_target: &str,
        params: &Value,
    ) -> Result<ConsumerResponse> {
        let query = SessionGroupsQuery::from_params(params)?;
        let providers = providers_from_target(provider_target)?;
        let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
        let projects = self.local_store.projects()?;
        let snapshot = self.local_store.session_index(&providers)?;
        let is_refreshing = !projects.is_empty() && snapshot.refreshed_at.is_none();
        Ok(ConsumerResponse::success_without_snapshot(
            id,
            grouped_view(snapshot, &query, &projects, is_refreshing)?,
        ))
    }

    pub(crate) fn sessions_watch(&self, id: String) -> Result<ConsumerResponse> {
        Ok(ConsumerResponse::success_without_snapshot(
            id,
            json!({ "subscribed": true }),
        ))
    }

    pub(crate) fn projects_list(&self, id: String) -> Result<ConsumerResponse> {
        let projects = {
            let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
            self.local_store.projects()?
        };
        Ok(ConsumerResponse::success_without_snapshot(
            id,
            to_value(ProjectListView { projects })?,
        ))
    }

    pub(crate) fn projects_suggestions(
        &self,
        id: String,
        params: &Value,
    ) -> Result<ConsumerResponse> {
        let query = ProjectSuggestionsQuery::from_params(params)?;
        let suggestions = {
            let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
            self.local_store
                .project_suggestions(query.query.as_deref(), query.limit)?
        };
        Ok(ConsumerResponse::success_without_snapshot(
            id,
            to_value(ProjectSuggestionsView { suggestions })?,
        ))
    }

    pub(crate) fn projects_add(&mut self, id: String, params: &Value) -> Result<ConsumerResponse> {
        let cwd =
            absolute_normalized_cwd("projects/add", path_param("projects/add", params, "cwd")?)?;
        let projects = {
            let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
            self.local_store.add_project(&cwd.display().to_string())?;
            self.local_store.projects()?
        };
        self.session_index_refreshes.clear();
        Ok(ConsumerResponse::success_without_snapshot(
            id,
            to_value(ProjectListView { projects })?,
        ))
    }

    pub(crate) fn projects_remove(
        &mut self,
        id: String,
        params: &Value,
    ) -> Result<ConsumerResponse> {
        let project_id = string_param("projects/remove", params, "projectId")?;
        let projects = {
            let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
            self.local_store.remove_project(&project_id)?;
            self.local_store.projects()?
        };
        self.session_index_refreshes.clear();
        Ok(ConsumerResponse::success_without_snapshot(
            id,
            to_value(ProjectListView { projects })?,
        ))
    }

    pub(crate) fn projects_update(
        &mut self,
        id: String,
        params: &Value,
    ) -> Result<ConsumerResponse> {
        let project_id = string_param("projects/update", params, "projectId")?;
        let display_name = string_param("projects/update", params, "displayName")?;
        let projects = {
            let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
            self.local_store
                .update_project_display_name(&project_id, &display_name)?;
            self.local_store.projects()?
        };
        Ok(ConsumerResponse::success_without_snapshot(
            id,
            to_value(ProjectListView { projects })?,
        ))
    }

    pub(crate) fn session_index_refresh_due(&self, provider: ProviderId) -> bool {
        self.session_index_refreshes
            .get(&provider)
            .is_none_or(|last| {
                current_epoch()
                    .saturating_sub(*last)
                    .ge(&SESSION_INDEX_REFRESH_INTERVAL_SECONDS)
            })
    }

    pub(crate) fn refresh_session_index_provider(&mut self, provider: ProviderId) -> Result<()> {
        let entries = {
            let projects = {
                let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
                self.local_store.projects()?
            };
            if projects.is_empty() {
                Vec::new()
            } else {
                let project_cwds = projects
                    .iter()
                    .map(|project| project.cwd.as_str())
                    .collect::<HashSet<_>>();
                let provider_port = self.provider(provider)?;
                let mut entries = Vec::new();
                for project in &projects {
                    entries.extend(paginated_index_entries(
                        provider_port.as_mut(),
                        provider,
                        Some(&project.cwd),
                    )?);
                }
                entries
                    .into_iter()
                    .filter(|entry| project_cwds.contains(entry.cwd.as_str()))
                    .collect::<Vec<_>>()
            }
        };
        self.session_index_refreshes
            .insert(provider, current_epoch());
        let revision = {
            let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
            self.local_store
                .replace_session_index_provider(provider, &entries)?
        };
        if let Some(revision) = revision {
            self.event_buffer.emit(
                provider,
                RuntimeEventKind::SessionsIndexChanged,
                None,
                json!({ "revision": revision }),
            );
        }
        Ok(())
    }

    /// Refreshes cwd suggestions for all providers.
    ///
    /// # Errors
    ///
    /// Returns an error when a provider refresh fails.
    pub fn refresh_project_suggestions(&mut self) -> Result<()> {
        let mut first_error = None;
        for provider in providers_from_target("all")? {
            if let Err(error) = self.refresh_project_suggestions_provider(provider)
                && first_error.is_none()
            {
                first_error = Some(error);
            }
        }
        if let Some(error) = first_error {
            return Err(error);
        }
        Ok(())
    }

    fn refresh_project_suggestions_provider(&mut self, provider: ProviderId) -> Result<()> {
        let provider_port = self.provider(provider)?;
        let entries = paginated_index_entries(provider_port.as_mut(), provider, None)?;
        let mut cwds = entries
            .into_iter()
            .map(|entry| entry.cwd)
            .collect::<HashSet<_>>()
            .into_iter()
            .collect::<Vec<_>>();
        cwds.sort();
        let _store_lock = self.store_lock.lock().map_err(store_lock_error)?;
        self.local_store
            .replace_project_suggestions_provider(provider, &cwds)?;
        Ok(())
    }
}

impl ProjectSuggestionsQuery {
    fn from_params(params: &Value) -> Result<Self> {
        let query = optional_string_param("projects/suggestions", params, "query")?
            .map(|value| value.trim().to_owned())
            .filter(|value| !value.is_empty());
        let limit = match optional_u64_param("projects/suggestions", params, "limit")? {
            Some(value) => usize::try_from(value)
                .unwrap_or(MAX_PROJECT_SUGGESTIONS_LIMIT)
                .clamp(1, MAX_PROJECT_SUGGESTIONS_LIMIT),
            None => DEFAULT_PROJECT_SUGGESTIONS_LIMIT,
        };
        Ok(Self { query, limit })
    }
}
