---
status: accepted
date: 2026-11-24
deciders: the template's maintainer chose the three client layers and the anti-corruption layer
---

# The client is layered, with an anti-corruption layer around AppKit

## Context and Problem Statement

AppKit generates TypeScript types for each SQL query's rows and gives React hooks that return those rows. The rows have the warehouse's shape: its column names, nulls and encodings. If components use the rows directly, every change to a query or table reaches into the user interface, and business rules end up spread across components. How should client code be organized so that the warehouse's model stays out of the app's own?

## Decision Drivers

- Keep the warehouse's data model from leaking into components and business rules.
- Let business rules be tested in plain TypeScript, without React, AppKit or a browser.
- Make the boundaries checkable by tools, so that agents and people both keep to them.

## Considered Options

1. Three layers in `client/src/`: a view (components and pages), an application layer (`hooks/`, plus `acl/` as the only code that touches AppKit's generated types and data hooks), and a domain of immutable plain TypeScript.
2. No layers in `client/src/`: components call AppKit's hooks and use the generated rows directly, as AppKit's template does.

## Decision Outcome

Chosen: option 1. Separating presentation from domain lets each be reasoned about on its own ([Fowler, Presentation Domain Data Layering](https://martinfowler.com/bliki/PresentationDomainDataLayering.html)). An adapter layer between two models with different meanings keeps either from corrupting the other ([Microsoft, Anti-corruption Layer pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/anti-corruption-layer)). Option 2 lost because it leaves no place for rules outside components, and nothing stops rows from spreading. The layers, their rules and the exceptions are in `docs/design/architecture.md`.

Confidence: the layers and their import rules are in place, and the boundary checks run in `check`. No record compares the cost of the extra mapping code against option 2 in a real project.

### Consequences

- Good, because a query or table change touches one `acl/` hook, and domain rules are tested without a browser.
- Bad, because every data need costs a hook and a mapping function, even when the rows would do as they are.
- Bad, because AppKit's chart and table components fetch for themselves, so they are a documented exception that maintainers must keep narrow.

### Confirmation

`check` runs both. dependency-cruiser's `generated-types-only-in-acl` rule fails when code outside `client/src/acl/` imports AppKit's generated types. `domain-imports-nothing-above-it` and `domain-not-framework` fail when the domain imports another layer, React, AppKit or browser code, and `application-not-view` and `acl-not-hooks` keep the application layer's imports pointing down. The ast-grep rule `appkit-data-hooks-only-in-acl` fails when code outside `client/src/acl/` calls AppKit's data hooks. Import paths alone can't tell those hooks apart from the rest of AppKit's UI package.

## More Information

When server code needs the domain's rules, the domain moves to `shared/domain/` (see `docs/design/architecture.md`). Bounded contexts, when a team adopts them, add rules between contexts on top of these layers.
