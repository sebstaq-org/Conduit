use super::SdkHostActor;
use crate::error::{AcpError, Result};
use crate::initialize::{
    ProviderInitializeRequest, ProviderInitializeResponse, ProviderInitializeResult,
};
use agent_client_protocol::{self as acp, Agent as _};

impl SdkHostActor {
    pub(super) fn initialize_result(&self) -> Option<ProviderInitializeResult> {
        self.initialize_result.clone()
    }

    pub(super) async fn initialize(
        &mut self,
        request: ProviderInitializeRequest,
    ) -> Result<ProviderInitializeResult> {
        if let Some(result) = &self.initialize_result {
            return Ok(result.clone());
        }
        let response = self
            .connection()?
            .initialize(request.to_sdk_request())
            .await
            .map_err(|source| super::sdk_error(self.provider, "initialize", source))?;
        let result = ProviderInitializeResult {
            request,
            response: ProviderInitializeResponse::from_sdk_response(response),
        };
        self.initialize_result = Some(result.clone());
        Ok(result)
    }

    pub(super) fn initialized_connection(
        &self,
        operation: &'static str,
    ) -> Result<&acp::ClientSideConnection> {
        if self.initialize_result.is_none() {
            return Err(AcpError::NotInitialized {
                provider: self.provider,
                operation: operation.to_owned(),
            });
        }
        self.connection()
    }
}
