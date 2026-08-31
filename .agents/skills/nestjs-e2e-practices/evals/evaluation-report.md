# Evaluation Report

The skill was evaluated with independent task runs using `openai/gpt-5.6-luna`. Each behavioral
prompt was run once with the skill and once without it. The triggering evaluation used OpenCode
`1.18.4` with the skill directory configured as a project skill path.

## Behavioral Evaluation

| Evaluation                               | With skill | Baseline  | Material difference                                                 |
| ---------------------------------------- | ---------- | --------- | ------------------------------------------------------------------- |
| Auth and users structure                 | 7/7        | 7/7       | Both covered the core structure; the skill made ownership explicit  |
| Forgot-password email boundary           | 5/5        | 5/5       | Both isolated transport; the skill made residual scope explicit     |
| Duplicate discovery, fixtures, contracts | 6/6        | 5/6       | The skill preserved centralized cleanup and all required assertions |
| Pure unit-test boundary                  | 1/1        | 1/1       | Both correctly avoided E2E infrastructure                           |
| **Total**                                | **19/19**  | **18/19** | The skill's main discriminator was centralized lifecycle ownership  |

The full benchmark, grading files, and static viewer are in the external workspace at
`../nestjs-e2e-practices-workspace/iteration-1/`.

## OpenCode Triggering Evaluation

The official `skill-creator` triggering scripts invoke `claude -p` and are not compatible with the
user's Codex/OpenCode workflow. A small external harness detected OpenCode's actual `skill` tool
event instead. It ran each of the 20 queries three times, for 60 total runs.

| Iteration | Description change                                          | Result |
| --------- | ----------------------------------------------------------- | ------ |
| 1         | Original description                                        | 19/20  |
| 2         | Added the source-accessible and deployed-black-box boundary | 20/20  |

The only iteration-1 false positive was a Cypress test against a deployed API without NestJS source
or database access. The final description now excludes that black-box scenario while retaining
support for source-accessible NestJS HTTP E2E work.

Triggering evidence and the OpenCode harness are in
`../nestjs-e2e-practices-workspace/triggering/opencode-iteration-2/`.

## Human Review

The user accepted the generated viewer and evaluation results, then formally accepted the final
implementation. The later description change was driven by the OpenCode triggering result and
generalized the boundary instead of adding a query-specific exception.

## Limitations

- The behavioral task runner did not expose duration or token metrics, so those fields remain
  unavailable in the behavioral benchmark.
- The triggering result measures OpenCode `1.18.4` with the configured OpenAI model; it is not a
  Claude Code or Codex triggering measurement.
- The official Claude-only optimization loop was not used because the user does not use Claude.

## Current Behavioral Evaluation (2026-08-30)

This current run used independent Pi subagents with `openai-codex/gpt-5.6-terra`. For each case, one
runner received the skill and one was a baseline; runners were prohibited from reading evaluation
definitions or reports. Results were graded objectively against `evals.json` expectations.

### Initial Runs

| Case      | With skill   | Baseline     | Result note                                                                       |
| --------- | ------------ | ------------ | --------------------------------------------------------------------------------- |
| 5         | Passed (3/3) | Passed (3/3) | Executed                                                                          |
| 6         | Passed (3/3) | Passed (3/3) | Executed                                                                          |
| 7         | Passed (3/3) | Passed (3/3) | Executed                                                                          |
| 8         | Failed (2/3) | Failed (2/3) | Both omitted typed context                                                        |
| 9         | Failed (3/4) | Passed (4/4) | Skill omitted deterministic setup                                                 |
| 10        | Passed (3/3) | Failed (2/3) | Baseline omitted the explicit HTTP/public boundary                                |
| 11        | Failed (2/3) | Failed (0/3) | Skill omitted the persisted-effect alternative; baseline retained an internal spy |
| 12        | Passed (3/3) | Passed (3/3) | Executed                                                                          |
| **Total** | **22/24**    | **20/24**    | **All cases executed once**                                                       |

### Focused Reruns After Quick Reference Navigation Refinements

Fresh `explore` subagents read `SKILL.md` and the relevant cards before rerunning cases 8, 9,
and 11. No baseline was rerun for this focused iteration.

| Case | With skill   | Baseline     | Evidence                                                                                          |
| ---- | ------------ | ------------ | ------------------------------------------------------------------------------------------------- |
| 8    | Passed (3/3) | Not executed | Explicit typed auth-flow context                                                                  |
| 9    | Passed (4/4) | Not executed | Explicit deterministic, minimal, reproducible, isolated real-persistence seed and HTTP assertions |
| 11   | Passed (3/3) | Not executed | Public response/forbidden fields and optional GET persisted effect                                |

### Final Affected-Case Status

| Cases | With skill                                                             | Baseline                                                                        | Blocked |
| ----- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------- |
| 5–12  | All executed and passed; cases 8, 9, and 11 passed after focused rerun | Executed once for every case; focused reruns for 8, 9, and 11 were not executed | None    |

### Current-Run Limitations

- This run used Pi subagents and the current model, not the missing historical OpenCode external
  harness; the historical workspace was not recreated.
- Raw task outputs existed only as temporary local evidence and are not packaged.
- Each result is a single run and is subject to stochasticity.
- No duration or token benchmark was collected beyond tool-reported session metadata.
