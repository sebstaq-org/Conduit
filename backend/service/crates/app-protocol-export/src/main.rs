//! Generates the TypeScript app protocol boundary package.

mod contracts;
#[cfg(test)]
mod contracts_tests;

use std::env::{self, current_dir};
use std::error::Error;
use std::fs;
use std::path::{Path, PathBuf};

const GENERATED_RELATIVE_PATH: &str = "packages/app-protocol/src/generated.ts";

fn main() -> Result<(), Box<dyn Error>> {
    let mut args = env::args();
    let _binary = args.next();
    let Some(command) = args.next() else {
        return Err(invalid_args("expected command: generate or check"));
    };
    if args.next().is_some() {
        return Err(invalid_args("expected a single command"));
    }

    match command.as_str() {
        "generate" => write_generated_file(),
        "check" => check_generated_file(),
        _ => Err(invalid_args("expected command: generate or check")),
    }
}

fn write_generated_file() -> Result<(), Box<dyn Error>> {
    let path = generated_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, contracts::generate_typescript()?)?;
    Ok(())
}

fn check_generated_file() -> Result<(), Box<dyn Error>> {
    let path = generated_path()?;
    let current = fs::read_to_string(&path)?;
    let generated = contracts::generate_typescript()?;
    if current == generated {
        return Ok(());
    }

    Err(invalid_args(
        "packages/app-protocol/src/generated.ts is stale; run pnpm run protocol:generate",
    ))
}

fn generated_path() -> Result<PathBuf, Box<dyn Error>> {
    Ok(repo_root()?.join(GENERATED_RELATIVE_PATH))
}

fn repo_root() -> Result<PathBuf, Box<dyn Error>> {
    let cwd = current_dir()?;
    if let Some(root) = discover_repo_root(&cwd) {
        return Ok(root);
    }

    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let Some(root) = discover_repo_root(manifest_dir) else {
        return Err(invalid_args("could not resolve repository root"));
    };
    Ok(root)
}

fn discover_repo_root(start: &Path) -> Option<PathBuf> {
    start
        .ancestors()
        .find(|candidate| {
            candidate.join("package.json").is_file()
                && candidate.join("backend/service/Cargo.toml").is_file()
        })
        .map(Path::to_path_buf)
}

fn invalid_args(message: &str) -> Box<dyn Error> {
    Box::new(std::io::Error::new(
        std::io::ErrorKind::InvalidInput,
        message.to_owned(),
    ))
}
