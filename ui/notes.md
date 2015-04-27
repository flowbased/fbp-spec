
Usecases/requirements
---------
Grouped by functional area. Ordered roughly in order of importance (within groups, between groups).
Many of these overlap strongly with the general needs when developing and debugging.

Basic

- See existing testcases for a component/graph. Names/asserts
- Look at a test as example usage of component. Fixture, input/output
- ? See all tests in a project (regardless of their topic)

Making changes

- Add a new testcase, test suite
- Changing testcase description. Name/assertion
- Change testcase input/expected data
- Change test suite fixture graph
- Marking/unmarking a test case or suite as skipped
- Delete a testcase, test suite
- Rename a component and its associated test suite
- Changing testcase input temporarily, revert back to original

Running

- Run all tests in project explicitly/manually
- Run a particular test explicitly/manually
- Run only tests matching a search "grep"
- Run all in project tests automatically after change

Results

- Know if a particular version of project passes tests locally
- See how a particular test run failed. Compare expected/actual values of run
- (v2) Compare results of two different test runs

Debugging

- See data flowing through network for a test run
- Able to go into graphs of network, see data
- (v2) Compare data in network between two runs
- (v2) Ability to set data-breakpoints on edge

Retroactive debugging

- (v2) Open a flowtrace from a failing test, debug as if ran interactively

Continious Integration

- (v2?) Know if a particular version of code passes in CI env
- (v2) See details of CI results

Searching

- ? finding a particular test case by looking up on data or description (name/assertion)

Implementation
--------------

- Reusing Runner code from CLI tool.
For maximum compatibility between interactive/UI and non-interative/CLI
- fbp-spec UI library
    - showing & editing testcases
    - showing results overview
- Collaborates with other UI libraries
    - Graph visualization/editing: the-graph
    - Data/packet editing & comparison. Extract from noflo-ui/node-inspector: the-data?
    Individual editors/comparators should be plugins.
    Should have small on-canvas representation, and (full) details view?
    - Program introspection. Maybe extract from noflo-ui?: the-timeline?
- Integrated into IDE (Flowhub).


UI pieces
---------
Sorted by level-of-detail.
Should be able to navigate into (more details) and up (less details).
Some levels might be visible at the same time on desktop view.

(0) Project overview

- Test status. Green/red, N pass/fail
- CI status. Green/red, N pass/fail
- Component/graph listing
- Run all tests in project

(1) Topic overview

- Test case listing, grouped by suite. Suite names
- Test names+assertion, status (pass/fail). Read-only
- Run all test for topic

(2) Test details

- Fixture graph. Editable (behind lock?)
- Expected values
- Run a single test

(3) Program / test-run details

- Navigate into subgraphs/components
- Network/edge data introspection

