//! Generates the TypeScript app protocol boundary package.

mod contracts;

use std::env;
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
    fs::write(path, contracts::generate_typescript())?;
    Ok(())
}

fn check_generated_file() -> Result<(), Box<dyn Error>> {
    let path = generated_path()?;
    let current = fs::read_to_string(&path)?;
    let generated = contracts::generate_typescript();
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
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let Some(root) = manifest_dir.ancestors().nth(4) else {
        return Err(invalid_args("could not resolve repository root"));
    };
    Ok(root.to_path_buf())
}

fn invalid_args(message: &str) -> Box<dyn Error> {
    Box::new(std::io::Error::new(
        std::io::ErrorKind::InvalidInput,
        message.to_owned(),
    ))
}
