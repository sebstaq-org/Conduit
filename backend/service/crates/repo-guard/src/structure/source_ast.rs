//! AST-backed Rust source policy checks.

use std::collections::HashSet;
use syn::visit::{self, Visit};
use syn::{
    Attribute, Expr, ExprCall, File, Ident, Item, ItemFn, ItemMod, ItemStatic, ItemUse, UseTree,
    Visibility,
};

const OUTPUT_FUNCTIONS: [&str; 2] = ["stderr", "stdout"];

pub(super) fn check_ast(relative: &str, syntax: &File, failures: &mut Vec<String>) {
    check_file_suppressions(relative, syntax, failures);
    let scope = ModuleScope::from_items(&syntax.items, failures, relative);
    check_items(relative, &syntax.items, &scope, failures);
}

fn check_file_suppressions(relative: &str, syntax: &File, failures: &mut Vec<String>) {
    if has_forbidden_suppression(&syntax.attrs) {
        failures.push(format!(
            "{relative} uses forbidden crate-wide lint suppression."
        ));
    }
}

fn check_items(relative: &str, items: &[Item], scope: &ModuleScope, failures: &mut Vec<String>) {
    for item in items {
        match item {
            Item::Fn(item_fn) => check_item_fn(relative, item_fn, scope, failures),
            Item::ForeignMod(_) => {
                failures.push(format!("{relative} uses forbidden extern/FFI syntax."))
            }
            Item::Mod(item_mod) => check_module(relative, item_mod, failures),
            Item::Static(item_static) => check_static(relative, item_static, failures),
            Item::Use(item_use) => check_public_glob(relative, item_use, failures),
            other => {
                let mut visitor = OutputVisitor::new(relative, scope.clone(), failures);
                visitor.visit_item(other);
            }
        }
    }
}

fn check_item_fn(
    relative: &str,
    item_fn: &ItemFn,
    scope: &ModuleScope,
    failures: &mut Vec<String>,
) {
    if item_fn.sig.abi.is_some() {
        failures.push(format!("{relative} uses forbidden extern/FFI syntax."));
    }

    let mut visitor = OutputVisitor::new(relative, scope.clone(), failures);
    visitor.visit_item_fn(item_fn);
}

fn check_module(relative: &str, item_mod: &ItemMod, failures: &mut Vec<String>) {
    if has_forbidden_suppression(&item_mod.attrs) {
        failures.push(format!(
            "{relative} uses forbidden module-wide lint suppression."
        ));
    }

    if let Some((_, items)) = &item_mod.content {
        let nested_scope = ModuleScope::from_items(items, failures, relative);
        check_items(relative, items, &nested_scope, failures);
    }
}

fn check_static(relative: &str, item_static: &ItemStatic, failures: &mut Vec<String>) {
    if matches!(item_static.mutability, syn::StaticMutability::Mut(_)) {
        failures.push(format!("{relative} uses forbidden mutable static state."));
    }
}

fn check_public_glob(relative: &str, item_use: &ItemUse, failures: &mut Vec<String>) {
    if !matches!(item_use.vis, Visibility::Public(_)) {
        return;
    }

    if tree_has_glob(&item_use.tree) {
        failures.push(format!("{relative} uses forbidden wildcard re-export."));
    }
}

fn has_forbidden_suppression(attributes: &[Attribute]) -> bool {
    attributes.iter().any(is_suppression_attribute)
}

fn is_suppression_attribute(attribute: &Attribute) -> bool {
    attribute.path().is_ident("allow") || attribute.path().is_ident("expect")
}

fn tree_has_glob(tree: &UseTree) -> bool {
    match tree {
        UseTree::Glob(_) => true,
        UseTree::Group(group) => group.items.iter().any(tree_has_glob),
        UseTree::Path(path) => tree_has_glob(&path.tree),
        UseTree::Name(_) | UseTree::Rename(_) => false,
    }
}

#[derive(Clone, Default)]
struct ModuleScope {
    io_aliases: HashSet<String>,
    output_aliases: HashSet<String>,
}

