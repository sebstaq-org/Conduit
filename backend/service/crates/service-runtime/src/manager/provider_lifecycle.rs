use super::ServiceRuntime;
use crate::{ProviderFactory, ProviderPort, Result, RuntimeError};
use acp_core::{ConnectionState, ProviderInitializeRequest, ProviderInitializeResult};
use acp_discovery::ProviderId;

impl<F> ServiceRuntime<F>
where
    F: ProviderFactory,
{
    pub(crate) fn provider(&mut self, provider: ProviderId) -> Result<&mut Box<dyn ProviderPort>> {
        self.remove_disconnected_provider(provider);
        if !self.providers.contains_key(&provider) {
            let service = self.factory.connect(provider)?;
            self.providers.insert(provider, service);
        }
        self.providers
            .get_mut(&provider)
            .ok_or_else(|| RuntimeError::Provider("provider manager lost provider".to_owned()))
    }

    pub(crate) fn initialized_provider(
        &mut self,
        provider: ProviderId,
    ) -> Result<&mut Box<dyn ProviderPort>> {
        let provider_port = self.provider(provider)?;
        initialize_provider_port(provider_port.as_mut())?;
        Ok(provider_port)
    }

    fn take_provider(&mut self, provider: ProviderId) -> Result<Box<dyn ProviderPort>> {
        self.remove_disconnected_provider(provider);
        if !self.providers.contains_key(&provider) {
            let service = self.factory.connect(provider)?;
            self.providers.insert(provider, service);
        }
        self.providers
            .remove(&provider)
            .ok_or_else(|| RuntimeError::Provider("provider manager lost provider".to_owned()))
    }

    pub(crate) fn take_initialized_provider(
        &mut self,
        provider: ProviderId,
    ) -> Result<Box<dyn ProviderPort>> {
        let mut provider_port = self.take_provider(provider)?;
        initialize_provider_port(provider_port.as_mut())?;
        Ok(provider_port)
    }

    fn remove_disconnected_provider(&mut self, provider: ProviderId) {
        if !self
            .providers
            .get(&provider)
            .is_some_and(|entry| entry.snapshot().connection_state == ConnectionState::Disconnected)
        {
            return;
        }
        self.providers.remove(&provider);
        self.loaded_provider_sessions
            .retain(|key| key.provider != provider);
        self.session_states
            .retain(|key, _state| key.provider != provider);
    }
}

pub(super) fn initialize_provider_port(
    provider_port: &mut dyn ProviderPort,
) -> Result<ProviderInitializeResult> {
    if let Some(result) = provider_port.initialize_result()? {
        return Ok(result);
    }
    provider_port.initialize(ProviderInitializeRequest::conduit_default())
}
