//! Session browser product read-model commands.

use crate::command::ConsumerResponse;
use crate::error::{path_param, string_param};
use crate::event::RuntimeEventKind;
use crate::manager::{ServiceRuntime, store_lock_error};
use crate::manager_helpers::{absolute_normalized_cwd, current_epoch, paginated_index_entries};
use crate::session_groups::{SessionGroupsQuery, grouped_view, providers_from_target};
use crate::{ProviderFactory, Result};
use acp_discovery::ProviderId;
use serde_json::{Value, json, to_value};
use session_store::ProjectRow;
use std::collections::HashSet;

const SESSION_INDEX_REFRESH_INTERVAL_SECONDS: u64 = 30;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectListView {
    projects: Vec<ProjectRow>,
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
}