impl ModuleScope {
    fn from_items(items: &[Item], failures: &mut Vec<String>, relative: &str) -> Self {
        let mut scope = Self::default();
        for item in items {
            if let Item::Use(item_use) = item {
                collect_use_tree(
                    &item_use.tree,
                    &mut Vec::new(),
                    &mut scope,
                    failures,
                    relative,
                );
            }
        }
        scope
    }
}

fn collect_use_tree(
    tree: &UseTree,
    prefix: &mut Vec<String>,
    scope: &mut ModuleScope,
    failures: &mut Vec<String>,
    relative: &str,
) {
    match tree {
        UseTree::Group(group) => {
            for item in &group.items {
                collect_use_tree(item, prefix, scope, failures, relative);
            }
        }
        UseTree::Path(path) => {
            prefix.push(path.ident.to_string());
            collect_use_tree(&path.tree, prefix, scope, failures, relative);
            let _ = prefix.pop();
        }
        UseTree::Name(name) => register_use(
            joined_path(prefix, &name.ident),
            local_use_name(prefix, &name.ident, None),
            scope,
            relative,
            failures,
        ),
        UseTree::Rename(rename) => register_use(
            joined_path(prefix, &rename.ident),
            local_use_name(prefix, &rename.ident, Some(&rename.rename)),
            scope,
            relative,
            failures,
        ),
        UseTree::Glob(_) => {}
    }
}

fn register_use(
    full: Vec<String>,
    local_name: String,
    scope: &mut ModuleScope,
    relative: &str,
    failures: &mut Vec<String>,
) {
    if is_io_module_path(&full) {
        scope.io_aliases.insert(local_name);
        return;
    }

    if is_output_function_path(&full) {
        scope.output_aliases.insert(local_name);
        failures.push(format!(
            "{relative} directly imports forbidden stdout/stderr emission helpers."
        ));
    }
}

fn joined_path(prefix: &[String], ident: &Ident) -> Vec<String> {
    let mut full = prefix.to_vec();
    full.push(ident.to_string());
    full
}

fn local_use_name(prefix: &[String], ident: &Ident, rename: Option<&Ident>) -> String {
    if let Some(rename) = rename {
        return rename.to_string();
    }

    if ident == "self" {
        return prefix.last().cloned().unwrap_or_default();
    }

    ident.to_string()
}

fn is_io_module_path(path: &[String]) -> bool {
    matches!(path, [std, io] if std == "std" && io == "io")
        || matches!(path, [std, io, current] if std == "std" && io == "io" && current == "self")
}

fn is_output_function_path(path: &[String]) -> bool {
    matches!(path, [std, io, function] if std == "std" && io == "io" && is_output_name(function))
}

fn is_output_name(segment: &str) -> bool {
    OUTPUT_FUNCTIONS.contains(&segment)
}

struct OutputVisitor<'a> {
    failures: &'a mut Vec<String>,
    relative: &'a str,
    scope: ModuleScope,
}

impl<'a> OutputVisitor<'a> {
    fn new(relative: &'a str, scope: ModuleScope, failures: &'a mut Vec<String>) -> Self {
        Self {
            failures,
            relative,
            scope,
        }
    }

    fn direct_output_call(&self, expression: &Expr) -> bool {
        let Expr::Path(path) = expression else {
            return false;
        };
        let segments = path
            .path
            .segments
            .iter()
            .map(|segment| segment.ident.to_string())
            .collect::<Vec<_>>();

        match segments.as_slice() {
            [std, io, function] => std == "std" && io == "io" && is_output_name(function),
            [alias, function] => self.scope.io_aliases.contains(alias) && is_output_name(function),
            [alias] => self.scope.output_aliases.contains(alias),
            _ => false,
        }
    }
}

impl<'ast> Visit<'ast> for OutputVisitor<'_> {
    fn visit_expr_call(&mut self, node: &'ast ExprCall) {
        if self.direct_output_call(&node.func) {
            self.failures.push(format!(
                "{} directly emits to forbidden stdout/stderr output.",
                self.relative
            ));
        }

        visit::visit_expr_call(self, node);
    }
}
