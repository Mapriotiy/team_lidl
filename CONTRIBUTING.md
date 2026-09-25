# Contribution guide

## Working agreement

- `main` is the integration and release branch. There is no long-lived `develop` branch.
- Every implementation or documentation change goes through a focused pull request.
- Use short-lived branches, one concern per PR, and squash merges into `main`.
- Claim a work item before editing. Identify the primary reviewer and shared files in the PR.
- Open a draft PR early when contracts or shared files need feedback.
- Raise blockers promptly. Prefer a small complete flow over disconnected partial features.
- Use neutral, task-based names in branches, commits, documentation, and PRs. Do not add tool branding or generated attribution footers. Preserve truthful contributor identity.

## Branch names

Use `<type>/<short-description>` or `<type>/<issue-number>-<short-description>`:

```text
feat/service-profiles
feat/12-company-evidence
fix/duplicate-signal-scoring
docs/execution-playbook
chore/project-scaffold
```

Allowed types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `perf`, `build`, `revert`.

Start from the latest `main`:

```bash
git switch main
git pull --ff-only origin main
git switch -c feat/service-profiles
```

Do not bundle unrelated cleanup with a feature. Aim for a PR that another contributor can review in 10–15 minutes; split larger changes at working boundaries.

## Commit and PR titles

Use Conventional Commits for commits and PR titles:

```text
<type>(<optional-scope>): <imperative description>
```

Examples:

```text
feat(profiles): add editable service questions
feat(research): persist source excerpts
fix(scoring): count syndicated news as one event
docs: document local setup
ci: validate pull request titles
```

Use `feat` for new behavior and `fix` for incorrect behavior. Use `refactor` when behavior is unchanged. Keep titles specific; avoid `updates`, `final changes`, or `stuff`.

Breaking contracts use `!`, such as `feat(api)!: replace opportunity response`, and a `BREAKING CHANGE:` explanation in the description. During the hackathon, coordinate consumer changes before merging a breaking contract.

The squash commit must use the final PR title. Rewrite the PR description when the implementation changes scope.

## Updating a branch

Fetch and integrate `origin/main` before requesting final review. Rebase a branch only when you are its sole contributor. Coordinate first if anyone else uses it.

```bash
git fetch origin
git rebase origin/main
```

If a previously pushed personal branch was rebased, use `git push --force-with-lease`, never plain `--force`. Never rewrite `main`. For a shared feature branch, merge `origin/main` into it instead of rewriting colleagues' history.

After a PR is squash-merged, start new work from updated `main`; do not reuse the old feature branch.

## Pull request requirements

The PR template is the handoff. Include the problem, resulting behavior, exact validation performed, and any remaining limitations. Add screenshots for meaningful UI changes and sample responses for contract changes.

Before requesting review:

1. Review the entire diff for accidental files, unrelated edits, credentials, and misleading claims.
2. Run the checks relevant to the change. Write down results; do not claim unrun tests passed.
3. Confirm migrations and API consumers agree with the change.
4. Exercise loading, empty, failure, and partial-result states when applicable.
5. Update setup instructions or contracts when behavior changes.

One teammate reviews each PR. Select a reviewer familiar with the neighboring layer. Authors do not approve their own PRs. Reviewers check correctness, user-visible behavior, evidence integrity, and scope before style preferences.

## Merge and release

1. Resolve review discussions and obtain one teammate's approval.
2. Confirm required checks pass on the latest revision and the branch meets the configured up-to-date requirement.
3. Select **Squash and merge**. Verify the resulting commit title follows the convention.
4. Delete the remote feature branch after merge.
5. Confirm the integrated application still deploys and complete the relevant smoke check.

If a merged change breaks the demo, revert its squash commit through a focused PR, or ship a small reviewed fix. Do not reset or force-push `main`. Avoid destructive database changes; prefer additive migrations with a recovery plan.

At feature freeze, record the release candidate commit in the team handoff. Tag the tested final commit `v0.1.0-demo` after validation. Tags identify tested code; they are not a substitute for a deployment check.

## Repository settings checklist

These are intended settings, **not a claim that they have been applied**. A repository administrator should confirm them before the first implementation merge.

- [ ] Allow squash merging; disable merge commits and rebase merging for PRs.
- [ ] Set the default squash message to PR title and description.
- [ ] Enable automatic deletion of merged branches.
- [ ] Protect `main` with a ruleset requiring pull requests and one approval.
- [ ] Dismiss stale approvals when new commits are pushed; require conversation resolution.
- [ ] Require linear history; block force pushes and branch deletion.
- [ ] Require branches to be up to date before merging.
- [ ] Restrict bypass access to the designated maintainer; document any emergency bypass.
- [ ] Enable the `PR title` required check after its first successful run.
- [ ] Add application lint, type, test, and build checks after the scaffold provides real commands.

Availability of protections depends on repository visibility and the GitHub plan. If a setting is unavailable, record that limitation and follow the same review procedure manually.

The included workflow checks PR titles only. It does not enforce squash merging, reviews, or application correctness; those require repository settings and later CI jobs.

## Secrets and source material

Keep credentials in local environment files or deployment secrets. Commit only placeholder values in `.env.example`. Never commit API keys, personal access tokens, production exports, or unrestricted research dumps. If a credential is exposed, rotate it; deleting the file alone does not remove the exposure.

## References

- [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
- [GitHub squash merge configuration](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/configuring-commit-squashing-for-pull-requests)
