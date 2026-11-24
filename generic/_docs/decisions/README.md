# Architecture decision records

This folder holds the few decisions that shape the whole system: the ones that
would take rewriting a layer, or every feature, to undo. Each record states the
decision, which options were weighed, why the chosen one won, and what it
costs.

Most decisions don't belong here. A library or tool choice, a coding rule, a
convention, a plan or an unanswered question each has another home: the design
documents in `docs/design/`, the [plan](../plan.md), or the
[open questions](../open-questions.md). Write a record with the `adr` skill,
which holds the test a decision must pass to earn one.

A record that stops being true is replaced by a new record with the next number
and deleted, never kept and marked as superseded. Numbers are never reused.

| Number                                                    | Decision                                                           | Status   |
| --------------------------------------------------------- | ------------------------------------------------------------------ | -------- |
| [0001](0001-single-page-app-on-appkit-express-server.md)  | The app is a single-page app on AppKit's Express server            | accepted |
| [0002](0002-layered-client-with-anti-corruption-layer.md) | The client is layered, with an anti-corruption layer around AppKit | accepted |
