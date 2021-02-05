const core = require('@actions/core')
const github = require('@actions/github')

// check if this is running on a pull request
if (!github.context.payload.pull_request) {
  return core.setOutput('passed', true)
}

const token = core.getInput('githubToken');
const context = github.context
const octokit = github.getOctokit(token)

const hasSomeInput = core.getInput('hasSome')
const hasAllInput = core.getInput('hasAll')
const hasNoneInput = core.getInput('hasNone')
const hasNotAllInput = core.getInput('hasNotAll')

const hasSomeLabels = hasSomeInput.split(',')
const hasAllLabels = hasAllInput.split(',')
const hasNoneLabels = hasNoneInput.split(',')
const hasNotAllLabels = hasNotAllInput.split(',')

const failMessages = []


const prLabels = context.payload.pull_request.labels.map(item => item.name)

const hasSomeResult = !hasSomeInput || hasSomeLabels.some((label) =>
  prLabels.includes(label)
)

const hasAllResult = !hasAllInput || hasAllLabels.every((label) =>
  prLabels.includes(label)
)

const hasNoneResult = !hasNoneInput || hasNoneLabels.every((label) =>
  !prLabels.includes(label)
)

const hasNotAllResult = !hasNotAllInput || hasNotAllLabels.some((label) =>
  !prLabels.includes(label)
)

if (!hasSomeResult) {
  failMessages.push(`The PR needs to have at least one of the following labels to pass this check: ${hasSomeLabels.join(
    ', '
  )}`)
}

if (!hasAllResult) {
  failMessages.push(`The PR needs to have all of the following labels to pass this check: ${hasAllLabels.join(
    ', '
  )}`)
}

if (!hasNoneResult) {
  failMessages.push(`The PR needs to have none of the following labels to pass this check: ${hasNoneLabels.join(
    ', '
  )}`)
}

if (!hasNotAllResult) {
  failMessages.push(`The PR needs to not have at least one of the following labels to pass this check: ${hasNotAllLabels.join(
    ', '
  )}`)
}

async function run () {
  const params = {
    ...context.repo,
    head_branch: context.payload.pull_request.head.ref,
    head_sha: context.payload.pull_request.head.sha,
    name: `${context.job}`,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  }

  // console.log(context.payload.pull_request.merge_commit_sha)
  // console.log(failMessages)

  const checks = await octokit.checks.listForRef({
    ...context.repo,
    ref: context.payload.pull_request.head.ref,
  });

  console.log(JSON.stringify(checks.data.check_runs))

  const checkRunIds = checks.data.check_runs.filter(check => check.name === context.job).map(check => check.id)
  console.log(checkRunIds)

  // const checksSha = await octokit.checks.listForRef({
  //   ...context.repo,
  //   ref: context.payload.pull_request.head.sha,
  // });

  // console.log(JSON.stringify(checksSha.data.check_runs))

  if (failMessages.length) {
    console.log(failMessages)
    // const check = await octokit.checks.create({
    //   ...params,
    //   external_id: context.job,
    //   status: 'completed',
    //   conclusion: 'failure',
    //   output: {
    //     title: 'Labels did not pass provided rules',
    //     summary: failMessages.join('. ')
    //   }
    // })

    for (const id of checkRunIds) {
      await octokit.checks.update({
        ...context.repo,
        check_run_id: id,
        conclusion: 'failure',
        output: {
          title: 'Labels did not pass provided rules',
          summary: failMessages.join('. ')
        }
      })
    }

    // core.info(JSON.stringify(check))

    core.info(failMessages.join('. '))
    core.setFailed(failMessages.join('. '))
  } else {
    // const check = await octokit.checks.create({
    //   ...params,
    //   status: 'completed',
    //   conclusion: 'success',
    //   output: {
    //     title: 'Labels follow all the provided rules',
    //     summary: ''
    //   }
    // })

    for (const id of checkRunIds) {
      await octokit.checks.update({
        ...context.repo,
        check_run_id: id,
        conclusion: 'success',
        output: {
          title: 'Labels follow all the provided rules',
          summary: ''
        }
      })
    }

    // core.info(JSON.stringify(check))
    core.info('passed: true')

    core.setOutput('passed', true)
  }
}

run()
